import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/historical-intelligence', layout: 'owner', access: 'authenticated' };
export const nav = { label: '30-year intelligence', icon: 'BrainCircuit', group: 'Research', order: 30 };

export default function HistoricalIntelligence() {
  return (
    <ModuleWorkspace
      eyebrow="Historical examination research"
      title="30-year exam intelligence engine"
      summary="A research system for historical IIT-JEE, AIEEE, JEE Main, JEE Advanced, AIPMT, and NEET/NEET UG papers. Its outputs must remain grounded in verified papers, syllabus context, and extraction confidence."
      phase="Phase 4"
      status="Not yet ingested"
      statusTone="review"
      capabilities={[
        'Historical paper registry with exam, year, session, and source metadata',
        'OCR and mathematical or diagram extraction with page references',
        'Question DNA, Concept DNA, and Skill DNA profiles',
        'Question-family clustering and concept-combination matrices',
        'Historical difficulty and recurring-pattern observations',
        'Syllabus crosswalks and change-aware year comparisons',
        'Research filters, original practice generation inputs, and exam simulations'
      ]}
      prerequisites={['Source registry and rights review', 'Versioned syllabus crosswalks', 'Question and concept schema', 'Human review of uncertain OCR']}
      nextPath="/sources"
      nextLabel="Open source registry"
      note="Historical frequency is descriptive evidence, not a promise about future papers. Do not publish predictions or probabilities without a validated methodology and uncertainty disclosure."
    />
  );
}
