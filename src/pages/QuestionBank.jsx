import { useEffect, useState } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';
import QuestionBankQuestionCard from '@/components/question-bank/QuestionBankQuestionCard';
import {
  canUseEditorialQuestionBank,
  fetchQuestionBankExaminations,
  fetchQuestionBankPage
} from '@/services/questionBankService';

export const route = {
  path: '/question-bank',
  layout: 'owner',
  access: 'authenticated'
};

export const nav = {
  label: 'Question bank',
  icon: 'Library',
  group: 'Practice',
  order: 40
};

const PAGE_SIZE = 20;

function FilterSelect({ id, label, value, onChange, options, placeholder = 'All' }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function QuestionSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-8 w-40" />
      </CardContent>
    </Card>
  );
}

export default function QuestionBank() {
  const { profile } = useProfile();
  const isEditorial = canUseEditorialQuestionBank(profile);
  const [search, setSearch] = useState('');
  const [examinationId, setExaminationId] = useState('');
  const [subject, setSubject] = useState('');
  const [questionType, setQuestionType] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [page, setPage] = useState(1);

  const {
    data: examinations,
    loading: examinationsLoading,
    error: examinationsError
  } = useFetch(fetchQuestionBankExaminations, []);

  const {
    data,
    loading,
    error,
    run
  } = useFetch(
    () => fetchQuestionBankPage({
      page,
      pageSize: PAGE_SIZE,
      search,
      examinationId,
      subject,
      questionType,
      difficulty,
      year,
      status,
      sourceType,
      profile
    }),
    [
      page,
      search,
      examinationId,
      subject,
      questionType,
      difficulty,
      year,
      status,
      sourceType,
      profile
    ]
  );

  useEffect(() => {
    setPage(1);
  }, [search, examinationId, subject, questionType, difficulty, year, status, sourceType]);

  const rows = data?.rows || [];
  const total = Number(data?.total || 0);

  function resetFilters() {
    setSearch('');
    setExaminationId('');
    setSubject('');
    setQuestionType('');
    setDifficulty('');
    setYear('');
    setStatus('');
    setSourceType('');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Phase 5 · verified practice content
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Question bank</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Search examination questions by exam, subject, format, difficulty, year and source. Student-facing results are restricted to published questions with validated answers and cleared reuse rights.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
            <ApperIcon name="ShieldCheck" size={14} />
            Live database
          </span>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="space-y-1.5">
            <Label htmlFor="question-search">Search questions</Label>
            <div className="relative">
              <ApperIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="question-search"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search wording, concept names, skills or question-family codes"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              id="question-exam"
              label="Examination"
              value={examinationId}
              onChange={setExaminationId}
              options={(examinations || []).map((exam) => ({
                value: exam.Id,
                label: exam.Name + (exam.exam_type_c ? ' · ' + exam.exam_type_c : '')
              }))}
              placeholder={examinationsLoading ? 'Loading exams…' : 'All examinations'}
            />
            <FilterSelect
              id="question-subject"
              label="Subject"
              value={subject}
              onChange={setSubject}
              options={[
                { value: 'Physics', label: 'Physics' },
                { value: 'Chemistry', label: 'Chemistry' },
                { value: 'Maths', label: 'Mathematics' },
                { value: 'Biology', label: 'Biology' }
              ]}
            />
            <FilterSelect
              id="question-type"
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
            />
            <FilterSelect
              id="question-difficulty"
              label="Difficulty"
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: 'Basic', label: 'Basic' },
                { value: 'Moderate', label: 'Moderate' },
                { value: 'Advanced', label: 'Advanced' }
              ]}
            />
            <div className="space-y-1.5">
              <Label htmlFor="question-year">Historical year</Label>
              <Input
                id="question-year"
                inputMode="numeric"
                value={year}
                onChange={(event) => setYear(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="e.g. 2024"
              />
            </div>

            {isEditorial && (
              <>
                <FilterSelect
                  id="question-status"
                  label="Editorial status"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'Draft', label: 'Draft' },
                    { value: 'Review', label: 'Review' },
                    { value: 'Verified', label: 'Verified' },
                    { value: 'Published', label: 'Published' },
                    { value: 'Rejected', label: 'Rejected' }
                  ]}
                />
                <FilterSelect
                  id="question-source-type"
                  label="Source type"
                  value={sourceType}
                  onChange={setSourceType}
                  options={[
                    { value: 'Historical', label: 'Historical' },
                    { value: 'Original', label: 'Original' },
                    { value: 'Sample', label: 'Sample' },
                    { value: 'Teacher', label: 'Teacher supplied' }
                  ]}
                />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              {isEditorial
                ? 'Editorial view includes review-state records. Only authorised roles can open the historical approval workflow.'
                : 'Drafts, unvalidated answers, restricted sources and unpublished options are excluded by data permissions.'}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              <ApperIcon name="RotateCcw" size={14} className="mr-1.5" />
              Reset filters
            </Button>
          </div>
          {examinationsError && (
            <p className="text-xs text-destructive">Examination filter error: {examinationsError}</p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Question results</h2>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Updating results…' : total.toLocaleString() + ' matching question(s)'}
            </p>
          </div>
          <span className="rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
            Page {page}
          </span>
        </div>

        {loading && !data ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => <QuestionSkeleton key={index} />)}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-destructive">
                <ApperIcon name="AlertTriangle" size={17} />
                <p className="font-semibold">Question bank could not be loaded</p>
              </div>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button type="button" variant="outline" onClick={run}>Retry</Button>
            </CardContent>
          </Card>
        ) : rows.length ? (
          <>
            <div className="grid gap-3">
              {rows.map((question) => (
                <QuestionBankQuestionCard
                  key={question.Id}
                  question={question}
                  profile={profile}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{((page - 1) * PAGE_SIZE) + rows.length} of {total.toLocaleString()}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ApperIcon name="ChevronLeft" size={14} className="mr-1" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!data?.hasMore || loading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                  <ApperIcon name="ChevronRight" size={14} className="ml-1" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
                <ApperIcon name="LibraryBig" size={22} />
              </span>
              <div className="space-y-1">
                <h3 className="font-semibold">No questions match these filters</h3>
                <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                  The bank reads from governed question records. It does not fabricate sample papers to make an empty dataset look populated.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={resetFilters}>Clear filters</Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
