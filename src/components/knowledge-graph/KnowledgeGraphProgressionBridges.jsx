import ApperIcon from '@/components/ApperIcon';

export default function KnowledgeGraphProgressionBridges() {
  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <article className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <ApperIcon name="GraduationCap" size={17} className="text-primary" />
          <h2 className="font-semibold">JEE progression bridge</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Foundation → JEE Main → difficult Main → JEE Advanced → advanced multi-concept application. This is a learning progression framework, not a claim that the two examinations share identical syllabi.
        </p>
      </article>
      <article className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <ApperIcon name="BookOpenCheck" size={17} className="text-primary" />
          <h2 className="font-semibold">NEET progression bridge</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          NCERT foundation → concept → standard MCQ → statement-based → integrated MCQ → timed MCQ → full test, with retention tracked as a distinct learning outcome.
        </p>
      </article>
    </section>
  );
}
