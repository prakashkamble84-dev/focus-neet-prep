import { Link } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { runAccessNegativeTests } from '@/services/accessNegativeTests';

export const route = { path: '/architecture', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Build roadmap', icon: 'Milestone', group: 'Governance', order: 130 };

const phases = [
  ['00', 'Product foundation', 'Application shell, module map, and a student onboarding checklist on Preferences that tracks profile, exam target, year, language and baseline setup.', 'Workflow built'],
  ['01', 'Database and security', '37 custom tables, eight application profiles, permissions, and 160 RLS policies are provisioned. Negative-access tests check the permission map for every role; live per-role server checks remain a release step.', 'Workflow built · permission-map tests'],
  ['02', 'Official sources and curriculum', 'Authority registry, versioned source documents, private PDF upload, rights review, manual page-extraction records, exam-year rules, syllabus change history, 2026 JEE Main/NEET unit-outline import, and NTA-listed JEE Main 2027 source records. Baseline rows require an authorised registration action; automated OCR remains pending.', 'Workflow built'],
  ['03', 'Knowledge graph', 'Concept identities, prerequisite edges, and mastery objectives.', 'Workflow built'],
  ['04', '30-year exam intelligence', 'Historical papers, OCR, DNA profiles, clustering, and crosswalks.', 'Partly built · paper registry only'],
  ['05', 'Question bank', 'Searchable published-question repository with examination filters, student-safe visibility, and answer-option inspection. The real corpus still depends on verified question records.', 'Workflow built'],
  ['06', 'AI question generation', 'Authenticated Gemini endpoint, original-question authoring, blind independent solving, answer-key agreement, format-specific option integrity, syllabus/difficulty/clarity/ambiguity checks, semantic and lexical duplicate screening, persisted validation evidence, independent Academic Expert approval, and separate CEO/Manager publication. The Gemini secret is saved; the first successful generation run still needs verification against an eligible published, expert-verified Concept.', 'Credential saved · run pending'],
  ['07', 'Diagnostics and student profile', 'Student profile onboarding, rights-cleared baseline diagnostics, server-side answer evaluation, student-owned attempt persistence, and concept mastery updates using the existing live tables. The first signed-in student test remains pending.', 'Workflow built · student test pending'],
  ['08', 'AI teacher', 'Deployed Gemini tutoring with hints-first and full-solution modes, private saved conversations, student-owned mastery/mistake context, recent attempts, and published verified curriculum references. Real student verification and answer-quality review remain pending.', 'Workflow built · student test pending'],
  ['09', 'Adaptive practice', 'Next-question selection using mastery, prerequisites, and novelty.', 'Workflow built'],
  ['10', 'Mistake DNA', 'Error categories, root causes, repair, and retesting.', 'Workflow built'],
  ['11', 'Study plan and revision', 'Time-aware planning and spaced repetition.', 'Workflow built'],
  ['12', 'Mock examinations', 'Exam simulations, autosave, scoring, and review.', 'Workflow built · server-timed grading'],
  ['13', 'Performance intelligence', 'Trends, benchmarks, and evidence-based readiness.', 'Workflow built · read-only analytics'],
  ['14', 'Parents and mentors', 'Consent, assignments, reporting, and scholarship information.', 'Workflow built · consent workspace'],
  ['15', 'Multilingual and voice', 'Language preferences, speech, and supported image intake.', 'Workflow built · language preferences only'],
  ['16', 'Production hardening', 'Privacy, security, monitoring, backups, performance, and deployment.', 'Partly built · privacy section; operations pending']
];

export default function Architecture() {
  const accessTests = runAccessNegativeTests();

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
              The Phase 2 source workflow is available. The published Question Bank and Phase 6 question-generation, validation and editorial approval workflows are deployed on the connected application. GEMINI_API_KEY is saved in server-side Secrets Manager, and the deployed function now reads it through Apper's secret API. A successful live run is not yet confirmed; it also requires an eligible published, expert-verified Concept and an authenticated academic editor. Phase 7 profile and diagnostic workflows are implemented on the existing student tables; an authenticated student run must still verify attempt and mastery persistence. Phase 8 Gemini tutor is deployed with private session history and student-specific learning context; a real student session and response-quality review remain pending. Verified exam baselines, syllabus coverage, real question corpus, human academic sign-offs, and live role-negative tests against the server remain explicit release requirements.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {phases.map((phase) => (
          <div key={phase[0]} className="grid gap-3 border-b border-border p-4 last:border-b-0 sm:grid-cols-[54px_minmax(0,1fr)_150px] sm:items-center sm:px-5">
            <span className="font-mono text-sm font-semibold text-primary">{phase[0]}</span>
            <div>
              <p className="font-semibold">{phase[1]}</p>
              <p className="mt-1 text-sm text-muted-foreground">{phase[2]}</p>
            </div>
            <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${phase[3].includes('pending') ? 'bg-warning/15 text-warning-foreground' : phase[3] === 'Schema provisioned' || phase[3].startsWith('Workflow built') ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
              {phase[3]}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold">Phase 01 negative-access tests</p>
          <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">{accessTests.passed} of {accessTests.tests.length} passed</span>
        </div>
        <ul className="divide-y divide-border">
          {accessTests.tests.map((test) => (
            <li key={test.name} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 text-muted-foreground">{test.name}</span>
              <span className={`shrink-0 text-xs font-semibold ${test.passed ? 'text-success' : 'text-destructive'}`}>{test.passed ? 'Pass' : 'Fail'}</span>
            </li>
          ))}
        </ul>
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
