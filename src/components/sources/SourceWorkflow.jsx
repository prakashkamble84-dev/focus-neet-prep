import ApperIcon from '@/components/ApperIcon';
import SourceExtractionQueue from '@/components/sources/SourceExtractionQueue';

const steps = [
  ['01', 'Discover and register', 'Record the issuing authority, official domain, title, academic year and original document URL.'],
  ['02', 'Retrieve and preserve', 'Upload the original PDF into private storage. Preserve the URL, file metadata, version label and checksum.'],
  ['03', 'Extract page by page', 'Capture text, tables, equations and diagrams with page numbers and confidence values.'],
  ['04', 'Verify source and rights', 'Review authority, document metadata, permitted use and extraction quality independently.'],
  ['05', 'Map curriculum', 'Create versioned syllabus nodes with page-level source references and import-batch lineage.'],
  ['06', 'Approve publication', 'Academic reviewers approve a syllabus version and its changed nodes before student-facing publication.']
];

export default function SourceWorkflow() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {steps.map(([number, title, detail]) => (
        <div key={number} className="flex gap-3 rounded-lg border border-border bg-card p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent font-mono text-xs font-semibold text-primary">{number}</span>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
          </div>
        </div>
      ))}
      <div className="md:col-span-2">
        <SourceExtractionQueue />
      </div>
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 md:col-span-2">
        <div className="flex items-start gap-3">
          <ApperIcon name="ScanSearch" size={18} className="mt-0.5 shrink-0 text-warning-foreground" />
          <div>
            <p className="font-semibold">Equation and diagram extraction not enabled yet</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Page-level OCR is available from the extraction dialog and always needs reviewer verification. Equation parsing and diagram recognition still need evaluation tests before they can be enabled.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
