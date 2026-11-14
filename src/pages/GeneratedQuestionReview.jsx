import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';
import {
  fetchGeneratedQuestionReviewData,
  reviewGeneratedQuestion
} from '@/services/questionGenerationService';

export const route = {
  path: '/question-generation/questions/:id',
  layout: 'owner',
  access: "profile === 'CEO' || profile === 'CEO_c' || profile === 'Manager' || profile === 'Manager_c' || profile === 'AcademicExpert_c' || profile === 'ContentReviewer_c'"
};

const ACADEMIC_REVIEWER = 'AcademicExpert_c';
const EDITORS = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c', 'ContentReviewer_c'];
const PUBLISHERS = ['CEO', 'CEO_c', 'Manager', 'Manager_c'];

function statusTone(status) {
  if (status === 'Passed' || status === 'Validated' || status === 'Verified' || status === 'Published') return 'secondary';
  if (status === 'Failed' || status === 'Rejected') return 'destructive';
  return 'outline';
}

function EvidencePanel({ check }) {
  let evidence = {};
  try {
    evidence = JSON.parse(check.evidence_json_c || '{}');
  } catch {
    evidence = {};
  }

  return (
    <details className="rounded-md border border-border p-3">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{check.check_type_c}</p>
          <p className="text-xs text-muted-foreground">{check.is_independent_c ? 'Independent model pass' : 'Deterministic integrity check'} · {Math.round(Number(check.score_c || 0) * 100)}%</p>
        </div>
        <Badge variant={statusTone(check.check_status_c)}>{check.check_status_c}</Badge>
      </summary>
      <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
        <p>{check.details_c}</p>
        {evidence.solution && <p className="whitespace-pre-wrap rounded bg-muted/30 p-2">Independent solution: {evidence.solution}</p>}
        {evidence.answerKey && <p>Independent answer: {evidence.answerKey}</p>}
        {evidence.generated && <p>Generated answer key: {evidence.generated}</p>}
        {evidence.independent && <p>Independent answer key: {evidence.independent}</p>}
        {Array.isArray(evidence.reasoningSteps) && evidence.reasoningSteps.length > 0 && (
          <ol className="list-decimal space-y-1 pl-5">
            {evidence.reasoningSteps.map((step, index) => <li key={index}>{step}</li>)}
          </ol>
        )}
        {Array.isArray(evidence.similarCandidates) && evidence.similarCandidates.length > 0 && (
          <div>
            <p className="font-semibold text-foreground">Similar records to inspect</p>
            {evidence.similarCandidates.map((candidate, index) => (
              <p key={candidate.id || index}>{candidate.title || candidate.id} {candidate.lexicalScore !== null ? '· lexical similarity ' + Math.round(candidate.lexicalScore * 100) + '%' : ''}</p>
            ))}
          </div>
        )}
        {check.provider_c && <p>Provider: {check.provider_c} · {check.model_c} · {check.prompt_version_c}</p>}
      </div>
    </details>
  );
}

export default function GeneratedQuestionReview() {
  const { id } = useParams();
  const { profile } = useProfile();
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [rightsStatus, setRightsStatus] = useState('Public');
  const [saving, setSaving] = useState(false);
  const { data, loading, error, run } = useFetch(
    () => fetchGeneratedQuestionReviewData(id),
    [id]
  );

  const question = data?.question;
  const options = data?.options || [];
  const checks = data?.checks || [];
  const mappings = data?.mappings || [];
  const reviews = data?.reviews || [];
  const isEditorial = EDITORS.includes(profile);
  const canApprove = profile === ACADEMIC_REVIEWER;
  const canPublish = PUBLISHERS.includes(profile);

  async function perform(action) {
    if (!notes.trim()) {
      toast.error('Review notes are required.');
      return;
    }
    if (action === 'approve' && !['Public', 'Licensed'].includes(rightsStatus)) {
      toast.error('Choose the authorised rights basis before approval.');
      return;
    }

    setSaving(true);
    try {
      const result = await reviewGeneratedQuestion({
        question,
        options,
        checks,
        mappings,
        action,
        reviewerId: user?.userId,
        reviewerProfile: profile,
        rightsStatus,
        notes
      });
      if (!result.success) {
        toast.error('Review action blocked', { description: result.message });
        return;
      }

      toast.success(result.message);
      setNotes('');
      await run();
    } catch (reviewError) {
      toast.error('Review action failed', { description: reviewError.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-3 border-b border-border pb-5">
        <Link to="/question-generation" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <ApperIcon name="ArrowLeft" size={14} />
          Back to question generation
        </Link>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Phase 6 · independent review</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Generated question review</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Model checks are screening evidence, not proof of correctness. Academic approval and publication remain separate human decisions.
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      ) : error ? (
        <Card><CardContent className="space-y-3 p-5">
          <p className="font-semibold">Generated question could not be loaded</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" onClick={run}>Retry</Button>
        </CardContent></Card>
      ) : question ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-base">{question.Name}</CardTitle>
                  <CardDescription>{question.question_type_c} · {question.difficulty_c} · {data.batch?.Name}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={statusTone(question.status_c)}>{question.status_c}</Badge>
                  <Badge variant={statusTone(question.ai_generation_status_c)}>{question.ai_generation_status_c}</Badge>
                  <Badge variant={statusTone(question.ai_duplicate_status_c)}>{question.ai_duplicate_status_c}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm leading-6">
                {question.question_body_c}
              </div>

              {options.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated options</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.filter((option) => option.status_c !== 'Retired').sort((a,b) => Number(a.sequence_c || 0)-Number(b.sequence_c || 0)).map((option) => (
                      <div key={option.Id} className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                        <span className="font-mono font-semibold">{option.option_key_c}.</span>
                        <span className="flex-1 whitespace-pre-wrap">{option.option_text_c}</span>
                        {option.is_correct_c === true && <Badge variant="secondary">Key</Badge>}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated answer key</p>
                  <p className="mt-1 text-sm font-semibold">{question.answer_key_c || 'Missing'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Independent answer agreement</p>
                  <p className="mt-1 text-sm">{question.ai_independent_answer_match_c === true ? 'Matches' : 'Does not match / not checked'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Validation score</p>
                  <p className="mt-1 font-mono text-sm">{Math.round(Number(question.ai_validation_score_c || 0) * 100)}%</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rights status</p>
                  <p className="mt-1 text-sm">{question.rights_status_c || 'Unknown'}</p>
                </div>
              </div>

              <details className="rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-semibold">Generated solution and approach</summary>
                <div className="mt-3 space-y-3 border-t border-border pt-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proposed solution</p>
                    <p className="mt-1 whitespace-pre-wrap leading-6">{question.solution_c}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Validation notes</p>
                    <p className="mt-1 whitespace-pre-wrap leading-6 text-muted-foreground">{question.ai_generation_notes_c}</p>
                  </div>
                </div>
              </details>
              <p className="text-xs text-muted-foreground">
                Generated by {question.ai_generation_provider_c} · {question.ai_generation_model_c} · {question.ai_generation_prompt_version_c}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">Automated quality evidence</CardTitle>
              <CardDescription>Expand each check to inspect evidence. A model score never substitutes for a human academic decision.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {checks.length ? checks.map((check) => <EvidencePanel key={check.Id} check={check} />) : (
                <p className="text-sm text-muted-foreground">No validation check records are attached.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">Concept mapping and review trail</CardTitle>
              <CardDescription>The primary concept mapping must be verified independently before publication.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mappings.map((mapping) => (
                <div key={mapping.Id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-semibold">{mapping.Name}</p>
                    <p className="text-xs text-muted-foreground">{mapping.mapping_type_c} · confidence {Math.round(Number(mapping.confidence_c || 0) * 100)}%</p>
                  </div>
                  <Badge variant={statusTone(mapping.status_c)}>{mapping.verified_c ? 'Verified' : mapping.status_c}</Badge>
                </div>
              ))}
              {reviews.map((review) => (
                <div key={review.Id} className="border-t border-border pt-2">
                  <p className="text-xs font-semibold">{review.review_type_c} · {review.review_status_c}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{review.review_notes_c}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {isEditorial && (
            <Card>
              <CardHeader>
                <CardTitle className="font-mono text-base">Human approval gate</CardTitle>
                <CardDescription>
                  Academic Experts verify correctness and rights. CEO or Manager publishes separately. No AI-generated draft is automatically released.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {canApprove && question.status_c !== 'Verified' && question.status_c !== 'Published' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="generated-rights">Reuse basis confirmed by your organisation</Label>
                    <select
                      id="generated-rights"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={rightsStatus}
                      onChange={(event) => setRightsStatus(event.target.value)}
                      disabled={saving}
                    >
                      <option value="Public">Public</option>
                      <option value="Licensed">Licensed</option>
                    </select>
                    <p className="text-xs text-muted-foreground">Do not choose a rights basis merely because content is newly generated. Confirm applicable terms before approval.</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="generated-review-notes">Review notes (required)</Label>
                  <Textarea
                    id="generated-review-notes"
                    rows={4}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Record the mathematics/science checks performed, answer reasoning, ambiguity concerns, duplicate assessment and rights basis."
                    disabled={saving}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {isEditorial && ['Draft', 'Review'].includes(question.status_c) && (
                    <>
                      <Button type="button" variant="outline" onClick={() => perform('request_changes')} disabled={saving || !notes.trim()}>
                        Request changes
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => perform('reject')} disabled={saving || !notes.trim()}>
                        Reject
                      </Button>
                    </>
                  )}
                  {canApprove && ['Draft', 'Review'].includes(question.status_c) && (
                    <Button type="button" onClick={() => perform('approve')} disabled={saving || !notes.trim()}>
                      {saving ? 'Saving…' : 'Approve academically'}
                    </Button>
                  )}
                  {canPublish && question.status_c === 'Verified' && (
                    <Button type="button" onClick={() => perform('publish')} disabled={saving || !notes.trim()}>
                      {saving ? 'Publishing…' : 'Publish to Question Bank'}
                    </Button>
                  )}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  The creator cannot approve their own question. The Academic Expert must also differ from the person who proposed the primary concept mapping.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
