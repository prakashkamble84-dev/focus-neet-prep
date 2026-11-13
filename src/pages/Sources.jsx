import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { registerOfficialBaseline } from '@/services/academicRegistry';
import FilePicker from '@/components/FilePicker';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export const route = { path: '/sources', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Academic sources', icon: 'FileCheck2', group: 'Research', order: 110 };

const sourceFields = ['Id', 'Name', 'source_code_c', 'organisation_name_c', 'organisation_type_c', 'official_domain_c', 'website_url_c', 'jurisdiction_c', 'authority_scope_c', 'is_authoritative_c', 'active_c', 'last_verified_at_c'];
const documentFields = ['Id', 'Name', 'examination_c', 'source_registry_c', 'source_category_c', 'document_type_c', 'official_url_c', 'published_date_c', 'effective_date_c', 'academic_year_c', 'document_version_c', 'rights_status_c', 'verification_status_c', 'ingestion_status_c', 'review_notes_c'];
const versionFields = ['Id', 'Name', 'source_document_c', 'source_registry_c', 'version_label_c', 'official_title_c', 'document_url_c', 'document_file_c', 'publication_date_c', 'effective_date_c', 'rights_status_c', 'rights_notes_c', 'ingestion_status_c', 'version_status_c', 'academic_year_c', 'change_summary_c'];

async function fetchAuthorities() {
  const result = await sdk.table('source_registry_c').select(sourceFields).limit(100, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load official authorities');
  return result.data ?? [];
}

async function fetchDocuments() {
  const result = await sdk.table('source_documents_c').select(documentFields).limit(200, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load source documents');
  return result.data ?? [];
}

async function fetchVersions() {
  const result = await sdk.table('source_document_versions_c').select(versionFields).limit(200, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not load source document versions');
  return result.data ?? [];
}

function Status({ value }) {
  const tone = value === 'Verified' || value === 'Licensed' || value === 'Public' || value === 'Complete'
    ? 'border-success/30 bg-success/10 text-success'
    : value === 'Rejected' || value === 'Restricted' || value === 'Failed'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : value === 'Review' || value === 'Queued' || value === 'Retrieved' || value === 'Discovered'
        ? 'border-warning/30 bg-warning/10 text-warning-foreground'
        : 'border-border bg-muted text-muted-foreground';
  return <Badge variant="outline" className={tone}>{value || 'Not set'}</Badge>;
}

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

export default function Sources() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const canReview = ['CEO', 'Manager', 'AcademicExpert_c', 'ContentReviewer_c'].includes(profile);
  const canManageAuthorities = ['CEO', 'Manager', 'AcademicExpert_c'].includes(profile);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [files, setFiles] = useState([]);
  const [rightsStatus, setRightsStatus] = useState('Unknown');
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: authoritiesData, loading: authoritiesLoading, error: authoritiesError, run: refreshAuthorities } = useFetch(fetchAuthorities, []);
  const { data: documentsData, loading: documentsLoading, error: documentsError, run: refreshDocuments } = useFetch(fetchDocuments, []);
  const { data: versionsData, loading: versionsLoading, error: versionsError, run: refreshVersions } = useFetch(fetchVersions, []);

  const authorities = authoritiesData ?? [];
  const documents = documentsData ?? [];
  const versions = versionsData ?? [];

  const filteredAuthorities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return authorities;
    return authorities.filter((item) =>
      [item.Name, item.organisation_name_c, item.source_code_c, item.official_domain_c]
        .some((value) => String(value ?? '').toLowerCase().includes(q))
    );
  }, [authorities, search]);

  const filteredVersions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return versions;
    return versions.filter((item) =>
      [item.Name, item.official_title_c, item.version_label_c, item.document_url_c, item.rights_status_c, item.ingestion_status_c]
        .some((value) => String(value ?? '').toLowerCase().includes(q))
    );
  }, [versions, search]);

  const pendingRights = versions.filter((item) => !['Licensed', 'Public'].includes(item.rights_status_c)).length;
  const pendingFiles = versions.filter((item) => !item.document_file_c?.length).length;

  async function handleRegisterBaseline() {
    setSeeding(true);
    try {
      const result = await registerOfficialBaseline();
      const s = result.summary;
      toast.success('Official source baseline registered', {
        description: `${s.authorities} authorities · ${s.documents} documents · ${s.versions} versions · ${s.syllabusVersions} syllabus versions created`
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
    setReviewNotes(version.rights_notes_c || '');
    setReviewOpen(true);
  }

  async function handleUpload() {
    if (!selectedVersion) return;
    setSaving(true);
    try {
      const result = await sdk.table('source_document_versions_c').update({
        Id: selectedVersion.Id,
        document_file_c: sdk.storage.toUpdateFormat(files)
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
          verification_status_c: 'Review',
          review_notes_c: reviewNotes
        });
        if (!parentResult.data?.length) {
          toast.error(parentResult.messages?.[0] || 'Version updated, but parent source record did not update');
          await refreshVersions();
          return;
        }
      }

      if (user?.userId) {
        const verification = await sdk.table('source_verification_records_c').create({
          Name: `Rights review · ${selectedVersion.official_title_c || selectedVersion.Name}`,
          document_version_c: selectedVersion.Id,
          verification_type_c: 'Rights',
          decision_c: rightsStatus === 'Licensed' || rightsStatus === 'Public' ? 'Verified' : 'Rejected',
          reviewer_user_c: user.userId,
          verified_at_c: new Date().toISOString(),
          verification_notes_c: reviewNotes,
          independent_check_c: false
        });
        if (!verification.data?.length) {
          toast.warning('Source status updated, but the review event could not be recorded');
        }
      }

      toast.success('Rights review saved', {
        description: rightsStatus === 'Licensed' || rightsStatus === 'Public'
          ? 'The source record is marked verified for rights metadata. Syllabus publication still needs academic approval.'
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
              Official URLs and source metadata can be registered now. PDFs still need to be uploaded into controlled storage, rights need review, and extracted text or diagrams need page-level verification. Nothing with unknown usage rights is released to students.
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
              description="Register the verified official baseline to add the 2026 JEE Main, JEE Advanced and NEET UG source documents and their version records."
              action={canManageAuthorities ? <Button className="mt-4" onClick={handleRegisterBaseline} disabled={seeding}>Register official baseline</Button> : null}
            />
          ) : (
            filteredVersions.map((version) => {
              const parentId = version.source_document_c?.Id ?? version.source_document_c;
              const parent = documents.find((doc) => doc.Id === parentId);
              const fileCount = version.document_file_c?.length ?? 0;
              return (
                <div key={version.Id} className="rounded-lg border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{version.official_title_c || version.Name}</h3>
                        <Badge variant="outline">{version.academic_year_c || version.version_label_c || 'Version'}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{parent?.Name || 'Parent document record'} · {version.version_label_c || 'Unversioned'}</p>
                      <div className="flex flex-wrap gap-2">
                        <Status value={version.ingestion_status_c} />
                        <Status value={version.rights_status_c} />
                        <Status value={version.version_status_c} />
                        <Badge variant="outline">{fileCount ? 'PDF stored' : 'PDF not stored'}</Badge>
                      </div>
                      {version.change_summary_c && <p className="max-w-4xl text-sm leading-5 text-muted-foreground">{version.change_summary_c}</p>}
                      <a href={version.document_url_c} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 break-all text-xs font-medium text-primary hover:underline">
                        <ApperIcon name="ExternalLink" size={13} /> Open official document
                      </a>
                    </div>
                    {canReview && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => openUpload(version)}>
                          <ApperIcon name="Upload" size={14} /> {fileCount ? 'Manage PDF' : 'Attach PDF'}
                        </Button>
                        <Button size="sm" onClick={() => openReview(version)}>
                          <ApperIcon name="ClipboardCheck" size={14} /> Review rights
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
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
                    <Status value={authority.is_authoritative_c ? 'Verified' : 'Review'} />
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

        <TabsContent value="workflow" className="grid gap-3 md:grid-cols-2">
          {[
            ['01', 'Discover and register', 'Record the issuing authority, official domain, title, academic year and original document URL.'],
            ['02', 'Retrieve and preserve', 'Upload the original PDF into private storage. Preserve the URL, file metadata, version label and checksum.'],
            ['03', 'Extract page by page', 'Capture text, tables, equations and diagrams with page numbers and confidence values.'],
            ['04', 'Verify source and rights', 'Review authority, document metadata, permitted use and extraction quality independently.'],
            ['05', 'Map curriculum', 'Create versioned syllabus nodes with page-level source references and import-batch lineage.'],
            ['06', 'Approve publication', 'Academic reviewers approve a syllabus version and its changed nodes before student-facing publication.']
          ].map(([n, title, detail]) => (
            <div key={n} className="flex gap-3 rounded-lg border border-border bg-card p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent font-mono text-xs font-semibold text-primary">{n}</span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 md:col-span-2">
            <p className="font-semibold">Automated OCR is not enabled yet</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              The registry supports PDF storage and page-level extraction records. An automated OCR/diagram pipeline is not connected in this build; no extraction is silently fabricated. Use the reviewer workflow until a server-side extraction provider and evaluation tests are configured.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attach official PDF</DialogTitle>
            <DialogDescription>{selectedVersion?.official_title_c || selectedVersion?.Name || 'Selected document version'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Original PDF file</Label>
            <FilePicker
              value={files}
              onChange={setFiles}
              maxFiles={1}
              fieldConfig={{ supportedExtensions: ['pdf'], supportMultipleValues: false, minValue: 0, maxValue: 20480 }}
            />
            <p className="text-xs leading-5 text-muted-foreground">The PDF is stored in private platform storage. Uploading does not grant redistribution rights or publish the syllabus.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleUpload} disabled={saving || !files.length}>
              {saving ? 'Saving…' : 'Save PDF attachment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review document usage rights</DialogTitle>
            <DialogDescription>Record the reuse decision for {selectedVersion?.official_title_c || selectedVersion?.Name || 'this document'}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rights decision</Label>
              <Select value={rightsStatus} onValueChange={setRightsStatus}>
                <SelectTrigger><SelectValue placeholder="Select rights status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Unknown">Unknown · do not publish</SelectItem>
                  <SelectItem value="Licensed">Licensed · permission recorded</SelectItem>
                  <SelectItem value="Public">Public · permitted use basis recorded</SelectItem>
                  <SelectItem value="Restricted">Restricted · do not redistribute</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Evidence and reviewer notes</Label>
              <Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={4} placeholder="Record the official terms, licence, public-use basis, or reason for restriction…" />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Marking rights as Licensed or Public verifies the rights metadata only. It does not approve the syllabus content or mark OCR as complete.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleReview} disabled={saving || !canReview}>{saving ? 'Saving…' : 'Save rights review'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
