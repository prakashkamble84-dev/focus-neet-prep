import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function ScoreSummary({ result }) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Baseline result</CardTitle>
            <CardDescription>
              Based on the published, answer-verified questions completed in this session.
            </CardDescription>
          </div>
          <Badge variant="secondary">Saved to your profile</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {result.percentage === null ? '—' : Math.round(result.percentage) + '%'}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Correct</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{result.correctCount}</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Incorrect</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{result.incorrectCount}</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Unattempted</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{result.unattemptedCount}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Marks awarded</span>
            <span className="font-mono tabular-nums">{Number(result.score || 0).toFixed(2)} / {Number(result.maximumScore || 0).toFixed(2)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: Math.max(0, Math.min(100, Number(result.percentage || 0))) + '%' }}
            />
          </div>
        </div>

        {result.mastery?.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Concept evidence updated</h3>
            <div className="divide-y divide-border rounded-lg border border-border">
              {result.mastery.map((item) => (
                <div key={item.conceptId} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <p className="text-sm font-medium">{item.conceptName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.correctCount} correct of {item.attemptCount} recorded attempts
                    </p>
                  </div>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.masteryWarnings?.length > 0 && (
          <p className="text-xs text-warning-foreground">
            Some attempt records were saved, but a mastery summary could not be updated for every concept: {result.masteryWarnings.join(' ')}
          </p>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Answer review</h3>
          {result.feedback?.map((item, index) => (
            <div key={item.questionId} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium">{index + 1}. {item.questionName}</p>
                {item.answered
                  ? <Badge variant={item.correct ? 'secondary' : 'destructive'}>{item.correct ? 'Correct' : 'Incorrect'}</Badge>
                  : <Badge variant="outline">Not attempted</Badge>}
              </div>
              {item.answered && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Your answer: {item.submittedAnswer || '—'} · Correct answer: {item.correctAnswer || 'Not available'}
                </p>
              )}
              {item.solution && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.solution}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DiagnosticResultPanel({ result, onRunAnother, onReturn }) {
  return (
    <div className="space-y-3">
      <ScoreSummary result={result} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onRunAnother}>
          Run another baseline
        </Button>
        <Button type="button" variant="outline" onClick={onReturn}>
          Return to profile
        </Button>
      </div>
    </div>
  );
}
