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

  const result = await sdk.table('source_verification_records_c').create({
    Name: 'Independent page extraction review · page ' + row.page_number_c + ' · record ' + row.Id,
    document_version_c: versionId,
    verification_type_c: row.content_kind_c === 'Text' ? 'OCR' : 'Academic',
    decision_c: decision,
    reviewer_user_c: reviewerId,
    verified_at_c: new Date().toISOString(),
    verification_notes_c: 'Extraction record ' + row.Id + '. ' + (decision === 'Verified' ? 'Page text and content classification independently reviewed.' : 'Page extraction rejected during independent review.'),
    independent_check_c: true
  });
  if (!result.data?.length) {
    return { success: false, message: result.messages?.join('; ') || result.message || 'Independent extraction review could not be recorded.' };
  }

  const update = await sdk.table('source_extractions_c').update({
    Id: row.Id,
    quality_status_c: decision
  });
  if (!update.data?.length) {
    return { success: false, message: update.messages?.join('; ') || update.message || 'Review event was recorded, but the extraction status could not be updated.' };
  }

  return { success: true };
}
