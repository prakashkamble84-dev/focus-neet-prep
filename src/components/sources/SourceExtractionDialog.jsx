import { useEffect, useState } from 'react';
import { sdk } from '@/services/sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function SourceExtractionDialog({ open, onOpenChange, version, onSaved }) {
  const [pageNumber, setPageNumber] = useState('');
  const [sectionTitle, setSectionTitle] = useState('');
  const [contentKind, setContentKind] = useState('Text');
  const [extractedText, setExtractedText] = useState('');
  const [confidence, setConfidence] = useState('1');
  const [imageCount, setImageCount] = useState('0');
  const [equationCount, setEquationCount] = useState('0');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPageNumber('');
    setSectionTitle('');
    setContentKind('Text');
    setExtractedText('');
    setConfidence('1');
    setImageCount('0');
    setEquationCount('0');
    setReviewerNotes('');
  }, [open, version?.Id]);

  async function handleSave() {
    const page = Number(pageNumber);
    const quality = Number(confidence);
    if (!version?.Id) {
      toast.error('Select a source document version first');
      return;
    }
    if (!Number.isInteger(page) || page < 1) {
      toast.error('Enter a valid one-based PDF page number');
      return;
    }
    if (!extractedText.trim()) {
      toast.error('Add the extracted text or describe the page content');
      return;
    }
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
      toast.error('Extraction confidence must be between 0 and 1');
      return;
    }

    setSaving(true);
    try {
      const result = await sdk.table('source_extractions_c').create({
        Name: `Page ${page} · ${sectionTitle.trim() || contentKind}`,
        document_version_c: version.Id,
        page_number_c: page,
        section_title_c: sectionTitle.trim() || `Page ${page}`,
        content_kind_c: contentKind,
        extraction_method_c: 'Manual',
        extracted_text_c: extractedText.trim(),
        confidence_c: quality,
        image_count_c: Math.max(0, Number(imageCount) || 0),
        equation_count_c: Math.max(0, Number(equationCount) || 0),
        quality_status_c: 'Review',
        reviewer_notes_c: reviewerNotes.trim() || 'Manually captured; independent review required.'
      });
      if (!result.data?.length) {
        toast.error(result.messages?.join('; ') || result.message || 'Extraction record was not saved');
        return;
      }
      toast.success('Page extraction record saved', {
        description: `Page ${page} is stored in Review and is not yet approved for publication.`
      });
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error('Page extraction could not be saved', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add manual page extraction</DialogTitle>
          <DialogDescription>{version?.official_title_c || version?.Name || 'Source document version'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>PDF page number</Label>
            <Input type="number" min="1" step="1" value={pageNumber} onChange={(event) => setPageNumber(event.target.value)} placeholder="1" />
          </div>
          <div className="space-y-2">
            <Label>Section heading</Label>
            <Input value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} placeholder="e.g. Physics · Unit 1" />
          </div>
          <div className="space-y-2">
            <Label>Page content kind</Label>
            <Select value={contentKind} onValueChange={setContentKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Text">Text</SelectItem>
                <SelectItem value="Table">Table</SelectItem>
                <SelectItem value="Equation">Equation</SelectItem>
                <SelectItem value="Diagram">Diagram</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Extraction confidence (0–1)</Label>
            <Input type="number" min="0" max="1" step="0.01" value={confidence} onChange={(event) => setConfidence(event.target.value)} placeholder="1.00" />
          </div>
          <div className="space-y-2">
            <Label>Images on page</Label>
            <Input type="number" min="0" step="1" value={imageCount} onChange={(event) => setImageCount(event.target.value)} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>Equations on page</Label>
            <Input type="number" min="0" step="1" value={equationCount} onChange={(event) => setEquationCount(event.target.value)} placeholder="0" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Extracted content or diagram description</Label>
            <Textarea value={extractedText} onChange={(event) => setExtractedText(event.target.value)} rows={6} placeholder="Transcribe the official page content faithfully. Preserve equations, units, numbering and source wording." />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Reviewer notes</Label>
            <Textarea value={reviewerNotes} onChange={(event) => setReviewerNotes(event.target.value)} rows={2} placeholder="OCR corrections, uncertain symbols, missing diagram labels, or verification notes…" />
          </div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Records are saved as Review. This form does not certify mathematical correctness, OCR quality, syllabus fit or redistribution rights.
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save page record'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
