import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { registerOfficialBaseline } from '@/services/academicRegistry';
import { saveFirstPassSourceReview } from '@/services/sourceVerificationService';
import { fetchSourceAuthorities, fetchSourceDocuments, fetchSourceVersions } from '@/services/sourceRegistryService';
import { SourceRightsDialog, SourceUploadDialog } from '@/components/sources/SourceDialogs';
import SourceExtractionDialog from '@/components/sources/SourceExtractionDialog';
import SourceRegistryTabs from '@/components/sources/SourceRegistryTabs';
import SourceDiscoveryPanel from '@/components/sources/SourceDiscoveryPanel';
import SourceLifecycleDiagnostics from '@/components/sources/SourceLifecycleDiagnostics';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export const route = {
  path: '/sources',
  layout: 'owner',
  access: "profile === 'CEO' || profile === 'CEO_c' || profile === 'Manager' || profile === 'Manager_c' || profile === 'AcademicExpert_c' || profile === 'ContentReviewer_c'"
};
export const nav = {
  label: 'Academic sources',
  icon: 'FileCheck2',
  section: 'Academic operations',
  profiles: ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c', 'ContentReviewer_c'],
  order: 110
};

export default function Sources() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const canReview = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c', 'ContentReviewer_c'].includes(profile);
  const canManageAuthorities = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'].includes(profile);

  const [search, setSearch] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [extractionOpen, setExtractionOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [files, setFiles] = useState([]);
  const [rightsStatus, setRightsStatus] = useState('Unknown');
  const [authorityChecked, setAuthorityChecked] = useState(false);
  const [metadataChecked, setMetadataChecked] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  const { data: authoritiesData, loading: authoritiesLoading, error: authoritiesError, run: refreshAuthorities } = useFetch(fetchSourceAuthorities, []);
  const { data: documentsData, error: documentsError, run: refreshDocuments } = useFetch(fetchSourceDocuments, []);
  const { data: versionsData, loading: versionsLoading, error: versionsError, run: refreshVersions } = useFetch(fetchSourceVersions, []);

  const authorities = authoritiesData ?? [];
  const documents = documentsData ?? [];
  const versions = versionsData ?? [];
  const query = search.trim().toLowerCase();

  const filteredAuthorities = useMemo(() => authorities.filter((item) =>
    !query || [item.Name, item.organisation_name_c, item.source_code_c, item.official_domain_c]
      .some((value) => String(value ?? '').toLowerCase().includes(query))
  ), [authorities, query]);

  const filteredVersions = useMemo(() => versions.filter((item) =>
    !query || [item.Name, item.official_title_c, item.version_label_c, item.document_url_c, item.rights_status_c, item.ingestion_status_c]
      .some((value) => String(value ?? '').toLowerCase().includes(query))
  ), [versions, query]);

  const pendingRights = versions.filter((item) => !['Licensed', 'Public'].includes(item.rights_status_c)).length;
  const pendingFiles = versions.filter((item) => !item.document_file_c?.length).length;

  async function handleRegisterBaseline() {
    setSeeding(true);
    try {
      const { summary } = await registerOfficialBaseline();
      toast.success('Official source baseline registered', {
        description: `${summary.authorities} authorities · ${summary.documents} documents · ${summary.versions} versions · ${summary.syllabusVersions} syllabus versions created`
      });
      await Promise.all([refreshAuthorities(), refreshDocuments(), refreshVersions()]);
    } catch (error) {
      toast.error('Source registration did not finish', { description: error.message });
    } finally {
      setSeeding(false);
    }
  }

  function openUpload(version) {
    setSelectedVersion(version);
    setFiles(version.document_file_c ?? []);
    setUploadOpen(true);
  }

  function openExtract(version) {
    setSelectedVersion(version);
    setExtractionOpen(true);
  }

  function openReview(version) {
    setSelectedVersion(version);
    setRightsStatus(version.rights_status_c || 'Unknown');
    setAuthorityChecked(false);
    setMetadataChecked(false);
    setReviewNotes(version.rights_notes_c || '');
    setReviewOpen(true);
  }

  async function handleUpload() {
    if (!selectedVersion) return;
    setSaving(true);
    try {
      const result = await sdk.table('source_document_versions_c').update({
        Id: selectedVersion.Id,
        document_file_c: sdk.storage.toUpdateFormat(files),
        ingestion_status_c: 'Retrieved'
      });
      if (!result.data?.length) {
        toast.error(result.messages?.[0] || result.message || 'PDF attachment was not saved');
        return;
      }
      toast.success('PDF attached to the source version');
      setUploadOpen(false);
      setSelectedVersion(null);
      await refreshVersions();
    } catch (error) {
      toast.error('PDF attachment failed', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleReview() {
    if (!selectedVersion) return;
    setSaving(true);
    try {
      const documentId = selectedVersion.source_document_c?.Id ?? selectedVersion.source_document_c;
      const parent = documents.find((item) => String(item.Id) === String(documentId));
      const result = await saveFirstPassSourceReview({
        version: selectedVersion,
        document: parent,
        rightsStatus,
        authorityChecked,
        metadataChecked,
        notes: reviewNotes,
        reviewerId: user?.userId
      });
      if (!result.success) {
        toast.error('Source review was not saved', { description: result.message });
        return;
      }

      toast.success('First-pass source review saved', {
        description: 'This new review invalidates earlier independent verification. A different reviewer must re-check the source before publication.'
      });
      setReviewOpen(false);
      setSelectedVersion(null);
      await Promise.all([refreshDocuments(), refreshVersions()]);
    } catch (error) {
      toast.error('Rights review failed', { description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Phase 2 · Academic provenance</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Academic source registry</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Discover official and independent curriculum sources, then trace each candidate to its URL, version, stored PDF, rights decision and page-level extraction review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/curriculum/manage"><ApperIcon name="ListTree" size={16} /> Manage curriculum</Link>
          </Button>
          {canManageAuthorities && (
            <Button onClick={handleRegisterBaseline} disabled={seeding}>
              <ApperIcon name={seeding ? 'LoaderCircle' : 'DatabaseZap'} size={16} className={seeding ? 'animate-spin' : ''} />
              {seeding ? 'Registering sources…' : 'Register official baseline'}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
        <div className="flex items-start gap-3">
          <ApperIcon name="ShieldAlert" size={19} className="mt-0.5 shrink-0 text-warning-foreground" />
          <div>
            <p className="font-semibold">Import does not equal publication</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Official URLs and source metadata can be registered now. PDFs still need to be uploaded into controlled storage, rights need review, and extracted text or diagrams need page-level verification. Unknown usage rights are not released to students.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Official authorities', value: authorities.length, icon: 'Landmark' },
          { label: 'Document records', value: documents.length, icon: 'Files' },
          { label: 'Versions awaiting rights review', value: pendingRights, icon: 'Scale' },
          { label: 'PDFs not yet stored', value: pendingFiles, icon: 'FileUp' }
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              <ApperIcon name={item.icon} size={17} className="text-primary" />
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      <SourceDiscoveryPanel onAdded={() => Promise.all([refreshDocuments(), refreshVersions()])} />

      <SourceLifecycleDiagnostics />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <ApperIcon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search authorities, titles, versions…" className="pl-9" />
        </div>
        <p className="text-xs text-muted-foreground">Source records are stored in the connected Northstar database.</p>
      </div>

      <SourceRegistryTabs
        filteredVersions={filteredVersions}
        documents={documents}
        versionsError={versionsError}
        versionsLoading={versionsLoading}
        versionsData={versionsData}
        refreshVersions={refreshVersions}
        refreshDocuments={refreshDocuments}
        documentsError={documentsError}
        canManageAuthorities={canManageAuthorities}
        canReview={canReview}
        seeding={seeding}
        onRegisterBaseline={handleRegisterBaseline}
        filteredAuthorities={filteredAuthorities}
        authoritiesError={authoritiesError}
        authoritiesLoading={authoritiesLoading}
        authoritiesData={authoritiesData}
        refreshAuthorities={refreshAuthorities}
        onUpload={openUpload}
        onReview={openReview}
        onExtract={openExtract}
      />

      <SourceUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        version={selectedVersion}
        files={files}
        onFilesChange={setFiles}
        saving={saving}
        onSave={handleUpload}
      />

      <SourceExtractionDialog
        open={extractionOpen}
        onOpenChange={setExtractionOpen}
        version={selectedVersion}
        onSaved={refreshVersions}
      />

      <SourceRightsDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        version={selectedVersion}
        rightsStatus={rightsStatus}
        onRightsStatusChange={setRightsStatus}
        authorityChecked={authorityChecked}
        onAuthorityCheckedChange={setAuthorityChecked}
        metadataChecked={metadataChecked}
        onMetadataCheckedChange={setMetadataChecked}
        reviewNotes={reviewNotes}
        onReviewNotesChange={setReviewNotes}
        saving={saving}
        canReview={canReview}
        onSave={handleReview}
      />
    </div>
  );
}
