import { Badge } from '@/components/ui/badge';

function Status({ value }) {
  const tone = value === 'Published' || value === 'Verified' || value === 'Approved'
    ? 'border-success/30 bg-success/10 text-success'
    : value === 'Rejected'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : value === 'Review' || value === 'Draft' || value === 'Ready'
        ? 'border-warning/30 bg-warning/10 text-warning-foreground'
        : 'border-border bg-muted text-muted-foreground';
  return <Badge variant="outline" className={tone}>{value || 'Not set'}</Badge>;
}

export default function CurriculumImportBatches({ batches, loading, loaded }) {
  return (
    <section className="space-y-3">
      <h2 className="font-mono text-base font-semibold">Import batches</h2>
      {loading && !loaded ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Loading import batches…</div>
      ) : batches.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No curriculum import batches have been created.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {batches.map((batch) => (
            <div key={batch.Id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{batch.Name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{batch.nodes_created_c || 0} nodes created · {batch.nodes_updated_c || 0} updated</p>
                {batch.import_notes_c && <p className="mt-1 text-xs leading-5 text-muted-foreground">{batch.import_notes_c}</p>}
              </div>
              <Status value={batch.status_c} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
