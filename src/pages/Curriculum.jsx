import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/curriculum', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Curriculum', icon: 'BookOpen', group: 'Learn', order: 10 };

export default function Curriculum() {
  return (
    <ModuleWorkspace
      eyebrow="Academic foundation"
      title="Exam-specific curriculum"
      summary="A version-controlled syllabus for JEE Main, JEE Advanced, and NEET UG. Each topic must be traceable to the official document and academic year that governs it."
      phase="Phase 2"
      status="Awaiting source ingestion"
      statusTone="review"
      capabilities={[
        'Separate syllabus versions for each examination and academic year',
        'Subject, unit, chapter, topic, subtopic, and concept hierarchy',
        'Official source links and page-level provenance',
        'Syllabus additions, removals, renames, and change reports',
        'Examination-specific duration, sections, and scoring configurations',
        'Academic expert approval before publishing curriculum changes'
      ]}
      prerequisites={['Official source registry', 'Verified NTA, JEE Advanced, NMC, and NCERT documents', 'Phase 1 database and access controls']}
      nextPath="/sources"
      nextLabel="Review source governance"
      note="The curriculum will not be treated as current until its academic-year version and official source have been verified. Old versions remain available for historical comparisons."
    />
  );
}
