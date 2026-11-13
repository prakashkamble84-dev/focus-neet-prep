import { sdk } from '@/services/sdk';

export function getLookupId(value) {
  return value && typeof value === 'object' ? value.Id ?? null : value ?? null;
}

function getHost(value) {
  try {
    return new URL(String(value || '')).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function domainMatches(url, authorityDomain) {
  const host = getHost(url);
  const expected = String(authorityDomain || '').toLowerCase().replace(/^www\./, '').trim();
  return Boolean(host && expected && (host === expected || host.endsWith('.' + expected)));
}

export function evaluateIndependentSourceVerification({
  version,
  document,
  authority,
  verifications = [],
  reviewerId,
  checks = {}
}) {
  const issues = [];
  const versionId = String(version?.Id || '');
  const parentId = String(getLookupId(version?.source_document_c) || '');
  const allowedRights = ['Public', 'Licensed'];
  const firstPassTypes = ['Rights', 'Authority', 'Metadata'];

  if (!versionId || !parentId || !document) issues.push('A source document and version must both exist.');
  if (!allowedRights.includes(version?.rights_status_c) || version?.rights_status_c !== document?.rights_status_c) {
    issues.push('Both source document and version must have the same Public or Licensed rights decision.');
  }
  if (!version?.document_file_c?.length) issues.push('Attach the original PDF to private storage before final verification.');
  if (!String(version?.document_url_c || document?.official_url_c || '').startsWith('https://')) {
    issues.push('The source must have a valid HTTPS official URL.');
  }
  if (!authority?.official_domain_c) issues.push('The issuing authority needs a registered official domain.');
  if (!String(authority?.official_domain_c || '').trim()) issues.push('The issuing authority is not linked to this version.');
  if (!checks.authority || !checks.metadata || !checks.rights || !checks.pdfIntegrity) {
    issues.push('Complete all four independent verification checks.');
  }
  if (!String(checks.notes || '').trim()) issues.push('Record the evidence behind the independent review.');
  if (!reviewerId) issues.push('The signed-in reviewer identity is unavailable.');

  const primary = {};
  for (const type of firstPassTypes) {
    const rows = verifications.filter((row) => (
      String(getLookupId(row.document_version_c)) === versionId &&
      row.verification_type_c === type &&
      row.decision_c === 'Verified' &&
      row.independent_check_c !== true
    ));
    if (!rows.length) {
      issues.push('A first-pass ' + type.toLowerCase() + ' review must be completed before independent verification.');
      continue;
    }
    primary[type] = new Set(rows.map((row) => String(getLookupId(row.reviewer_user_c) || '')).filter(Boolean));
  }

  const allPrimaryReviewers = new Set(
    Object.values(primary).flatMap((set) => [...set])
  );
  if (reviewerId && allPrimaryReviewers.has(String(reviewerId))) {
    issues.push('Independent verification must be completed by a different person from the first-pass reviewer.');
  }

  const url = version?.document_url_c || document?.official_url_c;
  const domainIsMatched = domainMatches(url, authority?.official_domain_c);
  if (!domainIsMatched && !checks.officialOriginConfirmed) {
    issues.push('The PDF URL is hosted outside the registered authority domain. Confirm that the link was reached from the authority website.');
  }

  return {
    valid: issues.length === 0,
    issues,
    domainIsMatched,
    versionId,
    reviewerId: String(reviewerId || '')
  };
}

async function createApprovalEvent(reviewerId, version, notes) {
  const result = await sdk.table('content_approvals_c').create({
    Name: 'Independent source verification · ' + (version.official_title_c || version.Name),
    content_type_c: 'Source',
    record_identifier_c: 'source-version:' + version.Id,
    content_version_c: String(version.Id),
    review_status_c: 'Approved',
    reviewer_user_c: reviewerId,
    submitted_by_c: reviewerId,
    decision_notes_c: notes,
    submitted_at_c: new Date().toISOString(),
    resolved_at_c: new Date().toISOString()
  });
  return Boolean(result.data?.length);
}

export async function completeIndependentSourceVerification({
  version,
  document,
  authority,
  verifications = [],
  reviewerId,
  checks
}) {
  const eligibility = evaluateIndependentSourceVerification({
    version,
    document,
    authority,
    verifications,
    reviewerId,
    checks
  });
  if (!eligibility.valid) return { success: false, issues: eligibility.issues };

  const alreadyVerified = (
    version.ingestion_status_c === 'Verified' &&
    document.verification_status_c === 'Verified' &&
    document.ingestion_status_c === 'Complete'
  );
  if (alreadyVerified) return { success: true, alreadyVerified: true, auditLogged: true };

  const types = ['Rights', 'Authority', 'Metadata'];
  const existingIndependent = verifications.filter((row) => (
    String(getLookupId(row.document_version_c)) === String(version.Id) &&
    row.independent_check_c === true &&
    row.decision_c === 'Verified'
  ));

  for (const type of types) {
    const exists = existingIndependent.some((row) => row.verification_type_c === type);
    if (exists) continue;

    const result = await sdk.table('source_verification_records_c').create({
      Name: 'Independent ' + type.toLowerCase() + ' verification · ' + (version.official_title_c || version.Name),
      document_version_c: version.Id,
      verification_type_c: type,
      decision_c: 'Verified',
      reviewer_user_c: reviewerId,
      verified_at_c: new Date().toISOString(),
      verification_notes_c: String(checks.notes).trim() + (eligibility.domainIsMatched ? '' : ' Official authority site link to the registered CDN/host was independently confirmed.'),
      independent_check_c: true
    });
    if (!result.data?.length) {
      return {
        success: false,
        issues: [result.messages?.join('; ') || result.message || 'Could not save the independent ' + type.toLowerCase() + ' verification record.']
      };
    }
  }

  const versionResult = await sdk.table('source_document_versions_c').update({
    Id: version.Id,
    rights_status_c: document.rights_status_c,
    ingestion_status_c: 'Verified'
  });
  if (!versionResult.data?.length) {
    return {
      success: false,
      issues: [versionResult.messages?.join('; ') || versionResult.message || 'Independent checks were recorded, but the source version could not be marked Verified.']
    };
  }

  const documentResult = await sdk.table('source_documents_c').update({
    Id: document.Id,
    rights_status_c: version.rights_status_c,
    verification_status_c: 'Verified',
    ingestion_status_c: 'Complete',
    retrieved_at_c: new Date().toISOString(),
    review_notes_c: String(document.review_notes_c || '').trim() + '\nIndependent source verification completed: ' + String(checks.notes).trim()
  });
  if (!documentResult.data?.length) {
    return {
      success: false,
      issues: [documentResult.messages?.join('; ') || documentResult.message || 'The source version is Verified, but the parent document could not be finalised. Retry verification to complete it.']
    };
  }

  let auditLogged = false;
  try {
    auditLogged = await createApprovalEvent(reviewerId, version, checks.notes);
  } catch {
    auditLogged = false;
  }

  return { success: true, alreadyVerified: false, auditLogged, issues: [] };
}

export async function independentlyReviewPageExtraction(row, decision, reviewerId) {
  if (!row?.Id || !reviewerId) return { success: false, message: 'A page record and signed-in reviewer are required.' };
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
