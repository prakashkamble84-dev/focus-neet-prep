import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function KnowledgeGraphDiagnostics({ diagnostics, selfTests, onRunTests }) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Live graph integrity</h3>
            <p className="mt-1 text-xs text-muted-foreground">Checks use the records currently visible under the signed-in role.</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{diagnostics.errors} errors</Badge>
            <Badge variant="outline">{diagnostics.warnings} warnings</Badge>
            <Badge variant="outline">{diagnostics.info} info</Badge>
          </div>
        </div>
        {diagnostics.issues.length ? (
          <div className="mt-4 divide-y divide-border rounded-md border border-border">
            {diagnostics.issues.map((issue, index) => (
              <div key={issue.code + '-' + index} className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{issue.severity}</Badge>
                  <span className="text-xs font-semibold">{issue.code}</span>
                </div>
                <p className="mt-1 text-sm">{issue.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">No structural graph issues found in the records visible to this account.</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Graph rules self-test · 12 checks</h3>
            <p className="mt-1 text-xs text-muted-foreground">Deterministic tests for cycle detection and relationship validation.</p>
          </div>
          <Button size="sm" variant="outline" onClick={onRunTests}>Run self-tests again</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">{selfTests.passed} passed</Badge>
          <Badge variant="outline">{selfTests.failed} failed</Badge>
        </div>
        <div className="mt-3 divide-y divide-border rounded-md border border-border">
          {selfTests.tests.map((test) => (
            <div key={test.name} className="flex items-start gap-3 p-3">
              <ApperIcon name={test.passed ? 'CheckCircle2' : 'XCircle'} size={16} className={test.passed ? 'text-success' : 'text-destructive'} />
              <div>
                <p className="text-sm font-medium">{test.name}</p>
                <p className="text-xs text-muted-foreground">{test.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
