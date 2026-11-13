import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export const route = { path: '/curriculum', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Curriculum', icon: 'BookOpen', group: 'Learn', order: 10 };

const { eq } = window.ApperSDK.CoreSDK;

const syllabusFields = ['Id', 'Name', 'examination_c', 'source_document_c', 'source_document_version_c', 'academic_year_c', 'version_label_c', 'status_c', 'change_summary_c'];
const nodeFields = ['Id', 'Name', 'syllabus_version_c', 'node_code_c', 'node_type_c', 'subject_c', 'parent_node_code_c', 'node_path_c', 'source_page_start_c', 'source_page_end_c', 'source_document_version_c', 'import_batch_c', 'status_c', 'verified_c'];
const batchFields = ['Id', 'Name', 'examination_version_c', 'document_version_c', 'import_type_c', 'status_c', 'nodes_created_c', 'nodes_updated_c', 'import_notes_c'];

const JEE_MAIN_2026 = [
  { subject: 'Maths', title: 'Sets, Relations and Functions', number: 1, pages: [1, 1] },
  { subject: 'Maths', title: 'Complex Numbers and Quadratic Equations', number: 2, pages: [1, 1] },
  { subject: 'Maths', title: 'Matrices and Determinants', number: 3, pages: [1, 1] },
  { subject: 'Maths', title: 'Permutations and Combinations', number: 4, pages: [1, 1] },
  { subject: 'Maths', title: 'Binomial Theorem and its Simple Applications', number: 5, pages: [1, 1] },
  { subject: 'Maths', title: 'Sequence and Series', number: 6, pages: [1, 1] },
  { subject: 'Maths', title: 'Limit, Continuity and Differentiability', number: 7, pages: [1, 1] },
  { subject: 'Maths', title: 'Integral Calculas', number: 8, pages: [1, 2] },
  { subject: 'Maths', title: 'Differential Equations', number: 9, pages: [2, 2] },
  { subject: 'Maths', title: 'Co-ordinate Geometry', number: 10, pages: [2, 2] },
  { subject: 'Maths', title: 'Three Dimensional Geometry', number: 11, pages: [2, 2] },
  { subject: 'Maths', title: 'Vector Algebra', number: 12, pages: [2, 2] },
  { subject: 'Maths', title: 'Statistics and Probability', number: 13, pages: [2, 2] },
  { subject: 'Maths', title: 'Trigonometry', number: 14, pages: [2, 2] },

  { subject: 'Physics', title: 'Units and Measurements', number: 1, pages: [3, 3] },
  { subject: 'Physics', title: 'Kinematics', number: 2, pages: [3, 3] },
  { subject: 'Physics', title: 'Laws of Motion', number: 3, pages: [3, 3] },
  { subject: 'Physics', title: 'Work, Energy and Power', number: 4, pages: [3, 3] },
  { subject: 'Physics', title: 'Rotational Motion', number: 5, pages: [3, 3] },
  { subject: 'Physics', title: 'Gravitation', number: 6, pages: [3, 3] },
  { subject: 'Physics', title: 'Properties of Solids and Liquids', number: 7, pages: [3, 4] },
  { subject: 'Physics', title: 'Thermodynamics', number: 8, pages: [4, 4] },
  { subject: 'Physics', title: 'Kinetic Theory of Gases', number: 9, pages: [4, 4] },
  { subject: 'Physics', title: 'Oscillations and Waves', number: 10, pages: [4, 4] },
  { subject: 'Physics', title: 'Electrostatics', number: 11, pages: [4, 4] },
  { subject: 'Physics', title: 'Current Electricity', number: 12, pages: [4, 5] },
  { subject: 'Physics', title: 'Magnetic Effects of Current and Magnetism', number: 13, pages: [5, 5] },
  { subject: 'Physics', title: 'Electromagnetic Induction and Alternating Currents', number: 14, pages: [5, 5] },
  { subject: 'Physics', title: 'Electromagnetic Waves', number: 15, pages: [5, 5] },
  { subject: 'Physics', title: 'Optics', number: 16, pages: [5, 5] },
  { subject: 'Physics', title: 'Dual Nature of Matter and Radiation', number: 17, pages: [5, 6] },
  { subject: 'Physics', title: 'Atoms and Nuclei', number: 18, pages: [6, 6] },
  { subject: 'Physics', title: 'Electronic Devices', number: 19, pages: [6, 6] },
  { subject: 'Physics', title: 'Experimental Skills', number: 20, pages: [6, 6] },

  { subject: 'Chemistry', title: 'Some Basic Concepts in Chemistry', number: 1, pages: [7, 7] },
  { subject: 'Chemistry', title: 'Atomic Structure', number: 2, pages: [7, 7] },
  { subject: 'Chemistry', title: 'Chemical Bonding and Molecular Structure', number: 3, pages: [7, 7] },
  { subject: 'Chemistry', title: 'Chemical Thermodynamics', number: 4, pages: [7, 8] },
  { subject: 'Chemistry', title: 'Solutions', number: 5, pages: [8, 8] },
  { subject: 'Chemistry', title: 'Equilibrium', number: 6, pages: [8, 8] },
  { subject: 'Chemistry', title: 'Redox Reactions and Electrochemistry', number: 7, pages: [8, 8] },
  { subject: 'Chemistry', title: 'Chemical Kinetics', number: 8, pages: [8, 8] },
  { subject: 'Chemistry', title: 'Classification of Elements and Periodicity in Properties', number: 9, pages: [8, 9] },
  { subject: 'Chemistry', title: 'p-Block Elements', number: 10, pages: [9, 9] },
  { subject: 'Chemistry', title: 'd- and f-Block Elements', number: 11, pages: [9, 9] },
  { subject: 'Chemistry', title: 'Coordination Compounds', number: 12, pages: [9, 9] },
  { subject: 'Chemistry', title: 'Purification and Characterisation of Organic Compounds', number: 13, pages: [9, 10] },
  { subject: 'Chemistry', title: 'Some Basic Principles of Organic Chemistry', number: 14, pages: [10, 10] },
  { subject: 'Chemistry', title: 'Hydrocarbons', number: 15, pages: [10, 10] },
  { subject: 'Chemistry', title: 'Organic Compounds Containing Halogens', number: 16, pages: [10, 10] },
  { subject: 'Chemistry', title: 'Organic Compounds Containing Oxygen', number: 17, pages: [10, 10] },
  { subject: 'Chemistry', title: 'Organic Compounds Containing Nitrogen', number: 18, pages: [10, 11] },
  { subject: 'Chemistry', title: 'Biomolecules', number: 19, pages: [11, 11] },
  { subject: 'Chemistry', title: 'Principles Related to Practical Chemistry', number: 20, pages: [11, 11] }
];

const NEET_2026 = [
  { subject: 'Physics', title: 'Physics and Measurement', number: 1, pages: [4, 4] },
  { subject: 'Physics', title: 'Kinematics', number: 2, pages: [4, 4] },
  { subject: 'Physics', title: 'Laws of Motion', number: 3, pages: [4, 4] },
  { subject: 'Physics', title: 'Work, Energy and Power', number: 4, pages: [4, 4] },
  { subject: 'Physics', title: 'Rotational Motion', number: 5, pages: [4, 4] },
  { subject: 'Physics', title: 'Gravitation', number: 6, pages: [5, 5] },
  { subject: 'Physics', title: 'Properties of Solids and Liquids', number: 7, pages: [5, 5] },
  { subject: 'Physics', title: 'Thermodynamics', number: 8, pages: [5, 5] },
  { subject: 'Physics', title: 'Kinetic Theory of Gases', number: 9, pages: [5, 5] },
  { subject: 'Physics', title: 'Oscillations and Waves', number: 10, pages: [5, 5] },
  { subject: 'Physics', title: 'Electrostatics', number: 11, pages: [5, 5] },
  { subject: 'Physics', title: 'Current Electricity', number: 12, pages: [5, 5] },
  { subject: 'Physics', title: 'Magnetic Effects of Current and Magnetism', number: 13, pages: [6, 6] },
  { subject: 'Physics', title: 'Electromagnetic Induction and Alternating Currents', number: 14, pages: [6, 6] },
  { subject: 'Physics', title: 'Electromagnetic Waves', number: 15, pages: [6, 6] },
  { subject: 'Physics', title: 'Optics', number: 16, pages: [6, 6] },
  { subject: 'Physics', title: 'Dual Nature of Matter and Radiation', number: 17, pages: [7, 7] },
  { subject: 'Physics', title: 'Atoms and Nuclei', number: 18, pages: [7, 7] },
  { subject: 'Physics', title: 'Electronic Devices', number: 19, pages: [7, 7] },
  { subject: 'Physics', title: 'Experimental Skills', number: 20, pages: [7, 7] },

  { subject: 'Chemistry', title: 'Some Basic Concepts in Chemistry', number: 1, pages: [8, 8] },
  { subject: 'Chemistry', title: 'Atomic Structure', number: 2, pages: [8, 8] },
  { subject: 'Chemistry', title: 'Chemical Bonding and Molecular Structure', number: 3, pages: [8, 8] },
  { subject: 'Chemistry', title: 'Chemical Thermodynamics', number: 4, pages: [8, 8] },
  { subject: 'Chemistry', title: 'Solutions', number: 5, pages: [8, 9] },
  { subject: 'Chemistry', title: 'Equilibrium', number: 6, pages: [9, 9] },
  { subject: 'Chemistry', title: 'Redox Reactions and Electrochemistry', number: 7, pages: [9, 9] },
  { subject: 'Chemistry', title: 'Chemical Kinetics', number: 8, pages: [9, 9] },
  { subject: 'Chemistry', title: 'Classification of Elements and Periodicity in Properties', number: 9, pages: [10, 10] },
  { subject: 'Chemistry', title: 'p-Block Elements', number: 10, pages: [10, 10] },
  { subject: 'Chemistry', title: 'd- and f-Block Elements', number: 11, pages: [10, 10] },
  { subject: 'Chemistry', title: 'Coordination Compounds', number: 12, pages: [10, 10] },
  { subject: 'Chemistry', title: 'Purification and Characterisation of Organic Compounds', number: 13, pages: [11, 11] },
  { subject: 'Chemistry', title: 'Some Basic Principles of Organic Chemistry', number: 14, pages: [11, 11] },
  { subject: 'Chemistry', title: 'Hydrocarbons', number: 15, pages: [11, 11] },
  { subject: 'Chemistry', title: 'Organic Compounds Containing Halogens', number: 16, pages: [11, 11] },
  { subject: 'Chemistry', title: 'Organic Compounds Containing Oxygen', number: 17, pages: [11, 12] },
  { subject: 'Chemistry', title: 'Organic Compounds Containing Nitrogen', number: 18, pages: [12, 12] },
  { subject: 'Chemistry', title: 'Biomolecules', number: 19, pages: [12, 12] },
  { subject: 'Chemistry', title: 'Principles Related to Practical Chemistry', number: 20, pages: [12, 13] },

  { subject: 'Biology', title: 'Diversity in Living World', number: 1, pages: [14, 14] },
  { subject: 'Biology', title: 'Structural Organisation in Animals and Plants', number: 2, pages: [14, 14] },
  { subject: 'Biology', title: 'Cell Structure and Function', number: 3, pages: [14, 14] },
  { subject: 'Biology', title: 'Plant Physiology', number: 4, pages: [15, 15] },
  { subject: 'Biology', title: 'Human Physiology', number: 5, pages: [15, 15] },
  { subject: 'Biology', title: 'Reproduction', number: 6, pages: [16, 16] },
  { subject: 'Biology', title: 'Genetics and Evolution', number: 7, pages: [16, 16] },
  { subject: 'Biology', title: 'Biology and Human Welfare', number: 8, pages: [17, 17] },
  { subject: 'Biology', title: 'Biotechnology and its Applications', number: 9, pages: [17, 17] },
  { subject: 'Biology', title: 'Ecology and Environment', number: 10, pages: [17, 18] }
];

const CURRICULA = [
  {
    key: 'JEE_MAIN_2026_P1',
    label: 'JEE Main Paper 1 · 2026',
    units: JEE_MAIN_2026,
    source: 'NTA JEE Main 2026 Paper 1 syllabus',
    note: 'Mathematics, Physics and Chemistry unit headings. Nodes are imported as Review and are not student-published.'
  },
  {
    key: 'NEET_UG_2026',
    label: 'NEET UG · 2026',
    units: NEET_2026,
    source: 'NMC UGMEB NEET UG 2026 syllabus',
    note: 'Physics, Chemistry and Biology unit headings. Nodes are imported as Review and are not student-published.'
  }
];

async function fetchSyllabusVersions() {
  const result = await sdk.table('syllabus_versions_c').select(syllabusFields).limit(100, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load syllabus versions');
  return result.data ?? [];
}

async function fetchCurriculumNodes() {
  const result = await sdk.table('curriculum_nodes_c').select(nodeFields).limit(500, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load curriculum nodes');
  return result.data ?? [];
}

async function fetchImportBatches() {
  const result = await sdk.table('curriculum_import_batches_c').select(batchFields).limit(100, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load import batches');
  return result.data ?? [];
}

async function findSyllabus(label) {
  const result = await sdk.table('syllabus_versions_c')
    .select(syllabusFields)
    .where(eq('version_label_c', label))
    .limit(1, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not find the syllabus version');
  return result.data?.[0] ?? null;
}

async function findImportBatch(name) {
  const result = await sdk.table('curriculum_import_batches_c')
    .select(batchFields)
    .where(eq('Name', name))
    .limit(1, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not find the import batch');
  return result.data?.[0] ?? null;
}

async function importCurriculumOutline(curriculum) {
  const syllabus = await findSyllabus(curriculum.label);
  if (!syllabus) throw new Error(`Register the official source baseline before importing ${curriculum.label}`);

  const batch = await findImportBatch(`INITIAL-${curriculum.key}`);
  if (!batch) throw new Error(`The import batch for ${curriculum.label} is missing. Re-register the official source baseline.`);

  const versionId = syllabus.source_document_version_c?.Id ?? syllabus.source_document_version_c;
  if (!versionId) throw new Error('This syllabus version has no linked source document version');

  const existingResult = await sdk.table('curriculum_nodes_c')
    .select(['Id', 'node_code_c'])
    .where(eq('syllabus_version_c', syllabus.Id))
    .limit(500, 0).fetch();
  if (!existingResult.success) throw new Error(existingResult.message || 'Could not check existing curriculum nodes');

  const existingCodes = new Set((existingResult.data ?? []).map((node) => node.node_code_c));
  const nodes = [];
  const subjectCodes = {};

  for (const subject of [...new Set(curriculum.units.map((unit) => unit.subject))]) {
    const code = `${curriculum.key}-${subject.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;
    subjectCodes[subject] = code;
    if (existingCodes.has(code)) continue;
    nodes.push({
      Name: subject,
      syllabus_version_c: syllabus.Id,
      node_code_c: code,
      node_type_c: 'Subject',
      subject_c: subject,
      node_path_c: `${curriculum.label} / ${subject}`,
      description_c: `Subject heading taken from ${curriculum.source}. Detailed topic extraction is pending.`,
      learning_objectives_c: 'Learning objectives and topic-level details await page-by-page extraction and academic review.',
      status_c: 'Review',
      verified_c: false,
      sort_order_c: nodes.length + 1,
      source_document_version_c: versionId,
      source_page_start_c: Math.min(...curriculum.units.filter((u) => u.subject === subject).map((u) => u.pages[0])),
      source_page_end_c: Math.max(...curriculum.units.filter((u) => u.subject === subject).map((u) => u.pages[1])),
      source_excerpt_c: `Subject: ${subject}`,
      import_batch_c: batch.Id
    });
  }

  for (const unit of curriculum.units) {
    const subjectCode = subjectCodes[unit.subject];
    const code = `${curriculum.key}-${unit.subject.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-U${String(unit.number).padStart(2, '0')}`;
    if (existingCodes.has(code)) continue;
    nodes.push({
      Name: unit.title,
      syllabus_version_c: syllabus.Id,
      node_code_c: code,
      node_type_c: 'Unit',
      subject_c: unit.subject,
      parent_node_code_c: subjectCode,
      node_path_c: `${curriculum.label} / ${unit.subject} / Unit ${unit.number}`,
      description_c: 'Official unit heading imported from the source PDF. Subtopics and learning objectives have not yet been extracted.',
      learning_objectives_c: 'Pending page-level extraction and academic review.',
      status_c: 'Review',
      verified_c: false,
      sort_order_c: unit.number,
      source_document_version_c: versionId,
      source_page_start_c: unit.pages[0],
      source_page_end_c: unit.pages[1],
      source_excerpt_c: `UNIT ${unit.number}: ${unit.title}`,
      import_batch_c: batch.Id
    });
  }

  let created = 0;
  for (let start = 0; start < nodes.length; start += 25) {
    const chunk = nodes.slice(start, start + 25);
    if (!chunk.length) continue;
    const result = await sdk.table('curriculum_nodes_c').create(chunk);
    created += result.data?.length ?? 0;
    if (!result.data?.length && result.messages?.length) {
      throw new Error(result.messages.join('; '));
    }
    if (result.partial) {
      throw new Error(result.messages?.join('; ') || 'Only part of the curriculum batch was saved');
    }
  }

  const expectedTotal = (existingResult.data?.length ?? 0) + created;
  const updateBatch = await sdk.table('curriculum_import_batches_c').update({
    Id: batch.Id,
    status_c: 'Review',
    nodes_created_c: created,
    import_notes_c: `${curriculum.note} ${created} new nodes created in this run; ${expectedTotal} records now exist for this syllabus version. Await expert review before publication.`
  });
  if (!updateBatch.data?.length) throw new Error(updateBatch.messages?.join('; ') || 'Nodes created, but import batch summary was not updated');

  return { created, total: expectedTotal, label: curriculum.label };
}

function Status({ value }) {
  const tone = value === 'Published' || value === 'Verified' || value === 'Approved'
    ? 'border-success/30 bg-success/10 text-success'
    : value === 'Rejected'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : value === 'Review' || value === 'Draft' || value === 'Ready'
        ? 'border-warning/30 bg-warning/10 text-warning-foreground'
        : 'border-border bg-muted text-muted-foreground';
  return <Badge variant="outline" className={tone}>{value || 'Not set'}</Badge>;
}

export default function Curriculum() {
  const { profile } = useProfile();
  const canImport = ['CEO', 'Manager', 'AcademicExpert_c'].includes(profile);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const { data: syllabusData, loading: syllabusLoading, error: syllabusError, run: refreshSyllabus } = useFetch(fetchSyllabusVersions, []);
  const { data: nodesData, loading: nodesLoading, error: nodesError, run: refreshNodes } = useFetch(fetchCurriculumNodes, []);
  const { data: batchesData, loading: batchesLoading, error: batchesError, run: refreshBatches } = useFetch(fetchImportBatches, []);

  const syllabi = syllabusData ?? [];
  const nodes = nodesData ?? [];
  const batches = batchesData ?? [];
  const q = search.trim().toLowerCase();

  const filteredSyllabi = useMemo(() => syllabi.filter((item) =>
    !q || [item.Name, item.version_label_c, item.status_c].some((v) => String(v ?? '').toLowerCase().includes(q))
  ), [syllabi, q]);

  const nodeCounts = useMemo(() => {
    const counts = {};
    for (const node of nodes) {
      const id = node.syllabus_version_c?.Id ?? node.syllabus_version_c;
      counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [nodes]);

  async function handleImport(curriculum) {
    setImporting(true);
    try {
      const result = await importCurriculumOutline(curriculum);
      toast.success(`${curriculum.label}: ${result.created} new curriculum nodes imported`, {
        description: `${result.total} records now exist. All remain in Review until an academic expert approves them.`
      });
      await Promise.all([refreshSyllabus(), refreshNodes(), refreshBatches()]);
    } catch (error) {
      toast.error('Curriculum import failed', { description: error.message });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Phase 2 · Versioned syllabus</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Curriculum ingestion</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Import the official subject and unit outline with a traceable document version and page reference. Every imported node remains in Review until an academic expert validates the content.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/sources"><ApperIcon name="FileCheck2" size={16} /> Open source registry</Link>
        </Button>
      </div>

      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
        <div className="flex items-start gap-3">
          <ApperIcon name="ShieldCheck" size={19} className="mt-0.5 shrink-0 text-warning-foreground" />
          <div>
            <p className="font-semibold">Review-gated syllabus data</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              The outline import creates Subject and Unit nodes only. It does not invent subtopics, learning objectives, difficulty, prerequisites or concepts. Those require a separate extraction and expert-review pass. Imported nodes are not visible in student curriculum views until approved and published.
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

      {syllabusError || nodesError || batchesError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold">Some curriculum records could not be loaded</p>
          <p className="mt-1 text-muted-foreground">{[syllabusError, nodesError, batchesError].filter(Boolean).join(' · ')}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => Promise.all([refreshSyllabus(), refreshNodes(), refreshBatches()])}>Retry</Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search syllabus versions…" className="sm:max-w-sm" />
        <p className="text-xs text-muted-foreground">Syllabus versions are independent by examination and academic year.</p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-mono text-base font-semibold">Official 2026 syllabus outlines</h2>
          <p className="mt-1 text-sm text-muted-foreground">These imports use exact unit headings transcribed from the referenced official PDFs.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {CURRICULA.map((curriculum) => {
            const syllabus = syllabi.find((item) => item.version_label_c === curriculum.label);
            const count = syllabus ? nodeCounts[syllabus.Id] || 0 : 0;
            const batch = batches.find((item) => item.Name === `INITIAL-${curriculum.key}`);
            const sourceVersionId = syllabus?.source_document_version_c?.Id ?? syllabus?.source_document_version_c;
            return (
              <div key={curriculum.key} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{curriculum.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{curriculum.source}</p>
                  </div>
                  <Status value={syllabus?.status_c || (syllabusLoading ? 'Loading' : 'Not registered')} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {['Physics', 'Chemistry', curriculum.key.startsWith('NEET') ? 'Biology' : 'Maths'].map((subject) => (
                    <div key={subject} className="rounded-md bg-accent/50 p-2">
                      <p className="text-xs text-muted-foreground">{subject}</p>
                      <p className="mt-1 font-mono text-lg font-semibold">{curriculum.units.filter((u) => u.subject === subject).length}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{count} nodes present</span>
                  <span>·</span>
                  <span>Source version {sourceVersionId ? 'linked' : 'pending'}</span>
                  <span>·</span>
                  <span>Import {batch?.status_c || 'not started'}</span>
                </div>
                {canImport && (
                  <Button className="mt-4 w-full" onClick={() => handleImport(curriculum)} disabled={importing || !syllabus || !sourceVersionId || !batch}>
                    <ApperIcon name={importing ? 'LoaderCircle' : 'ListTree'} size={15} className={importing ? 'animate-spin' : ''} />
                    {importing ? 'Importing outline…' : count ? 'Import missing units' : 'Import official unit outline'}
                  </Button>
                )}
                {!syllabus && <p className="mt-3 text-xs text-warning-foreground">Register the official source baseline on the Sources page first.</p>}
                {!canImport && <p className="mt-3 text-xs text-muted-foreground">Academic reviewers can inspect curriculum nodes after an import batch is created.</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-mono text-base font-semibold">Syllabus versions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Version history is retained; new versions do not overwrite prior curriculum records.</p>
        </div>
        {syllabusLoading && !syllabusData ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading syllabus versions…</div>
        ) : filteredSyllabi.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <ApperIcon name="BookOpen" size={24} className="mx-auto text-primary" />
            <p className="mt-3 font-semibold">No syllabus versions registered</p>
            <p className="mt-1 text-sm text-muted-foreground">Use the official source baseline registration before importing curriculum outlines.</p>
            <Button asChild variant="outline" className="mt-4"><Link to="/sources">Open source registry</Link></Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="divide-y divide-border">
              {filteredSyllabi.map((syllabus) => {
                const examName = syllabus.examination_c?.Name || 'Examination';
                return (
                  <div key={syllabus.Id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">{syllabus.version_label_c || syllabus.Name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{examName} · Academic year {syllabus.academic_year_c || 'not set'}</p>
                      {syllabus.change_summary_c && <p className="mt-1 text-xs leading-5 text-muted-foreground">{syllabus.change_summary_c}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-muted-foreground">{nodeCounts[syllabus.Id] || 0} nodes</span>
                      <Status value={syllabus.status_c} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-base font-semibold">Other examination track</h2>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold">JEE Advanced · 2026</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                The official syllabus PDF is registered and states that the 2026 syllabus remains the same as 2025. Detailed subject and topic extraction has not been imported in this pass. It will remain in Review until its complete outline has been parsed and checked.
              </p>
            </div>
            <Badge variant="outline">Detailed extraction pending</Badge>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-base font-semibold">Import batches</h2>
        {batchesLoading && !batchesData ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">Loading import batches…</div>
        ) : batches.length === 0 ? (
          <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">No curriculum import batches have been created.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {batches.map((batch) => (
              <div key={batch.Id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{batch.Name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{batch.nodes_created_c || 0} nodes created · {batch.import_type_c}</p>
                </div>
                <Status value={batch.status_c} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
