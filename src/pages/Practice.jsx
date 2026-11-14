import { useState } from 'react';
import { toast } from 'sonner';
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

export const route = { path: '/practice', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Adaptive practice', icon: 'Target', group: 'Practice', order: 50 };

async function fetchActiveExaminations() {
  const { eq } = window.ApperSDK.CoreSDK;
  const result = await sdk.table('examinations_c')
    .select(['Id', 'Name', 'exam_type_c', 'active_c'])
    .where(eq('active_c', true))
    .orderBy('Name')
    .limit(100, 0)
    .fetch();

  if (!result.success) {
    throw new Error(result.messages?.join('; ') || result.message || 'Examinations could not be loaded.');
  }
  return result.data || [];
}

export default function Practice() {
  const { user } = useAuth();
  const [examinationId, setExaminationId] = useState('');
  const [current, setCurrent] = useState(null);
  const [answer, setAnswer] = useState('');
  const [confidence, setConfidence] = useState('Medium');
  const [shownAt, setShownAt] = useState(0);
  const [result, setResult] = useState(null);
  const [recentIds, setRecentIds] = useState([]);

  const { data: examinations, loading: examsLoading, error: examsError } = useFetch(
    fetchActiveExaminations,
    []
  );

  const { invoke: requestNext, loading: nextLoading } = useFunction(
    import.meta.env.VITE_ADAPTIVE_PRACTICE,
    { showError: true }
  );

  const { invoke: submitAnswer, loading: submitLoading } = useFunction(
    import.meta.env.VITE_ADAPTIVE_PRACTICE,
    { showError: true }
  );

  const exams = examinations ?? [];
  const activeExamId = examinationId || String(exams[0]?.Id ?? '');
  const question = current?.question || null;
  const isMulti = question?.questionType === 'Multi';
  const selectedValues = Array.isArray(answer) ? answer : [];
  const hasAnswer = isMulti ? selectedValues.length > 0 : String(answer).trim().length > 0;

  async function loadNextQuestion() {
    if (!user?.userId || !activeExamId) return;

    const response = await requestNext({
      action: 'next',
      studentUserId: user.userId,
      examinationId: activeExamId,
      recentQuestionIds: recentIds
    });

    if (!response?.success) return;

    setCurrent(response);
    setAnswer(response.question.questionType === 'Multi' ? [] : '');
    setConfidence('Medium');
    setResult(null);
    setShownAt(Date.now());
    setRecentIds((previous) => [response.question.id, ...previous].slice(0, 50));
  }

  async function submitCurrentAnswer(event) {
    event.preventDefault();
    if (!question || result || !hasAnswer) return;

    const response = await submitAnswer({
      action: 'submit',
      studentUserId: user.userId,
      questionId: question.id,
      answer,
      confidence,
      timeSeconds: Math.round((Date.now() - shownAt) / 1000)
    });

    if (!response?.success) return;
    setResult(response);
  }

  function toggleOption(label, checked) {
    setAnswer(checked
      ? [...new Set([...selectedValues, label])]
      : selectedValues.filter((item) => item !== label));
  }

  return (
    <div className="space-y-5">
      <header className="space-y-2 border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Phase 9 · personalised practice
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Adaptive practice</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Each question is chosen from verified, published items using your concept mastery, so weaker concepts come up first.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose an examination</CardTitle>
          <CardDescription>Questions are drawn only from verified, published items for the examination you pick.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          {examsError ? (
            <p className="text-sm text-destructive">{examsError.message}</p>
          ) : examsLoading ? (
            <p className="text-sm text-muted-foreground">Loading examinations…</p>
          ) : exams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active examinations are available yet.</p>
          ) : (
            <>
              <div className="min-w-0 max-w-sm flex-1 space-y-1.5">
                <Label htmlFor="practice-exam">Examination</Label>
                <select
                  id="practice-exam"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={activeExamId}
                  onChange={(event) => setExaminationId(event.target.value)}
                  disabled={nextLoading}
                >
                  {exams.map((exam) => (
                    <option key={exam.Id} value={String(exam.Id)}>
                      {exam.Name}{exam.exam_type_c ? ' · ' + exam.exam_type_c : ''}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" onClick={loadNextQuestion} disabled={nextLoading || !activeExamId}>
                {nextLoading
                  ? <><ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" />Selecting…</>
                  : <><ApperIcon name="Target" size={15} className="mr-2" />{question ? 'Next question' : 'Start practice'}</>}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {!question ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Start practice to receive a question chosen for your current concept mastery.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base">{question.title}</CardTitle>
                <CardDescription>{current.reason}</CardDescription>
              </div>
              <Badge variant="outline">
                {isMulti ? 'Multiple correct' : question.questionType}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="min-w-0 truncate" title={current.concept.name}>{current.concept.name}</span>
              <span aria-hidden="true">·</span>
              <span>{question.difficulty}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{question.maximumMarks} marks</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {current.concept.masteryPercent === null ? 'New concept' : current.concept.masteryPercent + '% mastery'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={submitCurrentAnswer} className="space-y-5">
              <p className="whitespace-pre-wrap text-sm leading-6">{question.questionText}</p>

              {question.questionType === 'Numeric' ? (
                <div className="max-w-sm space-y-1.5">
                  <Label htmlFor="practice-answer">Numerical answer</Label>
                  <Input
                    id="practice-answer"
                    inputMode="decimal"
                    value={String(answer)}
                    onChange={(event) => setAnswer(event.target.value)}
                    disabled={Boolean(result)}
                    placeholder="Enter your answer"
                  />
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {question.options.map((option) => {
                    const selected = isMulti ? selectedValues.includes(option.label) : answer === option.label;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={selected}
                        disabled={Boolean(result)}
                        onClick={() => (isMulti ? toggleOption(option.label, !selected) : setAnswer(option.label))}
                        className={'flex min-h-12 items-start gap-3 rounded-md border p-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-70 ' + (
                          selected ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'
                        )}
                      >
                        <span className="font-mono font-semibold">{option.label}.</span>
                        <span className="whitespace-pre-wrap">{option.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {!result && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="practice-confidence" className="text-xs text-muted-foreground">How confident are you?</Label>
                    <select
                      id="practice-confidence"
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      value={confidence}
                      onChange={(event) => setConfidence(event.target.value)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <Button type="submit" disabled={submitLoading || !hasAnswer}>
                    {submitLoading
                      ? <><ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" />Checking…</>
                      : <><ApperIcon name="CheckCircle2" size={15} className="mr-2" />Submit answer</>}
                  </Button>
                </div>
              )}
            </form>

            {result && (
              <div className="space-y-3 rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={result.correct ? 'secondary' : 'outline'}>
                    {result.correct ? 'Correct' : 'Not correct'}
                  </Badge>
                  <span className="text-sm tabular-nums">
                    Score {result.scoreAwarded > 0 ? '+' : ''}{result.scoreAwarded} of {result.maximumMarks}
                  </span>
                </div>
                <p className="text-sm">
                  Correct answer: <span className="font-mono font-semibold">{result.correctAnswer || '—'}</span>
                </p>
                {result.solution && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Solution</p>
                    <p className="whitespace-pre-wrap text-sm leading-6">{result.solution}</p>
                  </div>
                )}
                {result.mastery && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Concept mastery now {result.mastery.percent}% · {result.mastery.status} · {result.mastery.attemptCount} attempts
                  </p>
                )}
                {result.masteryWarning && (
                  <p className="text-xs text-warning-foreground">{result.masteryWarning}</p>
                )}
                <div className="flex justify-end">
                  <Button type="button" onClick={loadNextQuestion} disabled={nextLoading}>
                    <ApperIcon name="ArrowRight" size={15} className="mr-2" />
                    Next question
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
