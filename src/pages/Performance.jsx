import ModuleWorkspace from '@/components/ModuleWorkspace';

export const route = { path: '/performance', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Performance', icon: 'ChartNoAxesCombined', group: 'Improve', order: 90 };

export default function Performance() {
  return (
    <ModuleWorkspace
      eyebrow="Learning analytics"
      title="Performance and readiness"
      summary="Convert validated study activity and assessment results into understandable progress signals. Separate observed performance from estimates and uncertainty."
      phase="Phase 13"
      status="Awaiting assessment data"
      statusTone="review"
      capabilities={[
        'Subject, chapter, concept, and skill-level performance',
        'Accuracy, speed, consistency, and retention trends',
        'Readiness indicators with transparent evidence and uncertainty',
        'Historical cohort comparisons only when valid benchmarks exist',
        'Study-plan adherence and intervention signals',
        'No guaranteed ranks, fabricated percentiles, or unsupported predictions'
      ]}
      prerequisites={['Mock exam scoring', 'Validated attempt history', 'Benchmark dataset governance']}
      nextPath="/mock-tests"
      nextLabel="Review mock examinations"
    />
  );
}
