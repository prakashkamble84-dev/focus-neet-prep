import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { CURRICULA } from '@/services/curriculumImportData';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const route = { path: '/curriculum', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Curriculum', icon: 'BookOpen', section: 'Learn', order: 10 };

const SOURCE_URLS = {
  JEE_MAIN_2026_P1: 'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311323551056.pdf',
  NEET_UG_2026: 'https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/01/202601081066816297.pdf'
};

const EXAM_LABELS = {
  JEE_MAIN_2026_P1: 'JEE Main',
  NEET_UG_2026: 'NEET UG'
};

async function fetchCurriculumLibrary() {
  const [syllabusResult, nodeResult, sourceResult] = await Promise.all([
    sdk.table('syllabus_versions_c')
      .select(['Id', 'Name', 'examination_c', 'source_document_c', 'academic_year_c', 'version_label_c', 'status_c'])
      .limit(300, 0).fetch(),
    sdk.table('curriculum_nodes_c')
      .select(['Id', 'Name', 'syllabus_version_c', 'node_code_c', 'node_type_c', 'subject_c', 'parent_node_code_c', 'node_path_c', 'description_c', 'learning_objectives_c', 'status_c', 'sort_order_c', 'verified_c', 'source_page_start_c', 'source_page_end_c', 'source_excerpt_c'])
      .limit(2000, 0).fetch(),
    sdk.table('source_documents_c')
      .select(['Id', 'Name', 'official_url_c', 'source_category_c', 'document_type_c', 'rights_status_c', 'verification_status_c', 'issuing_authority_c', 'academic_year_c'])
      .limit(500, 0).fetch()
  ]);

  if (!syllabusResult.success) throw new Error(syllabusResult.message || 'Could not load syllabus versions');
  if (!nodeResult.success) throw new Error(nodeResult.message || 'Could not load curriculum topics');
  if (!sourceResult.success) throw new Error(sourceResult.message || 'Could not load curriculum sources');

  return {
    syllabi: syllabusResult.data || [],
    nodes: nodeResult.data || [],
    sources: sourceResult.data || []
  };
}

function lookupId(value) {
  return value && typeof value === 'object' ? value.Id : value;
}

function lookupName(value) {
  return value && typeof value === 'object' ? value.Name : '';
}

function safeText(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function csvCell(value) {
  const text = String(value ?? '');
  return '"' + text.replace(/"/g, '""') + '"';
}

function downloadRows(rows, fileName) {
  if (!rows.length) return;
  const headings = [
    'Exam', 'Academic year', 'Subject', 'Level', 'Curriculum item',
    'Parent item', 'Curriculum path', 'Source title', 'Source type',
    'Source URL', 'Source page start', 'Source page end',
    'Publication state', 'Expert verified'
  ];
  const values = rows.map((row) => [
    row.exam, row.year, row.subject, row.level, row.title, row.parentTitle,
    row.path, row.sourceTitle, row.sourceType, row.sourceUrl,
    row.pageStart, row.pageEnd, row.state, row.verified ? 'Yes' : 'No'
  ]);
  const csv = [headings, ...values].map((line) => line.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function printRows(rows, title) {
  if (!rows.length) return;
  const popup = window.open('', '_blank');
  if (!popup) return;
  const tableRows = rows.map((row) => (
    '<tr><td>' + escapeHtml(row.exam) + ' · ' + escapeHtml(row.year) + '</td>' +
    '<td>' + escapeHtml(row.subject) + '</td>' +
    '<td>' + escapeHtml(row.level) + '</td>' +
    '<td><strong>' + escapeHtml(row.title) + '</strong><br><small>' + escapeHtml(row.path) + '</small></td>' +
    '<td>' + escapeHtml(row.sourceTitle) + '<br><small>' + escapeHtml(row.sourceUrl) + '</small></td>' +
    '<td>' + escapeHtml(row.state) + '</td></tr>'
  )).join('');
  popup.document.write(
    '<!doctype html><html><head><title>' + escapeHtml(title) + '</title>' +
    '<meta charset="utf-8"><style>body{font:12px Arial,sans-serif;padding:28px;color:#17202a}h1{font-size:20px}p{line-height:1.5;color:#445}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ccd;padding:8px;text-align:left;vertical-align:top}th{background:#f1f3f5}small{color:#667;word-break:break-word}@media print{body{padding:0}}</style></head><body>' +
    '<h1>' + escapeHtml(title) + '</h1>' +
    '<p>Generated from Northstar curriculum records. Reference snapshots are clearly distinguished from expert-verified published curriculum. Use the linked source for the issuing authority document.</p>' +
    '<table><thead><tr><th>Exam / year</th><th>Subject</th><th>Level</th><th>Curriculum item</th><th>Source</th><th>State</th></tr></thead><tbody>' + tableRows + '</tbody></table>' +
    '</body></html>'
  );
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 300);
}

export default function CurriculumLibrary() {
  const { profile } = useProfile();
  const canManage = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c', 'ContentReviewer_c'].includes(profile);
  const [examFilter, setExamFilter] = useState('All exams');
  const [yearFilter, setYearFilter] = useState('All years');
  const [subjectFilter, setSubjectFilter] = useState('All subjects');
  const [levelFilter, setLevelFilter] = useState('All levels');
  const [search, setSearch] = useState('');

  const { data, loading, error, run } = useFetch(fetchCurriculumLibrary, []);
  const syllabi = data?.syllabi || [];
  const nodes = data?.nodes || [];
  const sources = data?.sources || [];

  const rows = useMemo(() => {
    const syllabusById = new Map(syllabi.map((item) => [String(item.Id), item]));
    const sourceById = new Map(sources.map((item) => [String(item.Id), item]));
    const dbNodes = nodes.filter((node) => {
      const syllabus = syllabusById.get(String(lookupId(node.syllabus_version_c)));
      return syllabus?.status_c === 'Published' && node.status_c === 'Published' && node.verified_c === true;
    }).map((node) => {
      const syllabus = syllabusById.get(String(lookupId(node.syllabus_version_c)));
      const source = sourceById.get(String(lookupId(syllabus?.source_document_c)));
      const exam = lookupName(syllabus?.examination_c) || syllabus?.version_label_c?.split('·')[0]?.trim() || 'Examination';
      return {
        id: node.Id,
        exam,
        year: syllabus?.academic_year_c || '',
        subject: node.subject_c || '',
        level: node.node_type_c || 'Topic',
        title: node.Name,
        parentCode: node.parent_node_code_c || '',
        parentTitle: node.parent_node_code_c || '',
        path: node.node_path_c || node.Name,
        sourceTitle: source?.Name || syllabus?.Name || 'Published curriculum source',
        sourceType: source?.source_category_c || 'Official',
        sourceUrl: source?.official_url_c || '',
        pageStart: node.source_page_start_c || '',
        pageEnd: node.source_page_end_c || '',
        state: 'Published · expert verified',
        verified: true
      };
    });

    const dbKeysWithUnits = new Set(
      dbNodes.filter((item) => item.level !== 'Subject').map((item) => item.exam + '|' + item.year)
    );

    const referenceRows = [];
    for (const curriculum of CURRICULA) {
      const exam = EXAM_LABELS[curriculum.key];
      const year = 2026;
      if (dbKeysWithUnits.has(exam + '|' + year)) continue;
      const url = SOURCE_URLS[curriculum.key];
      for (const subject of curriculum.subjects) {
        const units = curriculum.units.filter((unit) => unit.subject === subject);
        referenceRows.push({
          id: curriculum.key + '-' + subject,
          exam,
          year,
          subject,
          level: 'Subject',
          title: subject,
          parentCode: '',
          parentTitle: '',
          path: curriculum.label + ' / ' + subject,
          sourceTitle: curriculum.source,
          sourceType: 'Official source snapshot',
          sourceUrl: url,
          pageStart: Math.min(...units.map((unit) => unit.pages[0])),
          pageEnd: Math.max(...units.map((unit) => unit.pages[1])),
          state: 'Reference snapshot · not yet expert-published in Northstar',
          verified: false
        });
        for (const unit of units) {
          referenceRows.push({
            id: curriculum.key + '-' + subject + '-' + unit.number,
            exam,
            year,
            subject,
            level: 'Unit',
            title: unit.title,
            parentCode: subject,
            parentTitle: subject,
            path: curriculum.label + ' / ' + subject + ' / Unit ' + unit.number,
            sourceTitle: curriculum.source,
            sourceType: 'Official source snapshot',
            sourceUrl: url,
            pageStart: unit.pages[0],
            pageEnd: unit.pages[1],
            state: 'Reference snapshot · unit headings only',
            verified: false
          });
        }
      }
    }

    const parentNames = new Map(dbNodes.map((item) => [item.parentCode, item.title]));
    return [...dbNodes, ...referenceRows].map((item) => ({
      ...item,
      parentTitle: parentNames.get(item.parentCode) || item.parentTitle
    }));
  }, [syllabi, nodes, sources]);

  const exams = useMemo(() => ['All exams', ...new Set(rows.map((row) => row.exam).filter(Boolean))], [rows]);
  const years = useMemo(() => ['All years', ...new Set(rows.map((row) => String(row.year)).filter(Boolean))], [rows]);
  const subjects = useMemo(() => ['All subjects', ...new Set(rows.map((row) => row.subject).filter(Boolean))], [rows]);
  const levels = ['All levels', 'Subject', 'Unit', 'Chapter', 'Topic', 'Subtopic', 'Concept'];

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => (
      (examFilter === 'All exams' || row.exam === examFilter) &&
      (yearFilter === 'All years' || String(row.year) === yearFilter) &&
      (subjectFilter === 'All subjects' || row.subject === subjectFilter) &&
      (levelFilter === 'All levels' || row.level === levelFilter) &&
      (!term || [row.exam, row.subject, row.level, row.title, row.parentTitle, row.path, row.sourceTitle]
        .some((value) => String(value || '').toLowerCase().includes(term)))
    )).sort((a, b) => (
      String(a.exam).localeCompare(String(b.exam)) ||
      String(a.subject).localeCompare(String(b.subject)) ||
      Number(a.pageStart || 0) - Number(b.pageStart || 0) ||
      String(a.title).localeCompare(String(b.title))
    ));
  }, [rows, examFilter, yearFilter, subjectFilter, levelFilter, search]);

  const filteredKey = filteredRows.map((row) => row.id).join('|');
  const hasPublishedTopics = rows.some((row) => row.verified && ['Chapter', 'Topic', 'Subtopic', 'Concept'].includes(row.level));
  const referenceOnly = filteredRows.length > 0 && filteredRows.every((row) => !row.verified);
  const title = [examFilter === 'All exams' ? 'JEE and NEET' : examFilter, yearFilter === 'All years' ? '' : yearFilter, subjectFilter === 'All subjects' ? '' : subjectFilter, levelFilter === 'All levels' ? 'curriculum' : levelFilter]
    .filter(Boolean).join(' · ');

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Student resource library</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Curriculum library</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Browse by examination, year, subject and curriculum level. Download filtered outlines as CSV, or print and save the selection as PDF.
          </p>
        </div>
        {canManage && (
          <Button asChild variant="outline">
            <Link to="/curriculum/manage"><ApperIcon name="Settings2" size={16} /> Manage curriculum</Link>
          </Button>
        )}
      </header>

      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ApperIcon name="Info" size={18} className="mt-0.5 shrink-0 text-primary" />
          <div className="space-y-1">
            <p className="font-semibold">What is available now</p>
            <p className="text-sm leading-6 text-muted-foreground">
              The library includes the 2026 official JEE Main Paper 1 and NEET UG subject and unit-heading snapshots. These are useful syllabus outlines, not a full topic-by-topic or subtopic-by-subtopic extraction. Detailed chapter and topic rows appear only after academic review and publication.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Visible curriculum items', value: rows.length, icon: 'ListTree' },
          { label: 'Examinations', value: new Set(rows.map((row) => row.exam)).size, icon: 'GraduationCap' },
          { label: 'Subjects', value: new Set(rows.map((row) => row.exam + '|' + row.subject)).size, icon: 'BookOpen' },
          { label: 'Published topic levels', value: rows.filter((row) => row.verified && ['Chapter', 'Topic', 'Subtopic', 'Concept'].includes(row.level)).length, icon: 'Network' }
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

      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            Examination
            <select value={examFilter} onChange={(event) => setExamFilter(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {exams.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            Academic year
            <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {years.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            Subject
            <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {subjects.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            Curriculum level
            <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {levels.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            Search curriculum
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search subject or topic…" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <strong className="font-mono text-foreground">{filteredRows.length}</strong> of <strong className="font-mono text-foreground">{rows.length}</strong> items
            {referenceOnly ? ' · reference snapshot, not expert-published' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => downloadRows(filteredRows, 'northstar-curriculum.csv')} disabled={!filteredRows.length}>
              <ApperIcon name="Download" size={15} /> Download CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => printRows(filteredRows, title)} disabled={!filteredRows.length}>
              <ApperIcon name="FileDown" size={15} /> Print / Save PDF
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-semibold">Published curriculum records could not be loaded</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => run()}>Retry</Button>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg border border-border bg-foreground/5" />)}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <ApperIcon name="BookOpenCheck" size={26} className="mx-auto text-primary" />
          <p className="mt-3 font-semibold">No curriculum items match these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {levelFilter === 'Topic' || levelFilter === 'Chapter' || levelFilter === 'Subtopic'
              ? 'No expert-verified items at this level have been published yet. The current 2026 reference snapshots contain subject and unit headings only.'
              : 'Change the examination, year, subject or search phrase to see available curriculum.'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => {
            setExamFilter('All exams');
            setYearFilter('All years');
            setSubjectFilter('All subjects');
            setLevelFilter('All levels');
            setSearch('');
          }}>Clear filters</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="divide-y divide-border">
            {filteredRows.map((row, index) => (
              <article key={row.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent font-mono text-xs text-primary">{String(index + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{row.title}</h2>
                      <Badge variant="outline">{row.level}</Badge>
                      <Badge variant="outline" className={row.verified ? 'border-success/30 bg-success/10 text-success' : 'border-warning/30 bg-warning/10 text-warning-foreground'}>
                        {row.verified ? 'Published · verified' : 'Reference snapshot'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{row.exam} · {row.year} · {row.subject}{row.parentTitle ? ' · under ' + row.parentTitle : ''}</p>
                    <p className="text-xs text-muted-foreground">{row.path}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.sourceTitle} {row.pageStart ? '· PDF pages ' + row.pageStart + (row.pageEnd && row.pageEnd !== row.pageStart ? '–' + row.pageEnd : '') : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  {row.sourceUrl && (
                    <Button asChild size="sm" variant="ghost">
                      <a href={row.sourceUrl} target="_blank" rel="noreferrer"><ApperIcon name="ExternalLink" size={14} /> Source</a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => downloadRows([row], 'curriculum-' + safeText(row.subject).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + safeText(row.title).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.csv')}>
                    <ApperIcon name="Download" size={14} /> Download
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {!hasPublishedTopics && (
        <section className="rounded-lg border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <ApperIcon name="ListTree" size={18} className="mt-0.5 shrink-0 text-warning-foreground" />
            <div>
              <p className="font-semibold">Detailed chapter and topic publishing is still pending</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                This library is wired to show and download verified Chapter, Topic, Subtopic and Concept records as soon as academic reviewers publish them. It does not relabel unit headings as topics to make the library look fuller.
              </p>
            </div>
          </div>
        </section>
      )}

      {loading && data && <p className="text-xs text-muted-foreground" aria-live="polite">Refreshing published curriculum…</p>}
    </div>
  );
}
