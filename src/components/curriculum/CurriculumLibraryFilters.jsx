export default function CurriculumLibraryFilters({
  exams,
  years,
  subjects,
  levels,
  exam,
  year,
  subject,
  level,
  search,
  onExamChange,
  onYearChange,
  onSubjectChange,
  onLevelChange,
  onSearchChange
}) {
  const selectClass = 'h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
        Examination
        <select value={exam} onChange={(event) => onExamChange(event.target.value)} className={selectClass}>
          {exams.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
        Academic year
        <select value={year} onChange={(event) => onYearChange(event.target.value)} className={selectClass}>
          {years.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
        Subject
        <select value={subject} onChange={(event) => onSubjectChange(event.target.value)} className={selectClass}>
          {subjects.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
        Curriculum level
        <select value={level} onChange={(event) => onLevelChange(event.target.value)} className={selectClass}>
          {levels.map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
        Search curriculum
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search subject or topic…" className={selectClass} />
      </label>
    </div>
  );
}
