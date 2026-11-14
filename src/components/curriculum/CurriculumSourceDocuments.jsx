import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const DOCUMENTS = [
  {
    exam: 'JEE Main',
    year: 2026,
    title: 'Paper 1 official syllabus PDF',
    detail: 'NTA syllabus for Mathematics, Physics and Chemistry.',
    url: 'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311323551056.pdf',
    kind: 'Official PDF',
    action: 'Open official PDF'
  },
  {
    exam: 'JEE Main',
    year: 2027,
    title: 'Official syllabus listing',
    detail: 'NTA lists the 2027 syllabus document. The PDF has not yet been imported into Northstar.',
    url: 'https://jeemain.nta.nic.in/document/syllabus-2027/',
    kind: 'Official document page',
    action: 'Open NTA listing'
  },
  {
    exam: 'JEE Advanced',
    year: 2026,
    title: 'Official syllabus PDF',
    detail: 'JEE Advanced 2026 syllabus published by the examination authority.',
    url: 'https://jeeadv.ac.in/documents/jee-advanced-2026-syllabus.pdf',
    kind: 'Official PDF',
    action: 'Open official PDF'
  },
  {
    exam: 'NEET UG',
    year: 2026,
    title: 'Official syllabus PDF',
    detail: 'NEET UG 2026 syllabus published through the official NMC / UGMEB process.',
    url: 'https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/01/202601081066816297.pdf',
    kind: 'Official PDF',
    action: 'Open official PDF'
  }
];

export default function CurriculumSourceDocuments() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-mono text-base font-semibold">Official syllabus documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">Open the issuing authority's original document. A source link is not the same as an extracted, academically reviewed curriculum.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {DOCUMENTS.map((document) => (
          <article key={document.exam + document.year} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{document.exam}</Badge>
              <Badge variant="outline">{document.year}</Badge>
              <span className="text-xs text-muted-foreground">{document.kind}</span>
            </div>
            <h3 className="mt-3 font-semibold">{document.title}</h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{document.detail}</p>
            <Button asChild size="sm" variant="outline" className="mt-4">
              <a href={document.url} target="_blank" rel="noreferrer">
                <ApperIcon name="ExternalLink" size={14} /> {document.action}
              </a>
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
