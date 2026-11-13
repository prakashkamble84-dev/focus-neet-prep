import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function KnowledgeGraphRelationshipBrowser({ relationships, canEdit, onVerify, onReject }) {
  if (!relationships.length) {
    return <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">No concept relationship edges have been recorded yet.</div>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="divide-y divide-border">
        {relationships.map((edge) => (
          <article key={edge.Id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">{edge.fromNode?.Name || 'Missing node'} <span className="px-1 text-muted-foreground">→</span> {edge.toNode?.Name || 'Missing node'}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{edge.relationship_type_c}</Badge>
                <StatusBadge value={edge.status_c} />
                <span className="text-xs text-muted-foreground">{edge.direction_c || 'Forward'}</span>
                {edge.confidence_c != null && <span className="text-xs text-muted-foreground">Confidence {Math.round(Number(edge.confidence_c) * 100)}%</span>}
              </div>
              {edge.review_notes_c && <p className="text-xs leading-5 text-muted-foreground">{edge.review_notes_c}</p>}
            </div>
            {canEdit && edge.status_c !== 'Rejected' && edge.status_c !== 'Verified' && (
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => onReject(edge)}>Reject</Button>
                <Button size="sm" onClick={() => onVerify(edge)}>Verify</Button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

export function KnowledgeGraphFamilyBrowser({ families }) {
  if (!families.length) {
    return <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">No question-family codes exist yet. When reviewed questions share a family code, the engine groups them here and links their mapped concepts.</div>;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {families.map((family) => (
        <article key={family.code} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{family.code}</p>
              <p className="mt-1 text-xs text-muted-foreground">{family.questions.length} linked question records</p>
            </div>
            <Badge variant="outline">{family.conceptNodes.length} concepts</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {family.examNames.map((exam) => <Badge key={exam} variant="outline">{exam}</Badge>)}
          </div>
          {family.conceptNodes.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mapped concepts</p>
              <p className="mt-1 text-sm">{family.conceptNodes.map((node) => node.Name).join(' · ')}</p>
            </div>
          )}
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Example records</p>
            <p className="mt-1 text-sm">{family.questions.slice(0, 4).map((question) => question.Name || ('Question ' + question.Id)).join(' · ')}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export function KnowledgeGraphCrosswalkBrowser({ crosswalks }) {
  if (!crosswalks.length) {
    return <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">No historical syllabus crosswalks have been verified yet. The system keeps historical mappings separate from current-syllabus publication.</div>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="divide-y divide-border">
        {crosswalks.map((row) => (
          <article key={row.Id} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{row.mapping_type_c}</Badge>
              <StatusBadge value={row.status_c} />
              <span className="text-xs text-muted-foreground">{row.confidence_c == null ? 'Confidence not scored' : Math.round(Number(row.confidence_c) * 100) + '%'}</span>
            </div>
            <p className="mt-2 text-sm font-semibold">{row.sourceNode?.Name || row.sourceVersion?.version_label_c || 'Source syllabus'} <span className="px-1 text-muted-foreground">→</span> {row.targetNode?.Name || row.targetVersion?.version_label_c || 'Target syllabus'}</p>
            {row.mapping_notes_c && <p className="mt-1 text-xs leading-5 text-muted-foreground">{row.mapping_notes_c}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}

