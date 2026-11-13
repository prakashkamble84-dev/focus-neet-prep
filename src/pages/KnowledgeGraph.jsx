import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { KnowledgeGraphHeader } from '@/components/knowledge-graph/KnowledgeGraphHeader';
import KnowledgeGraphWorkspace from '@/components/knowledge-graph/KnowledgeGraphWorkspace';
import KnowledgeGraphNodeDialog from '@/components/knowledge-graph/KnowledgeGraphNodeDialog';
import KnowledgeGraphRelationshipDialog from '@/components/knowledge-graph/KnowledgeGraphRelationshipDialog';
import KnowledgeGraphMasteryDialog from '@/components/knowledge-graph/KnowledgeGraphMasteryDialog';
import {
  buildKnowledgeGraphModel,
  fetchKnowledgeGraphData
} from '@/services/knowledgeGraphService';
import {
  buildGraphDiagnostics,
  runKnowledgeGraphSelfTests
} from '@/services/knowledgeGraphRules';
import { sdk } from '@/services/sdk';

export const route = { path: '/knowledge-graph', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Knowledge graph', icon: 'Network', section: 'Learn', order: 20 };

const STAFF_PROFILES = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'];
const STUDENT_PROFILES = ['User', 'User_c'];

function isStudentVisible(node) {
  return node.status_c === 'Published' &&
    node.verified_c === true &&
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
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
  const [masteryNode, setMasteryNode] = useState(null);
  const [selfTests, setSelfTests] = useState(() => runKnowledgeGraphSelfTests());

  const nodes = model.nodes || [];
  const roleVisibleNodes = useMemo(
    () => canEdit ? nodes : nodes.filter(isStudentVisible),
    [nodes, canEdit]
  );
  const relationships = useMemo(
    () => (model.relationships || []).filter((edge) => canEdit || edge.status_c === 'Verified'),
    [model.relationships, canEdit]
  );
  const questionMappings = useMemo(
    () => (model.questionMappings || []).filter((mapping) => (
      canEdit || (mapping.verified_c === true && mapping.status_c === 'Verified')
    )),
    [model.questionMappings, canEdit]
  );
  const crosswalks = useMemo(
    () => (model.crosswalks || []).filter((row) => canEdit || row.status_c === 'Verified'),
    [model.crosswalks, canEdit]
  );

  const visibleFamilyModel = useMemo(() => {
    const visibleQuestionIds = new Set(
      (model.questions || [])
        .filter((question) => canEdit || (
          question.status_c === 'Published' &&
          ['Public', 'Licensed'].includes(question.rights_status_c)
        ))
        .map((question) => String(question.Id))
    );
    return (model.families || []).map((family) => {
      const familyQuestions = family.questions.filter((question) => visibleQuestionIds.has(String(question.Id)));
      const familyQuestionIds = new Set(familyQuestions.map((question) => String(question.Id)));
      const conceptIds = new Set(
        questionMappings
          .filter((mapping) => familyQuestionIds.has(String(mapping.question?.Id)))
          .map((mapping) => String(mapping.node?.Id))
          .filter(Boolean)
      );
      return {
        ...family,
        questions: familyQuestions,
        conceptNodes: roleVisibleNodes.filter((node) => conceptIds.has(String(node.Id)))
      };
    }).filter((family) => family.questions.length > 0);
  }, [model.families, model.questions, questionMappings, roleVisibleNodes, canEdit]);

  const diagnostics = useMemo(
    () => buildGraphDiagnostics(roleVisibleNodes, relationships, questionMappings),
    [roleVisibleNodes, relationships, questionMappings]
  );

  const conceptCount = nodes.filter((node) => node.node_type_c === 'Concept').length;
  const publishedCount = nodes.filter((node) => node.status_c === 'Published' && node.verified_c).length;
  const verifiedPrerequisiteCount = relationships.filter((edge) => (
    edge.relationship_type_c === 'Prereq' && edge.status_c === 'Verified'
  )).length;

  async function refresh() {
    await run();
  }

  async function reviewRelationship(edge, status) {
    if (!edge?.Id) return;
    const existingNotes = String(edge.review_notes_c || '').trim();
    const action = status === 'Verified' ? 'verified' : 'rejected';
    const notes = (existingNotes ? existingNotes + '\n' : '') +
      'Academic relationship ' + action + ' on ' + new Date().toISOString() + '.';
    const result = await sdk.table('concept_relationships_c').update({
      Id: edge.Id,
      status_c: status,
      review_notes_c: notes
    });
    if (!result.data?.length) {
      toast.error(result.messages?.join('; ') || result.message || 'Relationship review was not saved');
      return;
    }
    toast.success(status === 'Verified' ? 'Relationship verified' : 'Relationship rejected');
    await refresh();
  }

  function hasVerifiedEvidence(node) {
    const sourceVersion = node.sourceVersion;
    const sourceDocument = node.sourceDocument;
    const rights = sourceVersion?.rights_status_c || sourceDocument?.rights_status_c;
    return Boolean(
      sourceVersion &&
      sourceVersion.ingestion_status_c === 'Verified' &&
      sourceDocument?.verification_status_c === 'Verified' &&
      ['Public', 'Licensed'].includes(rights) &&
      Number(node.source_page_start_c) > 0 &&
      Number(node.source_page_end_c) >= Number(node.source_page_start_c) &&
      String(node.source_excerpt_c || '').trim()
    );
  }

  async function verifyNode(node) {
    if (!node?.Id) return;
    if (!hasVerifiedEvidence(node)) {
      toast.error('Concept verification is blocked until source evidence is complete', {
        description: 'Attach a verified source version, verify the parent source record and rights, and record a page range plus source excerpt.'
      });
      return;
    }
    const result = await sdk.table('curriculum_nodes_c').update({
      Id: node.Id,
      verified_c: true,
      status_c: 'Review'
    });
    if (!result.data?.length) {
      toast.error(result.messages?.join('; ') || result.message || 'Concept verification was not saved');
      return;
    }
    toast.success('Concept evidence verified. Publication is still a separate action.');
    await refresh();
  }

  async function publishNode(node) {
    if (!node?.Id) return;
    if (!node.verified_c || !hasVerifiedEvidence(node) || node.syllabusStatus !== 'Published') {
      toast.error('Concept publication is blocked', {
        description: 'Required: expert-verified concept, published syllabus version, verified source and rights, plus page-level evidence.'
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
    toast.success('Concept published to the student knowledge graph');
    await refresh();
  }

  const studentMasteryCount = nodes.filter((node) => node.mastery).length;

  return (
    <div className="space-y-7">
      <KnowledgeGraphHeader
        canEdit={canEdit}
        nodeCount={nodes.length}
        conceptCount={conceptCount}
        publishedCount={publishedCount}
        prerequisiteCount={verifiedPrerequisiteCount}
        familyCount={visibleFamilyModel.length}
        onAddConcept={() => setNodeDialogOpen(true)}
        onAddRelationship={() => setRelationshipDialogOpen(true)}
      />

      {error && (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-semibold">Knowledge graph data could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={refresh}>Retry loading graph</Button>
        </section>
      )}

      {!canEdit && !roleVisibleNodes.length && !loading && (
        <section className="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <p className="font-semibold">No published graph nodes are available yet</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Student accounts see only published and expert-verified concepts and relationships. Academic staff must first register and import the relevant syllabus, then review and publish the graph.
          </p>
          <Button size="sm" variant="outline" className="mt-3" asChild>
            <Link to="/curriculum">Open student curriculum library</Link>
          </Button>
        </section>
      )}

      {isStudent && (
        <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Your knowledge graph</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {studentMasteryCount
                  ? 'Your mastery states are shown only from records returned for your student account.'
                  : 'Your personal mastery view will populate when diagnostic and practice attempts create concept-mastery evidence.'}
              </p>
            </div>
            <Badge variant="outline">Private student view</Badge>
          </div>
        </section>
      )}

      <KnowledgeGraphWorkspace
        nodes={roleVisibleNodes}
        relationships={relationships}
        questionMappings={questionMappings}
        families={visibleFamilyModel}
        crosswalks={crosswalks}
        diagnostics={diagnostics}
        selfTests={selfTests}
        canEdit={canEdit}
        isStudent={isStudent}
        loading={loading && !data}
        onAddRelationship={() => setRelationshipDialogOpen(true)}
        onEditMastery={setMasteryNode}
        onVerifyNode={verifyNode}
        onPublishNode={publishNode}
        onVerifyRelationship={(edge) => reviewRelationship(edge, 'Verified')}
        onRejectRelationship={(edge) => reviewRelationship(edge, 'Rejected')}
        onRunTests={() => {
          const latest = runKnowledgeGraphSelfTests();
          setSelfTests(latest);
          if (latest.failed) toast.error('Graph rule self-test failed');
          else toast.success(latest.passed + ' graph rule self-tests passed');
        }}
      />

      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          Student, parent, teacher and mentor views are read-only. Draft concepts and unverified edges remain hidden from learner accounts.
        </p>
      )}

      <KnowledgeGraphNodeDialog
        open={nodeDialogOpen}
        onOpenChange={setNodeDialogOpen}
        syllabusVersions={model.syllabusVersions || []}
        nodes={nodes}
        sourceVersions={model.sourceVersions || []}
        onSaved={refresh}
      />
      <KnowledgeGraphRelationshipDialog
        open={relationshipDialogOpen}
        onOpenChange={setRelationshipDialogOpen}
        nodes={nodes}
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
