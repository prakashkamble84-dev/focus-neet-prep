import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useFetch } from '@/hooks/useFetch';
import { useFunction } from '@/hooks/useFunction';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';
import {
  fetchQuestionGenerationLookups,
  fetchQuestionGenerationStudioData,
  createQuestionGenerationBatch,
  fetchExistingQuestionCandidates,
  persistQuestionGenerationResult,
  markQuestionGenerationBatchFailed
} from '@/services/questionGenerationService';

export const route = {
  path: '/question-generation',
  layout: 'owner',
  access: "profile === 'CEO' || profile === 'CEO_c' || profile === 'Manager' || profile === 'Manager_c' || profile === 'AcademicExpert_c' || profile === 'ContentReviewer_c'"
};

export const nav = {
  label: 'Question generation',
  icon: 'WandSparkles',
  group: 'Practice',
  order: 42
};

const SUBJECTS = {
  jee: ['Physics', 'Chemistry', 'Maths'],
  neet: ['Physics', 'Chemistry', 'Biology']
};

function lookupId(value) {
  if (value && typeof value === 'object') return String(value.Id ?? value.id ?? '');
  return value === null || value === undefined ? '' : String(value);
}

function StatusBadge({ value }) {
  const tone = value === 'Completed' || value === 'Validated' || value === 'Published'
    ? 'secondary'
    : value === 'Failed' || value === 'Rejected'
      ? 'destructive'
      : 'outline';
  return <Badge variant={tone}>{value || 'Unknown'}</Badge>;
}

function FilterSelect({ id, label, value, onChange, options, placeholder = 'Choose…', disabled = false }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function QuestionGeneration() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [examinationId, setExaminationId] = useState('');
  const [subject, setSubject] = useState('Physics');
  const [conceptId, setConceptId] = useState('');
  const [questionType, setQuestionType] = useState('MCQ');
  const [difficulty, setDifficulty] = useState('Moderate');
  const [count, setCount] = useState('1');
  const [maximumMarks, setMaximumMarks] = useState('4');
  const [negativeMarks, setNegativeMarks] = useState('1');
  const [instruction, setInstruction] = useState('');
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const { data: lookups, loading: lookupLoading, error: lookupError } = useFetch(
    fetchQuestionGenerationLookups,
    []
  );
  const {
    data: workspace,
    loading: workspaceLoading,
    error: workspaceError,
    run: refreshWorkspace
  } = useFetch(fetchQuestionGenerationStudioData, [refreshRevision]);

  const {
    invoke,
    loading: providerLoading,
    error: providerError
  } = useFunction(import.meta.env.VITE_GENERATE_ORIGINAL_QUESTIONS, {
    showError: false
  });

  const examinations = lookups?.examinations || [];
  const selectedExam = examinations.find((exam) => String(exam.Id) === String(examinationId));
  const allowedSubjects = selectedExam?.exam_type_c && String(selectedExam.exam_type_c).toLowerCase().includes('neet')
    ? SUBJECTS.neet
    : SUBJECTS.jee;

  const concepts = useMemo(() => {
    if (!selectedExam) return [];
    return (lookups?.concepts || []).filter((node) => (
      node.subject_c === subject &&
      lookupId(node.syllabus?.examination_c) === String(selectedExam.Id)
    ));
  }, [lookups, selectedExam, subject]);

  const batches = workspace?.batches || [];
  const generatedQuestions = workspace?.questions || [];

  async function handleGenerate(event) {
    event.preventDefault();
    if (!examinationId || !conceptId || !user?.userId) {
      toast.error('Choose an examination, a verified concept and a signed-in academic editor.');
      return;
    }

    const input = {
      examinationId,
      subject,
      curriculumNodeId: conceptId,
      questionType,
      difficulty,
      count: Number(count),
      maximumMarks: Number(maximumMarks),
      negativeMarks: Number(negativeMarks),
      instruction: instruction.trim()
    };

    let batch;
    setSubmitting(true);
    try {
      const created = await createQuestionGenerationBatch({
        input,
        userId: user.userId
      });
      batch = created.batch;

      const existingCandidates = await fetchExistingQuestionCandidates({
        input: { ...input, examinationId: created.exam.Id },
        node: created.node
      });

      const response = await invoke({
        examName: created.exam.Name,
        examType: created.exam.exam_type_c || '',
        examCode: created.exam.code_c || '',
        subject,
        conceptPath: created.node.node_path_c || created.node.Name,
        conceptDescription: created.node.description_c || '',
        learningObjectives: created.node.learning_objectives_c || '',
        syllabusVersion: created.syllabus.Name,
        questionType,
        difficulty,
        count: Number(count),
        maximumMarks: Number(maximumMarks),
        negativeMarks: Number(negativeMarks),
        instruction: input.instruction,
        existingCandidates
      });

      if (!response?.success) {
        const message = providerError || response?.message ||
          'The AI endpoint did not return a result. Check that GEMINI_API_KEY has a value in Apper Secrets Manager.';
        await markQuestionGenerationBatchFailed(batch.Id, message);
        throw new Error(message);
      }

      const saved = await persistQuestionGenerationResult({
        batch,
        exam: created.exam,
        node: created.node,
        syllabus: created.syllabus,
        input,
        result: response
      });

      if (saved.batchStatus === 'Completed') {
        toast.success(saved.questions.length + ' original question draft(s) saved. Human academic approval is still required.');
      } else {
        toast.warning(saved.questions.length + ' draft(s) saved with validation or persistence issues. Review every item before approval.');
      }
      setInstruction('');
      setRefreshRevision((value) => value + 1);
    } catch (error) {
      const message = error?.message || 'Generation could not be completed.';
      if (batch?.Id) {
        await markQuestionGenerationBatchFailed(batch.Id, message);
        setRefreshRevision((value) => value + 1);
      }
      toast.error('Question generation stopped', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Phase 6 · original practice content
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AI question generation</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Create original JEE and NEET question drafts from published, verified syllabus concepts. Independent solving, answer agreement, syllabus fit, ambiguity and duplicate checks run before human review.
            </p>
          </div>
          <Badge variant="outline">Academic workspace</Badge>
        </div>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <ApperIcon name="KeyRound" size={17} className="text-highlight" />
            <CardTitle className="text-base">Provider configuration</CardTitle>
            <Badge variant="secondary">Credential saved</Badge>
          </div>
          <CardDescription>
            A server-side GEMINI_API_KEY value is saved in Apper Secrets Manager. Northstar keeps it on the server; the first real generation request will confirm that Google accepts it. The key is never exposed in browser code.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Provider: Google Gemini · Model: gemini-3.8-flash · Prompt: northstar-question-generation-v1
          </p>
          <a
            href="https://apper.integrately.com/projects/eaaa0a5aece643d4bd7c76ccfbeee2f8/manage/dev/secrets"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            Open Secrets Manager
            <ApperIcon name="ExternalLink" size={14} />
          </a>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-base">Generation brief</CardTitle>
            <CardDescription>
              Only published syllabus versions and verified Concept nodes are eligible. The server rechecks these relationships before creating a batch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lookupLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : lookupError ? (
              <div className="space-y-2 text-sm">
                <p className="text-destructive">{lookupError}</p>
                <p className="text-muted-foreground">Register and verify the examination baseline and syllabus concepts before generating questions.</p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleGenerate}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FilterSelect
                    id="generation-exam"
                    label="Examination"
                    value={examinationId}
                    onChange={(value) => {
                      setExaminationId(value);
                      setConceptId('');
                      const nextExam = examinations.find((exam) => String(exam.Id) === String(value));
                      const nextSubjects = nextExam?.exam_type_c && String(nextExam.exam_type_c).toLowerCase().includes('neet')
                        ? SUBJECTS.neet
                        : SUBJECTS.jee;
                      setSubject((current) => nextSubjects.includes(current) ? current : nextSubjects[0]);
                    }}
                    options={examinations.map((exam) => ({
                      value: String(exam.Id),
                      label: exam.Name
                    }))}
                    placeholder="Select exam"
                    disabled={submitting}
                  />
                  <FilterSelect
                    id="generation-subject"
                    label="Subject"
                    value={subject}
                    onChange={(value) => {
                      setSubject(value);
                      setConceptId('');
                    }}
                    options={allowedSubjects.map((value) => ({ value, label: value === 'Maths' ? 'Mathematics' : value }))}
                    disabled={!selectedExam || submitting}
                  />
                </div>

                <FilterSelect
                  id="generation-concept"
                  label="Verified syllabus concept"
                  value={conceptId}
                  onChange={setConceptId}
                  options={concepts.map((node) => ({
                    value: String(node.Id),
                    label: node.node_path_c || node.Name
                  }))}
                  placeholder={concepts.length ? 'Select a concept' : 'No published, verified concepts available'}
                  disabled={!selectedExam || submitting || !concepts.length}
                />
                {!lookupLoading && selectedExam && concepts.length === 0 && (
                  <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
                    <div className="flex items-start gap-3">
                      <ApperIcon name="BookOpenCheck" size={18} className="mt-0.5 shrink-0 text-warning-foreground" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">No generation-ready concepts yet</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          This is a syllabus-data blocker, not a Gemini-key error. Question generation only accepts a Concept attached to a Published syllabus version that is itself Published and expert-verified. Northstar's current outline import records Subject and Unit headings; it does not invent detailed Concepts from those headings.
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Register and verify the official syllabus PDF and its rights, capture the relevant page evidence, then add the Chapter, Topic and Concept nodes in Review. An Academic Expert must verify the source evidence before the nodes can be published and used here.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link to="/sources">Open academic sources</Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link to="/knowledge-graph">Open knowledge graph</Link>
                      </Button>
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link to="/curriculum/manage">Manage syllabus</Link>
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <FilterSelect
                    id="generation-format"
                    label="Question format"
                    value={questionType}
                    onChange={setQuestionType}
                    options={[
                      { value: 'MCQ', label: 'Single-correct MCQ' },
                      { value: 'Multi', label: 'Multiple-correct' },
                      { value: 'Numeric', label: 'Numerical response' },
                      { value: 'Assert', label: 'Assertion and reason' },
                      { value: 'Other', label: 'Other' }
                    ]}
                    disabled={submitting}
                  />
                  <FilterSelect
                    id="generation-difficulty"
                    label="Difficulty"
                    value={difficulty}
                    onChange={setDifficulty}
                    options={[
                      { value: 'Basic', label: 'Basic' },
                      { value: 'Moderate', label: 'Moderate' },
                      { value: 'Advanced', label: 'Advanced' }
                    ]}
                    disabled={submitting}
                  />
                  <div className="space-y-1.5">
                    <Label htmlFor="generation-count">Questions in batch (1–3)</Label>
                    <Input
                      id="generation-count"
                      type="number"
                      min="1"
                      max="3"
                      step="1"
                      value={count}
                      onChange={(event) => setCount(event.target.value)}
                      placeholder="1"
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="generation-marks">Maximum marks</Label>
                    <Input
                      id="generation-marks"
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={maximumMarks}
                      onChange={(event) => setMaximumMarks(event.target.value)}
                      placeholder="4"
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="generation-negative">Negative marks</Label>
                    <Input
                      id="generation-negative"
                      type="number"
                      min="0"
                      step="0.25"
                      value={negativeMarks}
                      onChange={(event) => setNegativeMarks(event.target.value)}
                      placeholder="0"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="generation-instruction">Additional academic instruction</Label>
                  <Textarea
                    id="generation-instruction"
                    rows={3}
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    placeholder="Optional: specify a sub-skill, representation, boundary condition or reasoning emphasis."
                    disabled={submitting}
                  />
                </div>

                <div className="rounded-md border border-border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                  AI output is never published automatically. A different Academic Expert must review the question, answer, rights basis and concept mapping. A CEO or Manager then publishes it.
                </div>

                <Button type="submit" disabled={submitting || providerLoading || !examinationId || !conceptId} className="w-full sm:w-auto">
                  {submitting || providerLoading
                    ? <ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" />
                    : <ApperIcon name="WandSparkles" size={15} className="mr-2" />}
                  Generate original drafts
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-base">Quality-control sequence</CardTitle>
            <CardDescription>Three model passes, structured checks and two human release gates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ['01', 'Original question author', 'Creates a fresh question from the selected published syllabus concept.'],
              ['02', 'Blind independent solver', 'Receives only the question and choices, not the proposed key or solution.'],
              ['03', 'Academic quality reviewer', 'Scores syllabus fit, difficulty, clarity, ambiguity and semantic duplicate risk.'],
              ['04', 'Academic Expert', 'Checks the question, independent answer, structured options, concept mapping and rights basis.'],
              ['05', 'CEO / Manager', 'Publishes only after academic review is complete.']
            ].map(([number, title, description]) => (
              <div key={number} className="flex gap-3">
                <span className="font-mono text-xs font-semibold text-primary">{number}</span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
            <div className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
              Automated checks are screening evidence, not proof of correctness. Failed or uncertain checks move a question to Needs Review.
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Recent generation batches</h2>
            <p className="text-xs text-muted-foreground">Draft batches are visible to the editorial roles only.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => {
            setRefreshRevision((value) => value + 1);
          }}>
            <ApperIcon name="RefreshCw" size={14} className="mr-1.5" />
            Refresh
          </Button>
        </div>

        {workspaceLoading && !workspace ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : workspaceError ? (
          <Card><CardContent className="p-4 text-sm text-destructive">{workspaceError}</CardContent></Card>
        ) : batches.length ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {batches.map((batch) => (
              <div key={batch.Id} className="grid gap-2 border-b border-border p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{batch.Name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {batch.subject_c} · {batch.question_type_c} · {batch.difficulty_c} · {batch.generated_count_c || 0}/{batch.requested_count_c || 0} generated
                  </p>
                  {batch.result_summary_c && <p className="mt-1 text-xs text-muted-foreground">{batch.result_summary_c}</p>}
                  {batch.error_message_c && <p className="mt-1 whitespace-pre-wrap text-xs text-destructive">{batch.error_message_c}</p>}
                </div>
                <StatusBadge value={batch.status_c} />
              </div>
            ))}
          </div>
        ) : (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No generation batches yet. Select a verified syllabus concept to create the first batch.</CardContent></Card>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Generated question review queue</h2>
          <p className="text-xs text-muted-foreground">These are draft or review-state items. They are not student-visible.</p>
        </div>
        {generatedQuestions.length ? (
          <div className="grid gap-3">
            {generatedQuestions.map((question) => (
              <Card key={question.Id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">{question.Name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{question.question_body_c}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {question.question_type_c} · {question.difficulty_c} · {question.ai_duplicate_status_c || 'Duplicate status pending'} · Validation score {Math.round(Number(question.ai_validation_score_c || 0) * 100)}%
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge value={question.status_c} />
                    <Link
                      to={'/question-generation/questions/' + question.Id}
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold hover:bg-accent"
                    >
                      Review
                      <ApperIcon name="ArrowUpRight" size={13} />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No original generated questions are waiting in this queue.</CardContent></Card>
        )}
      </section>
    </div>
  );
}
