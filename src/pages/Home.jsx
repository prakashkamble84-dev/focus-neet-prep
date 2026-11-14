import { Link } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';

export const route = {
  path: '/',
  layout: 'owner',
  access: 'authenticated'
};

export const nav = {
  label: 'Overview',
  icon: 'LayoutDashboard',
  group: 'Start',
  order: 0
};

const workspaces = [
  { title: 'Curriculum', detail: 'Explore exam-specific syllabus versions and chapter structure.', icon: 'BookOpen', path: '/curriculum', phase: 'Phase 2' },
  { title: 'Knowledge graph', detail: 'Understand concepts, prerequisites, and cross-topic links.', icon: 'Network', path: '/knowledge-graph', phase: 'Phase 3' },
  { title: '30-year intelligence', detail: 'Study historical papers, question DNA, and verified patterns.', icon: 'BrainCircuit', path: '/historical-intelligence', phase: 'Phase 4' },
  { title: 'Question bank', detail: 'Search published, answer-validated questions and inspect answer choices.', icon: 'Library', path: '/question-bank', phase: 'Phase 5' },
  { title: 'AI question generation', detail: 'Create original drafts with blind solving, quality checks and human release gates.', icon: 'WandSparkles', path: '/question-generation', phase: 'Phase 6' },
  { title: 'AI teacher', detail: 'Work through doubts with guided, inspectable explanations.', icon: 'Bot', path: '/ai-tutor', phase: 'Phase 8' },
  { title: 'Adaptive practice', detail: 'Practise based on mastery, prerequisites, and mistake patterns.', icon: 'Target', path: '/practice', phase: 'Phase 9' },
  { title: 'Mistake DNA', detail: 'Find recurring error types and repair the underlying gaps.', icon: 'ScanSearch', path: '/mistake-dna', phase: 'Phase 10' },
  { title: 'Revision centre', detail: 'Turn weak concepts into a sustainable spaced-revision plan.', icon: 'CalendarClock', path: '/revision', phase: 'Phase 11' },
  { title: 'Mock examinations', detail: 'Run exam-specific timed assessments and review results.', icon: 'ClipboardCheck', path: '/mock-tests', phase: 'Phase 12' },
  { title: 'Performance', detail: 'Track progress and evidence-based examination readiness.', icon: 'ChartNoAxesCombined', path: '/performance', phase: 'Phase 13' },
  { title: 'Parent and mentor', detail: 'Share authorised progress summaries and learning interventions.', icon: 'Users', path: '/mentors', phase: 'Phase 14' },
  { title: 'Academic sources', detail: 'Trace every syllabus item and question to its source.', icon: 'FileCheck2', path: '/sources', phase: 'Phase 2' }
];

const examTracks = [
  { name: 'JEE Main', subjects: 'Physics · Chemistry · Mathematics', marker: 'JM', accent: 'bg-primary text-primary-foreground' },
  { name: 'JEE Advanced', subjects: 'Physics · Chemistry · Mathematics', marker: 'JA', accent: 'bg-highlight text-highlight-foreground' },
  { name: 'NEET UG', subjects: 'Physics · Chemistry · Biology', marker: 'NU', accent: 'bg-secondary text-secondary-foreground' }
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.4fr_0.6fr] lg:p-10">
          <div className="relative z-10 max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">Your preparation workspace</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              Prepare with evidence.
              <span className="block text-primary">Practise with intent.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              One structured learning system for JEE Main, JEE Advanced, and NEET UG. Build concept depth, learn from mistakes, and make every practice session count.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/curriculum" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                Explore curriculum
                <ApperIcon name="ArrowUpRight" size={16} />
              </Link>
              <Link to="/architecture" className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-accent">
                View build roadmap
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative flex aspect-square w-full max-w-[250px] items-center justify-center rounded-full border border-primary/20 bg-accent/70">
              <div className="absolute inset-5 rounded-full border border-dashed border-primary/30" />
              <div className="absolute inset-10 rounded-full border border-primary/20" />
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                <ApperIcon name="Atom" size={44} />
              </div>
              <span className="absolute left-2 top-10 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px]">CONCEPTS</span>
              <span className="absolute right-0 top-1/2 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px]">PRACTICE</span>
              <span className="absolute bottom-8 left-3 rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px]">MASTERY</span>
            </div>
          </div>
        </div>
        <div className="grid border-t border-border bg-accent/50 sm:grid-cols-3">
          {['Official-source curriculum', 'Question-level intelligence', 'Student-specific learning'].map((label, index) => (
            <div key={label} className="flex items-center gap-3 border-b border-border px-6 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
              <span className="font-mono text-xs font-bold text-primary">0{index + 1}</span>
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Choose your examination track</p>
            <h2 className="mt-2 text-xl font-semibold">Three exams. Separate rules. One learning system.</h2>
          </div>
          <p className="text-xs text-muted-foreground">Exam-specific syllabus and scoring rules will remain versioned.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {examTracks.map((exam) => (
            <Link key={exam.name} to="/settings" className="group rounded-lg border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className={`flex h-11 w-11 items-center justify-center rounded-lg font-mono text-sm font-bold ${exam.accent}`}>{exam.marker}</span>
                <ApperIcon name="ArrowUpRight" size={18} className="text-muted-foreground transition group-hover:text-primary" />
              </div>
              <h3 className="mt-5 font-mono text-lg font-semibold">{exam.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{exam.subjects}</p>
              <p className="mt-4 text-xs font-semibold text-primary">Configure preparation track</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Learning system</p>
            <h2 className="mt-2 text-xl font-semibold">Your preparation, connected end to end</h2>
          </div>
          <Link to="/architecture" className="text-sm font-semibold text-primary hover:underline">See all implementation phases</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((item) => (
            <Link key={item.title} to={item.path} className="group flex min-h-[150px] gap-4 rounded-lg border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                <ApperIcon name={item.icon} size={19} />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{item.title}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{item.phase}</span>
                </span>
                <span className="mt-2 block text-sm leading-5 text-muted-foreground">{item.detail}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open workspace <ApperIcon name="ArrowRight" size={13} /></span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <ApperIcon name="ShieldCheck" size={20} className="text-primary" />
            <h2 className="font-mono text-base font-semibold">Built around academic trust</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Official syllabus versions, source provenance, OCR confidence, expert approval, and question validation are first-class parts of the design. Historical trends will be reported as evidence, not presented as guaranteed predictions.
          </p>
          <Link to="/sources" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Explore source governance <ApperIcon name="ArrowRight" size={15} /></Link>
        </div>
        <div className="rounded-lg border border-highlight/30 bg-highlight/5 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <ApperIcon name="Construction" size={20} className="text-highlight" />
            <h2 className="font-mono text-base font-semibold">Implementation status</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Phase 2 source and curriculum workflows are available. The published Question Bank and Phase 6 generation, validation and approval screens are deployed. The Gemini API key still needs to be entered in server-side Secrets Manager before live generation can run. Exam source baselines, verified syllabus coverage and human academic approvals remain data and governance work, not generated placeholders.
          </p>
          <Link to="/architecture" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-highlight hover:underline">Review what is and is not live <ApperIcon name="ArrowRight" size={15} /></Link>
        </div>
      </section>
    </div>
  );
}
