import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function Status({ value }) {
  const tone = value === 'Verified' || value === 'Licensed' || value === 'Public' || value === 'Complete'
    ? 'border-success/30 bg-success/10 text-success'
    : value === 'Rejected' || value === 'Restricted' || value === 'Failed'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : value === 'Review' || value === 'Queued' || value === 'Retrieved' || value === 'Discovered'
        ? 'border-warning/30 bg-warning/10 text-warning-foreground'
        : 'border-border bg-muted text-muted-foreground';
  return <Badge variant="outline" className={tone}>{value || 'Not set'}</Badge>;
}

export default function SourceVersionCard({ version, parent, canReview, onUpload, onReview, onExtract }) {
  const fileCount = version.document_file_c?.length ?? 0;
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{version.official_title_c || version.Name}</h3>
            <Badge variant="outline">{version.academic_year_c || version.version_label_c || 'Version'}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{parent?.Name || 'Parent document record'} · {version.version_label_c || 'Unversioned'}</p>
          <div className="flex flex-wrap gap-2">
            <Status value={version.ingestion_status_c} />
            <Status value={version.rights_status_c} />
            <Status value={version.version_status_c} />
            <Badge variant="outline">{fileCount ? 'PDF stored' : 'PDF not stored'}</Badge>
          </div>
          {version.change_summary_c && <p className="max-w-4xl text-sm leading-5 text-muted-foreground">{version.change_summary_c}</p>}
          <a href={version.document_url_c} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 break-all text-xs font-medium text-primary hover:underline">
            <ApperIcon name="ExternalLink" size={13} /> Open official document
          </a>
        </div>
        {canReview && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onUpload(version)}>
              <ApperIcon name="Upload" size={14} /> {fileCount ? 'Manage PDF' : 'Attach PDF'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExtract(version)}>
              <ApperIcon name="FileText" size={14} /> Add page record
            </Button>
            <Button size="sm" onClick={() => onReview(version)}>
              <ApperIcon name="ClipboardCheck" size={14} /> Review rights
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
