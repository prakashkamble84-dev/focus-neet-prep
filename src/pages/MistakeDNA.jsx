import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useAuth } from '@/layouts/RootLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ApperIcon from '@/components/ApperIcon';

export const route = { path: '/mistake-dna', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Mistake DNA', icon: 'ScanSearch', group: 'Improve', order: 60 };

const EMPTY_PROFILE = { concepts: [], wrongCount: 0, confidentWrongCount: 0 };

const lookupId = (value) => {
  if (value && typeof value === 'object') return String(value.Id ?? '');
  return String(value ?? '');
};

const lookupName = (value) => {
  if (value && typeof value === 'object') return value.Name || 'Unnamed concept';
  return 'Unnamed concept';
};

async function fetchMistakeProfile(studentUserId) {
  const { and, eq, isIn } = window.ApperSDK.CoreSDK;

  const [attemptsResult, masteryResult] = await Promise.all([
    sdk.table('student_attempts_c')
      .select(['Id', 'question_c', 'confidence_c', 'attempted_at_c'])
      .where(and(eq('student_user_c', studentUserId), eq('is_correct_c', false)))
      .orderByDesc('attempted_at_c')
      .limit(200, 0)
      .fetch(),
    sdk.table('student_concept_mastery_c')
      .select(['Id', 'curriculum_node_c', 'mastery_score_c', 'mastery_status_c', 'attempt_count_c'])
      .where(eq('student_user_c', studentUserId))
      .limit(200, 0)
      .fetch()
  ]);

  if (!attemptsResult.success) {
    throw new Error(attemptsResult.messages?.join('; ') || attemptsResult.message || 'Wrong answers could not be loaded.');
  }
  if (!masteryResult.success) {
    throw new Error(masteryResult.messages?.join('; ') || masteryResult.message || 'Concept mastery could not be loaded.');
  }

  const wrongAttempts = attemptsResult.data || [];
  const questionIds = [...new Set(wrongAttempts.map((attempt) => lookupId(attempt.question_c)).filter(Boolean))];

  let questionConcept = new Map();
  if (questionIds.length) {
    const questionsResult = await sdk.table('questions_c')
      .select(['Id', 'curriculum_node_c'])
      .where(isIn('Id', questionIds))
      .limit(questionIds.length, 0)
      .fetch();

    if (!questionsResult.success) {
      throw new Error(questionsResult.messages?.join('; ') || questionsResult.message || 'Question concepts could not be loaded.');
    }
    questionConcept = new Map((questionsResult.data || []).map((question) => [
      String(question.Id),
      question.curriculum_node_c
    ]));
  }

  const masteryByConcept = new Map((masteryResult.data || []).map((row) => [
    lookupId(row.curriculum_node_c),
    row
  ]));

  const concepts = new Map();
  let confidentWrongCount = 0;

  wrongAttempts.forEach((attempt) => {
    const concept = questionConcept.get(lookupId(attempt.question_c));
    const conceptId = lookupId(concept);
    if (!conceptId) return;

    const isConfident = attempt.confidence_c === 'High';
    if (isConfident) confidentWrongCount += 1;

    const entry = concepts.get(conceptId) || {
      id: conceptId,
      name: lookupName(concept),
      wrongCount: 0,
      confidentWrongCount: 0,
      lastWrongAt: null
    };
    entry.wrongCount += 1;
    if (isConfident) entry.confidentWrongCount += 1;
    if (!entry.lastWrongAt || attempt.attempted_at_c > entry.lastWrongAt) {
      entry.lastWrongAt = attempt.attempted_at_c;
    }
    concepts.set(conceptId, entry);
  });

  const rows = [...concepts.values()].map((entry) => {
    const mastery = masteryByConcept.get(entry.id);
    return {
      ...entry,
      masteryPercent: mastery ? Math.round(Number(mastery.mastery_score_c || 0) * 100) : null,
      masteryStatus: mastery?.mastery_status_c || null,
      attemptCount: Number(mastery?.attempt_count_c || 0)
    };
  });

  rows.sort((a, b) => b.wrongCount - a.wrongCount || (a.masteryPercent ?? 0) - (b.masteryPercent ?? 0));

  return {
    concepts: rows,
    wrongCount: wrongAttempts.length,
    confidentWrongCount
  };
}

function repairGuidance(concept) {
  if (concept.confidentWrongCount > 0) {
    return 'You were confident on some wrong answers here. Re-read the rule or method before attempting more questions.';
  }
  if (concept.masteryPercent !== null && concept.masteryPercent < 60) {
    return 'Mastery is below 60%. Practise this concept until your answers become consistent.';
  }
  return 'Keep practising this concept to confirm the repair holds.';
}

export default function MistakeDNA() {
  const { user } = useAuth();
  const studentUserId = user?.userId || '';

  const { data, loading, error } = useFetch(
    () => (studentUserId ? fetchMistakeProfile(studentUserId) : Promise.resolve(EMPTY_PROFILE)),
    [studentUserId]
  );

  const profile = data ?? EMPTY_PROFILE;
  const concepts = profile.concepts ?? [];

  return (
    <div className="space-y-5">
      <header className="space-y-2 border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Phase 10 · error diagnosis
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Mistake DNA</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Your wrong answers grouped by concept, so recurring errors and confident misconceptions stand out.
        </p>
      </header>

      {error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">{error.message}</CardContent>
        </Card>
      ) : loading && !data ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Analysing your wrong answers…</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wrong answers</p>
                <p className="text-2xl font-bold tabular-nums">{profile.wrongCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Concepts affected</p>
                <p className="text-2xl font-bold tabular-nums">{concepts.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confident errors</p>
                <p className="text-2xl font-bold tabular-nums">{profile.confidentWrongCount}</p>
              </CardContent>
            </Card>
          </div>

          {concepts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No recurring mistakes yet. Wrong answers from adaptive practice and diagnostics will appear here.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Concepts by recurring errors</CardTitle>
                <CardDescription>Most frequent wrong answers first. Built from your recent wrong attempts.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border p-0">
                {concepts.map((concept) => (
                  <div key={concept.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium" title={concept.name}>{concept.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {concept.wrongCount} wrong · {concept.confidentWrongCount} made with high confidence
                        {concept.lastWrongAt ? ` · last ${new Date(concept.lastWrongAt).toLocaleDateString()}` : ''}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">{repairGuidance(concept)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {concept.masteryStatus ? <Badge variant="outline">{concept.masteryStatus}</Badge> : null}
                      {concept.masteryPercent !== null ? (
                        <span className="text-sm font-semibold tabular-nums">{concept.masteryPercent}%</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div>
            <Button asChild variant="outline">
              <Link to="/practice">
                <ApperIcon name="Target" size={15} className="mr-2" />
                Practise weak concepts
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
