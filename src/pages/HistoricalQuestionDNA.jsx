import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';
import { saveHistoricalQuestionDNA } from '@/services/historicalQuestionDNAService';
import {
  fetchHistoricalQuestionReviewData,
  recordHistoricalQuestionReview
} from '@/services/historicalQuestionReviewService';

export const route = {
  path: '/historical-intelligence/questions/:id',
  layout: 'owner',
  access: "profile === 'CEO' || profile === 'CEO_c' || profile === 'Manager' || profile === 'Manager_c' || profile === 'AcademicExpert_c' || profile === 'ContentReviewer_c'"
};

const ACADEMIC_PROFILES = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'];
const EXTRACTION_PROFILES = [...ACADEMIC_PROFILES, 'ContentReviewer_c'];

function ReviewStatus({ label, value }) {
  const tone = value === 'Approved'
    ? 'secondary'
    : value === 'Rejected'
      ? 'destructive'
      : 'outline';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={tone}>{value || 'Not reviewed'}</Badge>
    </div>
  );
}

export default function HistoricalQuestionDNA() {
  const { id } = useParams();
  const { profile } = useProfile();
  const { user } = useAuth();
  const canEdit = ACADEMIC_PROFILES.includes(profile);
  const canReviewExtraction = EXTRACTION_PROFILES.includes(profile);
  const { data, loading, error, run } = useFetch(
    () => fetchHistoricalQuestionReviewData(id),
    [id]
  );

  const question = data?.question;
  const [form, setForm] = useState({});
  const [answerKey, setAnswerKey] = useState('');
  const [solution, setSolution] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [decision, setDecision] = useState('Approved');
  const [saving, setSaving] = useState(false);
  const [activeAction, setActiveAction] = useState('');

  useEffect(() => {
    if (!question) return;
    setForm({
      question_family_code_c: question.question_family_code_c || '',
      recurring_pattern_group_c: question.recurring_pattern_group_c || '',
      concept_dna_c: question.concept_dna_c || '',
      skill_dna_c: question.skill_dna_c || '',
      approach_pattern_c: question.approach_pattern_c || '',
      concept_combination_c: question.concept_combination_c || '',
      difficulty_c: question.difficulty_c || 'Moderate'
    });
    setAnswerKey(question.answer_key_c || '');
    setSolution(question.solution_c || '');
  }, [question]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveDNA() {
    setSaving(true);
    setActiveAction('dna');
    try {
      const result = await saveHistoricalQuestionDNA(question, form, user?.userId);
      if (!result.success) {
        toast.error('Question DNA was not saved', { description: result.message });
        return;
      }
      toast.success('Question DNA saved. The question remains in Review.');
      setReviewNotes('');
      await run();
    } catch (saveError) {
      toast.error('Question DNA update failed', { description: saveError.message });
    } finally {
      setSaving(false);
      setActiveAction('');
    }
  }

  async function runReviewAction(action, nextDecision = decision) {
    if (!reviewNotes.trim()) {
      toast.error('Add review notes before recording this decision.');
      return;
    }

    setSaving(true);
    setActiveAction(action);
    try {
      const result = await recordHistoricalQuestionReview({
        question,
        paper: data.paper,
        sourceDocument: data.sourceDocument,
        reviews: data.reviews,
        creatorId: data.creatorId,
        reviewerId: user?.userId,
        reviewerProfile: profile,
        action,
        decision: nextDecision,
        answerKey,
        solution,
        notes: reviewNotes
      });

      if (!result.success) {
        toast.error('Review action blocked', { description: result.message });
        return;
      }

      toast.success(result.message || 'Review decision recorded.');
      setReviewNotes('');
      await run();
    } catch (reviewError) {
      toast.error('Question review failed', { description: reviewError.message });
    } finally {
      setSaving(false);
      setActiveAction('');
    }
  }

  const locked = !canEdit || !question || ['Verified', 'Published'].includes(question.status_c);
  const paper = data?.paper;
  const source = data?.sourceDocument;
  const sourceMatches = data?.sourceMatches === true;
  const latestExtraction = data?.latestExtractionReview;
  const latestAnswer = data?.latestAnswerReview;
  const latestCopyright = data?.latestCopyrightReview;
  const latestAcademic = data?.latestAcademicReview;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3 border-b border-border pb-5">
        <Link to="/historical-intelligence" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ApperIcon name="ArrowLeft" size={14} />
          Back to historical intelligence
        </Link>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Phase 4 · question review
        </p>
        <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
          Historical question DNA and approval
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Question extraction, answer correctness, reuse rights, academic approval and publication are separate decisions. Each decision is recorded against the signed-in reviewer.
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-5">
            <p className="font-semibold">Question review record could not be loaded</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-3" variant="outline" onClick={run}>Retry</Button>
          </CardContent>
        </Card>
      ) : question ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="font-mono text-base">{question.Name}</CardTitle>
                <Badge variant={question.status_c === 'Published' ? 'default' : 'outline'}>
                  {question.status_c}
                </Badge>
              </div>
              <CardDescription>
                {question.historical_year_c || 'Year unknown'} · {question.historical_session_c || 'Session unknown'} · Question {question.historical_question_number_c || '—'} · PDF page {question.historical_page_number_c || '—'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-4 text-sm leading-6">
                {question.question_body_c || 'No extracted question text is available.'}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Extraction: {question.extraction_status_c || 'Pending'}</Badge>
                <Badge variant="outline">Answer: {question.answer_validation_status_c || 'Pending'}</Badge>
                <Badge variant="outline">Rights: {question.rights_status_c || 'Unknown'}</Badge>
                <Badge variant="outline">
                  {question.extraction_confidence_c === null || question.extraction_confidence_c === undefined
                    ? 'Native text · not scored'
                    : Math.round(Number(question.extraction_confidence_c) * 100) + '% OCR estimate'}
                </Badge>
              </div>
              <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historical paper</p>
                  <p className="mt-1 text-sm">{paper?.Name || 'Missing paper link'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Paper status: {paper?.status_c || 'Unavailable'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source document</p>
                  <p className="mt-1 text-sm">{source?.Name || 'Missing source document'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rights: {source?.rights_status_c || 'Unknown'} · Verification: {source?.verification_status_c || 'Unknown'} · Ingestion: {source?.ingestion_status_c || 'Unknown'}
                  </p>
                  {source?.official_url_c && (
                    <a href={source.official_url_c} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      Open source document
                      <ApperIcon name="ExternalLink" size={12} />
                    </a>
                  )}
                </div>
              </div>
              {!sourceMatches && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  The question, paper and source document references do not match. All approvals are blocked until corrected.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">Question review gates</CardTitle>
              <CardDescription>
                A question is trend-eligible only after the paper, source, extraction, answer and academic approval gates are all complete.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <ReviewStatus label="Independent extraction check" value={latestExtraction?.review_status_c} />
              <ReviewStatus label="Answer validation review" value={latestAnswer?.review_status_c} />
              <ReviewStatus label="Copyright and reuse review" value={latestCopyright?.review_status_c} />
              <ReviewStatus label="Academic verification review" value={latestAcademic?.review_status_c} />
            </CardContent>
          </Card>

          {canEdit && (
            <Card>
              <CardHeader>
                <CardTitle className="font-mono text-base">Question DNA classification</CardTitle>
                <CardDescription>Use consistent canonical concept and skill labels. These labels do not themselves verify a question.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dna-family">Question family code</Label>
                    <Input id="dna-family" value={form.question_family_code_c || ''} onChange={(event) => updateField('question_family_code_c', event.target.value)} placeholder="PHY-VEC-RESULTANT" disabled={locked} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dna-pattern">Recurring pattern group</Label>
                    <Input id="dna-pattern" value={form.recurring_pattern_group_c || ''} onChange={(event) => updateField('recurring_pattern_group_c', event.target.value)} placeholder="Vector constraint with relative motion" disabled={locked} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dna-difficulty">Difficulty</Label>
                    <select id="dna-difficulty" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.difficulty_c || 'Moderate'} onChange={(event) => updateField('difficulty_c', event.target.value)} disabled={locked}>
                      <option value="Basic">Basic</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Detected concept count</Label>
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 font-mono text-sm">
                      {String((form.concept_dna_c || '').split(/[;,\n]+/).map((value) => value.trim()).filter(Boolean).length)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dna-concepts">Concept DNA</Label>
                  <Textarea id="dna-concepts" rows={3} value={form.concept_dna_c || ''} onChange={(event) => updateField('concept_dna_c', event.target.value)} placeholder="List canonical concepts separated by commas or new lines." disabled={locked} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dna-skills">Skill DNA</Label>
                  <Textarea id="dna-skills" rows={3} value={form.skill_dna_c || ''} onChange={(event) => updateField('skill_dna_c', event.target.value)} placeholder="Vector decomposition, dimensional analysis, graph interpretation." disabled={locked} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dna-approach">Approach pattern</Label>
                  <Textarea id="dna-approach" rows={3} value={form.approach_pattern_c || ''} onChange={(event) => updateField('approach_pattern_c', event.target.value)} placeholder="Describe the reasoning sequence, not an unsourced copied solution." disabled={locked} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dna-combination">Concept combination</Label>
                  <Textarea id="dna-combination" rows={2} value={form.concept_combination_c || ''} onChange={(event) => updateField('concept_combination_c', event.target.value)} placeholder="Vectors + Newton's laws" disabled={locked} />
                </div>
                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Saving the classification writes an Academic review event and keeps the question in Review.
                  </p>
                  <Button onClick={saveDNA} disabled={saving || locked}>
                    {saving && activeAction === 'dna' ? <ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" /> : <ApperIcon name="Save" size={15} className="mr-2" />}
                    Save DNA classification
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">Auditable review actions</CardTitle>
              <CardDescription>
                Use the notes field to record what was checked. A reviewer cannot approve their own question extraction.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="review-decision">Review decision</Label>
                  <select id="review-decision" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={decision} onChange={(event) => setDecision(event.target.value)}>
                    <option value="Approved">Approved</option>
                    <option value="Changes">Changes required</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                {canEdit && (
                  <div className="space-y-2">
                    <Label htmlFor="answer-key">Answer key</Label>
                    <Input id="answer-key" value={answerKey} onChange={(event) => setAnswerKey(event.target.value)} placeholder="A, B, C, D or numerical value" disabled={question.status_c === 'Verified' || question.status_c === 'Published'} />
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="space-y-2">
                  <Label htmlFor="answer-solution">Validated solution or rationale</Label>
                  <Textarea id="answer-solution" rows={3} value={solution} onChange={(event) => setSolution(event.target.value)} placeholder="Record the independently checked reasoning, units and assumptions." disabled={question.status_c === 'Verified' || question.status_c === 'Published'} />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="review-notes">Review notes (required)</Label>
                <Textarea id="review-notes" rows={3} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Record what you compared against the original paper, answer source, rights basis or academic reasoning." />
              </div>

              <div className="flex flex-wrap gap-2">
                {canReviewExtraction && (
                  <Button variant="outline" onClick={() => runReviewAction('extraction')} disabled={saving || !sourceMatches}>
                    {saving && activeAction === 'extraction' ? 'Recording…' : 'Independently review extraction'}
                  </Button>
                )}
                {canEdit && (
                  <>
                    <Button variant="outline" onClick={() => runReviewAction('applyExtraction', 'Approved')} disabled={saving || !sourceMatches || !latestExtraction || latestExtraction.review_status_c !== 'Approved' || question.extraction_status_c === 'Verified'}>
                      Apply extraction approval
                    </Button>
                    <Button variant="outline" onClick={() => runReviewAction('answer')} disabled={saving || !sourceMatches || question.extraction_status_c !== 'Verified'}>
                      Validate answer key
                    </Button>
                    <Button variant="outline" onClick={() => runReviewAction('copyright')} disabled={saving || !sourceMatches}>
                      Confirm question reuse rights
                    </Button>
                    <Button variant="outline" onClick={() => runReviewAction('academic')} disabled={saving || !sourceMatches || question.extraction_status_c !== 'Verified' || question.answer_validation_status_c !== 'Verified'}>
                      Verify question academically
                    </Button>
                    <Button onClick={() => runReviewAction('publish', 'Approved')} disabled={saving || question.status_c !== 'Verified' || paper?.status_c !== 'Published'}>
                      Publish question
                    </Button>
                  </>
                )}
              </div>

              {!canEdit && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Content reviewers can independently review the extracted question text. Academic Experts apply that approval and complete answer, rights and publication decisions.
                </p>
              )}
              {saving && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ApperIcon name="LoaderCircle" size={14} className="animate-spin" />
                  Saving {activeAction} review record…
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">Review history</CardTitle>
              <CardDescription>Immutable decision events returned for this question</CardDescription>
            </CardHeader>
            <CardContent>
              {data.reviews.length ? (
                <div className="space-y-3">
                  {data.reviews
                    .slice()
                    .sort((a, b) => Date.parse(b.reviewed_at_c || 0) - Date.parse(a.reviewed_at_c || 0))
                    .map((review) => (
                      <div key={review.Id} className="border-b border-border pb-3 last:border-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{review.Name}</p>
                          <Badge variant={review.review_status_c === 'Approved' ? 'secondary' : 'outline'}>{review.review_status_c}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{review.review_type_c} · {review.reviewed_at_c || 'Date unavailable'}</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-5">{review.review_notes_c}</p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No review events have been recorded for this question.</p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
