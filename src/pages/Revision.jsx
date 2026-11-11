import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/revision', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Revision centre', icon: 'CalendarClock', group: 'Improve', order: 70 };

export default function Revision() {
  return (
    <ModuleWorkspace
      eyebrow="Long-term retention"
      title="Revision centre"
      summary="A sustainable revision system that schedules concepts and questions according to retention evidence, confidence, and the student's available time."
      phase="Phase 11"
      status="Awaiting mastery data"
      statusTone="review"
      capabilities={[
        'Spaced review scheduling based on recall performance',
        'Concept, formula, diagram, and question review items',
        'Daily and weekly revision queues',
        'Overdue review handling without overwhelming the student',
        'Time-aware study planning and rescheduling',
        'Revision effectiveness and retention tracking'
      ]}
      prerequisites={['Student learning profile', 'Mistake and mastery records', 'Study time preferences']}
      nextPath="/mistake-dna"
      nextLabel="Review mistake patterns"
    />
  );
}
