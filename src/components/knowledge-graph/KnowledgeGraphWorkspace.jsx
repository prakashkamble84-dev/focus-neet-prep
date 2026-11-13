import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ApperIcon from '@/components/ApperIcon';
import {
  KnowledgeGraphNodeBrowser,
  KnowledgeGraphNodeDetails
} from '@/components/knowledge-graph/KnowledgeGraphNodePanels';
import {
  KnowledgeGraphRelationshipBrowser,
  KnowledgeGraphFamilyBrowser,
  KnowledgeGraphMappingBrowser,
  KnowledgeGraphCrosswalkBrowser
} from '@/components/knowledge-graph/KnowledgeGraphResearchPanels';
import KnowledgeGraphDiagnostics from '@/components/knowledge-graph/KnowledgeGraphDiagnostics';
import KnowledgeGraphProgressionBridges from '@/components/knowledge-graph/KnowledgeGraphProgressionBridges';

const TABS = [
  { id: 'nodes', label: 'Knowledge hierarchy' },
  { id: 'relationships', label: 'Prerequisites and edges' },
  { id: 'families', label: 'Question families' },
  { id: 'mappings', label: 'Question mappings' },
  { id: 'crosswalks', label: 'Historical mapping' },
  { id: 'quality', label: 'Graph integrity' }
];

function reviewVisibleNode(node) {
  return node.status_c === 'Published' &&
    node.verified_c === true &&
    (!node.hasSyllabusVersion || node.syllabusStatus === 'Published');
}

export default function KnowledgeGraphWorkspace({
  nodes,
  relationships,
  questionMappings,
  families,
  crosswalks,
  diagnostics,
  selfTests,
  canEdit,
  isStudent,
  loading,
  onAddRelationship,
  onAddMapping,
  onVerifyMapping,
  onRejectMapping,
  onAddCrosswalk,
  canAddCrosswalk,
  onVerifyCrosswalk,
  onRejectCrosswalk,
  onEditMastery,
  onVerifyNode,
  onPublishNode,
  onVerifyRelationship,
  onRejectRelationship,
  onRunTests
}) {
  const [tab, setTab] = useState('nodes');
  const [examFilter, setExamFilter] = useState('All examinations');
  const [subjectFilter, setSubjectFilter] = useState('All subjects');
  const [typeFilter, setTypeFilter] = useState('All node types');
  const [layerFilter, setLayerFilter] = useState('All layers');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const visibleNodes = useMemo(() => {
    const allowed = canEdit ? nodes : nodes.filter(reviewVisibleNode);
    const term = search.trim().toLowerCase();
    return allowed.filter((node) => (
      (examFilter === 'All examinations' || node.examName === examFilter) &&
      (subjectFilter === 'All subjects' || node.subject_c === subjectFilter) &&
      (typeFilter === 'All node types' || node.node_type_c === typeFilter) &&
      (layerFilter === 'All layers' || node.layer === layerFilter) &&
      (!term || [node.Name, node.node_code_c, node.node_path_c, node.description_c, node.subject_c, node.examName]
        .some((value) => String(value || '').toLowerCase().includes(term)))
    )).sort((a, b) => (
      String(a.examName).localeCompare(String(b.examName)) ||
      String(a.subject_c).localeCompare(String(b.subject_c)) ||
      Number(a.sort_order_c || 0) - Number(b.sort_order_c || 0) ||
      String(a.node_path_c || a.Name).localeCompare(String(b.node_path_c || b.Name))
    ));
  }, [nodes, canEdit, examFilter, subjectFilter, typeFilter, layerFilter, search]);

  const selectedNode = visibleNodes.find((node) => String(node.Id) === String(selectedId)) ||
    visibleNodes.find((node) => node.node_type_c === 'Concept') ||
    visibleNodes[0] ||
    null;
  const examOptions = useMemo(() => [
    'All examinations',
    ...new Set(nodes.map((node) => node.examName).filter((name) => name && name !== 'Knowledge core'))
  ], [nodes]);
  const subjectOptions = useMemo(() => [
    'All subjects',
    ...new Set(nodes.map((node) => node.subject_c).filter(Boolean))
  ], [nodes]);

  const visibleRelationships = useMemo(() => (
    relationships.filter((edge) => canEdit || edge.status_c === 'Verified')
  ), [relationships, canEdit]);
  const visibleMappings = useMemo(() => (
    questionMappings.filter((mapping) => canEdit || (mapping.verified_c === true && mapping.status_c === 'Verified'))
  ), [questionMappings, canEdit]);

  const visibleFamilies = useMemo(() => {
    if (canEdit) return families;
    const publishedQuestions = new Set(
      families.flatMap((family) => family.questions)
        .filter((question) => question.status_c === 'Published' && ['Public', 'Licensed'].includes(question.rights_status_c))
        .map((question) => String(question.Id))
    );
    return families.map((family) => ({
      ...family,
      questions: family.questions.filter((question) => publishedQuestions.has(String(question.Id)))
    })).filter((family) => family.questions.length > 0);
  }, [families, canEdit]);

  const visibleCrosswalks = useMemo(() => (
    crosswalks.filter((row) => canEdit || row.status_c === 'Verified')
  ), [crosswalks, canEdit]);

  return (
    <div className="space-y-4">
      {isStudent && (
        <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Your knowledge graph</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your concept mastery states are overlaid only from records visible to your student account. As you complete diagnostics and practice, this map will gain evidence.
              </p>
            </div>
            <Badge variant="outline">Private student view</Badge>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={tab === item.id ? 'default' : 'outline'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {tab === 'nodes' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              Examination
              <select value={examFilter} onChange={(event) => setExamFilter(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground">
                {examOptions.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              Subject
              <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground">
                {subjectOptions.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              Node type
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground">
                {['All node types', 'Subject', 'Unit', 'Chapter', 'Topic', 'Subtopic', 'Concept'].map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              Layer
              <select value={layerFilter} onChange={(event) => setLayerFilter(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground">
                {['All layers', 'Syllabus-linked', 'Historical crosswalk', 'Knowledge core'].map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              Search graph
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Concept or node code…" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground" />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing <strong className="font-mono text-foreground">{visibleNodes.length}</strong> of <strong className="font-mono text-foreground">{nodes.length}</strong> nodes
            </p>
            <Button size="sm" variant="ghost" onClick={() => {
              setExamFilter('All examinations');
              setSubjectFilter('All subjects');
              setTypeFilter('All node types');
              setLayerFilter('All layers');
              setSearch('');
            }}>Clear filters</Button>
          </div>

          {loading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-lg border border-border bg-foreground/5" />)}
            </div>
          ) : visibleNodes.length ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <KnowledgeGraphNodeBrowser
                nodes={visibleNodes}
                selectedId={selectedNode?.Id}
                onSelect={setSelectedId}
                canEdit={canEdit}
                onEditMastery={onEditMastery}
              />
              <KnowledgeGraphNodeDetails
                node={selectedNode}
                relationships={visibleRelationships}
                mappings={visibleMappings}
                canEdit={canEdit}
                onAddRelationship={onAddRelationship}
                onEditMastery={onEditMastery}
                onVerify={onVerifyNode}
                onPublish={onPublishNode}
              />
            </div>
          ) : (
            <KnowledgeGraphNodeBrowser nodes={[]} />
          )}
        </div>
      )}

      {tab === 'relationships' && (
        <section className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-semibold">Prerequisite direction</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              A → B means A is required before B. Cycles are blocked when a new prerequisite is proposed. Related, Extends, Applies and Confused edges are stored separately from prerequisite dependencies.
            </p>
          </div>
          <KnowledgeGraphRelationshipBrowser
            relationships={visibleRelationships}
            canEdit={canEdit}
            onVerify={onVerifyRelationship}
            onReject={onRejectRelationship}
          />
        </section>
      )}

      {tab === 'families' && (
        <section className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-semibold">Question-family mapping</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Questions sharing a family code are grouped to represent a common problem structure. The graph links family records to concepts through question-to-concept mappings. Family codes are research groupings, not predictions.
            </p>
          </div>
          <div className="flex justify-end">
            {canEdit && (
              <Button size="sm" onClick={onAddMapping}>
                <ApperIcon name="Link2" size={14} /> Map question to concept
              </Button>
            )}
          </div>
          <KnowledgeGraphFamilyBrowser families={visibleFamilies} />
        </section>
      )}

      {tab === 'mappings' && (
        <section className="space-y-3">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Question-to-concept evidence</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Map a question's primary, secondary, prerequisite or skill concepts. New mappings remain in Review until an academic expert verifies them.
              </p>
            </div>
            {canEdit && (
              <Button size="sm" onClick={onAddMapping}>
                <ApperIcon name="Link2" size={14} /> Add mapping
              </Button>
            )}
          </div>
          <KnowledgeGraphMappingBrowser
            mappings={visibleMappings}
            canEdit={canEdit}
            onVerify={onVerifyMapping}
            onReject={onRejectMapping}
          />
        </section>
      )}

      {tab === 'crosswalks' && (
        <section className="space-y-3">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Historical syllabus crosswalk</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Historical nodes can map to current syllabus nodes as Same, Modified, Split, Merge, Removed, Added or Related. These mappings do not make historical content part of a student's current syllabus.
              </p>
            </div>
            {canEdit && (
              <Button size="sm" onClick={onAddCrosswalk} disabled={!canAddCrosswalk}>
                <ApperIcon name="GitCompareArrows" size={14} /> Add historical mapping
              </Button>
            )}
          </div>
          <KnowledgeGraphCrosswalkBrowser
            crosswalks={visibleCrosswalks}
            canEdit={canEdit}
            onVerify={onVerifyCrosswalk}
            onReject={onRejectCrosswalk}
          />
        </section>
      )}

      {tab === 'quality' && (
        <KnowledgeGraphDiagnostics
          diagnostics={diagnostics}
          selfTests={selfTests}
          onRunTests={onRunTests}
        />
      )}

      <KnowledgeGraphProgressionBridges />
    </div>
  );
}
