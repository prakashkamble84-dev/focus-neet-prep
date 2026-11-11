import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/mentors', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Parent and mentor', icon: 'Users', group: 'Support', order: 100 };

export default function Mentors() {
  return (
    <ModuleWorkspace
      eyebrow="Authorised support"
      title="Parent and mentor workspace"
      summary="Give parents, teachers, and mentors useful progress context while protecting student privacy and preserving student control over sharing."
      phase="Phase 14"
      status="Awaiting role and consent model"
      statusTone="review"
      capabilities={[
        'Explicit parent-student account linking and consent',
        'Teacher and mentor assignment workflows',
        'Role-scoped progress reports and intervention notes',
        'Study consistency and academic risk indicators',
        'Controlled notifications and report sharing',
        'Scholarship information with eligibility source references'
      ]}
      prerequisites={['Role-based access controls', 'Consent and account-linking workflow', 'Student learning analytics']}
      nextPath="/architecture"
      nextLabel="Review roadmap"
      note="Parents and mentors will never receive unrestricted access to private student conversations or records. Access must be authorised, scoped, and auditable."
    />
  );
}
