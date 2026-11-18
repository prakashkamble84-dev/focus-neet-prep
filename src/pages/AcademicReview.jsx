import { useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import ModuleWorkspace from '@/components/ModuleWorkspace';
import ApperIcon from '@/components/ApperIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/useFetch';
import { sdk } from '@/services/sdk';
import { formatRelativeTime } from '@/utils/date';

const { eq } = window.ApperSDK.CoreSDK;

export const route = {
  path: '/academic-review',
  layout: 'owner',
  access: "profile === 'CEO' || profile === 'Manager' || profile === 'AcademicExpert_c' || profile === 'ContentReviewer_c'"
};
export const nav = {
  label: 'Academic review',
  icon: 'ClipboardCheck',
  group: 'Governance',
  profiles: ['CEO', 'Manager', 'AcademicExpert_c', 'ContentReviewer_c'],
  order: 120
};

const APPROVAL_FIELDS = ['Name', 'review_status_c', 'decision_notes_c', 'submitted_at_c', 'resolved_at_c', 'CreatedOn'];
const REVIEW_FIELDS = ['Name', 'review_type_c', 'review_status_c', 'review_notes_c', 'reviewed_at_c', 'CreatedOn'];

const STATUS_STYLES = {
  Approved: 'border-success/30 bg-success/10 text-success',
  Rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  Changes: 'border-warning/40 bg-warning/15 text-warning-foreground',
  Pending: 'border-border bg-muted text-muted-foreground'
};

async function fetchReviewActivity() {
  const [approvals, reviews] = await Promise.all([
    sdk.table('content_approvals_c').select(APPROVAL_FIELDS).orderByDesc('CreatedOn').page(1, 20).fetch(),
    sdk.table('question_reviews_c').select(REVIEW_FIELDS).orderByDesc('CreatedOn').page(1, 20).fetch()
  ]);
  if (!approvals.success) throw new Error(approvals.message);
  if (!reviews.success) throw new Error(reviews.message);

  const rows = [
    ...(approvals.data ?? []).map((row) => ({
      key: `approval-${row.Id}`,
      kind: 'Content approval',
      title: row.Name,
      status: row.review_status_c,
      notes: row.decision_notes_c,
      at: row.resolved_at_c || row.submitted_at_c || row.CreatedOn
    })),
    ...(reviews.data ?? []).map((row) => ({
      key: `review-${row.Id}`,
      kind: row.review_type_c ? `Question review · ${row.review_type_c}` : 'Question review',
      title: row.Name,
      status: row.review_status_c,
      notes: row.review_notes_c,
      at: row.reviewed_at_c || row.CreatedOn
    }))
  ];
  return rows.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}

function ReviewActivity() {
  const { data, loading, error, run } = useFetch(fetchReviewActivity, []);
  const rows = data ?? [];

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-primary">
            <ApperIcon name="History" size={19} />
          </span>
          <div>
            <h2 className="font-mono text-base font-semibold">Recent review activity</h2>
            <p className="text-xs text-muted-foreground">Latest content approvals and question review decisions</p>
          </div>
        </div>
        <button type="button" onClick={() => run()} disabled={loading} className="text-sm font-semibold text-primary hover:underline disabled:opacity-50">
          Refresh
        </button>
      </div>

      {loading && !data && <p className="text-sm text-muted-foreground">Loading review activity...</p>}

      {error && !loading && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-destructive">{error.message || 'Review activity could not be loaded.'}</p>
          <button type="button" onClick={() => run()} className="w-fit font-semibold text-primary hover:underline">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No review decisions have been recorded yet.</p>
      )}

      {!error && rows.length > 0 && (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{row.kind}</p>
                <p className="truncate text-sm font-medium" title={row.title}>{row.title || 'Untitled review'}</p>
                {row.notes && <p className="line-clamp-2 break-words text-xs text-muted-foreground">{row.notes}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant="outline" className={STATUS_STYLES[row.status] || STATUS_STYLES.Pending}>
                  {row.status || 'Pending'}
                </Badge>
                {row.at && <span className="text-xs text-muted-foreground">{formatRelativeTime(row.at)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const PENDING_APPROVAL_FIELDS = ['Id', 'Name', 'content_type_c', 'content_version_c', 'record_identifier_c', 'submitted_at_c', 'CreatedOn'];
const PENDING_REVIEW_FIELDS = ['Id', 'Name', 'review_type_c', 'CreatedOn'];

async function fetchPendingReviews() {
  const [approvals, reviews] = await Promise.all([
    sdk.table('content_approvals_c').select(PENDING_APPROVAL_FIELDS).where(eq('review_status_c', 'Pending')).orderByDesc('CreatedOn').page(1, 50).fetch(),
    sdk.table('question_reviews_c').select(PENDING_REVIEW_FIELDS).where(eq('review_status_c', 'Pending')).orderByDesc('CreatedOn').page(1, 50).fetch()
  ]);
  if (!approvals.success) throw new Error(approvals.message);
  if (!reviews.success) throw new Error(reviews.message);

  const rows = [
    ...(approvals.data ?? []).map((row) => ({
      key: `approval-${row.Id}`,
      Id: row.Id,
      table: 'content_approvals_c',
      kind: 'Content approval',
      title: row.Name,
      detail: [row.content_type_c, row.content_version_c, row.record_identifier_c].filter(Boolean).join(' · '),
      at: row.submitted_at_c || row.CreatedOn
    })),
    ...(reviews.data ?? []).map((row) => ({
      key: `review-${row.Id}`,
      Id: row.Id,
      table: 'question_reviews_c',
      kind: row.review_type_c ? `Question review · ${row.review_type_c}` : 'Question review',
      title: row.Name,
      detail: '',
      at: row.CreatedOn
    }))
  ];
  return rows.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
}

function ReviewQueue() {
  const reviewerId = useSelector((state) => state.user.user)?.Id ?? null;
  const [busyKey, setBusyKey] = useState(null);
  const { data, loading, error, run } = useFetch(fetchPendingReviews, []);
  const rows = data ?? [];

  const decide = async (row, status) => {
    setBusyKey(row.key);
    try {
      const now = new Date().toISOString();
      const payload = row.table === 'content_approvals_c'
        ? { Id: row.Id, review_status_c: status, reviewer_user_c: reviewerId, resolved_at_c: now }
        : { Id: row.Id, review_status_c: status, reviewer_user_c: reviewerId, reviewed_at_c: now };
      const res = await sdk.table(row.table).update(payload);
      if (res.messages.length) {
        toast.error(res.messages[0], { description: res.messages.slice(1).join('\n') || undefined, duration: 8000 });
        console.error(`${row.table} update failed: ${res.messages.join('; ')}`);
      }
      if (res.data.length) {
        toast.success(`Marked as ${status === 'Changes' ? 'changes requested' : status.toLowerCase()}`);
        run();
      }
    } catch (err) {
      toast.error(err.message || 'The decision could not be saved');
      console.error(`${row.table} update threw: ${err.message}`);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-primary">
            <ApperIcon name="ClipboardCheck" size={19} />
          </span>
          <div>
            <h2 className="font-mono text-base font-semibold">Pending approvals</h2>
            <p className="text-xs text-muted-foreground">Content approvals and question reviews awaiting a decision</p>
          </div>
        </div>
        <button type="button" onClick={() => run()} disabled={loading} className="text-sm font-semibold text-primary hover:underline disabled:opacity-50">
          Refresh
        </button>
      </div>

      {loading && !data && <p className="text-sm text-muted-foreground">Loading pending approvals...</p>}

      {error && !loading && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-destructive">{error.message || 'Pending approvals could not be loaded.'}</p>
          <button type="button" onClick={() => run()} className="w-fit font-semibold text-primary hover:underline">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing is waiting for review.</p>
      )}

      {!error && rows.length > 0 && (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{row.kind}</p>
                <p className="truncate text-sm font-medium" title={row.title}>{row.title || 'Untitled review'}</p>
                {row.detail && <p className="truncate text-xs text-muted-foreground" title={row.detail}>{row.detail}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button size="sm" disabled={busyKey === row.key} onClick={() => decide(row, 'Approved')}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" disabled={busyKey === row.key} onClick={() => decide(row, 'Changes')}>
                  Request changes
                </Button>
                <Button size="sm" variant="destructive" disabled={busyKey === row.key} onClick={() => decide(row, 'Rejected')}>
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AcademicReview() {
  return (
    <ModuleWorkspace
      eyebrow="Content governance"
      title="Academic review and approvals"
      summary="A controlled workflow for syllabus updates, extracted historical questions, generated practice content, answer keys, and academic corrections."
      phase="Phases 2, 4, 6"
      status="Review workflow active"
      statusTone="active"
      capabilities={[
        'Pending content approvals and question reviews queue',
        'Approve, request changes, or reject with the reviewer recorded',
        'Decisions saved to content approvals and question reviews',
        'Recent review activity with status and decision notes'
      ]}
      prerequisites={['Reviewer profiles and permissions', 'Content approvals and question reviews tables']}
      nextPath="/sources"
      nextLabel="Review source governance"
      note="Reviewer decisions are recorded in the content approval and question review tables and are visible only to governance profiles. Assignment, solution verification and duplicate checks are not built yet."
    >
      <ReviewQueue />
      <ReviewActivity />
    </ModuleWorkspace>
  );
}