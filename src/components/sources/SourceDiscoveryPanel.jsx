import { useState } from 'react';
import { sdk } from '@/services/sdk';
import { useFunction } from '@/hooks/useFunction';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const EXAMS = ['JEE Main', 'JEE Advanced', 'NEET UG', 'General'];

export default function SourceDiscoveryPanel({ onAdded }) {
  const [exam, setExam] = useState('JEE Main');
  const [query, setQuery] = useState('syllabus chapters topics');
  const [results, setResults] = useState([]);
  const [savingUrl, setSavingUrl] = useState('');
  const [savedUrls, setSavedUrls] = useState([]);
  const { invoke, loading } = useFunction(import.meta.env.VITE_DISCOVER_CURRICULUM_SOURCES, { showError: false });

  async function discover() {
    const response = await invoke({ exam, query });
    if (!response) {
      toast.error('Source search did not return a result');
      return;
    }
    if (response.success === false) {
      toast.error(response.message || 'Source discovery failed');
      return;
    }
    setResults(response.results || []);
    if (response.results?.length) {
      toast.success('Internet search completed', { description: response.message });
    } else {
      toast.info(response.message || 'No matching sources found');
    }
  }

  async function addCandidate(candidate) {
    setSavingUrl(candidate.url);
    try {
      const { eq } = window.ApperSDK.CoreSDK;
      const existing = await sdk.table('source_documents_c')
        .select(['Id', 'Name'])
        .where(eq('official_url_c', candidate.url))
        .limit(1, 0).fetch();
      if (!existing.success) throw new Error(existing.message || 'Could not check for duplicate source records');
      if (existing.data?.length) {
        setSavedUrls((current) => [...current, candidate.url]);
        toast.info('This URL is already in the source registry');
        return;
      }

      const result = await sdk.table('source_documents_c').create({
        Name: candidate.title.slice(0, 250),
        issuing_authority_c: candidate.domain,
        source_category_c: candidate.sourceType === 'Official' ? 'Official' : 'Secondary',
        document_type_c: 'Syllabus',
        official_url_c: candidate.url,
        document_version_c: 'Discovered candidate',
        retrieved_at_c: new Date().toISOString(),
        rights_status_c: 'Unknown',
        verification_status_c: 'New',
        ingestion_status_c: 'Queued',
        review_notes_c: [
          'Discovered through Northstar internet source search.',
          'Examination: ' + candidate.exam,
          'Classification: ' + candidate.sourceType + ' candidate based on the host domain.',
          'Search query: ' + query,
          'Search snippet: ' + (candidate.snippet || 'No snippet returned.'),
          'This record is unverified. Confirm the issuing organisation, publication date, academic year and reuse rights before extracting or publishing content.'
        ].join('\n')
      });
      if (!result.data?.length) {
        throw new Error(result.messages?.join('; ') || result.message || 'Source candidate was not saved');
      }

      const sourceDocumentId = result.data[0].Id;
      const versionResult = await sdk.table('source_document_versions_c').create({
        Name: candidate.title.slice(0, 250),
        source_document_c: sourceDocumentId,
        version_label_c: 'Discovered candidate',
        official_title_c: candidate.title.slice(0, 250),
        document_url_c: candidate.url,
        rights_status_c: 'Unknown',
        rights_notes_c: 'Candidate source. Usage rights and source authority have not been independently verified.',
        ingestion_status_c: 'Discovered',
        version_status_c: 'Current',
        change_summary_c: candidate.snippet || 'Discovered online. Publication date, academic year and syllabus relevance need review.'
      });

      setSavedUrls((current) => [...current, candidate.url]);
      if (!versionResult.data?.length) {
        toast.warning('Source record saved, but its version card could not be created', {
          description: versionResult.messages?.join('; ') || versionResult.message || 'Review the source document record.'
        });
      } else {
        toast.success('Source and candidate version saved for academic review');
      }
      onAdded?.();
    } catch (error) {
      toast.error('Could not save this source candidate', { description: error.message });
    } finally {
      setSavingUrl('');
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold">Internet source discovery</p>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
            Search official authorities and unofficial education providers. Domain-based labels are discovery hints only: every result needs human authority, date and rights verification before use.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Official + unofficial</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end">
        <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
          Examination
          <select value={exam} onChange={(event) => setExam(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {EXAMS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
          Search terms
          <Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && discover()} placeholder="e.g. 2027 Physics syllabus chapter list" />
        </label>
        <Button onClick={discover} disabled={loading || query.trim().length < 3}>
          <ApperIcon name={loading ? 'LoaderCircle' : 'Search'} size={15} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Searching…' : 'Search internet'}
        </Button>
      </div>

      {results.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{results.length} candidates discovered</p>
            <span className="text-xs text-muted-foreground">Unverified until reviewed</span>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {results.map((candidate) => {
              const saved = savedUrls.includes(candidate.url);
              const saving = savingUrl === candidate.url;
              return (
                <article key={candidate.url} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{candidate.title}</h3>
                      <Badge variant="outline" className={candidate.sourceType === 'Official' ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-muted text-muted-foreground'}>
                        {candidate.sourceType === 'Official' ? 'Official-domain candidate' : 'Unofficial candidate'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{candidate.domain} · {candidate.exam}</p>
                    {candidate.snippet && <p className="text-sm leading-5 text-muted-foreground">{candidate.snippet}</p>}
                    <a href={candidate.url} target="_blank" rel="noreferrer" className="inline-flex break-all text-xs font-medium text-primary hover:underline">{candidate.url}</a>
                  </div>
                  <Button size="sm" variant={saved ? 'outline' : 'default'} disabled={saved || saving} onClick={() => addCandidate(candidate)}>
                    <ApperIcon name={saved ? 'Check' : saving ? 'LoaderCircle' : 'BookmarkPlus'} size={14} className={saving ? 'animate-spin' : ''} />
                    {saved ? 'Saved for review' : saving ? 'Saving…' : 'Add to registry'}
                  </Button>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="rounded-md bg-accent/40 p-3 text-xs leading-5 text-muted-foreground">
          Search example: “JEE Main 2027 Physics syllabus topics”, “NEET Biology chapter list”, or “JEE Advanced chemistry syllabus coaching material”.
        </p>
      )}
    </section>
  );
}
