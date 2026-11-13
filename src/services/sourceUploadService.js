import { sdk } from '@/services/sdk';
import { invalidateSourceDependents } from '@/services/sourceContentInvalidationService';

export async function replaceSourcePdf({ version, document, files, reviewerId }) {
  if (!version?.Id || !document?.Id) {
    return { success: false, message: 'A source version and its parent document are required.' };
  }
  if (!reviewerId) return { success: false, message: 'The signed-in uploader identity is unavailable.' };
  const documentId = version.source_document_c?.Id ?? version.source_document_c;
  if (String(documentId || '') !== String(document.Id)) {
    return { success: false, message: 'The selected parent document does not match this source version.' };
  }
  if (!Array.isArray(files) || files.length === 0) {
    return { success: false, message: 'Attach at least one PDF file before saving.' };
  }

  const versionUpdate = await sdk.table('source_document_versions_c').update({
    Id: version.Id,
    document_file_c: sdk.storage.toUpdateFormat(files),
    rights_status_c: 'Unknown',
    rights_notes_c: 'PDF file added or replaced. Rights, authority and metadata must be reviewed again.',
    ingestion_status_c: 'Retrieved'
  });
  if (!versionUpdate.data?.length) {
    return {
      success: false,
      message: versionUpdate.messages?.join('; ') || versionUpdate.message || 'PDF attachment was not saved.'
    };
  }

  const parentUpdate = await sdk.table('source_documents_c').update({
    Id: document.Id,
    rights_status_c: 'Unknown',
    verification_status_c: 'Review',
    ingestion_status_c: 'Extracted',
    review_notes_c: String(document.review_notes_c || '') +
      '\nPDF file added or replaced. Repeat first-pass rights, authority and metadata review.'
  });

  const invalidation = await invalidateSourceDependents(
    version.Id,
    reviewerId,
    'The stored PDF was added or replaced. Previous page extractions, syllabus publication, curriculum nodes, concept relationships, question mappings and historical crosswalk approvals must be reviewed again.',
    true
  );

  if (!invalidation.success) {
    return {
      success: false,
      saved: true,
      message: 'PDF was saved, but dependent academic content could not be fully invalidated. ' + invalidation.message
    };
  }
  if (!parentUpdate.data?.length) {
    return {
      success: false,
      saved: true,
      invalidated: invalidation.invalidated,
      message: 'PDF was saved and dependent academic content was reset, but the parent source document could not be marked Review. ' +
        (parentUpdate.messages?.join('; ') || parentUpdate.message || 'Retry the parent update before verification.')
    };
  }

  return {
    success: true,
    saved: true,
    invalidated: invalidation.invalidated
  };
}
