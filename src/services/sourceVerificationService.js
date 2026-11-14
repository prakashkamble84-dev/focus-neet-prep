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

function recordTime(row) {
  const value = row?.verified_at_c || row?.CreatedOn;
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestRecord(rows) {
  return [...rows].sort((a, b) => recordTime(b) - recordTime(a))[0] || null;
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
  const versionAuthorityId = getLookupId(version?.source_registry_c);
  const documentAuthorityId = getLookupId(document?.source_registry_c);
  const authorityId = getLookupId(authority?.Id);
  if (!versionAuthorityId && !documentAuthorityId) {
    issues.push('The source version or parent document must be linked to a registered issuing authority.');
  }
  if (versionAuthorityId && documentAuthorityId && String(versionAuthorityId) !== String(documentAuthorityId)) {
    issues.push('The source version and parent document point to different issuing authorities.');
  }
  if (!authorityId) issues.push('The issuing authority registry record could not be identified.');
  if (authorityId && versionAuthorityId && String(authorityId) !== String(versionAuthorityId)) {
    issues.push('The selected issuing authority does not match the source version registry link.');
  }
  if (authorityId && documentAuthorityId && String(authorityId) !== String(documentAuthorityId)) {
    issues.push('The selected issuing authority does not match the parent document registry link.');
  }
  if (!authority?.official_domain_c) issues.push('The issuing authority needs a registered official domain.');
  if (authority && authority.is_authoritative_c !== true) issues.push('The linked source registry entry is not marked as an authoritative issuer.');
  if (authority && authority.active_c !== true) issues.push('The linked issuing authority is inactive.');
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
      row.independent_check_c !== true
    ));
    const latest = latestRecord(rows);
    const versionModifiedAt = version?.ModifiedOn ? Date.parse(version.ModifiedOn) : 0;
    if (!latest || latest.decision_c !== 'Verified' || recordTime(latest) < versionModifiedAt) {
      issues.push('The latest first-pass ' + type.toLowerCase() + ' review must be Verified after the source version was last changed.');
      continue;
    }
    primary[type] = new Set([String(getLookupId(latest.reviewer_user_c) || '')].filter(Boolean));
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

  const types = ['Rights', 'Authority', 'Metadata'];
  const currentIndependent = [];
  const currentIndependentReviewers = new Set();
  const versionModifiedAt = version.ModifiedOn ? Date.parse(version.ModifiedOn) : 0;

  for (const type of types) {
    const latestPrimary = latestRecord(verifications.filter((row) => (
      String(getLookupId(row.document_version_c)) === String(version.Id) &&
      row.verification_type_c === type &&
      row.independent_check_c !== true
    )));
    const latestIndependent = latestRecord(verifications.filter((row) => (
      String(getLookupId(row.document_version_c)) === String(version.Id) &&
      row.verification_type_c === type &&
      row.independent_check_c === true
    )));
    const isCurrent = latestIndependent?.decision_c === 'Verified' &&
      recordTime(latestIndependent) >= recordTime(latestPrimary) &&
      recordTime(latestIndependent) >= versionModifiedAt;
    currentIndependent.push({ type, isCurrent });
    if (isCurrent) {
      const id = getLookupId(latestIndependent.reviewer_user_c);
      if (id) currentIndependentReviewers.add(String(id));
    }
  }

  if (currentIndependentReviewers.size > 1) {
    return {
      success: false,
      issues: ['Current independent checks were completed by different reviewers. A single independent reviewer must complete all three checks.']
    };
  }
  if (currentIndependentReviewers.size === 1 && !currentIndependentReviewers.has(String(reviewerId))) {
    return {
      success: false,
      issues: ['A different reviewer has already completed part of the current independent verification. The same reviewer must finish all three checks.']
    };
  }

  const alreadyVerified = (
    version.ingestion_status_c === 'Verified' &&
    document.verification_status_c === 'Verified' &&
    document.ingestion_status_c === 'Complete' &&
    currentIndependent.every((item) => item.isCurrent) &&
    currentIndependentReviewers.has(String(reviewerId))
  );
  if (alreadyVerified) return { success: true, alreadyVerified: true, auditLogged: true };

  const versionResult = await sdk.table('source_document_versions_c').update({
    Id: version.Id,
    rights_status_c: document.rights_status_c,
    ingestion_status_c: 'Verified'
  });
  if (!versionResult.data?.length) {
    return {
      success: false,
      issues: [versionResult.messages?.join('; ') || versionResult.message || 'The source version could not be finalised.']
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
    await sdk.table('source_document_versions_c').update({
      Id: version.Id,
      ingestion_status_c: 'Review'
    });
    return {
      success: false,
      issues: [documentResult.messages?.join('; ') || documentResult.message || 'The parent document could not be finalised. The source version was rolled back to Review.']
    };
  }

  for (const item of currentIndependent) {
    if (item.isCurrent) continue;
    const result = await sdk.table('source_verification_records_c').create({
      Name: 'Independent ' + item.type.toLowerCase() + ' verification · ' + (version.official_title_c || version.Name),
      document_version_c: version.Id,
      verification_type_c: item.type,
      decision_c: 'Verified',
      reviewer_user_c: reviewerId,
      verified_at_c: new Date().toISOString(),
      verification_notes_c: String(checks.notes).trim() + (eligibility.domainIsMatched ? '' : ' Official authority site link to the registered CDN/host was independently confirmed.'),
      independent_check_c: true
    });
    if (!result.data?.length) {
      await Promise.all([
        sdk.table('source_document_versions_c').update({
          Id: version.Id,
          ingestion_status_c: 'Review'
        }),
        sdk.table('source_documents_c').update({
          Id: document.Id,
          verification_status_c: 'Review',
          ingestion_status_c: 'Extracted'
        })
      ]);
      return {
        success: false,
        issues: [result.messages?.join('; ') || result.message || 'Could not save all independent checks. Source status was rolled back to Review; the first-pass review must be repeated before retrying.']
      };
    }
  }

  let auditLogged = false;
  try {
    auditLogged = await createApprovalEvent(reviewerId, version, checks.notes);
  } catch {
    auditLogged = false;
  }

  if (!auditLogged) {
    await Promise.all([
      sdk.table('source_document_versions_c').update({
        Id: version.Id,
        ingestion_status_c: 'Review'
      }),
      sdk.table('source_documents_c').update({
        Id: document.Id,
        verification_status_c: 'Review',
        ingestion_status_c: 'Extracted'
      })
    ]);
    return {
      success: false,
      issues: ['The approval audit could not be recorded. Both source records were rolled back to Review, and first-pass verification must be repeated before retrying.']
    };
  }

  return { success: true, alreadyVerified: false, auditLogged: true, issues: [] };
}
