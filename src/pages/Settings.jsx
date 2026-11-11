import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/settings', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Preferences', icon: 'Settings2', group: 'Governance', order: 140 };

export default function Settings() {
  return (
    <ModuleWorkspace
      eyebrow="Account configuration"
      title="Preparation preferences"
      summary="This workspace will hold the student's exam targets, academic year, language, learning schedule, and privacy controls once the profile and consent models are connected."
      phase="Phase 0.2"
      status="Onboarding not configured"
      statusTone="review"
      capabilities={[
        'JEE Main, JEE Advanced, and NEET UG preparation selections',
        'Target examination year and current academic level',
        'Preferred language and explanation style',
        'Available study hours and scheduling constraints',
        'Parent linking and consent controls',
        'Account data export and deletion request workflow'
      ]}
      prerequisites={['Authentication configuration', 'Student and parent profile tables', 'Consent and privacy workflow']}
      nextPath="/architecture"
      nextLabel="Review implementation roadmap"
      note="Do not enter sensitive information until the production account and privacy controls are configured. This screen is currently a product-structure placeholder."
    />
  );
}
