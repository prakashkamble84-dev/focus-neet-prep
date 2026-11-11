import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/question-bank', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Question bank', icon: 'Library', group: 'Practice', order: 40 };

export default function QuestionBank() {
  return (
    <ModuleWorkspace
      eyebrow="Verified practice content"
      title="Question bank"
      summary="An examination-aware question repository with source provenance, version history, concept mappings, answer keys, and review status."
      phase="Phase 5"
      status="Awaiting question records"
      statusTone="review"
      capabilities={[
        'MCQ, multiple-select, numerical, assertion-reason, and exam-specific formats',
        'Question, option, answer-key, and solution versioning',
        'Mappings to concepts, skills, syllabus versions, and examinations',
        'Difficulty and cognitive-skill metadata',
        'Duplicate detection and source-rights tracking',
        'Search, filters, review queues, and publication controls'
      ]}
      prerequisites={['Knowledge graph', 'Historical question ingestion', 'Verified source and rights metadata']}
      nextPath="/historical-intelligence"
      nextLabel="Review historical intelligence"
      note="A question is not eligible for student practice merely because its text was extracted. Answer correctness, ambiguity, syllabus fit, and usage rights require validation."
    />
  );
}
