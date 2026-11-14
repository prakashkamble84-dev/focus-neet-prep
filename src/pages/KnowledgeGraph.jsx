import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/knowledge-graph', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Knowledge graph', icon: 'Network', group: 'Learn', order: 20 };

export default function KnowledgeGraph() {
  return (
    <ModuleWorkspace
      eyebrow="Concept relationships"
      title="Academic knowledge graph"
      summary="A connected map of concepts and prerequisites, built to explain what a learner needs to understand before attempting a harder idea."
      phase="Phase 3"
      status="Awaiting curriculum model"
      statusTone="review"
      capabilities={[
        'Stable concept identities across curriculum versions',
        'Directional prerequisite and dependency relationships',
        'Related, application, extension, and commonly confused concepts',
        'Cross-topic and academically valid cross-subject relationships',
        'Concept-level learning objectives and mastery dimensions',
        'Graph integrity checks for duplicates, orphan nodes, and cycles'
      ]}
      prerequisites={['Versioned curriculum hierarchy', 'Academic expert review', 'Concept identity and relationship schema']}
      nextPath="/curriculum"
      nextLabel="Review curriculum foundation"
      note="Prerequisite relationships will be reviewed by academic experts. They will not be generated freely by an AI model and published as facts."
    />
  );
}
