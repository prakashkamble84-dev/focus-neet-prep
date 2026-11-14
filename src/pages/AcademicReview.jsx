import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = {
  path: '/academic-review',
  layout: 'owner',
  access: "profile === 'CEO' || profile === 'Manager' || profile === 'AcademicExpert_c' || profile === 'ContentReviewer_c'"
};
export const nav = {
  label: 'Academic review',
  icon: 'ClipboardCheck',
  group: 'Governance',
  profiles: ['CEO', 'Manager', 'AcademicExpert_c', 'ContentReviewer_c'],
  order: 120
};

export default function AcademicReview() {
  return (
    <ModuleWorkspace
      eyebrow="Content governance"
      title="Academic review and approvals"
      summary="A controlled workflow for syllabus updates, extracted historical questions, generated practice content, answer keys, and academic corrections."
      phase="Phases 2, 4, 6"
      status="Review workflow not configured"
      statusTone="review"
      capabilities={[
        'Reviewer queues and assignment',
        'Source and extraction confidence inspection',
        'Independent solution and answer-key verification',
        'Duplicate, ambiguity, and syllabus-fit checks',
        'Approve, reject, request correction, and supersede actions',
        'Versioned audit trail for academic changes'
      ]}
      prerequisites={['Reviewer profiles and permissions', 'Source registry', 'Question validation services']}
      nextPath="/sources"
      nextLabel="Review source governance"
    />
  );
}
