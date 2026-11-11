import { Link } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';

export default function ModuleWorkspace({
  eyebrow,
  title,
  summary,
  phase,
  status = 'Planned',
  statusTone = 'muted',
  capabilities = [],
  prerequisites = [],
  nextPath = '/',
  nextLabel = 'Return to dashboard',
  note
}) {
  const tones = {
    active: 'border-success/30 bg-success/10 text-success',
    planned: 'border-border bg-muted text-muted-foreground',
    review: 'border-warning/40 bg-warning/15 text-warning-foreground'
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${tones[statusTone] || tones.planned}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {status}
          </span>
          <span className="rounded-full border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground">{phase}</span>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div className="rounded-lg border border-border bg-card p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-primary">
              <ApperIcon name="Layers3" size={19} />
            </span>
            <div>
              <h2 className="font-mono text-base font-semibold">Module scope</h2>
              <p className="text-xs text-muted-foreground">Capabilities defined by the agreed architecture</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-md border border-border/80 bg-background p-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent font-mono text-[11px] font-semibold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="text-sm leading-5">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dependencies</p>
            <ul className="mt-4 space-y-3">
              {(prerequisites.length ? prerequisites : ['Project foundation', 'Verified academic data', 'Role-based access controls']).map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ApperIcon name="GitBranch" size={15} className="mt-0.5 shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-accent/50 p-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">Implementation note</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {note || 'This module is represented in the application structure. Its production data model, workflows, and validations will be implemented in its dedicated build phase.'}
            </p>
            <Link to={nextPath} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
              {nextLabel}
              <ApperIcon name="ArrowRight" size={15} />
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
