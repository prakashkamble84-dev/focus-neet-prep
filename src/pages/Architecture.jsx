import { Link } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';

export const route = { path: '/architecture', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Build roadmap', icon: 'Milestone', group: 'Governance', order: 130 };

const phases = [
  ['00', 'Product foundation', 'Application shell and module map are deployed; onboarding workflows remain to be implemented.', 'Shell deployed'],
  ['01', 'Database and security', '37 custom tables, eight application profiles, permissions, and 160 RLS policies are provisioned; negative-access tests remain pending.', 'Schema provisioned'],
  ['02', 'Official sources and curriculum', 'Authority registry, versioned source documents, private PDF upload, rights review, manual page-extraction records, exam-year rules, syllabus change history, 2026 JEE Main/NEET unit-outline import, and NTA-listed JEE Main 2027 source records. Baseline rows require an authorised registration action; automated OCR remains pending.', 'Workflow built'],
  ['03', 'Knowledge graph', 'Concept identities, prerequisite edges, and mastery objectives.', 'Not started'],
  ['04', '30-year exam intelligence', 'Historical papers, OCR, DNA profiles, clustering, and crosswalks.', 'Not started'],
  ['05', 'Question bank', 'Versioned questions, answer keys, source mappings, and search.', 'Not started'],
  ['06', 'AI question generation', 'Original questions, independent solving, validation, and expert approval.', 'Not started'],
  ['07', 'Diagnostics and student profile', 'Baseline assessment, strengths, gaps, and learning preferences.', 'Not started'],
  ['08', 'AI teacher', 'Guided hints, explanations, Gemini integration, and evaluation.', 'Not started'],
  ['09', 'Adaptive practice', 'Next-question selection using mastery, prerequisites, and novelty.', 'Not started'],
  ['10', 'Mistake DNA', 'Error categories, root causes, repair, and retesting.', 'Not started'],
  ['11', 'Study plan and revision', 'Time-aware planning and spaced repetition.', 'Not started'],
  ['12', 'Mock examinations', 'Exam simulations, autosave, scoring, and review.', 'Not started'],
  ['13', 'Performance intelligence', 'Trends, benchmarks, and evidence-based readiness.', 'Not started'],
  ['14', 'Parents and mentors', 'Consent, assignments, reporting, and scholarship information.', 'Not started'],
  ['15', 'Multilingual and voice', 'Language preferences, speech, and supported image intake.', 'Not started'],
  ['16', 'Production hardening', 'Privacy, security, monitoring, backups, performance, and deployment.', 'Not started']
];

export default function Architecture() {
  return (
    <div className="space-y-7">
      <div className="max-w-3xl space-y-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Delivery plan · 17 phases</p>
        <h1 className="text-2xl font-semibold sm:text-3xl">Build roadmap</h1>
        <p className="text-sm leading-6 text-muted-foreground sm:text-base">
          The implementation is deliberately sequenced. Each phase has dependencies and a completion gate. Features are not marked live until the underlying data, permissions, and tests exist.
        </p>
      </div>

      <div className="rounded-lg border border-highlight/30 bg-highlight/5 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ApperIcon name="Info" size={19} className="mt-0.5 shrink-0 text-highlight" />
          <div>
            <p className="font-semibold">Current build status</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              The backend has 37 custom tables, eight application profiles, and 160 row-level policies. Phase 2 source and curriculum workflows are built, but official baseline rows still require registration from the Sources page, PDFs require upload and review, and automated OCR is not connected. NTA's 2027 syllabus and bulletin listings are recorded as Discovered, with no 2027 topics imported. Role-negative access tests and live AI are still pending.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {phases.map((phase, index) => (
          <div key={phase[0]} className="grid gap-3 border-b border-border p-4 last:border-b-0 sm:grid-cols-[54px_minmax(0,1fr)_150px] sm:items-center sm:px-5">
            <span className="font-mono text-sm font-semibold text-primary">{phase[0]}</span>
            <div>
              <p className="font-semibold">{phase[1]}</p>
              <p className="mt-1 text-sm text-muted-foreground">{phase[2]}</p>
            </div>
            <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${phase[3] === 'Schema provisioned' || phase[3] === 'Workflow built' ? 'bg-success/10 text-success' : index === 0 ? 'bg-warning/15 text-warning-foreground' : 'bg-muted text-muted-foreground'}`}>
              {phase[3]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
          <ApperIcon name="ArrowLeft" size={15} />
          Back to dashboard
        </Link>
        <Link to="/academic-review" className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm font-semibold hover:bg-accent">
          Review governance requirements
          <ApperIcon name="ArrowRight" size={15} />
        </Link>
      </div>
    </div>
  );
}
