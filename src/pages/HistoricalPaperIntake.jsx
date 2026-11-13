import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/layouts/RootLayout';
import { useFetch } from '@/hooks/useFetch';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';
import {
  extractPdfPagesFromFile
} from '@/services/historicalPdfIngestionService';
import {
  fetchHistoricalPaperIntakeLookups,
  registerHistoricalPaperBundle
} from '@/services/historicalPaperIntakeService';

export const route = {
  path: '/historical-intelligence/papers/new',
  layout: 'owner',
  access: "profile === 'CEO' || profile === 'CEO_c' || profile === 'Manager' || profile === 'Manager_c' || profile === 'AcademicExpert_c'"
};

const CURRENT_YEAR = new Date().getFullYear();

export default function HistoricalPaperIntake() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, run } = useFetch(fetchHistoricalPaperIntakeLookups, []);
  const [examinationId, setExaminationId] = useState('');
  const [authorityId, setAuthorityId] = useState('');
  const [academicYear, setAcademicYear] = useState(String(CURRENT_YEAR));
  const [session, setSession] = useState('');
  const [paperCode, setPaperCode] = useState('');
  const [paperType, setPaperType] = useState('Main');
  const [declaredQuestionCount, setDeclaredQuestionCount] = useState('');
  const [sourceCategory, setSourceCategory] = useState('Official');
  const [officialUrl, setOfficialUrl] = useState('');
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('eng');
  const [pages, setPages] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [analysing, setAnalysing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });

  const examinations = data?.examinations || [];
  const authorities = data?.authorities || [];
  const selectedExam = examinations.find((item) => String(item.Id) === String(examinationId));
  const selectedAuthority = authorities.find((item) => String(item.Id) === String(authorityId));

  const allCandidates = useMemo(
    () => pages.flatMap((page) => page.candidates || []),
    [pages]
  );
  const selectedCount = selectedCandidates.length;

  function handleExamChange(value) {
    setExaminationId(value);
    const exam = examinations.find((item) => String(item.Id) === String(value));
    if (exam?.exam_type_c === 'JEE Adv') setPaperType('Advanced');
    else if (exam?.exam_type_c === 'NEET UG') setPaperType('NEET');
    else setPaperType('Main');
  }

  function toggleCandidate(key, checked) {
    setSelectedCandidates((current) => (
      checked
        ? [...current, key]
        : current.filter((item) => item !== key)
    ));
  }

  async function analysePdf() {
    if (!file) {
      toast.error('Choose a PDF before analysis.');
      return;
    }
    setAnalysing(true);
    setPages([]);
    setSelectedCandidates([]);
    setProgress({ current: 0, total: 0, stage: 'Opening PDF' });

    try {
      const result = await extractPdfPagesFromFile(file, language, setProgress);
      setPages(result);
      setSelectedCandidates([]);
      const ocrPages = result.filter((page) => page.method === 'OCR').length;
      const questionCount = result.reduce((sum, page) => sum + (page.candidates?.length || 0), 0);
      toast.success('PDF analysis complete', {
        description: result.length + ' page(s) · ' + ocrPages + ' OCR page(s) · ' + questionCount + ' question candidate(s)'
      });
    } catch (error) {
      toast.error('PDF analysis failed', { description: error.message });
    } finally {
      setAnalysing(false);
    }
  }

  async function savePaper() {
    if (!selectedExam || !selectedAuthority) {
      toast.error('Select the examination and issuing authority.');
      return;
    }
    if (!file || !pages.length) {
      toast.error('Analyse the PDF before saving the historical paper.');
      return;
    }
    if (!paperCode.trim() || !officialUrl.trim()) {
      toast.error('Paper code and official HTTPS source URL are required.');
      return;
    }

    setSaving(true);
    try {
      const selected = allCandidates.filter((candidate) => selectedCandidates.includes(candidate.key));
      const result = await registerHistoricalPaperBundle({
        examination: selectedExam,
        authority: selectedAuthority,
        academicYear: Number(academicYear),
        session,
        paperCode,
        paperType,
        declaredQuestionCount: declaredQuestionCount.trim() ? Number(declaredQuestionCount) : null,
        sourceCategory,
        officialUrl,
        file,
        pages,
        selectedCandidates: selected,
        uploaderId: user?.userId
      });

      toast.success('Historical paper ingested', {
        description: result.pageCount + ' page record(s) and ' + result.questionCount + ' question draft(s) saved. All remain in Review/New.'
      });
      navigate('/historical-intelligence');
    } catch (error) {
      toast.error('Historical paper intake was incomplete', {
        description: error.message
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-3 border-b border-border pb-5">
        <Link to="/historical-intelligence" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ApperIcon name="ArrowLeft" size={14} />
          Back to historical intelligence
        </Link>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Phase 4 · paper ingestion</p>
        <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Ingest a historical paper</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Upload a paper you are authorised to use. The PDF is parsed in the browser, pages are stored as review records, and detected question blocks become unapproved drafts.
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-5">
            <p className="font-semibold">Exam and authority records could not be loaded</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-3" variant="outline" onClick={run}>Retry</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">Paper identity and provenance</CardTitle>
              <CardDescription>Every paper must trace back to an examination and issuing authority.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="intake-exam">Examination</Label>
                <select
                  id="intake-exam"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={examinationId}
                  onChange={(event) => handleExamChange(event.target.value)}
                  required
                >
                  <option value="">Choose examination</option>
                  {examinations.map((exam) => <option key={exam.Id} value={exam.Id}>{exam.Name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="intake-authority">Issuing authority</Label>
                <select
                  id="intake-authority"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={authorityId}
                  onChange={(event) => setAuthorityId(event.target.value)}
                  required
                >
                  <option value="">Choose authoritative source</option>
                  {authorities.map((authority) => (
                    <option key={authority.Id} value={authority.Id}>
                      {authority.organisation_name_c || authority.Name} · {authority.official_domain_c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="intake-year">Exam year</Label>
                <Input
                  id="intake-year"
                  type="number"
                  min="1997"
                  max={CURRENT_YEAR}
                  value={academicYear}
                  onChange={(event) => setAcademicYear(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intake-session">Session / slot</Label>
                <Input
                  id="intake-session"
                  value={session}
                  onChange={(event) => setSession(event.target.value)}
                  placeholder="Session 1, Paper 2, May attempt"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intake-code">Unique paper code</Label>
                <Input
                  id="intake-code"
                  value={paperCode}
                  onChange={(event) => setPaperCode(event.target.value)}
                  placeholder="JEE-MAIN-2026-S1-P1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intake-type">Paper type</Label>
                <select
                  id="intake-type"
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
              <div className="space-y-2">
                <Label htmlFor="intake-declared-count">Official question count (optional)</Label>
                <Input
                  id="intake-declared-count"
                  type="number"
                  min="1"
                  step="1"
                  value={declaredQuestionCount}
                  onChange={(event) => setDeclaredQuestionCount(event.target.value)}
                  placeholder="The count printed on the official paper or bulletin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intake-category">Source category</Label>
                <select
                  id="intake-category"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={sourceCategory}
                  onChange={(event) => setSourceCategory(event.target.value)}
                >
                  <option value="Official">Official</option>
                  <option value="Archive">Archive</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="intake-url">Official source page or PDF URL</Label>
                <Input
                  id="intake-url"
                  value={officialUrl}
                  onChange={(event) => setOfficialUrl(event.target.value)}
                  placeholder="https://official-domain.example/paper.pdf"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="intake-pdf">Historical question paper PDF</Label>
                <Input
                  id="intake-pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] || null);
                    setPages([]);
                    setSelectedCandidates([]);
                  }}
                />
                <p className="text-xs text-muted-foreground">PDF only · 20 MB maximum · uploaded into private platform storage after analysis. Question candidates are deliberately unselected until you inspect them.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="intake-language">OCR language for scanned pages</Label>
                <select
                  id="intake-language"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="eng">English</option>
                  <option value="eng+hin">English + Hindi</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">PDF extraction</CardTitle>
              <CardDescription>
                Native PDF text is extracted directly. Pages without readable text are rendered and passed through browser-side Tesseract OCR.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={analysePdf} disabled={analysing || saving || !file}>
                  {analysing ? <ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" /> : <ApperIcon name="ScanText" size={15} className="mr-2" />}
                  {analysing ? 'Analysing PDF…' : 'Analyse PDF pages'}
                </Button>
                {pages.length > 0 && (
                  <Badge variant="secondary">{pages.length} page(s) analysed</Badge>
                )}
                {pages.length > 0 && (
                  <Badge variant="outline">{allCandidates.length} question candidate(s)</Badge>
                )}
              </div>

              {analysing && (
                <div className="space-y-2">
                  <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                    <span>{progress.stage || 'Processing'}</span>
                    <span>{progress.current || 0} / {progress.total || '…'}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: progress.total ? ((progress.current / progress.total) * 100) + '%' : '4%' }}
                    />
                  </div>
                </div>
              )}

              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm leading-6">
                OCR is approximate. It can confuse minus signs, powers, Greek symbols, fractions, matrices, units and option labels. Image counts flag likely diagram pages, but diagrams are not reconstructed into vector drawings. A human must compare every extraction against the original PDF before approval.
              </div>

              {pages.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Page extraction preview</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">{selectedCount} question candidate(s) selected for draft creation</p>
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelectedCandidates(allCandidates.map((candidate) => candidate.key))}>
                        Select detected questions
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedCandidates([])}>
                        Clear selection
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                    {pages.map((page) => (
                      <article key={page.pageNumber} className="rounded-md border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Page {page.pageNumber}</Badge>
                            <Badge variant={page.method === 'OCR' ? 'secondary' : 'outline'}>{page.method}</Badge>
                            <Badge variant="outline">{page.confidence === null ? 'Native text · not scored' : Math.round(page.confidence * 100) + '% OCR estimate'}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <span>{page.imageCount} image(s)</span>
                            <span>{page.equationCount} math marker(s)</span>
                            <span>{page.candidates.length} question candidate(s)</span>
                          </div>
                        </div>
                        {page.previewImage && (
                          <a href={page.previewImage} target="_blank" rel="noopener noreferrer" className="mt-3 block max-w-md">
                            <img src={page.previewImage} alt={'Original PDF page ' + page.pageNumber + ' preview'} className="max-h-64 w-auto rounded border border-border bg-background object-contain" />
                            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary">Open page preview <ApperIcon name="ExternalLink" size={12} /></span>
                          </a>
                        )}
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                          {(page.text || '[No text detected on this page]').slice(0, 1100)}
                          {page.text.length > 1100 ? '…' : ''}
                        </p>
                        {page.candidates.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-border pt-3">
                            <p className="text-xs font-semibold">Detected question blocks</p>
                            {page.candidates.map((candidate) => (
                              <label key={candidate.key} className="flex items-start gap-2 rounded-sm bg-muted/30 p-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={selectedCandidates.includes(candidate.key)}
                                  onChange={(event) => toggleCandidate(candidate.key, event.target.checked)}
                                  className="mt-0.5"
                                />
                                <span>
                                  <span className="font-mono font-semibold">Q{candidate.questionNumber}</span>
                                  <span className="ml-2 text-muted-foreground">{candidate.body.slice(0, 220)}{candidate.body.length > 220 ? '…' : ''}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                        {(page.imageCount > 0 || page.equationCount > 0 || page.method === 'OCR') && (
                          <p className="mt-2 text-[11px] leading-5 text-warning-foreground">{page.reviewerNotes}</p>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
              Saving uploads the original PDF, creates its source document/version, stores one Review extraction record per page, and creates Review question drafts from selected blocks. Unknown rights are copied to the paper and question drafts.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/historical-intelligence">Cancel</Link>
              </Button>
              <Button onClick={savePaper} disabled={saving || analysing || !pages.length || !selectedExam || !selectedAuthority}>
                {saving ? <ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" /> : <ApperIcon name="DatabaseZap" size={15} className="mr-2" />}
                {saving ? 'Saving records…' : 'Save paper and extracts'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
