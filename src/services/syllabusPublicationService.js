import { sdk } from '@/services/sdk';

const { eq } = window.ApperSDK.CoreSDK;

function lookupId(value) {
  return value && typeof value === 'object' ? value.Id ?? null : value ?? null;
}

function recordTime(row) {
  const value = row?.verified_at_c || row?.CreatedOn;
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestRecord(rows) {
  return [...rows].sort((a, b) => recordTime(b) - recordTime(a))[0] || null;
}

async function unwrapRecord(request, tableName) {
  const result = await request;
  if (!result.success || !result.data) {
    throw new Error(result.message || tableName + ' record was not found');
  }
  return result.data;
}

async function readVerificationRows(versionId) {
  const result = await sdk.table('source_verification_records_c')
    .select([
      'Id',
      'Name',
      'CreatedOn',
      'document_version_c',
      'verification_type_c',
      'decision_c',
      'reviewer_user_c',
      'verified_at_c',
      'verification_notes_c',
      'independent_check_c'
    ])
    .where(eq('document_version_c', versionId))
    .limit(300, 0)
    .fetch();
  if (!result.success) throw new Error(result.message || 'Could not load source verification history');
  return result.data || [];
}

export function evaluateSyllabusPublication({
  syllabus,
  sourceVersion,
  sourceDocument,
  authority,
  verifications = [],
  reviewerId
}) {
  const issues = [];
  const versionId = String(sourceVersion?.Id || '');
  const firstPassTypes = ['Rights', 'Authority', 'Metadata'];
  const primaryReviewerIds = new Set();
  const independentReviewerIds = new Set();

  if (!syllabus?.Id) issues.push('The syllabus version is missing.');
  if (!sourceVersion || String(lookupId(syllabus?.source_document_version_c)) !== String(sourceVersion.Id)) {
    issues.push('The syllabus must point to the selected source document version.');
  }
  if (!sourceDocument || String(lookupId(sourceVersion?.source_document_c)) !== String(sourceDocument.Id)) {
    issues.push('The source document and source version do not match.');
  }
  if (!authority?.official_domain_c || authority.is_authoritative_c !== true || authority.active_c !== true) issues.push('The issuing authority must be registered, marked authoritative and active.');
  if (!sourceVersion?.document_file_c?.length) issues.push('The original PDF must be stored privately.');
  if (!String(sourceVersion?.document_url_c || sourceDocument?.official_url_c || '').startsWith('https://')) {
    issues.push('The official source URL must use HTTPS.');
  }
  if (!['Public', 'Licensed'].includes(sourceVersion?.rights_status_c) ||
      sourceVersion?.rights_status_c !== sourceDocument?.rights_status_c) {
    issues.push('Both the source version and parent document must carry the same Public or Licensed usage decision.');
  }
  if (sourceVersion?.ingestion_status_c !== 'Verified') {
    issues.push('The source document version has not completed independent verification.');
  }
  if (sourceDocument?.verification_status_c !== 'Verified' || sourceDocument?.ingestion_status_c !== 'Complete') {
    issues.push('The parent source document has not been independently verified and finalised.');
  }

  for (const type of firstPassTypes) {
    const primaryRows = verifications.filter((row) => (
      String(lookupId(row.document_version_c)) === versionId &&
      row.verification_type_c === type &&
      row.independent_check_c !== true
    ));
    const latestPrimary = latestRecord(primaryRows);
    if (!latestPrimary || latestPrimary.decision_c !== 'Verified') {
      issues.push('The latest first-pass ' + type.toLowerCase() + ' verification is not Verified.');
    }
    const primaryId = lookupId(latestPrimary?.reviewer_user_c);
    if (primaryId) primaryReviewerIds.add(String(primaryId));

    const independentRows = verifications.filter((row) => (
      String(lookupId(row.document_version_c)) === versionId &&
      row.verification_type_c === type &&
      row.independent_check_c === true
    ));
    const latestIndependent = latestRecord(independentRows);
    if (!latestIndependent || latestIndependent.decision_c !== 'Verified' ||
        recordTime(latestIndependent) < recordTime(latestPrimary)) {
      issues.push('A current independent ' + type.toLowerCase() + ' verification record is missing or stale.');
    }
    const independentId = lookupId(latestIndependent?.reviewer_user_c);
    if (independentId) independentReviewerIds.add(String(independentId));
  }

  if (!reviewerId) issues.push('The signed-in academic publisher identity is unavailable.');
  if (reviewerId && primaryReviewerIds.has(String(reviewerId))) {
    issues.push('The syllabus publisher cannot be the first-pass source reviewer.');
  }
  if (independentReviewerIds.size !== 1 || !independentReviewerIds.has(String(reviewerId || ''))) {
    issues.push('One second reviewer must complete all independent source checks, and that same person must publish the syllabus.');
  }
  for (const id of independentReviewerIds) {
    if (primaryReviewerIds.has(id)) {
      issues.push('The independent source-verification reviewer must differ from every first-pass reviewer.');
      break;
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

export async function publishSyllabusVersion(syllabusId, reviewerId) {
  try {
    const syllabus = await unwrapRecord(
      sdk.table('syllabus_versions_c')
        .select(['Id', 'Name', 'examination_c', 'source_document_c', 'source_document_version_c', 'academic_year_c', 'version_label_c', 'status_c', 'change_summary_c'])
        .get(syllabusId),
      'syllabus_versions_c'
    );

    if (syllabus.status_c === 'Published') {
      return { success: true, alreadyPublished: true, message: 'This syllabus version is already published.' };
    }

    const sourceVersionId = lookupId(syllabus.source_document_version_c);
    if (!sourceVersionId) {
      return { success: false, issues: ['The syllabus has no linked source document version.'] };
    }

    const sourceVersion = await unwrapRecord(
      sdk.table('source_document_versions_c')
        .select(['Id', 'Name', 'source_document_c', 'source_registry_c', 'document_file_c', 'document_url_c', 'rights_status_c', 'ingestion_status_c', 'version_label_c'])
        .get(sourceVersionId),
      'source_document_versions_c'
    );

    const sourceDocumentId = lookupId(sourceVersion.source_document_c);
    if (!sourceDocumentId || String(sourceDocumentId) !== String(lookupId(syllabus.source_document_c))) {
      return { success: false, issues: ['The syllabus and source version do not point to the same parent source document.'] };
    }

    const sourceDocument = await unwrapRecord(
      sdk.table('source_documents_c')
        .select(['Id', 'Name', 'source_registry_c', 'official_url_c', 'rights_status_c', 'verification_status_c', 'ingestion_status_c'])
        .get(sourceDocumentId),
      'source_documents_c'
    );

    const authorityId = lookupId(sourceVersion.source_registry_c) || lookupId(sourceDocument.source_registry_c);
    const authority = authorityId
      ? await unwrapRecord(
          sdk.table('source_registry_c')
            .select(['Id', 'Name', 'official_domain_c', 'website_url_c', 'is_authoritative_c', 'active_c'])
            .get(authorityId),
          'source_registry_c'
        )
      : null;

    const verifications = await readVerificationRows(sourceVersion.Id);
    const evaluation = evaluateSyllabusPublication({
      syllabus,
      sourceVersion,
      sourceDocument,
      authority,
      verifications,
      reviewerId
    });
    if (!evaluation.valid) return { success: false, issues: evaluation.issues };

    const update = await sdk.table('syllabus_versions_c').update({
      Id: syllabus.Id,
      status_c: 'Published',
      reviewed_at_c: new Date().toISOString()
    });
    if (!update.data?.length) {
      return {
        success: false,
        issues: [update.messages?.join('; ') || update.message || 'Syllabus publication was not saved.']
      };
    }

    const audit = await sdk.table('content_approvals_c').create({
      Name: 'Publish syllabus · ' + (syllabus.version_label_c || syllabus.Name),
      content_type_c: 'Syllabus',
      record_identifier_c: 'syllabus:' + syllabus.Id,
      content_version_c: String(syllabus.Id),
      review_status_c: 'Approved',
      reviewer_user_c: reviewerId,
      submitted_by_c: reviewerId,
      decision_notes_c: 'Published after independent source, rights, authority and metadata verification. Imported curriculum nodes retain their own review and publication states.',
      submitted_at_c: new Date().toISOString(),
      resolved_at_c: new Date().toISOString()
    });

    if (!audit.data?.length) {
      await sdk.table('syllabus_versions_c').update({
        Id: syllabus.Id,
        status_c: 'Review'
      });
      return {
        success: false,
        issues: ['The syllabus approval audit could not be recorded. Publication was rolled back to Review.']
      };
    }

    return {
      success: true,
      alreadyPublished: false,
      auditLogged: true,
      message: 'Syllabus version published. Individual curriculum nodes remain separately review-gated.'
    };
  } catch (error) {
    return { success: false, issues: [error.message || 'Syllabus publication failed.'] };
  }
}
