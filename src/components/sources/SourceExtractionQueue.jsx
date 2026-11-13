import { useMemo, useState } from 'react';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { independentlyReviewPageExtraction } from '@/services/sourcePageReviewService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ApperIcon from '@/components/ApperIcon';
import { toast } from 'sonner';

async function fetchExtractions() {
  const result = await sdk.table('source_extractions_c')
    .select(['Id', 'Name', 'CreatedBy', 'Owner', 'document_version_c', 'page_number_c', 'section_title_c', 'content_kind_c', 'extraction_method_c', 'extracted_text_c', 'confidence_c', 'image_count_c', 'equation_count_c', 'quality_status_c', 'reviewer_notes_c'])
    .limit(200, 0)
    .fetch();
  if (!result.success) throw new Error(result.message || 'Could not load page extraction records');
  return result.data ?? [];
}

function QualityStatus({ value }) {
  const tone = value === 'Verified'
    ? 'border-success/30 bg-success/10 text-success'
    : value === 'Rejected'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : 'border-warning/30 bg-warning/10 text-warning-foreground';
  return <Badge variant="outline" className={tone}>{value || 'Review'}</Badge>;
}

export default function SourceExtractionQueue() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const reviewerId = user?.userId;
  const canReview = ['CEO', 'Manager', 'AcademicExpert_c', 'ContentReviewer_c'].includes(profile);
  const { data, loading, error, run } = useFetch(fetchExtractions, []);
  const [savingId, setSavingId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const rows = data ?? [];
  const pending = useMemo(() => rows.filter((row) => row.quality_status_c === 'Review' || row.quality_status_c === 'Pending'), [rows]);
  const visible = showAll ? rows : pending;

  async function decide(row, decision) {
    if (!canReview) return;
    setSavingId(row.Id);
    try {
      const result = await independentlyReviewPageExtraction(row, decision, reviewerId);
      if (!result.success) {
        toast.error(result.message || 'Independent extraction review was not saved');
        return;
      }
      toast.success(`Page ${row.page_number_c}: extraction ${decision.toLowerCase()} with review history`);
      await run();
    } catch (error) {
      toast.error('Extraction review failed', { description: error.message });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-mono text-base font-semibold">Page extraction review queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review manually captured text, page numbers, equations and diagram descriptions. Approval applies only to this extraction record.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{pending.length} pending</Badge>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Show pending' : 'Show all'}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold">Could not load extraction records</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => run()}>Retry</Button>
        </div>
      ) : loading && !data ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Loading page extraction records…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-7 text-center">
          <ApperIcon name="FileCheck2" size={22} className="mx-auto text-primary" />
          <p className="mt-3 font-semibold">{showAll ? 'No extraction records yet' : 'No pending extraction reviews'}</p>
          <p className="mt-1 text-sm text-muted-foreground">Attach a source PDF, then add a page record from its document card.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((row) => (
            <article key={row.Id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{row.section_title_c || row.Name || `Page ${row.page_number_c}`}</p>
                    <Badge variant="outline">PDF page {row.page_number_c}</Badge>
                    <QualityStatus value={row.quality_status_c} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.document_version_c?.Name || 'Source document version'} · {row.extraction_method_c || 'Method not set'} · {row.content_kind_c || 'Content not classified'}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">{row.extracted_text_c}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Confidence: {Number(row.confidence_c ?? 0).toFixed(2)}</span>
                    <span>Images: {row.image_count_c || 0}</span>
                    <span>Equations: {row.equation_count_c || 0}</span>
                  </div>
                  {row.reviewer_notes_c && <p className="text-xs leading-5 text-muted-foreground">Note: {row.reviewer_notes_c}</p>}
                </div>
                {canReview && (row.quality_status_c === 'Review' || row.quality_status_c === 'Pending') && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" disabled={savingId === row.Id} onClick={() => decide(row, 'Rejected')}>
                      Reject
                    </Button>
                    <Button size="sm" disabled={savingId === row.Id} onClick={() => decide(row, 'Verified')}>
                      {savingId === row.Id ? 'Saving…' : 'Verify extraction'}
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs leading-5 text-muted-foreground">
        This queue is for source extraction quality only. It does not approve rights, validate syllabus applicability, publish curriculum nodes, or certify mathematical correctness.
      </p>
    </section>
  );
}
