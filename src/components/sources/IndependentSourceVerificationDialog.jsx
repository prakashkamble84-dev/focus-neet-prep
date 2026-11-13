import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { evaluateIndependentSourceVerification } from '@/services/sourceVerificationService';

export default function IndependentSourceVerificationDialog({
  open,
  onOpenChange,
  version,
  document,
  authority,
  verifications,
  reviewerId,
  saving,
  onSave
}) {
  const [authority, setAuthority] = useState(false);
  const [metadata, setMetadata] = useState(false);
  const [rights, setRights] = useState(false);
  const [pdfIntegrity, setPdfIntegrity] = useState(false);
  const [officialOriginConfirmed, setOfficialOriginConfirmed] = useState(false);
  const [notes, setNotes] = useState('');

  const evaluation = useMemo(() => evaluateIndependentSourceVerification({
    version,
    document,
    authority,
    verifications,
    reviewerId,
    checks: { authority, metadata, rights, pdfIntegrity, officialOriginConfirmed, notes }
  }), [version, document, authority, verifications, reviewerId, authority, metadata, rights, pdfIntegrity, officialOriginConfirmed, notes]);

  useEffect(() => {
    if (!open) return;
    setAuthority(false);
    setMetadata(false);
    setRights(false);
    setPdfIntegrity(false);
    setOfficialOriginConfirmed(false);
    setNotes('');
  }, [open, version?.Id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Independent source verification</DialogTitle>
          <DialogDescription>
            A second reviewer must independently confirm this document version before Northstar can mark it Verified.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border p-3">
            <p className="font-semibold">{version?.official_title_c || version?.Name || 'Source version'}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{version?.document_url_c || document?.official_url_c}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{version?.version_label_c || 'Version not labelled'}</Badge>
              <Badge variant="outline">{version?.rights_status_c || 'Rights unknown'}</Badge>
              <Badge variant="outline">{authority?.official_domain_c || 'Authority domain missing'}</Badge>
              <Badge variant="outline">{version?.document_file_c?.length ? 'PDF stored' : 'PDF not stored'}</Badge>
            </div>
          </div>
          <div className="space-y-3">
            {[
              [authority, setAuthority, 'I independently matched the issuing authority and official domain.'],
              [metadata, setMetadata, 'I independently matched the document title, version and academic year.'],
              [rights, setRights, 'I independently confirmed that the Public or Licensed usage basis is valid.'],
              [pdfIntegrity, setPdfIntegrity, 'I opened the stored PDF and confirmed it matches the linked official document.']
            ].map(([checked, setChecked, label]) => (
              <label key={label} className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} className="mt-0.5" />
                <span>{label}</span>
              </label>
            ))}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={officialOriginConfirmed} onChange={(event) => setOfficialOriginConfirmed(event.target.checked)} className="mt-0.5" />
              <span>The official authority website links to the CDN or file host used by this document.</span>
            </label>
          </div>
          <div className="space-y-2">
            <Label>Independent verification evidence</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Record the official page where the PDF was linked, the version/date checked, rights notice or licence basis, and any discrepancy resolved." />
          </div>
          {evaluation.issues.length > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
              <p className="text-sm font-semibold">Cannot finalise yet</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                {evaluation.issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            </div>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            The independent reviewer must be a different signed-in person from the first-pass rights, authority and metadata reviewer. This check records a real second-person decision; it cannot be self-approved.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={() => onSave({ authority, metadata, rights, pdfIntegrity, officialOriginConfirmed, notes })} disabled={saving || !evaluation.valid}>
            {saving ? 'Recording independent check…' : 'Complete independent verification'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
