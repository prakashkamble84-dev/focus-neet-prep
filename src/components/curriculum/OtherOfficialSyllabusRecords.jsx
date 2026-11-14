import { Badge } from '@/components/ui/badge';
import ApperIcon from '@/components/ApperIcon';

function Status({ value }) {
  const tone = ['Published', 'Verified', 'Approved'].includes(value)
    ? 'border-success/30 bg-success/10 text-success'
    : ['Rejected'].includes(value)
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : ['Review', 'Draft', 'Ready', 'Discovered', 'Retrieved'].includes(value)
        ? 'border-warning/30 bg-warning/10 text-warning-foreground'
        : 'border-border bg-muted text-muted-foreground';
  return <Badge variant="outline" className={tone}>{value || 'Not set'}</Badge>;
}

export default function OtherOfficialSyllabusRecords({ syllabi }) {
  const jeeMain2027 = syllabi.find((item) => item.version_label_c === 'JEE Main Paper 1 · 2027');
  const jeeAdvanced2026 = syllabi.find((item) => item.version_label_c === 'JEE Advanced · 2026');

  return (
    <section className="space-y-3">
      <h2 className="font-mono text-base font-semibold">Other official syllabus records</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">JEE Main · 2027</p>
            <Status value={jeeMain2027 ? 'Discovered' : 'Not registered'} />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            NTA's current Documents index lists the 2027 syllabus and information bulletin. The 2027 syllabus PDF has not yet been uploaded into Northstar, so no topics have been extracted or imported. Do not reuse the 2026 unit outline as a substitute.
          </p>
          <a href="https://jeemain.nta.nic.in/document/syllabus-2027/" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">
            Open official NTA 2027 syllabus listing <ApperIcon name="ExternalLink" size={12} />
          </a>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">JEE Advanced · 2026</p>
            <Status value={jeeAdvanced2026?.status_c || 'Review'} />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The official 2026 syllabus PDF states that the syllabus is unchanged from 2025. It is registered separately. Detailed topic extraction is not imported in this pass and remains in Review until checked.
          </p>
          <a href="https://jeeadv.ac.in/documents/jee-advanced-2026-syllabus.pdf" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">
            Open official JEE Advanced syllabus <ApperIcon name="ExternalLink" size={12} />
          </a>
        </div>
      </div>
    </section>
  );
}
