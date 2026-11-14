import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';
import { sdk } from '@/services/sdk';

export const route = { path: '/historical-intelligence', layout: 'owner', access: 'authenticated' };
export const nav = { label: '30-year intelligence', icon: 'BrainCircuit', group: 'Research', order: 30 };

const PAGE_SIZE = 20;
const PAPER_TYPES = ['Main', 'Advanced', 'NEET', 'Legacy'];
const PAPER_FIELDS = [
  'Name',
  'examination_c',
  'exam_year_c',
  'session_c',
  'paper_code_c',
  'paper_type_c',
  'question_count_c',
  'rights_status_c',
  'status_c',
  'difficulty_summary_c'
];
const STATUS_STYLES = {
  Published: 'border-success/30 bg-success/10 text-success',
  Verified: 'border-primary/30 bg-primary/10 text-primary',
  Review: 'border-warning/40 bg-warning/15 text-warning-foreground',
  New: 'border-border bg-muted text-muted-foreground'
};

async function fetchExaminations() {
  const result = await sdk.table('examinations_c')
    .select(['Id', 'Name'])
    .orderBy('Name')
    .limit(100, 0)
    .fetch();
  if (!result.success) throw new Error(result.message || 'Examination list could not be loaded.');
  return result.data || [];
}

async function fetchPapers({ page, search, examId, paperType }) {
  const { eq, contains, and, or } = window.ApperSDK.CoreSDK;
  const clauses = [];
  if (examId) clauses.push(eq('examination_c', examId));
  if (paperType) clauses.push(eq('paper_type_c', paperType));
  const term = String(search || '').trim();
  if (term) clauses.push(or(contains('Name', term), contains('paper_code_c', term)));

  let query = sdk.table('historical_papers_c').select(PAPER_FIELDS);
  if (clauses.length) query = query.where(and(...clauses));
  const result = await query.orderByDesc('exam_year_c').page(page, PAGE_SIZE).fetch();
  if (!result.success) throw new Error(result.message || 'Historical papers could not be loaded.');
  return {
    rows: result.data || [],
    total: Number(result.total || 0),
    hasMore: Boolean(result.hasMore)
  };
}

function PaperCard({ paper }) {
  const statusClass = STATUS_STYLES[paper.status_c] || STATUS_STYLES.New;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold" title={paper.Name}>{paper.Name || '—'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {paper.examination_c?.Name ?? '—'} · {paper.exam_year_c ?? '—'}{paper.session_c ? ` · ${paper.session_c}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Badge variant="outline">{paper.paper_type_c ?? '—'}</Badge>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>{paper.status_c ?? '—'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>Paper code <span className="font-mono text-foreground">{paper.paper_code_c ?? '—'}</span></span>
          <span className="tabular-nums">{paper.question_count_c ?? '—'} questions</span>
          <span>Rights: {paper.rights_status_c ?? 'Unknown'}</span>
        </div>
        {paper.difficulty_summary_c && (
          <p className="line-clamp-2 break-words text-sm text-muted-foreground">{paper.difficulty_summary_c}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function HistoricalIntelligence() {
  const [search, setSearch] = useState('');
  const [examId, setExamId] = useState('');
  const [paperType, setPaperType] = useState('');
  const [page, setPage] = useState(1);

  const { data: examinations, error: examError } = useFetch(fetchExaminations, []);
  const { data, loading, error, run } = useFetch(
    () => fetchPapers({ page, search, examId, paperType }),
    [page, search, examId, paperType]
  );

  useEffect(() => {
    setPage(1);
  }, [search, examId, paperType]);

  const rows = data?.rows || [];
  const total = Number(data?.total || 0);

  function resetFilters() {
    setSearch('');
    setExamId('');
    setPaperType('');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Historical examination research</p>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">30-year exam intelligence</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Browse the registered historical papers by examination, year and paper type. Each entry shows its verification status and rights basis. Historical frequency is descriptive evidence, not a prediction of future papers.
          </p>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="paper-search">Search papers</Label>
              <Input id="paper-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Paper name or paper code" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-exam-filter">Examination</Label>
              <select id="paper-exam-filter" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={examId} onChange={(event) => setExamId(event.target.value)}>
                <option value="">All examinations</option>
                {(examinations || []).map((exam) => <option key={exam.Id} value={exam.Id}>{exam.Name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-type-filter">Paper type</Label>
              <select id="paper-type-filter" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={paperType} onChange={(event) => setPaperType(event.target.value)}>
                <option value="">All paper types</option>
                {PAPER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <Button type="button" variant="outline" onClick={resetFilters}>Reset</Button>
          </div>
          {examError && <p className="text-xs text-destructive">{examError}</p>}
          <p className="text-xs text-muted-foreground">
            Only papers your role is permitted to see are returned. Papers without a cleared rights basis remain restricted.
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Registered papers</h2>
            <p className="text-xs text-muted-foreground">{loading ? 'Loading…' : `${total.toLocaleString()} paper(s)`}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={run}><ApperIcon name="RefreshCw" size={14} className="mr-1" />Refresh</Button>
        </div>

        {loading && !data ? (
          <div className="space-y-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>
        ) : error ? (
          <Card><CardContent className="space-y-2 p-5">
            <p className="font-semibold">Historical papers could not be loaded</p>
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={run}>Retry</Button>
          </CardContent></Card>
        ) : rows.length ? (
          <>
            <div className="grid gap-3">{rows.map((paper) => <PaperCard key={paper.Id} paper={paper} />)}</div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Page {page} · {rows.length} displayed</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
                <Button type="button" size="sm" variant="outline" disabled={!data?.hasMore || loading} onClick={() => setPage((current) => current + 1)}>Next</Button>
              </div>
            </div>
          </>
        ) : (
          <Card><CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <ApperIcon name="BrainCircuit" size={24} className="text-primary" />
            <div>
              <p className="font-semibold">No matching papers</p>
              <p className="mt-1 text-sm text-muted-foreground">Papers appear here once they are registered from a verified source document. No sample papers are shown.</p>
            </div>
            <Link to="/sources" className="text-sm font-semibold text-primary hover:underline">Open source registry</Link>
          </CardContent></Card>
        )}
      </section>
    </div>
  );
}
