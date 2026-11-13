import { Link } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';

export default function KnowledgeGraphHeader({ canEdit, nodeCount, conceptCount, publishedCount, prerequisiteCount, familyCount }) {
  return (
    <>
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Phase 3 · Master knowledge graph</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">JEE + NEET knowledge graph</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Connect the versioned syllabus to concepts, prerequisites, question families, historical crosswalks and observable mastery criteria.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('northstar:open-graph-node'))}>
                <ApperIcon name="Plus" size={15} /> Add concept
              </Button>
              <Button onClick={() => window.dispatchEvent(new CustomEvent('northstar:open-graph-edge'))}>
                <ApperIcon name="GitBranch" size={15} /> Connect concepts
              </Button>
            </>
          )}
          <Button variant="outline" asChild>
            <Link to="/curriculum/manage"><ApperIcon name="ListTree" size={15} /> Curriculum</Link>
          </Button>
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <ApperIcon name="Layers3" size={18} className="mt-0.5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-semibold">Three separate knowledge layers</p>
            <p className="text-sm leading-6 text-muted-foreground">
              Official syllabus facts remain tied to a specific published version. Historical syllabus links remain crosswalks, not current learning requirements. Stable concept knowledge connects the examinations without silently changing the official syllabus.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Hierarchy nodes', value: nodeCount, icon: 'ListTree' },
          { label: 'Concept nodes', value: conceptCount, icon: 'Network' },
          { label: 'Published / verified', value: publishedCount, icon: 'ShieldCheck' },
          { label: 'Verified prerequisites', value: prerequisiteCount, icon: 'GitBranch' },
          { label: 'Question families', value: familyCount, icon: 'Layers' }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <ApperIcon name={item.icon} size={17} className="text-primary" />
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </section>
    </>
  );
}
