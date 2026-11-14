import FilePicker from '@/components/FilePicker';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function SourceUploadDialog({
  open,
  onOpenChange,
  version,
  files,
  onFilesChange,
  saving,
  onSave
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attach official PDF</DialogTitle>
          <DialogDescription>{version?.official_title_c || version?.Name || 'Selected document version'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Original PDF file</Label>
          <FilePicker
            value={files}
            onChange={onFilesChange}
            maxFiles={1}
            fieldConfig={{ supportedExtensions: ['pdf'], supportMultipleValues: false, minValue: 0, maxValue: 20480 }}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            The PDF is stored in private platform storage. Uploading does not grant redistribution rights or publish the syllabus.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={onSave} disabled={saving || !files.length}>
            {saving ? 'Saving…' : 'Save PDF attachment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SourceRightsDialog({
  open,
  onOpenChange,
  version,
  rightsStatus,
  onRightsStatusChange,
  authorityChecked,
  onAuthorityCheckedChange,
  metadataChecked,
  onMetadataCheckedChange,
  reviewNotes,
  onReviewNotesChange,
  saving,
  canReview,
  onSave
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review document usage rights</DialogTitle>
          <DialogDescription>
            Record the reuse decision for {version?.official_title_c || version?.Name || 'this document'}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Rights decision</Label>
            <Select value={rightsStatus} onValueChange={onRightsStatusChange}>
              <SelectTrigger><SelectValue placeholder="Select rights status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Unknown">Unknown · do not publish</SelectItem>
                <SelectItem value="Licensed">Licensed · permission recorded</SelectItem>
                <SelectItem value="Public">Public · permitted use basis recorded</SelectItem>
                <SelectItem value="Restricted">Restricted · do not redistribute</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Verification checks</Label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={authorityChecked} onChange={(event) => onAuthorityCheckedChange(event.target.checked)} className="mt-0.5" />
              <span>I matched the issuing authority and official domain during this first-pass review.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={metadataChecked} onChange={(event) => onMetadataCheckedChange(event.target.checked)} className="mt-0.5" />
              <span>I matched the document title, version and academic-year metadata to the official page or PDF.</span>
            </label>
          </div>
          <div className="space-y-2">
            <Label>Evidence and reviewer notes</Label>
            <Textarea
              value={reviewNotes}
              onChange={(event) => onReviewNotesChange(event.target.value)}
              rows={4}
              placeholder="Record the official terms, licence, public-use basis, or reason for restriction…"
            />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Rights, authority and metadata checks are recorded separately. This does not approve syllabus topics, complete OCR, or publish a syllabus version.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={onSave} disabled={saving || !canReview}>{saving ? 'Saving…' : 'Save rights review'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
