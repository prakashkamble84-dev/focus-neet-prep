import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line
} from 'recharts';
import ApperIcon from '@/components/ApperIcon';
import HistoricalPaperStatusAction from '@/components/historical-intelligence/HistoricalPaperStatusAction';
import HistoricalQuestionQueue from '@/components/historical-intelligence/HistoricalQuestionQueue';
import HistoricalArchiveSources from '@/components/historical-intelligence/HistoricalArchiveSources';
import { fetchHistoricalIntelligenceData } from '@/services/historicalIntelligenceService';
import { buildHistoricalIntelligence } from '@/services/historicalIntelligenceRules';
import { runHistoricalIntelligenceSelfTests } from '@/services/historicalIntelligenceSelfTests';

export const route = { path: '/historical-intelligence', layout: 'owner', access: 'authenticated' };
export const nav = { label: '30-year intelligence', icon: 'BrainCircuit', group: 'Research', order: 30 };

const CURRENT_YEAR = new Date().getFullYear();
const STAFF_PROFILES = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c', 'ContentReviewer_c'];
const PAPER_EDITOR_PROFILES = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'];

function StatBlock({ label, value, detail, icon }) {
  return (
    <Card className="border-border/80">
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
          <ApperIcon name={icon} size={17} />
        </span>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  const variants = {
    Published: 'default',
    Verified: 'secondary',
    Review: 'outline',
    New: 'outline',
    Rejected: 'destructive'
  };
  return <Badge variant={variants[status] || 'outline'}>{status || 'Unspecified'}</Badge>;
}

function EmptyState({ title, description, action }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-primary">
        <ApperIcon name="FileSearch" size={20} />
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export default function HistoricalIntelligence() {
  const { profile } = useProfile();
  const canReview = STAFF_PROFILES.includes(profile);
  const canRegisterPaper = PAPER_EDITOR_PROFILES.includes(profile);
  const { data, loading, error, run } = useFetch(
    () => fetchHistoricalIntelligenceData({ includeReviews: canReview }),
    [canReview]
  );

  const [examFilter, setExamFilter] = useState('all');
  const [fromYear, setFromYear] = useState(CURRENT_YEAR - 29);
  const [toYear, setToYear] = useState(CURRENT_YEAR);
  const [paperSearch, setPaperSearch] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const selfTests = useMemo(() => runHistoricalIntelligenceSelfTests(), []);

  const model = useMemo(() => buildHistoricalIntelligence(data || {}, {
    currentYear: CURRENT_YEAR,
    fromYear,
    toYear,
    examFilter
  }), [data, fromYear, toYear, examFilter]);

  const exams = data?.examinations || [];

  const visiblePaperRows = useMemo(() => {
    const query = paperSearch.trim().toLowerCase();
    if (!query) return model.papers;
    return model.papers.filter((paper) => [
      paper.Name,
      paper.paper_code_c,
      paper.session_c,
      paper.examName,
      paper.paper_type_c
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [model.papers, paperSearch]);

  const formatCount = (value) => new Intl.NumberFormat('en-IN').format(value || 0);
  const passRate = selfTests.total ? Math.round((selfTests.passed / selfTests.total) * 100) : 0;

  async function refresh() {
    const result = await run();
    if (result) toast.success('Historical intelligence data refreshed.');
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Research / phase 04
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
              30-year exam intelligence
            </h1>
            <Badge variant="outline">Evidence-gated</Badge>
          </div>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Historical paper coverage, question-family signals and concept trends across the 1997–{CURRENT_YEAR} window.
            Only verified papers and validated questions contribute to the trend charts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canRegisterPaper && (
            <Button variant="outline" asChild>
              <Link to="/historical-intelligence/papers/new">
                <ApperIcon name="FileUp" size={15} className="mr-2" />
                Ingest paper PDF
              </Link>
            </Button>
          )}
          <Button variant="outline" onClick={refresh} disabled={loading}>
            <ApperIcon name="RefreshCw" size={15} className={loading ? 'mr-2 animate-spin' : 'mr-2'} />
            Refresh data
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/sources">
              Source registry
              <ApperIcon name="ArrowUpRight" size={15} className="ml-2" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBlock
          label="Registered papers"
          value={formatCount(model.stats.visiblePapers)}
          detail="Visible in the selected exam and year filters"
          icon="Files"
        />
        <StatBlock
          label="Evidence-ready papers"
          value={formatCount(model.stats.eligiblePapers)}
          detail="Verified status, source provenance and rights cleared"
          icon="ShieldCheck"
        />
        <StatBlock
          label="Verified historical questions"
          value={formatCount(model.stats.verifiedQuestions)}
          detail="Extraction, answer and source checks passed"
          icon="ListChecks"
        />
        <StatBlock
          label="Years with evidence"
          value={formatCount(model.stats.yearsCovered)}
          detail="Of 30 calendar years in the selected window"
          icon="CalendarRange"
        />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-end">
        <div className="min-w-48 flex-1 space-y-1.5">
          <label htmlFor="historical-exam-filter" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Examination
          </label>
          <select
            id="historical-exam-filter"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={examFilter}
            onChange={(event) => setExamFilter(event.target.value)}
          >
            <option value="all">All examinations</option>
            {exams.map((exam) => (
              <option key={exam.Id} value={exam.Name}>{exam.Name}</option>
            ))}
          </select>
        </div>
        <div className="w-full space-y-1.5 sm:w-36">
          <label htmlFor="historical-from-year" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            From year
          </label>
          <Input
            id="historical-from-year"
            type="number"
            min="1997"
            max={CURRENT_YEAR}
            value={fromYear}
            onChange={(event) => setFromYear(Number(event.target.value) || 1997)}
          />
        </div>
        <div className="w-full space-y-1.5 sm:w-36">
          <label htmlFor="historical-to-year" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            To year
          </label>
          <Input
            id="historical-to-year"
            type="number"
            min="1997"
            max={CURRENT_YEAR}
            value={toYear}
            onChange={(event) => setToYear(Number(event.target.value) || CURRENT_YEAR)}
          />
        </div>
        <p className="max-w-sm text-xs leading-5 text-muted-foreground">
          Trend evidence requires both paper and source-document verification. A year with no indexed evidence is shown as zero, not guessed.
        </p>
      </section>

      {error && (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-semibold">Historical intelligence data could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>Retry loading data</Button>
        </section>
      )}

      {data?.meta?.truncated && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <ApperIcon name="AlertTriangle" size={16} className="mt-0.5 shrink-0 text-warning" />
          <p>
            The query hit its 5,000-record retrieval limit. Some records may be omitted from the current analysis; refine the examination filter or reduce the year range before relying on totals.
          </p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="papers">Paper registry</TabsTrigger>
          <TabsTrigger value="questions">Question review</TabsTrigger>
          <TabsTrigger value="patterns">Question patterns</TabsTrigger>
          <TabsTrigger value="archives">Official archives</TabsTrigger>
          <TabsTrigger value="quality">Evidence quality</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          {loading && !data ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-56 w-full lg:col-span-2" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-mono text-base">Verified paper coverage by year</CardTitle>
                    <CardDescription>Count of source-backed historical papers in the selected period</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {model.stats.eligiblePapers ? (
                      <ResponsiveContainer width="100%" height={270}>
                        <BarChart data={model.yearTrend} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="year" interval={Math.max(0, Math.floor(model.yearTrend.length / 7) - 1)} tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="papers" name="Verified papers" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState
                        title="No verified papers in this filter"
                        description="Register official paper sources and complete source, rights and academic verification. The chart will populate from those records."
                        action={<Button variant="outline" size="sm" asChild><Link to="/sources">Open source registry</Link></Button>}
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-mono text-base">Verified question volume by year</CardTitle>
                    <CardDescription>Question records that passed extraction, answer and source checks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {model.stats.verifiedQuestions ? (
                      <ResponsiveContainer width="100%" height={270}>
                        <LineChart data={model.yearTrend} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="year" interval={Math.max(0, Math.floor(model.yearTrend.length / 7) - 1)} tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="questions" name="Verified questions" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState
                        title="No verified questions yet"
                        description="Question records enter this chart only after their extraction, answer key, rights and linked paper are verified."
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-mono text-base">Concept coverage by subject</CardTitle>
                    <CardDescription>
                      Unique questions with at least one verified mapping to a published concept
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {model.subjectCounts.length ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={model.subjectCounts} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="subject" width={86} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="count" name="Mapped questions" fill="var(--chart-3)" radius={[0, 3, 3, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState
                        title="Concept mapping is not available"
                        description="Verified question-to-concept mappings and published knowledge graph nodes are needed for subject coverage."
                        action={<Button variant="outline" size="sm" asChild><Link to="/knowledge-graph">Open knowledge graph</Link></Button>}
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="font-mono text-base">Question difficulty profile</CardTitle>
                    <CardDescription>Difficulty labels supplied on eligible historical questions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {model.stats.verifiedQuestions ? model.difficultyCounts.map((row, index) => {
                      const percentage = Math.round((row.count / model.stats.verifiedQuestions) * 100);
                      return (
                        <div key={row.difficulty} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span>{row.difficulty}</span>
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                              {formatCount(row.count)} · {percentage}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: percentage + '%',
                                backgroundColor: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'][index]
                              }}
                            />
                          </div>
                        </div>
                      );
                    }) : (
                      <EmptyState
                        title="No difficulty sample"
                        description="Difficulty distributions appear once verified historical question records are available."
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="font-mono text-base">Question-to-concept mapping</CardTitle>
                    <CardDescription>Mapped coverage uses verified mappings only</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="font-mono text-3xl font-semibold">{model.stats.mappingRate}%</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatCount(model.stats.mappedQuestions)} of {formatCount(model.stats.verifiedQuestions)} verified historical questions are mapped to a published concept.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="font-mono text-base">Declared paper question coverage</CardTitle>
                    <CardDescription>Observed verified questions compared with paper metadata totals</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="font-mono text-3xl font-semibold">{model.stats.paperQuestionCoverage}%</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatCount(model.stats.verifiedQuestions)} verified questions against {formatCount(model.stats.declaredQuestions)} declared questions across evidence-ready papers.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="papers" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-mono text-lg font-semibold">Historical paper registry</h2>
              <p className="text-sm text-muted-foreground">Paper metadata and source-readiness for the selected period</p>
            </div>
            <div className="w-full sm:max-w-xs">
              <Input
                value={paperSearch}
                onChange={(event) => setPaperSearch(event.target.value)}
                placeholder="Search paper, code, session or exam"
                aria-label="Search historical papers"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading && !data ? (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : visiblePaperRows.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year / paper</TableHead>
                        <TableHead>Examination</TableHead>
                        <TableHead>Session</TableHead>
                        <TableHead>Questions</TableHead>
                        <TableHead>Record status</TableHead>
                        <TableHead>Trend eligibility</TableHead>
                        <TableHead>Workflow</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiblePaperRows.map((paper) => {
                        const verifiedCount = model.questions.filter((question) => String(question.paper?.Id) === String(paper.Id)).length;
                        return (
                          <TableRow key={paper.Id}>
                            <TableCell className="min-w-56">
                              <p className="font-semibold">{paper.Name}</p>
                              <p className="mt-1 font-mono text-xs text-muted-foreground">
                                {paper.exam_year_c} · {paper.paper_code_c || 'No paper code'}
                              </p>
                            </TableCell>
                            <TableCell>{paper.examName}</TableCell>
                            <TableCell>{paper.session_c || '—'}</TableCell>
                            <TableCell className="font-mono tabular-nums">
                              {formatCount(verifiedCount)} / {paper.question_count_c ?? '—'}
                            </TableCell>
                            <TableCell><StatusBadge status={paper.status_c} /></TableCell>
                            <TableCell>
                              {paper.trendEligible ? (
                                <Badge variant="secondary">Evidence-ready</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">{paper.evidenceReason}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {canRegisterPaper ? (
                                <HistoricalPaperStatusAction paper={paper} onSaved={refresh} />
                              ) : (
                                <span className="text-xs text-muted-foreground">Read only</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-5">
                  <EmptyState
                    title="No historical paper records match this filter"
                    description="Register paper metadata after its PDF has been added to the source registry. New records stay out of trend charts until review is complete."
                    action={canRegisterPaper ? (
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <Button size="sm" asChild><Link to="/historical-intelligence/papers/new">Ingest a paper PDF</Link></Button>
                        <Button variant="outline" size="sm" asChild><Link to="/sources">Manage source PDFs</Link></Button>
                      </div>
                    ) : <Button variant="outline" size="sm" asChild><Link to="/sources">Open source registry</Link></Button>}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-5">
          <HistoricalQuestionQueue
            questions={data?.questions || []}
            canEdit={canReview}
          />
          <div className="flex flex-wrap gap-2 text-sm">
            <Button variant="outline" asChild><Link to="/sources">Review source pages and OCR</Link></Button>
            <Button variant="outline" asChild><Link to="/knowledge-graph">Review concept mappings</Link></Button>
          </div>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-5">
          <div>
            <h2 className="font-mono text-lg font-semibold">Question pattern library</h2>
            <p className="text-sm text-muted-foreground">
              Clusters are sourced from reviewer-assigned family and pattern codes. Similarity is not inferred from unreviewed text.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-mono text-base">Question families</CardTitle>
                <CardDescription>Most frequent family codes among evidence-ready questions</CardDescription>
              </CardHeader>
              <CardContent>
                {model.questionFamilies.length ? (
                  <div className="space-y-3">
                    {model.questionFamilies.map((family) => (
                      <div key={family.key} className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-0">
                        <span className="font-mono text-sm">{family.label}</span>
                        <Badge variant="outline">{formatCount(family.count)} questions</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No family codes found" description="Add reviewed question-family codes to verified historical questions to populate this view." />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-mono text-base">Recurring pattern groups</CardTitle>
                <CardDescription>Exact recurring-pattern labels recorded on verified questions</CardDescription>
              </CardHeader>
              <CardContent>
                {model.recurringPatterns.length ? (
                  <div className="space-y-3">
                    {model.recurringPatterns.map((pattern) => (
                      <div key={pattern.key} className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-0">
                        <span className="text-sm">{pattern.label}</span>
                        <Badge variant="outline">{formatCount(pattern.count)}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No recurring pattern labels" description="Pattern groups appear only when an academic reviewer records them on verified questions." />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-mono text-base">Frequently mapped concepts</CardTitle>
                <CardDescription>Verified question-to-concept links for published graph nodes</CardDescription>
              </CardHeader>
              <CardContent>
                {model.concepts.length ? (
                  <div className="space-y-3">
                    {model.concepts.map((concept) => (
                      <div key={concept.label + concept.subject} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{concept.label}</p>
                          <p className="text-xs text-muted-foreground">{concept.subject}</p>
                        </div>
                        <span className="font-mono text-sm tabular-nums">{formatCount(concept.count)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No published concept mappings" description="Map verified questions to published concepts in the knowledge graph." action={<Button variant="outline" size="sm" asChild><Link to="/knowledge-graph">Open knowledge graph</Link></Button>} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="font-mono text-base">Recorded skill DNA</CardTitle>
                <CardDescription>Exact skill labels supplied on evidence-ready questions</CardDescription>
              </CardHeader>
              <CardContent>
                {model.skillProfiles.length ? (
                  <div className="space-y-3">
                    {model.skillProfiles.map((skill) => (
                      <div key={skill.key} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0">
                        <span className="text-sm">{skill.label}</span>
                        <Badge variant="outline">{formatCount(skill.count)}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No skill labels found" description="Skill DNA appears after reviewers classify the skills required by historical questions." />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">Concept combinations</CardTitle>
              <CardDescription>Recorded combinations only. These are descriptive frequencies, not predictions.</CardDescription>
            </CardHeader>
            <CardContent>
              {model.conceptCombinations.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {model.conceptCombinations.map((item) => (
                    <div key={item.key} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                      <p className="text-sm leading-5">{item.label}</p>
                      <Badge variant="secondary">{formatCount(item.count)}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No recorded concept combinations" description="Question combinations need reviewed metadata before a frequency can be calculated." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archives" className="space-y-5">
          <HistoricalArchiveSources />
        </TabsContent>

        <TabsContent value="quality" className="space-y-5">
          <div>
            <h2 className="font-mono text-lg font-semibold">Evidence quality and validation</h2>
            <p className="text-sm text-muted-foreground">
              Records visible to your profile are checked against the same publication gates used by the analysis.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatBlock label="Papers awaiting gates" value={formatCount(model.quality.papersPending)} detail="Visible papers not yet evidence-ready" icon="FileClock" />
            <StatBlock label="Questions excluded" value={formatCount(model.quality.excludedQuestions)} detail="Linked questions that failed one or more gates" icon="ListX" />
            <StatBlock label="Questions unmapped" value={formatCount(model.quality.unmappedQuestions)} detail="Verified questions without a published concept map" icon="Network" />
            <StatBlock label="Logic checks" value={formatCount(selfTests.passed) + ' / ' + formatCount(selfTests.total)} detail={passRate + '% deterministic self-test pass rate'} icon="TestTube2" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">Why records are excluded</CardTitle>
              <CardDescription>Counts are based only on rows returned by database access policies</CardDescription>
            </CardHeader>
            <CardContent>
              {model.quality.reasons.length ? (
                <div className="space-y-3">
                  {model.quality.reasons.map((reason) => (
                    <div key={reason.reason} className="flex items-center justify-between gap-4 border-b border-border pb-2 last:border-0">
                      <span className="text-sm">{reason.reason}</span>
                      <Badge variant="outline">{formatCount(reason.count)}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No excluded paper or question records are visible in this filter.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-mono text-base">Deterministic rule checks</CardTitle>
              <CardDescription>Evidence gates, mismatch handling, mapping rules and year-range behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {selfTests.checks.map((check) => (
                <div key={check.name} className="flex items-start gap-2 text-sm">
                  <ApperIcon
                    name={check.passed ? 'CheckCircle2' : 'XCircle'}
                    size={16}
                    className={check.passed ? 'mt-0.5 shrink-0 text-success' : 'mt-0.5 shrink-0 text-destructive'}
                  />
                  <div className="min-w-0">
                    <p>{check.name}</p>
                    {!check.passed && <p className="text-xs text-destructive">{check.detail}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {canReview && (
            <Card>
              <CardHeader>
                <CardTitle className="font-mono text-base">Academic review records</CardTitle>
                <CardDescription>Question review events returned for your reviewer role</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.reviews?.length ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Question</TableHead>
                          <TableHead>Review type</TableHead>
                          <TableHead>Decision</TableHead>
                          <TableHead>Reviewed at</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.reviews.slice(0, 30).map((review) => (
                          <TableRow key={review.Id}>
                            <TableCell>{review.Name || review.question_c?.Name || 'Question review'}</TableCell>
                            <TableCell>{review.review_type_c}</TableCell>
                            <TableCell><StatusBadge status={review.review_status_c} /></TableCell>
                            <TableCell className="text-xs text-muted-foreground">{review.reviewed_at_c || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No question review events are currently visible to this role.</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <footer className="flex flex-col gap-2 border-t border-border pt-4 text-xs leading-5 text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
        <p>
          Historical frequencies describe the indexed sample. They do not predict future questions, guarantee topic appearance or prove that an unindexed year had no exam.
        </p>
        <Link to="/knowledge-graph" className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline">
          Open knowledge graph
          <ApperIcon name="ArrowUpRight" size={13} />
        </Link>
      </footer>
    </div>
  );
}
