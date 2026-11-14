import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';
import { sdk } from '@/services/sdk';

export const route = { path: '/question-bank', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Question bank', icon: 'Library', group: 'Practice', order: 40 };

const PAGE_SIZE = 20;
const EDITORIAL_PROFILES = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c', 'ContentReviewer_c'];

async function fetchExaminations() {
  const result = await sdk.table('examinations_c')
    .select(['Id', 'Name'])
    .orderBy('Name')
    .limit(100, 0)
    .fetch();
  if (!result.success) throw new Error(result.message || 'Examination list could not be loaded.');
  return result.data || [];
}

async function fetchQuestionPage({ page, search, examId, status, profile }) {
  const { eq, contains, and, or } = window.ApperSDK.CoreSDK;
  const editorial = EDITORIAL_PROFILES.includes(profile);
  const clauses = [];

  if (examId) clauses.push(eq('examination_c', examId));

  if (editorial && status) {
    clauses.push(eq('status_c', status));
  } else {
    clauses.push(eq('status_c', 'Published'));
  }

  if (!editorial) {
    clauses.push(eq('answer_validation_status_c', 'Verified'));
    clauses.push(or(eq('rights_status_c', 'Public'), eq('rights_status_c', 'Licensed')));
  }

  const term = String(search || '').trim();
  if (term) {
    clauses.push(or(
      contains('Name', term),
      contains('question_body_c', term),
      contains('concept_dna_c', term),
      contains('skill_dna_c', term)
    ));
  }

  const fields = [
    'Id',
    'Name',
    'CreatedOn',
    'question_body_c',
    'examination_c',
    'question_type_c',
    'difficulty_c',
    'maximum_marks_c',
    'negative_marks_c',
    'status_c',
    'source_type_c',
    'historical_year_c',
    'concept_dna_c',
    'skill_dna_c',
    'answer_validation_status_c',
    'rights_status_c',
    'generation_batch_c'
  ];

  const result = await sdk.table('questions_c')
    .select(fields)
    .where(and(...clauses))
    .orderByDesc('CreatedOn')
    .limit(PAGE_SIZE, (page - 1) * PAGE_SIZE)
    .fetch();

  if (!result.success) throw new Error(result.message || 'Question bank could not be loaded.');
  const rows = result.data || [];
  const total = Number(result.total ?? rows.length);
  const offset = (page - 1) * PAGE_SIZE;
  const inferredMore = result.total !== undefined
    ? total > offset + rows.length
    : rows.length === PAGE_SIZE;

  return {
    rows,
    total,
    hasMore: result.hasMore === true || (result.hasMore !== false && inferredMore)
  };
}

async function fetchQuestionOptions(questionId, editorial) {
  const { eq } = window.ApperSDK.CoreSDK;
  const fields = editorial
    ? ['Id', 'option_key_c', 'option_text_c', 'sequence_c', 'is_correct_c', 'status_c']
    : ['Id', 'option_key_c', 'option_text_c', 'sequence_c', 'status_c'];

  const result = await sdk.table('question_options_c')
    .select(fields)
    .where(eq('question_c', questionId))
    .where(eq('status_c', 'Published'))
    .orderBy('sequence_c')
    .limit(12, 0)
    .fetch();

  if (!result.success) throw new Error(result.message || 'Question options could not be loaded.');
  return result.data || [];
}

function QuestionCard({ question, editorial }) {
  const [expanded, setExpanded] = useState(false);
  const { data: options, loading, error, run } = useFetch(
    () => expanded ? fetchQuestionOptions(question.Id, editorial) : Promise.resolve([]),
    [expanded, question.Id, editorial]
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{question.Name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {question.examination_c?.Name || 'Examination'} · {question.historical_year_c || (question.source_type_c === 'Original' ? 'Original' : 'Year not recorded')} · {question.question_type_c} · {question.difficulty_c}
            </p>
          </div>
          <Badge variant={question.status_c === 'Published' ? 'secondary' : 'outline'}>{question.status_c}</Badge>
        </div>

        <p className="whitespace-pre-wrap text-sm leading-6">{question.question_body_c}</p>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {question.maximum_marks_c !== null && question.maximum_marks_c !== undefined && <span>Marks: {question.maximum_marks_c}</span>}
          {Number(question.negative_marks_c || 0) > 0 && <span>Negative: {question.negative_marks_c}</span>}
          {question.source_type_c && <span>Source: {question.source_type_c}</span>}
          {editorial && question.rights_status_c && <span>Rights: {question.rights_status_c}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>
            <ApperIcon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={14} className="mr-1" />
            {expanded ? 'Hide options' : 'Show options'}
          </Button>
          {editorial && question.source_type_c === 'Original' && (
            <Link
              to={'/question-generation/questions/' + question.Id}
              className="inline-flex h-9 items-center gap-1 rounded-md px-3 text-xs font-semibold text-primary hover:bg-accent"
            >
              Generation review
              <ApperIcon name="ArrowUpRight" size={13} />
            </Link>
          )}
        </div>

        {expanded && (
          <div className="space-y-2 rounded-md border border-border bg-muted/10 p-3">
            {loading && <Skeleton className="h-16 w-full" />}
            {error && (
              <div className="space-y-2 text-xs text-destructive">
                <p>{error}</p>
                <Button type="button" size="sm" variant="outline" onClick={run}>Retry</Button>
              </div>
            )}
            {!loading && !error && (
              options?.length ? options.map((option) => (
                <div key={option.Id} className="flex items-start gap-2 rounded-md bg-background p-2 text-sm">
                  <span className="font-mono font-semibold">{option.option_key_c}.</span>
                  <span className="flex-1 whitespace-pre-wrap">{option.option_text_c}</span>
                  {editorial && option.is_correct_c === true && <Badge variant="secondary">Correct</Badge>}
                </div>
              )) : <p className="text-xs text-muted-foreground">No published answer options are available.</p>
            )}
            {!editorial && <p className="text-xs text-muted-foreground">Correctness indicators are withheld outside an authorised assessment or editorial review.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function QuestionBank() {
  const { profile } = useProfile();
  const editorial = EDITORIAL_PROFILES.includes(profile);
  const [search, setSearch] = useState('');
  const [examId, setExamId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data: examinations, error: examError } = useFetch(fetchExaminations, []);
  const { data, loading, error, run } = useFetch(
    () => fetchQuestionPage({ page, search, examId, status, profile }),
    [page, search, examId, status, profile]
  );

  useEffect(() => {
    setPage(1);
  }, [search, examId, status]);

  const rows = data?.rows || [];
  const total = Number(data?.total || 0);

  function resetFilters() {
    setSearch('');
    setExamId('');
    setStatus('');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Published practice content</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Question bank</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Find examination questions with validated answers and cleared reuse rights. Editorial roles can inspect drafts and generated-question review evidence.
            </p>
          </div>
          {editorial && (
            <Link to="/question-generation" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">
              <ApperIcon name="WandSparkles" size={14} />
              Generate original questions
            </Link>
          )}
        </div>
      </header>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="question-search">Search questions</Label>
              <Input id="question-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Question text, concept or skill" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="question-exam-filter">Examination</Label>
              <select id="question-exam-filter" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={examId} onChange={(event) => setExamId(event.target.value)}>
                <option value="">All examinations</option>
                {(examinations || []).map((exam) => <option key={exam.Id} value={exam.Id}>{exam.Name}</option>)}
              </select>
            </div>
            {editorial && (
              <div className="space-y-1.5">
                <Label htmlFor="question-status-filter">Editorial status</Label>
                <select id="question-status-filter" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Published only</option>
                  <option value="Draft">Draft</option>
                  <option value="Review">Review</option>
                  <option value="Verified">Verified</option>
                  <option value="Published">Published</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            )}
            <Button type="button" variant="outline" onClick={resetFilters}>Reset</Button>
          </div>
          {examError && <p className="text-xs text-destructive">{examError}</p>}
          <p className="text-xs text-muted-foreground">
            {editorial
              ? 'Editorial view can inspect non-published questions. Student release still requires validated answers and a cleared rights basis.'
              : 'Only published questions with verified answers and Public or Licensed rights are returned.'}
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Question results</h2>
            <p className="text-xs text-muted-foreground">{loading ? 'Loading…' : total.toLocaleString() + ' result(s)'}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={run}><ApperIcon name="RefreshCw" size={14} className="mr-1" />Refresh</Button>
        </div>

        {loading && !data ? (
          <div className="space-y-3"><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /></div>
        ) : error ? (
          <Card><CardContent className="space-y-2 p-5">
            <p className="font-semibold">Question bank could not be loaded</p>
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={run}>Retry</Button>
          </CardContent></Card>
        ) : rows.length ? (
          <>
            <div className="grid gap-3">{rows.map((question) => <QuestionCard key={question.Id} question={question} editorial={editorial} />)}</div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Page {page} · {rows.length} displayed</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1,current - 1))}>Previous</Button>
                <Button type="button" size="sm" variant="outline" disabled={!data?.hasMore || loading} onClick={() => setPage((current) => current + 1)}>Next</Button>
              </div>
            </div>
          </>
        ) : (
          <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <ApperIcon name="LibraryBig" size={24} className="text-primary" />
            <div>
              <p className="font-semibold">No matching questions</p>
              <p className="mt-1 text-sm text-muted-foreground">No sample content is fabricated to hide an empty governed question dataset.</p>
            </div>
            {editorial && <Link to="/question-generation" className="text-sm font-semibold text-primary hover:underline">Open original question generation</Link>}
          </CardContent></Card>
        )}
      </section>
    </div>
  );
}
