import { useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useAuth } from '@/layouts/RootLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ApperIcon from '@/components/ApperIcon';
import { formatRelativeTime } from '@/utils/date';

export const route = { path: '/revision', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Revision centre', icon: 'CalendarClock', group: 'Improve', order: 70 };

const MASTERY_TARGET = 0.7;
const RECALL_OPTIONS = ['Again', 'Hard', 'Good', 'Easy'];
const EMPTY_PLAN = { due: [], scheduled: [], candidates: [] };

const lookupId = (value) => {
  if (value && typeof value === 'object') return String(value.Id ?? '');
  return String(value ?? '');
};

const lookupName = (value) => {
  if (value && typeof value === 'object') return value.Name || 'Unnamed concept';
  return 'Unnamed concept';
};

const nextInterval = (quality, previousInterval) => {
  const previous = Math.max(1, Number(previousInterval) || 1);
  if (quality === 'Again') return 1;
  if (quality === 'Hard') return Math.max(1, Math.round(previous * 1.2));
  if (quality === 'Good') return Math.max(2, Math.round(previous * 2));
  if (quality === 'Easy') return Math.max(4, Math.round(previous * 3));
  return previous;
};

async function fetchRevisionPlan(studentUserId) {
  const { and, eq, isIn, lt } = window.ApperSDK.CoreSDK;

  const [itemsResult, masteryResult] = await Promise.all([
    sdk.table('revision_items_c')
      .select(['Id', 'Name', 'curriculum_node_c', 'review_type_c', 'status_c', 'due_at_c', 'interval_days_c', 'recall_quality_c', 'last_reviewed_at_c'])
      .where(and(eq('student_user_c', studentUserId), isIn('status_c', ['Due', 'Scheduled'])))
      .orderBy('due_at_c')
      .limit(200, 0)
      .fetch(),
    sdk.table('student_concept_mastery_c')
      .select(['Id', 'curriculum_node_c', 'mastery_score_c', 'mastery_status_c'])
      .where(and(eq('student_user_c', studentUserId), lt('mastery_score_c', MASTERY_TARGET)))
      .orderBy('mastery_score_c')
      .limit(50, 0)
      .fetch()
  ]);

  if (!itemsResult.success) {
    throw new Error(itemsResult.messages?.join('; ') || itemsResult.message || 'Revision items could not be loaded.');
  }
  if (!masteryResult.success) {
    throw new Error(masteryResult.messages?.join('; ') || masteryResult.message || 'Concept mastery could not be loaded.');
  }

  const nowMs = Date.now();
  const items = itemsResult.data || [];
  const due = items.filter((item) => !item.due_at_c || Date.parse(item.due_at_c) <= nowMs);
  const scheduled = items.filter((item) => item.due_at_c && Date.parse(item.due_at_c) > nowMs);

  return {
    due,
    scheduled,
    candidates: masteryResult.data || []
  };
}

export default function Revision() {
  const { user } = useAuth();
  const studentUserId = user?.userId || '';
  const [pendingItemId, setPendingItemId] = useState(null);
  const [addingConcepts, setAddingConcepts] = useState(false);

  const { data, loading, error, run: refetchPlan } = useFetch(
    () => (studentUserId ? fetchRevisionPlan(studentUserId) : Promise.resolve(EMPTY_PLAN)),
    [studentUserId]
  );

  const plan = data ?? EMPTY_PLAN;
  const dueItems = plan.due ?? [];
  const scheduledItems = plan.scheduled ?? [];
  const candidates = plan.candidates ?? [];

  async function gradeItem(item, quality) {
    const reviewedAt = new Date();
    const interval = nextInterval(quality, item.interval_days_c);
    const nextDue = new Date(reviewedAt.getTime() + interval * 86400000).toISOString();

    setPendingItemId(item.Id);
    try {
      const response = await sdk.table('revision_items_c').update({
        Id: item.Id,
        status_c: 'Scheduled',
        recall_quality_c: quality,
        interval_days_c: interval,
        last_reviewed_at_c: reviewedAt.toISOString(),
        due_at_c: nextDue,
        next_review_at_c: nextDue
      });
      if (!response.data?.length) {
        throw new Error(response.messages?.join('; ') || response.message || 'Your review could not be saved.');
      }
      toast.success(`Next review in ${interval} ${interval === 1 ? 'day' : 'days'}.`);
      refetchPlan();
    } catch (reviewError) {
      toast.error('Review not saved', { description: reviewError.message });
      console.error(`revision_items_c update failed: ${reviewError.message}`);
    } finally {
      setPendingItemId(null);
    }
  }

  async function addWeakConcepts() {
    const activeConceptIds = new Set([...dueItems, ...scheduledItems].map((item) => lookupId(item.curriculum_node_c)));
    const toAdd = candidates.filter((candidate) => {
      const conceptId = lookupId(candidate.curriculum_node_c);
      return conceptId && !activeConceptIds.has(conceptId);
    });

    if (!toAdd.length) {
      toast.info('Every weak concept is already in your revision plan.');
      return;
    }

    const nowIso = new Date().toISOString();
    setAddingConcepts(true);
    try {
      const response = await sdk.table('revision_items_c').create(toAdd.map((candidate) => ({
        Name: `Review: ${lookupName(candidate.curriculum_node_c)}`,
        student_user_c: studentUserId,
        curriculum_node_c: lookupId(candidate.curriculum_node_c),
        review_type_c: 'Recall',
        status_c: 'Due',
        due_at_c: nowIso,
        interval_days_c: 1
      })));
      if (!response.data?.length) {
        throw new Error(response.messages?.join('; ') || response.message || 'Concepts could not be added to your plan.');
      }
      toast.success(`Added ${response.data.length} ${response.data.length === 1 ? 'concept' : 'concepts'} to your plan.`);
      if (response.partial) toast.warning(`Added ${response.data.length} of ${toAdd.length} concepts.`);
      refetchPlan();
    } catch (addError) {
      toast.error('Plan not updated', { description: addError.message });
      console.error(`revision_items_c create failed: ${addError.message}`);
    } finally {
      setAddingConcepts(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2 border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Phase 11 · long-term retention
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Revision centre</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Concepts you are due to review, scheduled by how well you recalled them last time.
        </p>
      </header>

      {error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">{error.message}</CardContent>
        </Card>
      ) : loading && !data ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Building your revision plan…</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due now</p>
                <p className="text-2xl font-bold tabular-nums">{dueItems.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduled</p>
                <p className="text-2xl font-bold tabular-nums">{scheduledItems.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Below mastery target</p>
                <p className="text-2xl font-bold tabular-nums">{candidates.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Due for review</CardTitle>
              <CardDescription>Rate how well you recalled each concept. Your next review is scheduled from that rating.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {dueItems.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nothing is due right now. Well done, you are up to date.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {dueItems.map((item) => (
                    <div key={item.Id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium" title={item.Name}>
                          {item.Name || lookupName(item.curriculum_node_c)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lookupName(item.curriculum_node_c)} · {item.due_at_c ? `due ${formatRelativeTime(item.due_at_c)}` : 'due now'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {RECALL_OPTIONS.map((quality) => (
                          <Button
                            key={quality}
                            size="sm"
                            variant={quality === 'Good' ? 'default' : 'outline'}
                            disabled={pendingItemId === item.Id}
                            onClick={() => gradeItem(item, quality)}
                          >
                            {quality}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scheduled ahead</CardTitle>
              <CardDescription>Concepts already reviewed, returning on their next date.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {scheduledItems.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No upcoming reviews yet. Reviews you complete will be scheduled here.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {scheduledItems.map((item) => (
                    <div key={item.Id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium" title={item.Name}>
                          {item.Name || lookupName(item.curriculum_node_c)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Next review {item.due_at_c ? formatRelativeTime(item.due_at_c) : '—'} · every {item.interval_days_c ?? 1} {Number(item.interval_days_c) === 1 ? 'day' : 'days'}
                        </p>
                      </div>
                      {item.recall_quality_c ? <Badge variant="outline">{item.recall_quality_c}</Badge> : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weak concepts</CardTitle>
              <CardDescription>
                Concepts where your mastery is below {Math.round(MASTERY_TARGET * 100)}%. Add them to your plan to review them on a schedule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No concepts are below your mastery target. Keep practising to maintain them.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {candidates.map((candidate) => (
                    <div key={candidate.Id} className="flex items-center justify-between gap-3 py-2">
                      <p className="min-w-0 flex-1 truncate text-sm" title={lookupName(candidate.curriculum_node_c)}>
                        {lookupName(candidate.curriculum_node_c)}
                      </p>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {Math.round(Number(candidate.mastery_score_c || 0) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={addWeakConcepts} disabled={addingConcepts || candidates.length === 0}>
                <ApperIcon name="Plus" size={15} className="mr-2" />
                {addingConcepts ? 'Adding…' : 'Add weak concepts to plan'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
