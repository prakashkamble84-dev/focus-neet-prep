import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function slug(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function CurriculumLibraryResults({ rows, loading, levelFilter, onClearFilters, onDownloadOne }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg border border-border bg-foreground/5" />)}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <ApperIcon name="BookOpenCheck" size={26} className="mx-auto text-primary" />
        <p className="mt-3 font-semibold">No curriculum items match these filters</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {['Topic', 'Chapter', 'Subtopic'].includes(levelFilter)
            ? 'No expert-verified items at this level have been published yet. The current 2026 reference snapshots contain subject and unit headings only.'
            : 'Change the examination, year, subject or search phrase to see available curriculum.'}
        </p>
        <Button variant="outline" className="mt-4" onClick={onClearFilters}>Clear filters</Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="divide-y divide-border">
        {rows.map((row, index) => (
          <article key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent font-mono text-xs text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{row.title}</h2>
                  <Badge variant="outline">{row.level}</Badge>
                  <Badge variant="outline" className={row.verified ? 'border-success/30 bg-success/10 text-success' : 'border-warning/30 bg-warning/10 text-warning-foreground'}>
                    {row.verified ? 'Published · verified' : 'Reference snapshot'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{row.exam} · {row.year} · {row.subject}{row.parentTitle ? ' · under ' + row.parentTitle : ''}</p>
                <p className="text-xs text-muted-foreground">{row.path}</p>
                <p className="text-xs text-muted-foreground">
                  {row.sourceTitle} {row.pageStart ? '· PDF pages ' + row.pageStart + (row.pageEnd && row.pageEnd !== row.pageStart ? '–' + row.pageEnd : '') : ''}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              {row.sourceUrl && (
                <Button asChild size="sm" variant="ghost">
                  <a href={row.sourceUrl} target="_blank" rel="noreferrer"><ApperIcon name="ExternalLink" size={14} /> Source</a>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onDownloadOne(row, slug)}>
                <ApperIcon name="Download" size={14} /> Download
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
