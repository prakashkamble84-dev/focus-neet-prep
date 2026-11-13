import { sdk } from '@/services/sdk';
import { getLookupId } from '@/services/sourceVerificationService';
import { invalidateSourceDependents } from '@/services/sourceContentInvalidationService';

export function getFirstPassSourceDecisions(rightsStatus, authorityChecked, metadataChecked) {
  return [
    { type: 'Rights', decision: ['Licensed', 'Public'].includes(rightsStatus) ? 'Verified' : rightsStatus === 'Restricted' ? 'Rejected' : 'NeedsFix' },
    { type: 'Authority', decision: authorityChecked ? 'Verified' : 'NeedsFix' },
    { type: 'Metadata', decision: metadataChecked ? 'Verified' : 'NeedsFix' }
  ];
}

export async function saveFirstPassSourceReview({
  version,
  document,
  rightsStatus,
  authorityChecked,
  metadataChecked,
  notes,
  reviewerId
}) {
  if (!version?.Id || !document?.Id) return { success: false, message: 'A source document and version are required.' };
  if (String(getLookupId(version.source_document_c)) !== String(document.Id)) {
    return { success: false, message: 'The selected parent document does not match this source version.' };
  }
  if (!reviewerId) return { success: false, message: 'The signed-in reviewer identity is unavailable.' };
  if (!['Unknown', 'Licensed', 'Public', 'Restricted', 'Review'].includes(rightsStatus)) {
    return { success: false, message: 'Choose Public, Licensed or Restricted as the rights decision.' };
  }
  if (!String(notes || '').trim()) return { success: false, message: 'Record evidence or a reason for the source review.' };
  if (['Licensed', 'Public'].includes(rightsStatus) && (!authorityChecked || !metadataChecked)) {
    return { success: false, message: 'Verify the issuing authority and document metadata before approving permitted use.' };
  }

  const invalidation = await invalidateSourceDependents(
    version.Id,
    reviewerId,
    'First-pass source review is being reopened. ' + String(notes).trim()
  );
  if (!invalidation.success) {
    return {
      success: false,
      message: 'Source metadata was not changed because all dependent syllabus and graph approvals could not be reset. ' + invalidation.message
    };
  }

  const versionUpdate = await sdk.table('source_document_versions_c').update({
    Id: version.Id,
    rights_status_c: rightsStatus,
    rights_notes_c: String(notes).trim(),
    ingestion_status_c: 'Review'
  });
  if (!versionUpdate.data?.length) {
    return { success: false, message: versionUpdate.messages?.join('; ') || versionUpdate.message || 'Source version could not be updated.' };
  }

  const parentUpdate = await sdk.table('source_documents_c').update({
    Id: document.Id,
    rights_status_c: rightsStatus,
    verification_status_c: 'Review',
    ingestion_status_c: 'Extracted',
    review_notes_c: String(notes).trim()
  });
  if (!parentUpdate.data?.length) {
    return { success: false, message: parentUpdate.messages?.join('; ') || parentUpdate.message || 'Parent source record could not be updated. The source version remains in Review.' };
  }

  const decisions = getFirstPassSourceDecisions(rightsStatus, authorityChecked, metadataChecked);

  for (const item of decisions) {
    const verification = await sdk.table('source_verification_records_c').create({
      Name: item.type + ' first-pass review · ' + (version.official_title_c || version.Name),
      document_version_c: version.Id,
      verification_type_c: item.type,
      decision_c: item.decision,
      reviewer_user_c: reviewerId,
      verified_at_c: new Date().toISOString(),
      verification_notes_c: String(notes).trim(),
      independent_check_c: false
    });
    if (!verification.data?.length) {
      return {
        success: false,
        message: verification.messages?.join('; ') || verification.message || 'A first-pass verification event could not be recorded. The version remains in Review.'
      };
    }
  }

  return { success: true };
}
