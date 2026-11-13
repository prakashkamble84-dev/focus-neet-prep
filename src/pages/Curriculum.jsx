import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { CURRICULA, importCurriculumOutline } from '@/services/curriculumImportService';
import CurriculumImportBatches from '@/components/curriculum/CurriculumImportBatches';
import OtherOfficialSyllabusRecords from '@/components/curriculum/OtherOfficialSyllabusRecords';
import CurriculumSyllabusVersionRow from '@/components/curriculum/CurriculumSyllabusVersionRow';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export const route = {
  path: '/curriculum/manage',
  layout: 'owner',
  access: "profile === 'CEO' || profile === 'CEO_c' || profile === 'Manager' || profile === 'Manager_c' || profile === 'AcademicExpert_c' || profile === 'ContentReviewer_c'"
};
export const nav = {
  label: 'Manage curriculum',
  icon: 'ListTree',
  section: 'Academic operations',
  profiles: ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c', 'ContentReviewer_c'],
  order: 90
};

async function fetchSyllabusVersions() {
  const result = await sdk.table('syllabus_versions_c')
    .select(['Id', 'Name', 'examination_c', 'source_document_version_c', 'academic_year_c', 'version_label_c', 'status_c', 'change_summary_c'])
    .limit(100, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load syllabus versions');
  return result.data ?? [];
}

async function fetchCurriculumNodes() {
  const result = await sdk.table('curriculum_nodes_c')
    .select(['Id', 'Name', 'syllabus_version_c', 'node_code_c', 'node_type_c', 'subject_c', 'source_page_start_c', 'source_page_end_c', 'status_c', 'verified_c'])
    .limit(500, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load curriculum nodes');
  return result.data ?? [];
}

async function fetchImportBatches() {
  const result = await sdk.table('curriculum_import_batches_c')
    .select(['Id', 'Name', 'status_c', 'nodes_created_c', 'nodes_updated_c', 'import_notes_c'])
    .limit(100, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load import batches');
  return result.data ?? [];
}

export default function Curriculum() {
  const { profile } = useProfile();
  const canImport = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'].includes(profile);
  const [search, setSearch] = useState('');
  const [importingKey, setImportingKey] = useState(null);

  const { data: syllabusData, loading: syllabusLoading, error: syllabusError, run: refreshSyllabus } = useFetch(fetchSyllabusVersions, []);
  const { data: nodesData, loading: nodesLoading, error: nodesError, run: refreshNodes } = useFetch(fetchCurriculumNodes, []);
  const { data: batchesData, loading: batchesLoading, error: batchesError, run: refreshBatches } = useFetch(fetchImportBatches, []);

  const syllabi = syllabusData ?? [];
  const nodes = nodesData ?? [];
  const batches = batchesData ?? [];
  const query = search.trim().toLowerCase();

  const filteredSyllabi = useMemo(() => syllabi.filter((item) =>
    !query || [item.Name, item.version_label_c, item.status_c, item.examination_c?.Name]
      .some((value) => String(value ?? '').toLowerCase().includes(query))
  ), [syllabi, query]);

  const nodeCounts = useMemo(() => {
    const counts = {};
    for (const node of nodes) {
      const syllabusId = node.syllabus_version_c?.Id ?? node.syllabus_version_c;
      counts[syllabusId] = (counts[syllabusId] || 0) + 1;
    }
    return counts;
  }, [nodes]);

  async function handleImport(curriculumKey) {
    setImportingKey(curriculumKey);
    try {
      const result = await importCurriculumOutline(curriculumKey);
      toast.success(`${result.label}: ${result.created} new nodes imported`, {
        description: `${result.total} subject and unit records now exist. All remain in Review until academic approval.`
      });
      await Promise.all([refreshSyllabus(), refreshNodes(), refreshBatches()]);
    } catch (error) {
      toast.error('Curriculum import failed', { description: error.message });
    } finally {
      setImportingKey(null);
    }
  }

  const loadingFirst = (syllabusLoading && !syllabusData) || (nodesLoading && !nodesData) || (batchesLoading && !batchesData);
  const loadError = syllabusError || nodesError || batchesError;

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Phase 2 · Versioned syllabus</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Curriculum management</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Import the official subject and unit outline with a traceable document version and page reference. Every imported node remains in Review until an academic expert validates the content.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/curriculum"><ApperIcon name="BookOpen" size={16} /> Student curriculum library</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/sources"><ApperIcon name="FileCheck2" size={16} /> Academic sources</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
        <div className="flex items-start gap-3">
          <ApperIcon name="ShieldCheck" size={19} className="mt-0.5 shrink-0 text-warning-foreground" />
          <div>
            <p className="font-semibold">Review-gated syllabus data</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              The baseline importer creates Subject and Unit nodes only. It does not invent subtopics, detailed learning objectives, difficulty levels, prerequisites or concepts. Those require full page-level extraction and academic review. Imported nodes are not student-published.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Syllabus versions', value: syllabi.length, icon: 'Layers3' },
          { label: 'Curriculum nodes', value: nodes.length, icon: 'Network' },
          { label: 'Import batches', value: batches.length, icon: 'Files' }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <ApperIcon name={item.icon} size={17} className="text-primary" />
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold">Some curriculum records could not be loaded</p>
          <p className="mt-1 text-muted-foreground">{[syllabusError, nodesError, batchesError].filter(Boolean).join(' · ')}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => Promise.all([refreshSyllabus(), refreshNodes(), refreshBatches()])}>Retry</Button>
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="font-mono text-base font-semibold">Official 2026 syllabus outlines</h2>
          <p className="mt-1 text-sm text-muted-foreground">JEE Main Paper 1 and NEET UG 2026. JEE Advanced is registered separately; its detailed outline remains pending extraction.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {CURRICULA.map((curriculum) => {
            const syllabus = syllabi.find((item) => item.version_label_c === curriculum.label);
            const nodeCount = syllabus ? nodeCounts[syllabus.Id] || 0 : 0;
            const batch = batches.find((item) => item.Name === `INITIAL-${curriculum.key}`);
            const versionId = syllabus?.source_document_version_c?.Id ?? syllabus?.source_document_version_c;
            const isImporting = importingKey === curriculum.key;
            return (
              <div key={curriculum.key} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{curriculum.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{curriculum.source}</p>
                  </div>
                  <Status value={syllabus?.status_c || (syllabusLoading ? 'Loading' : 'Not registered')} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {curriculum.subjects.map((subject) => (
                    <div key={subject} className="rounded-md bg-accent/50 p-2">
                      <p className="text-xs text-muted-foreground">{subject}</p>
                      <p className="mt-1 font-mono text-lg font-semibold">{curriculum.units.filter((unit) => unit.subject === subject).length}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{nodeCount} nodes present</span>
                  <span>·</span>
                  <span>Source version {versionId ? 'linked' : 'pending'}</span>
                  <span>·</span>
                  <span>Import {batch?.status_c || 'not started'}</span>
                </div>
                {canImport && (
                  <Button className="mt-4 w-full" onClick={() => handleImport(curriculum.key)} disabled={Boolean(importingKey) || !syllabus || !versionId || !batch}>
                    {isImporting ? 'Importing outline…' : nodeCount ? 'Import missing units' : 'Import official unit outline'}
                  </Button>
                )}
                {!syllabus && <p className="mt-3 text-xs text-warning-foreground">Register the official source baseline on the Sources page first.</p>}
                {!canImport && <p className="mt-3 text-xs text-muted-foreground">Academic administrators can import; review roles can inspect the generated records after import.</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-mono text-base font-semibold">Syllabus versions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Version history is retained; new years do not overwrite previous curriculum records.</p>
          </div>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search syllabus versions…" className="sm:max-w-sm" />
        </div>
        {loadingFirst ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg border border-border bg-foreground/5" />)}
          </div>
        ) : filteredSyllabi.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <ApperIcon name="BookOpen" size={24} className="mx-auto text-primary" />
            <p className="mt-3 font-semibold">No syllabus versions registered</p>
            <p className="mt-1 text-sm text-muted-foreground">Register the official source baseline before importing curriculum outlines.</p>
            <Button asChild variant="outline" className="mt-4"><Link to="/sources">Open source registry</Link></Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="divide-y divide-border">
              {filteredSyllabi.map((syllabus) => (
                <CurriculumSyllabusVersionRow
                  key={syllabus.Id}
                  syllabus={syllabus}
                  nodeCount={nodeCounts[syllabus.Id] || 0}
                  canPublish={canImport}
                  onRefresh={refreshSyllabus}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <OtherOfficialSyllabusRecords syllabi={syllabi} />

      <CurriculumImportBatches batches={batches} loading={batchesLoading} loaded={Boolean(batchesData)} />

      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
        <p className="font-semibold">No automated OCR or diagram extraction yet</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          The source registry stores PDFs and supports page-level extraction and verification records. Automated OCR, equation parsing and diagram recognition need a server-side extraction provider and evaluation tests before they can be enabled.
        </p>
      </div>
    </div>
  );
}
