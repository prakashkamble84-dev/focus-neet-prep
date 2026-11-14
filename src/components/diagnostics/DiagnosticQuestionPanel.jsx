import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import ApperIcon from '@/components/ApperIcon';

export default function DiagnosticQuestionPanel({
  assessment,
  answers,
  confidence,
  answeredCount,
  setSingleAnswer,
  toggleMultipleAnswer,
  setConfidence,
  submitDiagnostic,
  diagnosticLoading
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Baseline assessment</CardTitle>
            <CardDescription>
              {assessment.questionCount} questions · {assessment.availableQuestionPool} eligible questions in the published bank
            </CardDescription>
          </div>
          <Badge variant="outline">{answeredCount} of {assessment.questionCount} answered</Badge>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: (answeredCount / Math.max(1, assessment.questionCount)) * 100 + '%' }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {assessment.questions.map((question) => {
          const questionAnswer = answers[question.id];
          const selectedValues = Array.isArray(questionAnswer) ? questionAnswer : [];
          const answered = Array.isArray(questionAnswer)
            ? questionAnswer.length > 0
            : String(questionAnswer || '').trim().length > 0;

          return (
            <section key={question.id} className="space-y-3 border-b border-border pb-5 last:border-b-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">Question {question.number}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {question.subject || 'Subject not mapped'} · {question.conceptName} · {question.difficulty} · {question.maximumMarks} marks
                  </p>
                </div>
                <Badge variant={answered ? 'secondary' : 'outline'}>
                  {question.questionType === 'Multi' ? 'Multiple correct' : question.questionType}
                </Badge>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-6">{question.questionText}</p>

              {question.questionType === 'Numeric' ? (
                <div className="max-w-sm space-y-1.5">
                  <Label htmlFor={'answer-' + question.id}>Numerical answer</Label>
                  <Input
                    id={'answer-' + question.id}
                    inputMode="decimal"
                    value={String(questionAnswer || '')}
                    onChange={(event) => setSingleAnswer(question.id, event.target.value)}
                    placeholder="Enter your answer"
                  />
                </div>
              ) : question.options.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {question.options.map((option) => {
                    const selected = question.questionType === 'Multi'
                      ? selectedValues.includes(option.label)
                      : questionAnswer === option.label;

                    return (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => question.questionType === 'Multi'
                          ? toggleMultipleAnswer(question.id, option.label, !selected)
                          : setSingleAnswer(question.id, option.label)}
                        className={'flex min-h-12 items-start gap-3 rounded-md border p-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' + (
                          selected ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'
                        )}
                      >
                        <span className="font-mono font-semibold">{option.label}.</span>
                        <span className="whitespace-pre-wrap">{option.text}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
                  No published answer options are available for this question. Skip it and flag it for editorial review.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={'confidence-' + question.id} className="text-xs text-muted-foreground">How confident are you?</Label>
                <select
                  id={'confidence-' + question.id}
                  className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                  value={confidence[question.id] || 'Medium'}
                  onChange={(event) => setConfidence((current) => ({ ...current, [question.id]: event.target.value }))}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
            </section>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">
            You can leave questions unanswered. Only questions you answer become attempt records; skipped questions are counted separately.
          </p>
          <Button type="button" onClick={submitDiagnostic} disabled={diagnosticLoading || answeredCount === 0}>
            {diagnosticLoading
              ? <><ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" />Evaluating…</>
              : <><ApperIcon name="CheckCircle2" size={15} className="mr-2" />Submit diagnostic</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
