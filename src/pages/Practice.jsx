import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/practice', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Adaptive practice', icon: 'Target', group: 'Practice', order: 50 };

export default function Practice() {
  return (
    <ModuleWorkspace
      eyebrow="Personalised practice"
      title="Adaptive practice engine"
      summary="Select the next question using evidence about concept mastery, prerequisite gaps, question novelty, confidence, and the student's current learning goal."
      phase="Phase 9"
      status="Awaiting learner model"
      statusTone="review"
      capabilities={[
        'Question selection based on concept and skill mastery',
        'Prerequisite repair before advanced problem sets',
        'Difficulty progression and novelty controls',
        'Confidence-aware practice and time tracking',
        'Transparent reason for each recommended question',
        'Feedback loops from every validated attempt'
      ]}
      prerequisites={['Diagnostic assessment', 'Question bank', 'Knowledge graph', 'Student attempt history']}
      nextPath="/mistake-dna"
      nextLabel="Review mistake analysis"
    />
  );
}
