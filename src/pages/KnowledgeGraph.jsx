import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import KnowledgeGraphHeader from '@/components/knowledge-graph/KnowledgeGraphHeader';
import KnowledgeGraphWorkspace from '@/components/knowledge-graph/KnowledgeGraphWorkspace';
import KnowledgeGraphNodeDialog from '@/components/knowledge-graph/KnowledgeGraphNodeDialog';
import KnowledgeGraphRelationshipDialog from '@/components/knowledge-graph/KnowledgeGraphRelationshipDialog';
import KnowledgeGraphMasteryDialog from '@/components/knowledge-graph/KnowledgeGraphMasteryDialog';
import KnowledgeGraphMappingDialog from '@/components/knowledge-graph/KnowledgeGraphMappingDialog';
import KnowledgeGraphCrosswalkDialog from '@/components/knowledge-graph/KnowledgeGraphCrosswalkDialog';
import {
  reviewGraphRelationship,
  reviewQuestionMapping,
  reviewHistoricalCrosswalk,
  verifyGraphNode,
  publishGraphNode
} from '@/services/knowledgeGraphWorkflowService';
import {
  buildKnowledgeGraphModel,
  fetchKnowledgeGraphData
} from '@/services/knowledgeGraphService';
import { buildGraphDiagnostics } from '@/services/knowledgeGraphRules';
import { runKnowledgeGraphSelfTests } from '@/services/knowledgeGraphSelfTests';

export const route = { path: '/knowledge-graph', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Knowledge graph', icon: 'Network', section: 'Learn', order: 20 };

const STAFF_PROFILES = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'];
const STUDENT_PROFILES = ['User', 'User_c'];
const REVIEWER_PROFILES = ['ContentReviewer_c'];

function isStudentVisible(node) {
  return node.status_c === 'Published' &&
    node.verified_c === true &&
    (!node.hasSyllabusVersion || node.syllabusStatus === 'Published');
}

export default function KnowledgeGraph() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const reviewerId = user?.Id || user?.userId;
  const canEdit = STAFF_PROFILES.includes(profile);
  const canViewDrafts = canEdit || REVIEWER_PROFILES.includes(profile);
  const isStudent = STUDENT_PROFILES.includes(profile);
  const { data, loading, error, run } = useFetch(
    () => fetchKnowledgeGraphData(isStudent),
    [isStudent]
  );

  const model = useMemo(() => buildKnowledgeGraphModel(data), [data]);
  const [nodeDialogOpen, setNodeDialogOpen] = useState(false);
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [crosswalkDialogOpen, setCrosswalkDialogOpen] = useState(false);
  const [masteryNode, setMasteryNode] = useState(null);
  const [selfTests, setSelfTests] = useState(() => runKnowledgeGraphSelfTests());

  const nodes = model.nodes || [];
  const roleVisibleNodes = useMemo(
    () => canViewDrafts ? nodes : nodes.filter(isStudentVisible),
    [nodes, canViewDrafts]
  );
  const relationships = useMemo(
    () => (model.relationships || []).filter((edge) => canViewDrafts || edge.status_c === 'Verified'),
    [model.relationships, canViewDrafts]
  );
  const questionMappings = useMemo(
    () => (model.questionMappings || []).filter((mapping) => (
      canViewDrafts || (mapping.verified_c === true && mapping.status_c === 'Verified')
    )),
    [model.questionMappings, canViewDrafts]
  );
  const crosswalks = useMemo(
    () => (model.crosswalks || []).filter((row) => canViewDrafts || row.status_c === 'Verified'),
    [model.crosswalks, canViewDrafts]
  );

  const visibleFamilyModel = useMemo(() => {
    const visibleQuestionIds = new Set(
      (model.questions || [])
        .filter((question) => canViewDrafts || (
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
  }, [model.families, model.questions, questionMappings, roleVisibleNodes, canViewDrafts]);

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
    try {
      const result = await reviewGraphRelationship(edge, status, reviewerId, nodes, model.relationships || []);
      if (!result.success) toast.error(result.message);
      else if (!result.auditLogged) toast.warning('Relationship updated, but its approval history could not be recorded');
      else toast.success(status === 'Verified' ? 'Relationship verified and logged' : 'Relationship rejected and logged');
      await refresh();
    } catch (error) {
      toast.error('Relationship review failed', { description: error.message });
    }
  }

  async function reviewMapping(mapping, status) {
    if (!mapping?.Id) return;
    try {
      const result = await reviewQuestionMapping(mapping, status, reviewerId);
      if (!result.success) toast.error(result.message);
      else if (!result.auditLogged) toast.warning('Mapping updated, but its approval history could not be recorded');
      else toast.success(status === 'Verified' ? 'Question mapping verified and logged' : 'Question mapping rejected and logged');
      await refresh();
    } catch (error) {
      toast.error('Question mapping review failed', { description: error.message });
    }
  }

  async function reviewCrosswalk(row, status) {
    if (!row?.Id) return;
    try {
      const result = await reviewHistoricalCrosswalk(row, status, reviewerId);
      if (!result.success) toast.error(result.message);
      else if (!result.auditLogged) toast.warning('Crosswalk updated, but its approval history could not be recorded');
      else toast.success(status === 'Verified' ? 'Historical crosswalk verified and logged' : 'Historical crosswalk rejected and logged');
      await refresh();
    } catch (error) {
      toast.error('Historical crosswalk review failed', { description: error.message });
    }
  }

  async function verifyNode(node) {
    if (!node?.Id) return;
    try {
      const result = await verifyGraphNode(node, reviewerId);
      if (!result.success) toast.error('Node evidence verification is blocked', { description: result.message });
      else if (!result.auditLogged) toast.warning('Node verified, but its approval history could not be recorded');
      else toast.success('Node evidence verified and logged. Publication remains a separate action.');
      await refresh();
    } catch (error) {
      toast.error('Node verification failed', { description: error.message });
    }
  }

  async function publishNode(node) {
    if (!node?.Id) return;
    try {
      const result = await publishGraphNode(node, reviewerId);
      if (!result.success) toast.error('Node publication is blocked', { description: result.message });
      else if (!result.auditLogged) toast.warning('Node published, but its approval history could not be recorded');
      else toast.success('Node published and approval history recorded');
      await refresh();
    } catch (error) {
      toast.error('Node publication failed', { description: error.message });
    }
  }

  const studentMasteryCount = nodes.filter((node) => node.mastery).length;

  return (
    <div className="space-y-7">
      <KnowledgeGraphHeader
        canEdit={canEdit}
        canViewDrafts={canViewDrafts}
        loading={loading}
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
        canViewDrafts={canViewDrafts}
        isStudent={isStudent}
        loading={loading && !data}
        onAddRelationship={() => setRelationshipDialogOpen(true)}
        onAddMapping={() => setMappingDialogOpen(true)}
        onVerifyMapping={(mapping) => reviewMapping(mapping, 'Verified')}
        onRejectMapping={(mapping) => reviewMapping(mapping, 'Rejected')}
        onAddCrosswalk={() => setCrosswalkDialogOpen(true)}
        canAddCrosswalk={(model.syllabusVersions || []).some((source) => (
          (model.syllabusVersions || []).some((target) => (
            String(target.Id) !== String(source.Id) &&
            String(target.examination_c?.Id || target.examination_c) === String(source.examination_c?.Id || source.examination_c) &&
            Number(target.academic_year_c || 0) >= Number(source.academic_year_c || 0)
          ))
        ))}
        onVerifyCrosswalk={(row) => reviewCrosswalk(row, 'Verified')}
        onRejectCrosswalk={(row) => reviewCrosswalk(row, 'Rejected')}
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
          Student, parent, teacher and mentor views are read-only. Content reviewers can inspect draft graph records without editing them; learner accounts see only verified and published content.
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
      <KnowledgeGraphMappingDialog
        open={mappingDialogOpen}
        onOpenChange={setMappingDialogOpen}
        questions={model.questions || []}
        nodes={nodes}
        onSaved={refresh}
      />
      <KnowledgeGraphCrosswalkDialog
        open={crosswalkDialogOpen}
        onOpenChange={setCrosswalkDialogOpen}
        syllabusVersions={model.syllabusVersions || []}
        nodes={nodes}
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
