import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useAuth } from '@/layouts/RootLayout';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ApperIcon from '@/components/ApperIcon';

export const route = { path: '/performance', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Performance', icon: 'ChartNoAxesCombined', group: 'Improve', order: 90 };

const DAY_MS = 86400000;
const WINDOW_DAYS = 14;
const SMALL_SAMPLE = 20;

const EMPTY_PERFORMANCE = { tests: [], attemptCount: 0, accuracyRecent: null, accuracyPrevious: null, concepts: [] };

const lookupId = (value) => {
  if (value && typeof value === 'object') return String(value.Id ?? '');
  return String(value ?? '');
};

const lookupName = (value, fallback) => {
  if (value && typeof value === 'object') return value.Name || fallback;
  return fallback;
};

const percentOf = (score, total) => (Number(total) > 0 ? Math.round((Number(score || 0) / Number(total)) * 100) : null);

const accuracyOf = (rows) => {
  if (!rows.length) return null;
  const correct = rows.filter((row) => row.is_correct_c === true).length;
  return Math.round((correct / rows.length) * 100);
};

async function fetchPerformance(studentUserId) {
  const { and, eq, gte } = window.ApperSDK.CoreSDK;
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString();

  const [testsResult, attemptsResult, masteryResult] = await Promise.all([
    sdk.table('test_attempts_c')
      .select(['Id', 'test_c', 'total_marks_c', 'score_obtained_c', 'submitted_at_c', 'time_spent_seconds_c'])
      .where(and(eq('student_user_c', studentUserId), eq('status_c', 'Evaluated')))
      .orderByDesc('submitted_at_c')
      .limit(20, 0)
      .fetch(),
    sdk.table('student_attempts_c')
      .select(['Id', 'is_correct_c', 'attempted_at_c'])
      .where(and(eq('student_user_c', studentUserId), gte('attempted_at_c', since)))
      .orderByDesc('attempted_at_c')
      .limit(500, 0)
      .fetch(),
    sdk.table('student_concept_mastery_c')
      .select(['Id', 'curriculum_node_c', 'mastery_score_c', 'mastery_status_c'])
      .where(eq('student_user_c', studentUserId))
      .limit(200, 0)
      .fetch()
  ]);

  if (!testsResult.success) {
    throw new Error(testsResult.messages?.join('; ') || testsResult.message || 'Mock test results could not be loaded.');
  }
  if (!attemptsResult.success) {
    throw new Error(attemptsResult.messages?.join('; ') || attemptsResult.message || 'Recent practice could not be loaded.');
  }
  if (!masteryResult.success) {
    throw new Error(masteryResult.messages?.join('; ') || masteryResult.message || 'Concept mastery could not be loaded.');
  }

  const now = Date.now();
  const attempts = attemptsResult.data || [];
  const ageOf = (row) => now - new Date(row.attempted_at_c).getTime();
  const recent = attempts.filter((row) => ageOf(row) >= 0 && ageOf(row) < 7 * DAY_MS);
  const previous = attempts.filter((row) => ageOf(row) >= 7 * DAY_MS && ageOf(row) < 14 * DAY_MS);

  const tests = (testsResult.data || []).map((test) => ({
    id: lookupId(test.Id) || String(test.Id),
    name: lookupName(test.test_c, 'Mock test'),
    percent: percentOf(test.score_obtained_c, test.total_marks_c),
    submittedAt: test.submitted_at_c,
    timeSeconds: Number(test.time_spent_seconds_c || 0)
  }));

  const concepts = (masteryResult.data || [])
    .map((row) => ({
      id: String(row.Id),
      name: lookupName(row.curriculum_node_c, 'Unnamed concept'),
      percent: Math.round(Number(row.mastery_score_c || 0) * 100),
      status: row.mastery_status_c || null
    }))
    .sort((a, b) => a.percent - b.percent);

  return {
    tests,
    attemptCount: attempts.length,
    accuracyRecent: accuracyOf(recent),
    accuracyPrevious: accuracyOf(previous),
    concepts
  };
}

function trendLabel(recent, previous) {
  if (recent === null || previous === null) return 'Not enough practice in both weeks to compare.';
  const delta = recent - previous;
  if (delta === 0) return 'Accuracy is unchanged from the previous week.';
  return `Accuracy is ${Math.abs(delta)} points ${delta > 0 ? 'higher' : 'lower'} than the previous week.`;
}

export default function Performance() {
  const { user } = useAuth();
  const studentUserId = user?.userId || '';

  const { data, loading, error } = useFetch(
    () => (studentUserId ? fetchPerformance(studentUserId) : Promise.resolve(EMPTY_PERFORMANCE)),
    [studentUserId]
  );

  const performance = data ?? EMPTY_PERFORMANCE;
  const tests = performance.tests ?? [];
  const concepts = performance.concepts ?? [];
  const scoredTests = tests.filter((test) => test.percent !== null);
  const latestTest = scoredTests[0] ?? null;
  const averageTest = scoredTests.length
    ? Math.round(scoredTests.reduce((sum, test) => sum + test.percent, 0) / scoredTests.length)
    : null;
  const averageMastery = concepts.length
    ? Math.round(concepts.reduce((sum, concept) => sum + concept.percent, 0) / concepts.length)
    : null;
  const weakest = concepts.slice(0, 5);
  const lowSample = performance.attemptCount < SMALL_SAMPLE;

  return (
    <div className="space-y-5">
      <header className="space-y-2 border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Phase 13 · learning analytics
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Performance and readiness</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Observed results from your mock tests, practice and concept mastery. Figures are measured, not predicted.
        </p>
      </header>

      {error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">{error.message}</CardContent>
        </Card>
      ) : loading && !data ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Loading your performance…</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest mock score</p>
                <p className="text-2xl font-bold tabular-nums">{latestTest ? `${latestTest.percent}%` : '—'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average mock score</p>
                <p className="text-2xl font-bold tabular-nums">{averageTest !== null ? `${averageTest}%` : '—'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average concept mastery</p>
                <p className="text-2xl font-bold tabular-nums">{averageMastery !== null ? `${averageMastery}%` : '—'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Practice accuracy (7 days)</p>
                <p className="text-2xl font-bold tabular-nums">
                  {performance.accuracyRecent !== null ? `${performance.accuracyRecent}%` : '—'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Practice trend</CardTitle>
              <CardDescription>
                Accuracy across the last 7 days compared with the 7 days before. Based on {performance.attemptCount} attempts in the last {WINDOW_DAYS} days.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm leading-relaxed">{trendLabel(performance.accuracyRecent, performance.accuracyPrevious)}</p>
              {lowSample ? (
                <p className="text-xs text-muted-foreground">
                  Fewer than {SMALL_SAMPLE} attempts in this window, so treat these figures as indicative only.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mock test results</CardTitle>
              <CardDescription>Your evaluated mock tests, most recent first.</CardDescription>
            </CardHeader>
            {tests.length === 0 ? (
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No evaluated mock tests yet. Results appear here once a timed mock test is submitted.
              </CardContent>
            ) : (
              <CardContent className="divide-y divide-border p-0">
                {tests.map((test) => (
                  <div key={test.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm font-medium" title={test.name}>{test.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {test.submittedAt ? formatLocalDate(test.submittedAt, DATE_FORMATS.SHORT) : 'Date unavailable'}
                        {test.timeSeconds ? ` · ${Math.round(test.timeSeconds / 60)} min` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {test.percent !== null ? `${test.percent}%` : '—'}
                    </span>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weakest concepts</CardTitle>
              <CardDescription>Concepts with the lowest measured mastery. Mastery comes from your recorded attempts.</CardDescription>
            </CardHeader>
            {weakest.length === 0 ? (
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No concept mastery recorded yet. Practice questions to start building this picture.
              </CardContent>
            ) : (
              <CardContent className="divide-y divide-border p-0">
                {weakest.map((concept) => (
                  <div key={concept.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium" title={concept.name}>{concept.name}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      {concept.status ? <Badge variant="outline">{concept.status}</Badge> : null}
                      <span className="text-sm font-semibold tabular-nums">{concept.percent}%</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          <div>
            <Button asChild variant="outline">
              <Link to="/mistake-dna">
                <ApperIcon name="ScanSearch" size={15} className="mr-2" />
                Review mistake patterns
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
