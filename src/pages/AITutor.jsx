import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/ai-tutor', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'AI teacher', icon: 'Bot', group: 'Learn', order: 30 };

export default function AITutor() {
  return (
    <ModuleWorkspace
      eyebrow="Guided problem solving"
      title="AI teacher and doubt solver"
      summary="A guided learning assistant that helps students reason through Physics, Chemistry, Mathematics, and Biology rather than merely returning an answer."
      phase="Phase 8"
      status="AI provider not connected"
      statusTone="review"
      capabilities={[
        'Hints before full solutions, with adjustable explanation depth',
        'Step-by-step derivations and unit or dimensional checks',
        'Context from the selected syllabus and verified question record',
        'Image-based question intake when supported and safe',
        'Conversation history with prompt and model version tracking',
        'Feedback and evaluation for correctness, usefulness, and hallucinations'
      ]}
      prerequisites={['Secure Gemini server-side integration', 'Verified question and concept context', 'Prompt versioning and evaluation tests']}
      nextPath="/architecture"
      nextLabel="Review implementation roadmap"
      note="Live AI answers are disabled until the provider secret, server-side function, safety checks, and evaluation workflow are configured. No simulated AI response is presented as a real model answer."
    />
  );
}
