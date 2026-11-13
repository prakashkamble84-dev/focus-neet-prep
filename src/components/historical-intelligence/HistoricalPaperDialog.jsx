import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import ApperIcon from '@/components/ApperIcon';

const CURRENT_YEAR = new Date().getFullYear();

export default function HistoricalPaperDialog({ examinations = [], sourceDocuments = [], onSaved }) {
  const [open, setOpen] = useState(false);
  const [examId, setExamId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [session, setSession] = useState('');
  const [paperCode, setPaperCode] = useState('');
  const [paperType, setPaperType] = useState('Main');
  const [questionCount, setQuestionCount] = useState('');
  const [saving, setSaving] = useState(false);

  const paperSources = useMemo(() => sourceDocuments.filter((document) => (
    document.document_type_c === 'Paper' &&
    ['Official', 'Archive'].includes(document.source_category_c)
  )), [sourceDocuments]);

  function resetForm() {
    setExamId('');
    setSourceId('');
    setYear(String(CURRENT_YEAR));
    setSession('');
    setPaperCode('');
    setPaperType('Main');
    setQuestionCount('');
  }

  async function savePaper(event) {
    event.preventDefault();

    const numericYear = Number(year);
    const exam = examinations.find((item) => String(item.Id) === String(examId));
    const source = paperSources.find((item) => String(item.Id) === String(sourceId));

    if (!exam || !source || !Number.isInteger(numericYear) || numericYear < CURRENT_YEAR - 29 || numericYear > CURRENT_YEAR || !paperCode.trim()) {
      toast.error('Complete the examination, source, year and paper code fields.');
      return;
    }

    const numericQuestionCount = questionCount.trim() ? Number(questionCount) : null;
    if (numericQuestionCount !== null && (!Number.isInteger(numericQuestionCount) || numericQuestionCount < 1)) {
      toast.error('Question count must be a positive whole number.');
      return;
    }

    setSaving(true);
    try {
      const nameParts = [exam.Name, numericYear, session.trim(), paperCode.trim()].filter(Boolean);
      const payload = {
        Name: nameParts.join(' · '),
        examination_c: exam.Id,
        source_document_c: source.Id,
        exam_year_c: numericYear,
        session_c: session.trim(),
        paper_code_c: paperCode.trim(),
        paper_type_c: paperType,
        rights_status_c: source.rights_status_c || 'Unknown',
        status_c: 'New',
        review_notes_c: 'Paper metadata registered. Source provenance, question extraction, answer validation and rights must pass review before historical trend use.'
      };
      if (numericQuestionCount !== null) {
        payload.question_count_c = numericQuestionCount;
      }

      const result = await sdk.table('historical_papers_c').create(payload);
      if (result.messages?.length) {
        toast.error(result.messages[0], { description: result.messages.slice(1).join('\n') || undefined });
      }
      if (!result.data?.length) {
        return;
      }

      toast.success('Historical paper registered in the New review state.');
      setOpen(false);
      resetForm();
      await onSaved?.();
    } catch (error) {
      toast.error('Paper registration failed', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ApperIcon name="FilePlus2" size={16} className="mr-2" />
          Register paper
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Register a historical paper</DialogTitle>
          <DialogDescription>
            This creates a New metadata record only. It does not mark a paper as verified or make it eligible for trend analysis.
          </DialogDescription>
        </DialogHeader>

        {paperSources.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">No eligible paper source is registered yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the official or archived paper PDF in the source registry first.
            </p>
            <Button asChild variant="outline" className="mt-3">
              <Link to="/sources">Open source registry</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={savePaper} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paper-exam">Examination</Label>
                <select
                  id="paper-exam"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={examId}
                  onChange={(event) => setExamId(event.target.value)}
                  required
                >
                  <option value="">Select examination</option>
                  {examinations.map((exam) => (
                    <option key={exam.Id} value={exam.Id}>{exam.Name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paper-source">Source document</Label>
                <select
                  id="paper-source"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={sourceId}
                  onChange={(event) => setSourceId(event.target.value)}
                  required
                >
                  <option value="">Select source PDF</option>
                  {paperSources.map((document) => (
                    <option key={document.Id} value={document.Id}>
                      {document.Name} · {document.rights_status_c || 'Rights unknown'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paper-year">Exam year</Label>
                <Input
                  id="paper-year"
                  type="number"
                  min={CURRENT_YEAR - 29}
                  max={CURRENT_YEAR}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paper-session">Session or paper slot</Label>
                <Input
                  id="paper-session"
                  placeholder="For example, Session 1 or Paper 2"
                  value={session}
                  onChange={(event) => setSession(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paper-code">Paper code</Label>
                <Input
                  id="paper-code"
                  placeholder="For example, JMAIN-2026-S1"
                  value={paperCode}
                  onChange={(event) => setPaperCode(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paper-type">Paper type</Label>
                <select
                  id="paper-type"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={paperType}
                  onChange={(event) => setPaperType(event.target.value)}
                >
                  <option value="Main">Main</option>
                  <option value="Advanced">Advanced</option>
                  <option value="NEET">NEET</option>
                  <option value="Legacy">Legacy</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paper-question-count">Expected question count (optional)</Label>
              <Input
                id="paper-question-count"
                type="number"
                min="1"
                placeholder="Enter the official count when known"
                value={questionCount}
                onChange={(event) => setQuestionCount(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !examinations.length}>
                {saving ? (
                  <>
                    <ApperIcon name="LoaderCircle" size={16} className="mr-2 animate-spin" />
                    Registering…
                  </>
                ) : 'Register as New'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
