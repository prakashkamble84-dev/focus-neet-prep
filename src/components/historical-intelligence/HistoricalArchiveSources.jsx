import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ApperIcon from '@/components/ApperIcon';

const SOURCES = [
  {
    name: 'JEE Advanced past question papers',
    authority: 'JEE Advanced organising institute',
    coverage: 'The official archive lists Paper 1 and Paper 2 from 2007 through 2025, with English and Hindi versions listed for later years.',
    url: 'https://jeeadv.ac.in/archive.html',
    evidence: 'Paper archive',
    icon: 'GraduationCap'
  },
  {
    name: 'JEE Advanced current-year papers',
    authority: 'JEE Advanced organising institute',
    coverage: 'The official site lists the 2026 Paper 1 and Paper 2 question papers.',
    url: 'https://jeeadv.ac.in/',
    evidence: '2026 papers',
    icon: 'FileText'
  },
  {
    name: 'JEE Main official question-paper listings',
    authority: 'National Testing Agency',
    coverage: 'The official sitemap links 2026 shift-wise question papers and the 2025 archive.',
    url: 'https://jeemain.nta.nic.in/sitemap/',
    evidence: 'Shift-wise papers',
    icon: 'Files'
  },
  {
    name: 'JEE Main 2026 archive',
    authority: 'National Testing Agency',
    coverage: 'The official 2026 archive provides the year’s syllabus, information bulletin, FAQs and related notices. Use the Question Papers menu for paper files.',
    url: 'https://jeemain.nta.nic.in/2026-archive/',
    evidence: 'Official year archive',
    icon: 'Archive'
  },
  {
    name: 'NEET UG official archive',
    authority: 'National Testing Agency',
    coverage: 'The archive includes 2020 question-paper sets in multiple languages and historical notices and answer-key documents for later years. It is not a complete 30-year question-paper collection.',
    url: 'https://neet.nta.nic.in/archive/',
    evidence: 'Partial question-paper archive',
    icon: 'BookOpen'
  },
  {
    name: 'NEET UG current official site',
    authority: 'National Testing Agency',
    coverage: 'Current examination notices, information bulletin and candidate services. Candidate-specific response sheets may require candidate portal access.',
    url: 'https://neet.nta.nic.in/',
    evidence: 'Current authority portal',
    icon: 'ShieldCheck'
  }
];

export default function HistoricalArchiveSources() {
  const currentYear = new Date().getFullYear();
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-mono text-lg font-semibold">Official historical-paper discovery</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          These are authority-owned archive pages for locating candidate papers. They are discovery sources, not imported Northstar records. Download a paper only where you have a permitted-use basis, then ingest it for review.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {SOURCES.map((source) => (
          <Card key={source.name} className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                    <ApperIcon name={source.icon} size={17} />
                  </span>
                  <div>
                    <CardTitle className="text-base">{source.name}</CardTitle>
                    <CardDescription className="mt-1">{source.authority}</CardDescription>
                  </div>
                </div>
                <Badge variant="outline">{source.evidence}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-6 text-muted-foreground">{source.coverage}</p>
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                Open official archive
                <ApperIcon name="ExternalLink" size={14} />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="rounded-md border border-warning/40 bg-warning/10 p-4">
        <p className="text-sm font-semibold">Coverage limitation</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          The currently accessible official archive pages do not provide a complete, uniform 1997–{currentYear} digital paper collection for JEE Main, JEE Advanced and NEET UG. A missing archive entry is not proof that an exam did not occur or that the year had zero questions.
        </p>
      </div>
    </section>
  );
}
