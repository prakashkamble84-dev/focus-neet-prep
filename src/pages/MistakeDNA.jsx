import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/mistake-dna', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Mistake DNA', icon: 'ScanSearch', group: 'Improve', order: 60 };

export default function MistakeDNA() {
  return (
    <ModuleWorkspace
      eyebrow="Error diagnosis"
      title="Mistake DNA"
      summary="Move beyond marking an answer wrong. Identify the likely cause, distinguish symptoms from root causes, and verify whether the repair actually worked."
      phase="Phase 10"
      status="Awaiting attempt history"
      statusTone="review"
      capabilities={[
        'Conceptual, recall, calculation, interpretation, and strategy error categories',
        'Root-cause hypotheses with confidence levels',
        'Recurring mistake pattern detection',
        'Targeted repair exercises linked to prerequisite concepts',
        'Retesting and evidence-based mastery updates',
        'Student-facing mistake notebook and progress history'
      ]}
      prerequisites={['Validated question attempts', 'Concept graph', 'Student mastery model', 'Reliable error taxonomy']}
      nextPath="/practice"
      nextLabel="Review adaptive practice"
    />
  );
}
