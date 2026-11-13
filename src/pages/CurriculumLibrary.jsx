import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { fetchCurriculumLibrary, buildCurriculumRows } from '@/services/curriculumLibraryService';
import { downloadCurriculumRows, printCurriculumRows } from '@/services/curriculumLibraryDownloads';
import CurriculumLibraryFilters from '@/components/curriculum/CurriculumLibraryFilters';
import CurriculumLibraryResults from '@/components/curriculum/CurriculumLibraryResults';
import CurriculumSourceDocuments from '@/components/curriculum/CurriculumSourceDocuments';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';

export const route = { path: '/curriculum', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Curriculum', icon: 'BookOpen', section: 'Learn', order: 10 };

export default function CurriculumLibrary() {
  const { profile } = useProfile();
  const canManage = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c', 'ContentReviewer_c'].includes(profile);
  const [examFilter, setExamFilter] = useState('All exams');
  const [yearFilter, setYearFilter] = useState('All years');
  const [subjectFilter, setSubjectFilter] = useState('All subjects');
  const [levelFilter, setLevelFilter] = useState('All levels');
  const [search, setSearch] = useState('');
  const { data, loading, error, run } = useFetch(fetchCurriculumLibrary, []);

  const rows = useMemo(() => buildCurriculumRows(data), [data]);
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

  const hasPublishedTopics = rows.some((row) => row.verified && ['Chapter', 'Topic', 'Subtopic', 'Concept'].includes(row.level));
  const referenceOnly = filteredRows.length > 0 && filteredRows.every((row) => !row.verified);
  const documentTitle = [
    examFilter === 'All exams' ? 'JEE and NEET' : examFilter,
    yearFilter === 'All years' ? '' : yearFilter,
    subjectFilter === 'All subjects' ? '' : subjectFilter,
    levelFilter === 'All levels' ? 'curriculum' : levelFilter
  ].filter(Boolean).join(' · ');

  function clearFilters() {
    setExamFilter('All exams');
    setYearFilter('All years');
    setSubjectFilter('All subjects');
    setLevelFilter('All levels');
    setSearch('');
  }

  function downloadOne(row, slugify) {
    downloadCurriculumRows([row], 'curriculum-' + slugify(row.subject) + '-' + slugify(row.title) + '.csv');
  }

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

      <CurriculumSourceDocuments />

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
        <CurriculumLibraryFilters
          exams={exams}
          years={years}
          subjects={subjects}
          levels={levels}
          exam={examFilter}
          year={yearFilter}
          subject={subjectFilter}
          level={levelFilter}
          search={search}
          onExamChange={setExamFilter}
          onYearChange={setYearFilter}
          onSubjectChange={setSubjectFilter}
          onLevelChange={setLevelFilter}
          onSearchChange={setSearch}
        />
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <strong className="font-mono text-foreground">{filteredRows.length}</strong> of <strong className="font-mono text-foreground">{rows.length}</strong> items
            {referenceOnly ? ' · reference snapshot, not expert-published' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => downloadCurriculumRows(filteredRows)} disabled={!filteredRows.length}>
              <ApperIcon name="Download" size={15} /> Download CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => printCurriculumRows(filteredRows, documentTitle)} disabled={!filteredRows.length}>
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

      <CurriculumLibraryResults
        rows={filteredRows}
        loading={loading && !data}
        levelFilter={levelFilter}
        onClearFilters={clearFilters}
        onDownloadOne={downloadOne}
      />

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
      {error && <p className="text-xs text-muted-foreground">Previously loaded rows remain visible where available.</p>}
    </div>
  );
}
