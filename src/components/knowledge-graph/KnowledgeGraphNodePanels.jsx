import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getMasteryContractText } from '@/services/knowledgeGraphRules';

function StatusBadge({ value }) {
  const good = ['Published', 'Verified', 'Secure', 'Public', 'Licensed'].includes(value);
  const bad = ['Rejected', 'Retired'].includes(value);
  return (
    <Badge
      variant="outline"
      className={good ? 'border-success/30 bg-success/10 text-success' : bad ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-warning/30 bg-warning/10 text-warning-foreground'}
    >
      {value || 'Not set'}
    </Badge>
  );
}

export function KnowledgeGraphNodeBrowser({ nodes, selectedId, onSelect, canEdit, onEditMastery }) {
  if (!nodes.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <ApperIcon name="Network" size={28} className="mx-auto text-primary" />
        <p className="mt-3 font-semibold">No curriculum nodes match these filters</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Register the official source baseline and import a syllabus outline in Curriculum Management. Concept-level nodes must then be extracted and reviewed. This graph does not fabricate chapters or concepts.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="divide-y divide-border">
        {nodes.map((node) => (
          <div key={node.Id} className={String(node.Id) === String(selectedId) ? 'bg-accent/50' : ''}>
            <button
              type="button"
              onClick={() => onSelect(node.Id)}
              className="flex w-full flex-col gap-2 p-4 text-left transition-colors hover:bg-accent/40 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{node.Name}</span>
                  <Badge variant="outline">{node.node_type_c}</Badge>
                  {node.node_type_c === 'Concept' && node.parentNodeType === 'Concept' && <Badge variant="outline">Sub-concept</Badge>
                  {node.syllabusCompatibility && <Badge variant="outline">{node.syllabusCompatibility}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {node.examName} {node.academicYear ? '· ' + node.academicYear : ''} · {node.subject_c || 'No subject'}
                </p>
                <p className="break-words text-xs text-muted-foreground">{node.node_path_c || node.node_code_c}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <StatusBadge value={node.status_c} />
                {node.verified_c && <Badge variant="outline">Expert verified</Badge>}
                {node.mastery && <Badge variant="outline">Your mastery: {node.mastery.mastery_status_c || 'New'}</Badge>}
              </div>
            </button>
            {canEdit && node.node_type_c === 'Concept' && (
              <div className="flex justify-end px-4 pb-3">
                <Button size="sm" variant="ghost" onClick={() => onEditMastery(node)}>
                  <ApperIcon name="ClipboardCheck" size={14} /> Mastery contract
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function KnowledgeGraphNodeDetails({
  node,
  relationships,
  mappings,
  canEdit,
  onAddRelationship,
  onEditMastery,
  onVerify,
  onPublish
}) {
  if (!node) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
        Select a node to inspect its hierarchy, dependencies, question evidence and mastery contract.
      </div>
    );
  }

  const inbound = relationships.filter((edge) => edge.relationship_type_c === 'Prereq' && String(edge.toNode?.Id) === String(node.Id));
  const outbound = relationships.filter((edge) => edge.relationship_type_c === 'Prereq' && String(edge.fromNode?.Id) === String(node.Id));
  const related = relationships.filter((edge) => (
    edge.relationship_type_c !== 'Prereq' &&
    (String(edge.fromNode?.Id) === String(node.Id) || String(edge.toNode?.Id) === String(node.Id))
  ));
  const conceptMappings = mappings.filter((mapping) => String(mapping.node?.Id) === String(node.Id));
  const contract = node.node_type_c === 'Concept' ? getMasteryContractText(node.learning_objectives_c) : '';

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{node.Name}</h2>
            <Badge variant="outline">{node.node_type_c}</Badge>
            <StatusBadge value={node.status_c} />
            {node.syllabusCompatibility && <Badge variant="outline">{node.syllabusCompatibility}</Badge>}
          </div>
          <p className="break-words text-xs text-muted-foreground">{node.node_code_c} · {node.examName} · {node.subject_c}</p>
          <p className="text-xs text-muted-foreground">{node.node_path_c}</p>
        </div>
        {canEdit && node.node_type_c === 'Concept' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onEditMastery(node)}>
              <ApperIcon name="ClipboardCheck" size={14} /> Mastery contract
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAddRelationship(node)}>
              <ApperIcon name="GitBranch" size={14} /> Add edge
            </Button>
          </div>
        )}
      </div>

      {node.description_c && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Definition</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{node.description_c}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Difficulty</p>
          <p className="mt-1 font-semibold">{node.difficulty_c || 'Not assessed'}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Question mappings</p>
          <p className="mt-1 font-semibold tabular-nums">{conceptMappings.length}</p>
        </div>
        <div className="rounded-md bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Prerequisite dependencies</p>
          <p className="mt-1 font-semibold tabular-nums">{inbound.length} required · {outbound.length} unlocks</p>
        </div>
      </div>

      {node.learning_objectives_c && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Learning objectives and mastery contract</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-sans text-sm leading-6">{node.learning_objectives_c}</pre>
        </div>
      )}

      {node.node_type_c === 'Concept' && !node.learning_objectives_c?.includes('[MASTERY CONTRACT]') && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
          <p className="text-sm font-semibold">Seven-stage mastery contract not yet recorded</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Define Explain, Recognise, Apply, Transfer, Integrate, Timed and Retain evidence before this concept is used as a mastery target.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prerequisites</p>
          {inbound.length ? inbound.map((edge) => (
            <div key={edge.Id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium">{edge.fromNode?.Name || 'Missing node'}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <StatusBadge value={edge.status_c} />
                <span className="text-xs text-muted-foreground">{edge.confidence_c == null ? 'Confidence not scored' : Math.round(Number(edge.confidence_c) * 100) + '%'}</span>
              </div>
            </div>
          )) : <p className="text-xs text-muted-foreground">No prerequisite edges recorded.</p>}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Unlocks / dependent concepts</p>
          {outbound.length ? outbound.map((edge) => (
            <div key={edge.Id} className="rounded-md border border-border p-3">
              <p className="text-sm font-medium">{edge.toNode?.Name || 'Missing node'}</p>
              <StatusBadge value={edge.status_c} />
            </div>
          )) : <p className="text-xs text-muted-foreground">No dependent concepts recorded.</p>}
        </div>
      </div>

      {related.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Related concepts</p>
          <div className="flex flex-wrap gap-2">
            {related.map((edge) => (
              <Badge key={edge.Id} variant="outline">
                {(String(edge.fromNode?.Id) === String(node.Id) ? edge.toNode?.Name : edge.fromNode?.Name) || 'Missing node'} · {edge.relationship_type_c}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {(node.sourceVersion || node.sourceDocument) && (
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence and provenance</p>
          <p className="mt-1 text-sm font-medium">{node.sourceVersion?.official_title_c || node.sourceDocument?.Name || 'Linked syllabus source'}</p>
          <p className="text-xs text-muted-foreground">
            {node.sourceVersion?.rights_status_c || node.sourceDocument?.rights_status_c || 'Rights not reviewed'} · {node.sourceVersion?.ingestion_status_c || node.sourceDocument?.verification_status_c || 'Source not verified'}
          </p>
          {node.source_page_start_c && (
            <p className="mt-1 text-xs text-muted-foreground">
              Pages {node.source_page_start_c}{node.source_page_end_c && node.source_page_end_c !== node.source_page_start_c ? '–' + node.source_page_end_c : ''}
            </p>
          )}
          {node.source_excerpt_c && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{node.source_excerpt_c}</p>}
          {node.sourceVersion?.document_url_c && (
            <a href={node.sourceVersion.document_url_c} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">
              Open source document
            </a>
          )}
        </div>
      )}

      {canEdit && node.status_c !== 'Published' && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <p className="mr-auto text-xs text-muted-foreground">Every hierarchy level needs verified source rights, page evidence and a published parent path before students can see it.</p>
          {!node.verified_c && (
            <Button size="sm" variant="outline" onClick={() => onVerify(node)}>
              <ApperIcon name="ClipboardCheck" size={14} /> Verify evidence
            </Button>
          )}
          <Button size="sm" onClick={() => onPublish(node)} disabled={!node.sourceVersion || !node.source_page_start_c || !node.source_page_end_c || !node.source_excerpt_c || !node.verified_c || (node.hasSyllabusVersion && node.syllabusStatus !== 'Published') || (node.node_type_c !== 'Subject' && (!node.parentNode || node.parentNode.status_c !== 'Published' || node.parentNode.verified_c !== true))}>
            <ApperIcon name="ShieldCheck" size={14} /> Publish node
          </Button>
        </div>
      )}
    </section>
  );
}

