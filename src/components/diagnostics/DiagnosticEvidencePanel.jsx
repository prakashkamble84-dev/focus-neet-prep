import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import ApperIcon from '@/components/ApperIcon';

export default function DiagnosticEvidencePanel({
  attempts,
  mastery,
  diagnosticAccuracy,
  formReady,
  eligibleExams,
  selectedExamId,
  setSelectedExamId,
  setAssessment,
  setResult,
  startDiagnostic,
  diagnosticLoading
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your diagnostic evidence</CardTitle>
          <CardDescription>
            Only submitted answers are counted. Skipped questions do not become false mistakes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Recorded answers</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{attempts.length}</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Historical accuracy</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {diagnosticAccuracy === null ? '—' : diagnosticAccuracy + '%'}
            </p>
          </div>
          <div className="col-span-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Concept mastery signals</p>
              <Badge variant="outline">{mastery.length} tracked</Badge>
            </div>
            {mastery.length ? (
              <div className="mt-3 space-y-2">
                {mastery.slice(0, 5).map((item) => (
                  <div key={item.Id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{item.curriculum_node_c?.Name || 'Curriculum concept'}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {Math.round(Number(item.mastery_score_c || 0) * 100)}% · {item.mastery_status_c}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                No concept evidence yet. Your first completed diagnostic will start the mastery record.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start a baseline diagnostic</CardTitle>
          <CardDescription>
            Up to ten questions, sampled from your selected examination's published, answer-verified and rights-cleared question set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="diagnostic-examination">Examination</Label>
            <select
              id="diagnostic-examination"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selectedExamId}
              onChange={(event) => {
                setSelectedExamId(event.target.value);
                setAssessment(null);
                setResult(null);
              }}
              disabled={!formReady || diagnosticLoading || eligibleExams.length === 0}
            >
              <option value="">Select a target examination</option>
              {eligibleExams.map((exam) => (
                <option key={exam.Id} value={exam.Id}>{exam.Name}</option>
              ))}
            </select>
          </div>

          {!formReady && (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs leading-5 text-warning-foreground">
              Save your profile with a target examination and target year first. The baseline is then unlocked.
            </p>
          )}

          {formReady && !eligibleExams.length && (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs leading-5 text-warning-foreground">
              No active examination record matches your selected targets yet. Ask an administrator to verify the examination setup.
            </p>
          )}

          <Button
            type="button"
            className="w-full"
            onClick={startDiagnostic}
            disabled={!formReady || !selectedExamId || diagnosticLoading || !eligibleExams.length}
          >
            {diagnosticLoading
              ? <><ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" />Preparing diagnostic…</>
              : <><ApperIcon name="ClipboardCheck" size={15} className="mr-2" />Start baseline diagnostic</>}
          </Button>

          <p className="text-xs leading-5 text-muted-foreground">
            Your answer key stays server-side until you submit. The diagnostic is a starting measurement, not a predicted rank or a final judgement of ability.
          </p>
          <div className="border-t border-border pt-3">
            <Link to="/question-bank" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Browse published question bank
              <ApperIcon name="ArrowUpRight" size={13} />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
