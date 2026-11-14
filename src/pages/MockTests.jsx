import { useState } from 'react';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useFunction } from '@/hooks/useFunction';
import { useAuth } from '@/layouts/RootLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ApperIcon from '@/components/ApperIcon';

export const route = { path: '/mock-tests', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Mock examinations', icon: 'ClipboardCheck', group: 'Practice', order: 80 };

const STATUS_STYLES = {
  correct: 'border-success/20 bg-success/10 text-success',
  wrong: 'border-destructive/20 bg-destructive/10 text-destructive',
  unattempted: 'border-border bg-muted text-muted-foreground'
};

const STATUS_LABELS = { correct: 'Correct', wrong: 'Incorrect', unattempted: 'Not answered' };

async function fetchPublishedTests() {
  const { eq } = window.ApperSDK.CoreSDK;
  const result = await sdk.table('tests_c')
    .select(['Id', 'Name', 'test_type_c', 'duration_minutes_c', 'question_count_c', 'instructions_c', 'examination_c'])
    .where(eq('status_c', 'Published'))
    .orderBy('Name')
    .limit(100, 0)
    .fetch();

  if (!result.success) {
    throw new Error(result.messages?.join('; ') || result.message || 'Mock tests could not be loaded.');
  }
  return result.data || [];
}

const isAnswered = (value) => (Array.isArray(value) ? value.length > 0 : String(value ?? '').trim().length > 0);

export default function MockTests() {
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const { data: tests, loading: testsLoading, error: testsError } = useFetch(fetchPublishedTests, []);

  const { invoke: startAttempt, loading: startLoading } = useFunction(
    import.meta.env.VITE_MOCK_TEST,
    { showError: true }
  );

  const { invoke: submitAttempt, loading: submitLoading } = useFunction(
    import.meta.env.VITE_MOCK_TEST,
    { showError: true }
  );

  const questions = session?.questions ?? [];
  const answeredCount = questions.filter((question) => isAnswered(answers[question.testQuestionId])).length;

  async function beginTest(test) {
    if (!user?.userId) return;

    const response = await startAttempt({
      action: 'start',
      studentUserId: user.userId,
      testId: String(test.Id)
    });

    if (!response?.success) return;
    setSession({ test, attempt: response.attempt, questions: response.questions });
    setAnswers({});
    setResult(null);
  }

  async function submitTest() {
    if (!session || result || submitLoading) return;

    const response = await submitAttempt({
      action: 'submit',
      studentUserId: user.userId,
      attemptId: session.attempt.id,
      responses: questions
        .filter((question) => isAnswered(answers[question.testQuestionId]))
        .map((question) => ({
          testQuestionId: question.testQuestionId,
          answer: answers[question.testQuestionId]
        }))
    });

    if (!response?.success) return;
    setResult(response);
  }

  function chooseOption(question, key) {
    setAnswers((previous) => {
      const current = previous[question.testQuestionId];
      if (question.type !== 'Multi') {
        return { ...previous, [question.testQuestionId]: key };
      }
      const list = Array.isArray(current) ? current : [];
      return {
        ...previous,
        [question.testQuestionId]: list.includes(key) ? list.filter((item) => item !== key) : [...list, key]
      };
    });
  }

  function setTextAnswer(question, value) {
    setAnswers((previous) => ({ ...previous, [question.testQuestionId]: value }));
  }

  function leaveTest() {
    setSession(null);
    setAnswers({});
    setResult(null);
  }

  if (session && result) {
    return (
      <div className="space-y-5">
        <header className="space-y-2 border-b border-border pb-5">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Phase 12 · mock examinations
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{session.test.Name}</h1>
          <p className="text-sm text-muted-foreground">Attempt {session.attempt.number} · evaluated</p>
        </header>

        <Card>
          <CardContent className="grid grid-cols-2 gap-4 py-5 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Score</p>
              <p className="text-2xl font-bold tabular-nums">{result.scoreObtained} / {result.totalMarks}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Correct</p>
              <p className="text-2xl font-bold tabular-nums">{result.correctCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Incorrect</p>
              <p className="text-2xl font-bold tabular-nums">{result.wrongCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Not answered</p>
              <p className="text-2xl font-bold tabular-nums">{result.unattemptedCount}</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {questions.map((question) => {
            const item = result.breakdown?.find((entry) => entry.testQuestionId === question.testQuestionId);
            const status = item?.status || 'unattempted';
            return (
              <Card key={question.testQuestionId}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm">Question {question.sequence}</CardTitle>
                    <Badge variant="outline" className={STATUS_STYLES[status]}>
                      {STATUS_LABELS[status]} · {item?.marks ?? 0} marks
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">{question.body}</p>
                  <div className="grid gap-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Your answer: </span>
                      {item?.submittedAnswer || '—'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Correct answer: </span>
                      {item?.correctAnswer || '—'}
                    </p>
                  </div>
                  {item?.solution ? (
                    <div className="space-y-1 border-t border-border pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Solution</p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">{item.solution}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <Button type="button" onClick={leaveTest}>
            <ApperIcon name="ClipboardCheck" size={15} className="mr-2" />
            Back to mock tests
          </Button>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className="space-y-5">
        <header className="space-y-2 border-b border-border pb-5">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Phase 12 · mock examinations
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{session.test.Name}</h1>
          <p className="text-sm text-muted-foreground">
            Attempt {session.attempt.number}
            {session.attempt.durationMinutes ? ' · ' + session.attempt.durationMinutes + ' minutes' : ''}
          </p>
        </header>

        <div className="space-y-4">
          {questions.map((question) => {
            const value = answers[question.testQuestionId];
            return (
              <Card key={question.testQuestionId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    Question {question.sequence}{question.sectionCode ? ' · ' + question.sectionCode : ''}
                  </CardTitle>
                  <CardDescription>
                    {question.marks} marks
                    {question.negativeMarks ? ' · −' + question.negativeMarks + ' for a wrong answer' : ''}
                    {question.type === 'Multi' ? ' · select all that apply' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6">{question.body}</p>
                  {question.type === 'Numeric' ? (
                    <div className="max-w-xs space-y-1.5">
                      <Label htmlFor={'numeric-' + question.testQuestionId}>Your answer</Label>
                      <Input
                        id={'numeric-' + question.testQuestionId}
                        inputMode="decimal"
                        value={value ?? ''}
                        onChange={(event) => setTextAnswer(question, event.target.value)}
                        placeholder="Enter a number"
                      />
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {question.options.map((option) => {
                        const selected = question.type === 'Multi'
                          ? Array.isArray(value) && value.includes(option.key)
                          : value === option.key;
                        return (
                          <Button
                            key={option.key}
                            type="button"
                            variant={selected ? 'default' : 'outline'}
                            aria-pressed={selected}
                            className="h-auto justify-start whitespace-normal py-2 text-left"
                            onClick={() => chooseOption(question, option.key)}
                          >
                            <span className="mr-2 font-mono font-semibold">{option.key}</span>
                            <span className="min-w-0 break-words">{option.text}</span>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">{answeredCount} of {questions.length} answered</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={leaveTest} disabled={submitLoading}>
              Leave for now
            </Button>
            <Button type="button" onClick={submitTest} disabled={submitLoading}>
              {submitLoading
                ? <><ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" />Submitting…</>
                : 'Submit test'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const list = tests ?? [];

  return (
    <div className="space-y-5">
      <header className="space-y-2 border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Phase 12 · exam simulation
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Mock examinations</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Timed, full-length tests built from verified, published questions. Answers are graded on the server when you submit.
        </p>
      </header>

      {testsError ? (
        <p className="text-sm text-destructive">{testsError.message}</p>
      ) : testsLoading ? (
        <p className="text-sm text-muted-foreground">Loading mock tests…</p>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No mock tests are published yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((test) => (
            <Card key={test.Id}>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{test.test_type_c || 'Test'}</Badge>
                </div>
                <CardTitle className="min-w-0 break-words text-base">{test.Name}</CardTitle>
                <CardDescription>
                  {test.question_count_c ?? 0} questions · {test.duration_minutes_c ?? '—'} minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {test.instructions_c ? (
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{test.instructions_c}</p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-xs text-muted-foreground" title={test.examination_c?.Name ?? ''}>
                    {test.examination_c?.Name ?? ''}
                  </p>
                  <Button type="button" onClick={() => beginTest(test)} disabled={startLoading}>
                    {startLoading
                      ? <><ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" />Starting…</>
                      : <><ApperIcon name="ClipboardCheck" size={15} className="mr-2" />Start test</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
