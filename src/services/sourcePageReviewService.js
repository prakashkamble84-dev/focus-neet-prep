import { sdk } from '@/services/sdk';
import { getLookupId } from '@/services/sourceVerificationService';

export async function independentlyReviewPageExtraction(row, decision, reviewerId) {
  if (!row?.Id || !reviewerId) return { success: false, message: 'A page record and signed-in reviewer are required.' };
  if (!['Verified', 'Rejected'].includes(decision)) {
    return { success: false, message: 'Choose Verified or Rejected as the independent page decision.' };
  }
  const creatorId = getLookupId(row.CreatedBy) || getLookupId(row.Owner);
  if (decision === 'Verified' && (!creatorId || String(creatorId) === String(reviewerId))) {
    return { success: false, message: 'A different reviewer must verify this extraction. The person who created the transcript cannot independently approve it.' };
  }

  const versionId = getLookupId(row.document_version_c);
  if (!versionId) return { success: false, message: 'The extraction is not linked to a source document version.' };

  const previousStatus = row.quality_status_c || 'Pending';
  const update = await sdk.table('source_extractions_c').update({
    Id: row.Id,
    quality_status_c: decision
  });
  if (!update.data?.length) {
    return { success: false, message: update.messages?.join('; ') || update.message || 'Extraction status could not be updated.' };
  }

  const verification = await sdk.table('source_verification_records_c').create({
    Name: 'Independent page extraction review · page ' + row.page_number_c + ' · record ' + row.Id,
    document_version_c: versionId,
    verification_type_c: 'Academic',
    decision_c: decision,
    reviewer_user_c: reviewerId,
    verified_at_c: new Date().toISOString(),
    verification_notes_c: 'Extraction record ' + row.Id + '. ' +
      (decision === 'Verified'
        ? 'Page text and content classification independently reviewed.'
        : 'Page extraction rejected during independent review.'),
    independent_check_c: true
  });
  if (!verification.data?.length) {
    await sdk.table('source_extractions_c').update({
      Id: row.Id,
      quality_status_c: previousStatus
    });
    return {
      success: false,
      message: verification.messages?.join('; ') || verification.message || 'Independent review could not be recorded. The extraction status was rolled back.'
    };
  }

  return { success: true };
}
