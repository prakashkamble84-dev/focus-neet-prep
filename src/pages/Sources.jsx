import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { registerOfficialBaseline } from '@/services/academicRegistry';
import { fetchSourceAuthorities, fetchSourceDocuments, fetchSourceVersions } from '@/services/sourceRegistryService';
import { SourceRightsDialog, SourceUploadDialog } from '@/components/sources/SourceDialogs';
import SourceRegistryTabs from '@/components/sources/SourceRegistryTabs';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export const route = {
  path: '/sources',
  layout: 'owner',
  access: "profile === 'CEO' || profile === 'Manager' || profile === 'AcademicExpert_c' || profile === 'ContentReviewer_c'"
};
export const nav = {
  label: 'Academic sources',
  icon: 'FileCheck2',
  group: 'Research',
  profiles: ['CEO', 'Manager', 'AcademicExpert_c', 'ContentReviewer_c'],
  order: 110
};

export default function Sources() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const canReview = ['CEO', 'Manager', 'AcademicExpert_c', 'ContentReviewer_c'].includes(profile);
  const canManageAuthorities = ['CEO', 'Manager', 'AcademicExpert_c'].includes(profile);

  const [search, setSearch] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
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
    if (!['Licensed', 'Public', 'Restricted'].includes(rightsStatus)) {
      toast.error('Choose a rights decision before saving');
      return;
    }
    if (!reviewNotes.trim()) {
      toast.error('Add the evidence or reason behind the rights decision');
      return;
    }
    if ((rightsStatus === 'Licensed' || rightsStatus === 'Public') && (!authorityChecked || !metadataChecked)) {
      toast.error('Verify the issuing authority and document metadata before marking this source verified');
      return;
    }

    setSaving(true);
    try {
      const versionResult = await sdk.table('source_document_versions_c').update({
        Id: selectedVersion.Id,
        rights_status_c: rightsStatus,
        rights_notes_c: reviewNotes,
        ingestion_status_c: 'Review'
      });
      if (!versionResult.data?.length) {
        toast.error(versionResult.messages?.[0] || versionResult.message || 'Source version could not be updated');
        return;
      }

      const documentId = selectedVersion.source_document_c?.Id ?? selectedVersion.source_document_c;
      if (documentId) {
        const parentResult = await sdk.table('source_documents_c').update({
          Id: documentId,
          rights_status_c: rightsStatus,
          verification_status_c: rightsStatus === 'Licensed' || rightsStatus === 'Public' ? 'Verified' : 'Review',
          review_notes_c: reviewNotes
        });
        if (!parentResult.data?.length) {
          toast.error(parentResult.messages?.[0] || 'Version updated, but parent source record did not update');
          await refreshVersions();
          return;
        }
      }

      const reviewerId = user?.Id || user?.userId;
      if (reviewerId) {
        const reviewTypes = [
          { type: 'Rights', decision: rightsStatus === 'Licensed' || rightsStatus === 'Public' ? 'Verified' : 'Rejected' },
          ...(authorityChecked ? [{ type: 'Authority', decision: 'Verified' }] : []),
          ...(metadataChecked ? [{ type: 'Metadata', decision: 'Verified' }] : [])
        ];
        for (const item of reviewTypes) {
          const verification = await sdk.table('source_verification_records_c').create({
            Name: `${item.type} review · ${selectedVersion.official_title_c || selectedVersion.Name}`,
            document_version_c: selectedVersion.Id,
            verification_type_c: item.type,
            decision_c: item.decision,
            reviewer_user_c: reviewerId,
            verified_at_c: new Date().toISOString(),
            verification_notes_c: reviewNotes,
            independent_check_c: false
          });
          if (!verification.data?.length) {
            toast.warning(`${item.type} status updated, but its review event could not be recorded`);
          }
        }
      } else {
        toast.warning('Source status updated, but the reviewer identity was unavailable for the verification log');
      }

      toast.success('Source verification review saved', {
        description: rightsStatus === 'Licensed' || rightsStatus === 'Public'
          ? 'Authority, metadata and rights checks are recorded. Syllabus content still needs academic approval and curriculum publication.'
          : 'This source remains unavailable to student-facing views.'
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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Official source registry</h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Trace each syllabus and examination document to its issuing authority, exact version, original URL, stored PDF, rights decision and page-level extraction review.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/curriculum"><ApperIcon name="BookOpen" size={16} /> Curriculum ingestion</Link>
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
