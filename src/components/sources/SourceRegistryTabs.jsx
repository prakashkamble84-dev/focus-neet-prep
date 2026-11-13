import SourceVersionCard from '@/components/sources/SourceVersionCard';
import SourceWorkflow from '@/components/sources/SourceWorkflow';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-5 py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-primary">
        <ApperIcon name={icon} size={22} />
      </span>
      <h3 className="font-mono text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

function Status({ value }) {
  const tone = ['Verified', 'Licensed', 'Public', 'Complete'].includes(value)
    ? 'border-success/30 bg-success/10 text-success'
    : ['Rejected', 'Restricted', 'Failed'].includes(value)
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : ['Discovered', 'Retrieved', 'Queued', 'Extracted', 'Review'].includes(value)
        ? 'border-warning/30 bg-warning/10 text-warning-foreground'
        : 'border-border bg-muted text-muted-foreground';
  return <Badge variant="outline" className={tone}>{value || 'Not set'}</Badge>;
}

export default function SourceRegistryTabs({
  filteredVersions,
  documents,
  versionsError,
  versionsLoading,
  versionsData,
  refreshVersions,
  refreshDocuments,
  documentsError,
  canManageAuthorities,
  canReview,
  canIndependentlyVerify,
  seeding,
  onRegisterBaseline,
  filteredAuthorities,
  authoritiesError,
  authoritiesLoading,
  authoritiesData,
  refreshAuthorities,
  onUpload,
  onReview,
  onExtract
}) {
  return (
    <Tabs defaultValue="documents" className="space-y-4">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="documents">Documents and versions</TabsTrigger>
        <TabsTrigger value="authorities">Authorities</TabsTrigger>
        <TabsTrigger value="workflow">Ingestion workflow</TabsTrigger>
      </TabsList>

      <TabsContent value="documents" className="space-y-3">
        {versionsError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold">Could not load source versions</p>
            <p className="mt-1 text-muted-foreground">{versionsError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refreshVersions()}>Retry</Button>
          </div>
        ) : versionsLoading && !versionsData ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading source versions…</div>
        ) : filteredVersions.length === 0 ? (
          <EmptyState
            icon="FileSearch"
            title="No source versions registered"
            description="Register the official baseline to add the 2026 JEE Main, JEE Advanced and NEET UG documents, plus the currently listed JEE Main 2027 syllabus and bulletin records."
            action={canManageAuthorities ? <Button className="mt-4" onClick={onRegisterBaseline} disabled={seeding}>Register official baseline</Button> : null}
          />
        ) : (
          filteredVersions.map((version) => {
            const parentId = version.source_document_c?.Id ?? version.source_document_c;
            const parent = documents.find((doc) => doc.Id === parentId);
            const authorityId = version.source_registry_c?.Id ??
              version.source_registry_c ??
              parent?.source_registry_c?.Id ??
              parent?.source_registry_c;
            const authority = (authoritiesData || []).find((item) => String(item.Id) === String(authorityId || ''));
            return (
              <SourceVersionCard
                key={version.Id}
                version={version}
                parent={parent}
                authority={authority}
                authorities={authoritiesData || []}
                canReview={canReview}
                canIndependentlyVerify={canIndependentlyVerify}
                onUpload={onUpload}
                onReview={onReview}
                onExtract={onExtract}
                onIndependentVerificationComplete={() => Promise.all([refreshVersions(), refreshDocuments(), refreshAuthorities()])}
              />
            );
          })
        )}
        {documentsError && <p className="text-xs text-destructive">Parent document metadata could not be loaded: {documentsError}</p>}
      </TabsContent>

      <TabsContent value="authorities" className="space-y-3">
        {authoritiesError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold">Could not load authority registry</p>
            <p className="mt-1 text-muted-foreground">{authoritiesError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refreshAuthorities()}>Retry</Button>
          </div>
        ) : authoritiesLoading && !authoritiesData ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading authorities…</div>
        ) : filteredAuthorities.length === 0 ? (
          <EmptyState icon="Landmark" title="No authorities registered" description="The official authority baseline is added by an academic administrator." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredAuthorities.map((authority) => (
              <div key={authority.Id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{authority.organisation_name_c || authority.Name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{authority.source_code_c} · {authority.organisation_type_c}</p>
                  </div>
                  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">Official authority</Badge>
                </div>
                <p className="mt-3 text-sm leading-5 text-muted-foreground">{authority.authority_scope_c}</p>
                <a href={authority.website_url_c} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline">
                  {authority.official_domain_c} <ApperIcon name="ExternalLink" size={12} />
                </a>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="workflow">
        <SourceWorkflow />
      </TabsContent>
    </Tabs>
  );
}
