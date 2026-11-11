import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/mock-tests', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Mock examinations', icon: 'ClipboardCheck', group: 'Practice', order: 80 };

export default function MockTests() {
  return (
    <ModuleWorkspace
      eyebrow="Exam simulation"
      title="Mock examinations"
      summary="Timed assessment experiences configured against the selected examination version, including section rules, attempt limits, scoring, and review."
      phase="Phase 12"
      status="Awaiting rule engine"
      statusTone="review"
      capabilities={[
        'Blueprint-driven exam and section construction',
        'Version-correct timing, navigation, and question formats',
        'Reliable autosave and recovery of in-progress attempts',
        'Exam-specific answer and scoring rules',
        'Detailed response review and answer explanations',
        'Post-test analysis linked to concepts and mistake patterns'
      ]}
      prerequisites={['Official examination rule engine', 'Verified question bank', 'Attempt and scoring services']}
      nextPath="/curriculum"
      nextLabel="Review exam configuration"
    />
  );
}
