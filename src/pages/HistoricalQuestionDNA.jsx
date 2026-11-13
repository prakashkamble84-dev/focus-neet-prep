import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { sdk } from '@/services/sdk';
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

export const route = {
  path: '/historical-intelligence/questions/:id',
  layout: 'owner',
  access: "profile === 'CEO' || profile === 'CEO_c' || profile === 'Manager' || profile === 'Manager_c' || profile === 'AcademicExpert_c'"
};

const QUESTION_FIELDS = [
  'Id',
  'Name',
  'question_body_c',
  'source_type_c',
  'status_c',
  'question_type_c',
  'difficulty_c',
  'historical_year_c',
  'historical_session_c',
  'historical_question_number_c',
  'historical_page_number_c',
  'question_family_code_c',
  'concept_dna_c',
  'skill_dna_c',
  'approach_pattern_c',
  'recurring_pattern_group_c',
  'concept_combination_c',
  'concept_count_c',
  'extraction_confidence_c',
  'extraction_status_c',
  'answer_validation_status_c',
  'rights_status_c',
  'historical_paper_c'
];

async function fetchQuestion(id) {
  const result = await sdk.table('questions_c').select(QUESTION_FIELDS).get(id);
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Historical question was not found or is not visible to this role.');
  }
  return result.data;
}

export default function HistoricalQuestionDNA() {
  const { id } = useParams();
  const { profile } = useProfile();
  const { user } = useAuth();
  const canEdit = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'].includes(profile);
  const { data: question, loading, error, run } = useFetch(() => fetchQuestion(id), [id]);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

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
  }, [question]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveHistoricalQuestionDNA(question, form, user?.userId);
      if (!result.success) {
        toast.error('Question DNA was not saved', { description: result.message });
        return;
      }
      toast.success('Question DNA saved; the question remains in Review.');
      await run();
    } catch (error) {
      toast.error('Question DNA update failed', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  const locked = !canEdit || !question || ['Verified', 'Published'].includes(question.status_c);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-3 border-b border-border pb-5">
        <Link to="/historical-intelligence" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ApperIcon name="ArrowLeft" size={14} />
          Back to historical intelligence
        </Link>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Phase 4 · question DNA</p>
        <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">Classify historical question</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Add explicit academic labels used by pattern analysis. Saving classification does not verify the extracted text, answer key, source rights or syllabus alignment.
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-5">
            <p className="font-semibold">Question could not be loaded</p>
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
                <Badge variant="outline">{question.status_c}</Badge>
              </div>
              <CardDescription>
                {question.historical_year_c || 'Year unknown'} · {question.historical_session_c || 'Session unknown'} · Question {question.historical_question_number_c || '—'} · PDF page {question.historical_page_number_c || '—'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-4 text-sm leading-6">
                {question.question_body_c || 'No extracted question text is available.'}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Extraction: {question.extraction_status_c || 'Pending'}</Badge>
                <Badge variant="outline">Answer: {question.answer_validation_status_c || 'Pending'}</Badge>
                <Badge variant="outline">Rights: {question.rights_status_c || 'Unknown'}</Badge>
                <Badge variant="outline">OCR estimate: {Math.round(Number(question.extraction_confidence_c || 0) * 100)}%</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">Question DNA classification</CardTitle>
              <CardDescription>Use stable, specific labels. One question can contain multiple concepts and skills.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dna-family">Question family code</Label>
                  <Input id="dna-family" value={form.question_family_code_c || ''} onChange={(event) => updateField('question_family_code_c', event.target.value)} placeholder="e.g. PHY-VEC-RESULTANT" disabled={locked} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dna-pattern">Recurring pattern group</Label>
                  <Input id="dna-pattern" value={form.recurring_pattern_group_c || ''} onChange={(event) => updateField('recurring_pattern_group_c', event.target.value)} placeholder="e.g. Vector constraint with relative motion" disabled={locked} />
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
                <Textarea id="dna-concepts" rows={3} value={form.concept_dna_c || ''} onChange={(event) => updateField('concept_dna_c', event.target.value)} placeholder="List concepts separated by commas or new lines. Use canonical knowledge graph names." disabled={locked} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dna-skills">Skill DNA</Label>
                <Textarea id="dna-skills" rows={3} value={form.skill_dna_c || ''} onChange={(event) => updateField('skill_dna_c', event.target.value)} placeholder="e.g. vector decomposition, dimensional analysis, graph interpretation" disabled={locked} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dna-approach">Approach pattern</Label>
                <Textarea id="dna-approach" rows={3} value={form.approach_pattern_c || ''} onChange={(event) => updateField('approach_pattern_c', event.target.value)} placeholder="Describe the key reasoning sequence without copying a solution from another source." disabled={locked} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dna-combination">Concept combination</Label>
                <Textarea id="dna-combination" rows={2} value={form.concept_combination_c || ''} onChange={(event) => updateField('concept_combination_c', event.target.value)} placeholder="e.g. Vectors + Newton's laws" disabled={locked} />
              </div>
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-muted-foreground">
                  Every save writes an Academic review event with a Changes decision. The question remains in Review until separate extraction, answer and rights approval.
                </p>
                <Button onClick={save} disabled={saving || locked}>
                  {saving ? <ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" /> : <ApperIcon name="Save" size={15} className="mr-2" />}
                  {saving ? 'Saving…' : 'Save DNA classification'}
                </Button>
              </div>
              {locked && (
                <p className="text-xs text-warning-foreground">
                  This question is read-only. Verified or published classifications require the formal reopening workflow.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
