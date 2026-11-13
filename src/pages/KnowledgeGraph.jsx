import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ApperIcon from '@/components/ApperIcon';
import { sdk } from '@/services/sdk';
import {
  buildKnowledgeGraphModel,
  fetchKnowledgeGraphData
} from '@/services/knowledgeGraphService';
import {
  runKnowledgeGraphSelfTests,
  getLookupId
} from '@/services/knowledgeGraphRules';
import KnowledgeGraphNodeDialog from '@/components/knowledge-graph/KnowledgeGraphNodeDialog';
import KnowledgeGraphRelationshipDialog from '@/components/knowledge-graph/KnowledgeGraphRelationshipDialog';
import KnowledgeGraphMasteryDialog from '@/components/knowledge-graph/KnowledgeGraphMasteryDialog';
import {
  KnowledgeGraphNodeBrowser,
  KnowledgeGraphNodeDetails,
  KnowledgeGraphRelationshipBrowser,
  KnowledgeGraphFamilyBrowser,
  KnowledgeGraphCrosswalkBrowser,
  KnowledgeGraphDiagnostics
} from '@/components/knowledge-graph/KnowledgeGraphPanels';

export const route = { path: '/knowledge-graph', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Knowledge graph', icon: 'Network', section: 'Learn', order: 20 };

const STAFF_PROFILES = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'];
const STUDENT_PROFILES = ['User', 'User_c'];
const TABS = [
  { id: 'nodes', label: 'Knowledge hierarchy' },
  { id: 'relationships', label: 'Prerequisites and edges' },
  { id: 'families', label: 'Question families' },
  { id: 'crosswalks', label: 'Historical mapping' },
  { id: 'quality', label: 'Graph integrity' }
];

function nodeVersionId(node) {
  return getLookupId(node.syllabus_version_c);
}

function reviewVisibleNode(node) {
  return node.status_c === 'Published' && node.verified_c === true &&
    (!node.hasSyllabusVersion || node.syllabusStatus === 'Published');
}

export default function KnowledgeGraph() {
  const { profile } = useProfile();
  const canEdit = STAFF_PROFILES.includes(profile);
  const isStudent = STUDENT_PROFILES.includes(profile);
  const { data, loading, error, run } = useFetch(
    () => fetchKnowledgeGraphData(isStudent),
    [isStudent]
  );

  const model = useMemo(() => buildKnowledgeGraphModel(data), [data]);
  const selfTests = useMemo(() => runKnowledgeGraphSelfTests(), []);
  const [tab, setTab] = useState('nodes');
  const [examFilter, setExamFilter] = useState('All examinations');
  const [subjectFilter, setSubjectFilter] = useState('All subjects');
  const [typeFilter, setTypeFilter] = useState('All node types');
  const [layerFilter, setLayerFilter] = useState('All layers');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
  const [masteryNode, setMasteryNode] = useState(null);

  const allNodes = model.nodes || [];
  const visibleNodes = useMemo(() => {
    const allowed = canEdit ? allNodes : allNodes.filter(reviewVisibleNode);
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
  }, [allNodes, canEdit, examFilter, subjectFilter, typeFilter, layerFilter, search]);

  const selectedNode = visibleNodes.find((node) => String(node.Id) === String(selectedId)) ||
    visibleNodes.find((node) => node.node_type_c === 'Concept') ||
    visibleNodes[0] ||
    null;

  const examOptions = useMemo(() => [
    'All examinations',
    ...new Set(allNodes.map((node) => node.examName).filter((name) => name && name !== 'Knowledge core'))
  ], [allNodes]);
  const subjectOptions = useMemo(() => [
    'All subjects',
    ...new Set(allNodes.map((node) => node.subject_c).filter(Boolean))
  ], [allNodes]);
  const layerOptions = ['All layers', 'Syllabus-linked', 'Historical crosswalk', 'Knowledge core'];

  const relationships = useMemo(() => (
    (model.relationships || []).filter((edge) => canEdit || edge.status_c === 'Verified')
  ), [model.relationships, canEdit]);

  const questionMappings = useMemo(() => (
    (model.questionMappings || []).filter((mapping) => (
      canEdit || (mapping.verified_c === true && mapping.status_c === 'Verified')
    ))
  ), [model.questionMappings, canEdit]);

  const familyModel = useMemo(() => {
    if (canEdit) return model.families || [];
    const publishedQuestions = new Set(
      (model.questions || [])
        .filter((question) => question.status_c === 'Published' && ['Public', 'Licensed'].includes(question.rights_status_c))
        .map((question) => String(question.Id))
    );
    return (model.families || []).map((family) => ({
      ...family,
      questions: family.questions.filter((question) => publishedQuestions.has(String(question.Id)))
    })).filter((family) => family.questions.length > 0);
  }, [model.families, model.questions, canEdit]);

  const crosswalks = useMemo(() => (
    (model.crosswalks || []).filter((row) => canEdit || row.status_c === 'Verified')
  ), [model.crosswalks, canEdit]);

  const diagnostics = useMemo(() => model.diagnostics || { issues: [], errors: 0, warnings: 0, info: 0 }, [model.diagnostics]);

  async function refresh() {
    await run();
  }

  async function updateRelationship(edge, status) {
    if (!edge?.Id) return;
    const action = status === 'Verified' ? 'verify' : 'reject';
    const existingNotes = String(edge.review_notes_c || '').trim();
    const note = (existingNotes ? existingNotes + '\n' : '') +
      'Academic ' + action + ' action recorded ' + new Date().toISOString() + '.';
    const result = await sdk.table('concept_relationships_c').update({
      Id: edge.Id,
      status_c: status,
      review_notes_c: note
    });
    if (!result.data?.length) {
      toast.error(result.messages?.join('; ') || result.message || 'Relationship review was not saved');
      return;
    }
    toast.success(status === 'Verified' ? 'Relationship verified' : 'Relationship rejected');
    await refresh();
  }

  async function publishNode(node) {
    const sourceVersion = node.sourceVersion;
    const sourceDocument = node.sourceDocument;
    const hasGoodRights = ['Public', 'Licensed'].includes(
      sourceVersion?.rights_status_c || sourceDocument?.rights_status_c
    );
    const sourceVerified = sourceVersion?.ingestion_status_c === 'Verified' &&
      sourceDocument?.verification_status_c === 'Verified';
    const syllabusPublished = node.syllabusStatus === 'Published';
    const hasPageEvidence = Number(node.source_page_start_c) > 0 &&
      Number(node.source_page_end_c) >= Number(node.source_page_start_c) &&
      String(node.source_excerpt_c || '').trim().length > 0;

    if (!node.verified_c) {
      toast.error('An academic expert must mark this concept as verified first.');
      return;
    }
    if (!syllabusPublished || !sourceVerified || !hasGoodRights || !hasPageEvidence) {
      toast.error('Publication is blocked until all evidence checks pass', {
        description: 'Required: published syllabus version, verified source document and source version, Public or Licensed rights, one-based page range and source excerpt.'
      });
      return;
    }

    const result = await sdk.table('curriculum_nodes_c').update({
      Id: node.Id,
      status_c: 'Published',
      verified_c: true
    });
    if (!result.data?.length) {
      toast.error(result.messages?.join('; ') || result.message || 'Concept was not published');
      return;
    }
    toast.success('Concept published to the knowledge graph');
    await refresh();
  }

  const conceptCount = allNodes.filter((node) => node.node_type_c === 'Concept').length;
  const verifiedPrerequisites = relationships.filter((edge) => edge.relationship_type_c === 'Prereq' && edge.status_c === 'Verified').length;
  const publishedCount = allNodes.filter((node) => node.status_c === 'Published' && node.verified_c).length;
  const studentMasteryCount = allNodes.filter((node) => node.mastery).length;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Phase 3 · Master knowledge graph</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">JEE + NEET knowledge graph</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Connect the versioned syllabus to concepts, prerequisites, question families, historical crosswalks and observable mastery criteria.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setNodeDialogOpen(true)}>
                <ApperIcon name="Plus" size={15} /> Add concept
              </Button>
              <Button onClick={() => setRelationshipDialogOpen(true)}>
                <ApperIcon name="GitBranch" size={15} /> Connect concepts
              </Button>
            </>
          )}
          <Button variant="outline" asChild>
            <Link to="/curriculum/manage"><ApperIcon name="ListTree" size={15} /> Curriculum</Link>
          </Button>
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <ApperIcon name="Layers3" size={18} className="mt-0.5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-semibold">Three separate knowledge layers</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Official syllabus facts remain tied to a specific published version. Historical syllabus links remain crosswalks, not current learning requirements. Stable concept knowledge connects the examinations without silently changing the official syllabus.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Hierarchy nodes', value: allNodes.length, icon: 'ListTree' },
          { label: 'Concept nodes', value: conceptCount, icon: 'Network' },
          { label: 'Published / verified', value: publishedCount, icon: 'ShieldCheck' },
          { label: 'Verified prerequisites', value: verifiedPrerequisites, icon: 'GitBranch' },
          { label: 'Question families', value: familyModel.length, icon: 'Layers' }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <ApperIcon name={item.icon} size={17} className="text-primary" />
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </section>

      {isStudent && (
        <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Your knowledge graph</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {studentMasteryCount
                  ? 'Your concept mastery states are overlaid only from records visible to your student account.'
                  : 'Your personal graph will populate as diagnostic and practice attempts create concept-mastery evidence.'}
              </p>
            </div>
            <Badge variant="outline">Private student view</Badge>
          </div>
        </section>
      )}

      {error && (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-semibold">Knowledge graph data could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={refresh}>Retry loading graph</Button>
        </section>
      )}

      <section className="space-y-4">
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
                  {layerOptions.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                Search graph
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Concept or node code…" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground" />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Showing <strong className="font-mono text-foreground">{visibleNodes.length}</strong> of <strong className="font-mono text-foreground">{allNodes.length}</strong> nodes
              </p>
              <Button size="sm" variant="ghost" onClick={() => {
                setExamFilter('All examinations');
                setSubjectFilter('All subjects');
                setTypeFilter('All node types');
                setLayerFilter('All layers');
                setSearch('');
              }}>Clear filters</Button>
            </div>

            {loading && !data ? (
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
                  onEditMastery={setMasteryNode}
                />
                <KnowledgeGraphNodeDetails
                  node={selectedNode}
                  relationships={relationships}
                  mappings={questionMappings}
                  canEdit={canEdit}
                  onAddRelationship={() => setRelationshipDialogOpen(true)}
                  onEditMastery={setMasteryNode}
                  onPublish={publishNode}
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
              relationships={relationships}
              canEdit={canEdit}
              onVerify={(edge) => updateRelationship(edge, 'Verified')}
              onReject={(edge) => updateRelationship(edge, 'Rejected')}
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
            <KnowledgeGraphFamilyBrowser families={familyModel} />
          </section>
        )}

        {tab === 'crosswalks' && (
          <section className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-semibold">Historical syllabus crosswalk</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Historical nodes can map to current syllabus nodes as Same, Modified, Split, Merge, Removed, Added or Related. These mappings do not make historical content part of a student's current syllabus.
              </p>
            </div>
            <KnowledgeGraphCrosswalkBrowser crosswalks={crosswalks} />
          </section>
        )}

        {tab === 'quality' && (
          <KnowledgeGraphDiagnostics
            diagnostics={diagnostics}
            selfTests={selfTests}
            onRunTests={() => {
              const latest = runKnowledgeGraphSelfTests();
              if (latest.failed) toast.error('Graph rules self-test failed');
              else toast.success(latest.passed + ' graph rule self-tests passed');
            }}
          />
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ApperIcon name="GraduationCap" size={17} className="text-primary" />
            <h2 className="font-semibold">JEE progression bridge</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Foundation → JEE Main → difficult Main → JEE Advanced → advanced multi-concept application. This is a learning progression framework, not a claim that the two examinations share identical syllabi.</p>
        </article>
        <article className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ApperIcon name="BookOpenCheck" size={17} className="text-primary" />
            <h2 className="font-semibold">NEET progression bridge</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">NCERT foundation → concept → standard MCQ → statement-based → integrated MCQ → timed MCQ → full test, with retention tracked as a distinct learning outcome.</p>
        </article>
      </section>

      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          Student, parent, teacher and mentor views are read-only. Draft nodes and unverified relationship edges are not exposed to learner accounts.
        </p>
      )}

      <KnowledgeGraphNodeDialog
        open={nodeDialogOpen}
        onOpenChange={setNodeDialogOpen}
        syllabusVersions={model.syllabusVersions || []}
        nodes={allNodes}
        sourceVersions={model.sourceVersions || []}
        onSaved={refresh}
      />
      <KnowledgeGraphRelationshipDialog
        open={relationshipDialogOpen}
        onOpenChange={setRelationshipDialogOpen}
        nodes={allNodes}
        relationships={model.relationships || []}
        onSaved={refresh}
      />
      <KnowledgeGraphMasteryDialog
        open={Boolean(masteryNode)}
        onOpenChange={(open) => !open && setMasteryNode(null)}
        node={masteryNode}
        onSaved={refresh}
      />
    </div>
  );
}
