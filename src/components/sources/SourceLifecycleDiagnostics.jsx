import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ApperIcon from '@/components/ApperIcon';
import { runSourceLifecycleSelfTests } from '@/services/sourceLifecycleSelfTests';

export default function SourceLifecycleDiagnostics() {
  const [report, setReport] = useState(() => runSourceLifecycleSelfTests());
  const [ran, setRan] = useState(false);

  function runTests() {
    const result = runSourceLifecycleSelfTests();
    setReport(result);
    setRan(true);
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Source and syllabus release tests · 23 deterministic checks</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Deterministic checks for second-person verification, rights, PDF storage, stale approvals, official-origin provenance and syllabus publication.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={runTests}>
          <ApperIcon name="Play" size={14} /> Run checks again
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{report.passed} passed</Badge>
        <Badge variant="outline">{report.failed} failed</Badge>
        {ran && <Badge variant="outline">Re-run complete</Badge>}
      </div>
      <div className="divide-y divide-border rounded-md border border-border">
        {report.tests.map((test) => (
          <div key={test.name} className="flex items-start gap-3 p-3">
            <ApperIcon name={test.passed ? 'CheckCircle2' : 'XCircle'} size={16} className={test.passed ? 'text-success' : 'text-destructive'} />
            <div>
              <p className="text-sm font-medium">{test.name}</p>
              <p className="text-xs leading-5 text-muted-foreground">{test.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
