import { sdk } from '@/services/sdk';

function getId(value) {
  if (value && typeof value === 'object') return value.Id ?? value.id ?? null;
  return value ?? null;
}

function timeValue(row) {
  const value = row?.verified_at_c || row?.ModifiedOn || row?.CreatedOn;
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function latest(rows) {
  return [...rows].sort((a, b) => timeValue(b) - timeValue(a))[0] || null;
}

async function fetchRows(request, label) {
  const result = await request;
  if (!result.success) throw new Error(result.message || 'Could not load ' + label);
  return result.data || [];
}

export async function transitionHistoricalPaper(paper, nextStatus, reviewerId) {
  if (!paper?.Id || !reviewerId) {
    return { success: false, message: 'A paper record and signed-in reviewer are required.' };
  }
  if (!['Verified', 'Published'].includes(nextStatus)) {
    return { success: false, message: 'Only the Verified and Published transitions are supported here.' };
  }
  if (nextStatus === 'Published' && paper.status_c !== 'Verified') {
    return { success: false, message: 'A paper must be Verified before publication.' };
  }
  if (nextStatus === 'Verified' && !['New', 'Review'].includes(paper.status_c)) {
    return { success: false, message: 'Only New or Review papers can move to Verified.' };
  }

  const documentId = getId(paper.source_document_c);
  if (!documentId) return { success: false, message: 'The paper is not linked to a source document.' };

  const [documents] = await Promise.all([
    fetchRows(
      sdk.table('source_documents_c')
        .select(['Id', 'Name', 'CreatedBy', 'Owner', 'rights_status_c', 'verification_status_c', 'ingestion_status_c', 'extracted_page_count_c'])
        .where(window.ApperSDK.CoreSDK.eq('Id', documentId))
        .limit(1, 0)
        .fetch(),
      'source document'
    )
  ]);
  const document = documents[0];
  if (!document) return { success: false, message: 'The linked source document is unavailable.' };
  if (!['Public', 'Licensed'].includes(document.rights_status_c)) {
    return { success: false, message: 'Source reuse rights are not cleared.' };
  }
  if (document.verification_status_c !== 'Verified' || document.ingestion_status_c !== 'Complete') {
    return { success: false, message: 'Source document rights, authority and independent verification must be complete first.' };
  }

  const versions = await fetchRows(
    sdk.table('source_document_versions_c')
      .select(['Id', 'Name', 'source_document_c', 'document_file_c', 'rights_status_c', 'ingestion_status_c', 'version_status_c'])
      .where(window.ApperSDK.CoreSDK.eq('source_document_c', document.Id))
      .limit(20, 0)
      .fetch(),
    'source document versions'
  );
  const version = versions.find((item) => (
    item.version_status_c === 'Current' &&
    ['Public', 'Licensed'].includes(item.rights_status_c) &&
    item.rights_status_c === document.rights_status_c &&
    item.ingestion_status_c === 'Verified' &&
    Array.isArray(item.document_file_c) && item.document_file_c.length > 0
  ));
  if (!version) {
    return { success: false, message: 'No current source version has a stored PDF, matching rights decision and Verified ingestion status.' };
  }

  const verifications = await fetchRows(
    sdk.table('source_verification_records_c')
      .select(['Id', 'Name', 'document_version_c', 'verification_type_c', 'decision_c', 'reviewer_user_c', 'verified_at_c', 'independent_check_c'])
      .where(window.ApperSDK.CoreSDK.eq('document_version_c', version.Id))
      .limit(1000, 0)
      .fetch(),
    'source verification records'
  );

  if (nextStatus === 'Verified') {
    const primaryReviewerIds = new Set();
    const independentReviewerIds = new Set();
    for (const type of ['Rights', 'Authority', 'Metadata']) {
      const primary = latest(verifications.filter((row) =>
        row.verification_type_c === type && row.independent_check_c !== true
      ));
      const independent = latest(verifications.filter((row) =>
        row.verification_type_c === type && row.independent_check_c === true
      ));
      if (!primary || primary.decision_c !== 'Verified' ||
        !independent || independent.decision_c !== 'Verified') {
        return {
          success: false,
          message: 'Source ' + type.toLowerCase() + ' verification must pass in both first-pass and independent review.'
        };
      }
      const firstId = getId(primary.reviewer_user_c);
      const secondId = getId(independent.reviewer_user_c);
      if (!firstId || !secondId || String(firstId) === String(secondId)) {
        return {
          success: false,
          message: 'Source first-pass and independent ' + type.toLowerCase() + ' reviews must be completed by different people.'
        };
      }
      primaryReviewerIds.add(String(firstId));
      independentReviewerIds.add(String(secondId));
    }

    if (independentReviewerIds.size !== 1) {
      return {
        success: false,
        message: 'The same independent reviewer must complete all three source verification checks.'
      };
    }

    const uploaderIds = [
      getId(paper.CreatedBy) || getId(paper.Owner),
      getId(document.CreatedBy) || getId(document.Owner)
    ].filter(Boolean).map(String);

    if (uploaderIds.includes(String(reviewerId)) ||
      primaryReviewerIds.has(String(reviewerId)) ||
      independentReviewerIds.has(String(reviewerId))) {
      return {
        success: false,
        message: 'Paper verification must be completed by an Academic Expert who did not upload the paper or perform source verification.'
      };
    }

    const extractions = await fetchRows(
      sdk.table('source_extractions_c')
        .select(['Id', 'CreatedOn', 'ModifiedOn', 'CreatedBy', 'Owner', 'ModifiedBy', 'page_number_c', 'quality_status_c', 'document_version_c'])
        .where(window.ApperSDK.CoreSDK.eq('document_version_c', version.Id))
        .limit(5000, 0)
        .fetch(),
      'page extraction records'
    );

    const expectedPages = Number(document.extracted_page_count_c || 0);
    if (!Number.isInteger(expectedPages) || expectedPages < 1) {
      return { success: false, message: 'The source document has no verified page count. Re-run page extraction first.' };
    }

    const latestByPage = new Map();
    for (const row of extractions) {
      const page = Number(row.page_number_c);
      if (!Number.isInteger(page) || page < 1 || page > expectedPages) continue;
      const current = latestByPage.get(page);
      if (!current || timeValue(row) > timeValue(current)) {
        latestByPage.set(page, row);
      }
    }

    if (latestByPage.size !== expectedPages) {
      return {
        success: false,
        message: 'Every PDF page must have a current extraction record. Expected ' + expectedPages + ' page(s); found ' + latestByPage.size + '.'
      };
    }

    for (let page = 1; page <= expectedPages; page += 1) {
      const row = latestByPage.get(page);
      if (!row || row.quality_status_c !== 'Verified') {
        return {
          success: false,
          message: 'PDF page ' + page + ' does not have a current independently Verified extraction.'
        };
      }
      const extractorId = getId(row.CreatedBy) || getId(row.Owner);
      const reviewerOfPage = getId(row.ModifiedBy);
      if (!extractorId || !reviewerOfPage || String(extractorId) === String(reviewerOfPage)) {
        return {
          success: false,
          message: 'PDF page ' + page + ' must be independently reviewed by someone other than its extractor.'
        };
      }
    }
  }

  if (nextStatus === 'Published') {
    const academicVerification = latest(verifications.filter((row) =>
      row.verification_type_c === 'Academic' &&
      row.decision_c === 'Verified' &&
      row.independent_check_c !== true
    ));
    if (!academicVerification ||
      String(getId(academicVerification.reviewer_user_c) || '') === String(reviewerId)) {
      return {
        success: false,
        message: 'Paper publication must be approved by a different authorised person from the Academic Expert who verified it.'
      };
    }
  }

  const previousStatus = paper.status_c;
  const previousRights = paper.rights_status_c;
  const update = await sdk.table('historical_papers_c').update({
    Id: paper.Id,
    status_c: nextStatus,
    rights_status_c: document.rights_status_c
  });
  if (!update.data?.length) {
    return {
      success: false,
      message: update.messages?.join('; ') || update.message || 'Paper status could not be updated.'
    };
  }

  const audit = await sdk.table('source_verification_records_c').create({
    Name: 'Historical paper ' + nextStatus + ' · ' + paper.Name,
    document_version_c: version.Id,
    verification_type_c: 'Academic',
    decision_c: nextStatus,
    reviewer_user_c: reviewerId,
    verified_at_c: new Date().toISOString(),
    verification_notes_c: 'Historical paper ' + paper.Id + ' moved to ' + nextStatus + '. Source rights, first-pass and independent source checks, stored PDF, and every current page extraction were validated before the state transition.',
    independent_check_c: false
  });

  if (!audit.data?.length) {
    await sdk.table('historical_papers_c').update({
      Id: paper.Id,
      status_c: previousStatus,
      rights_status_c: previousRights || 'Unknown'
    });
    return {
      success: false,
      message: audit.messages?.join('; ') || audit.message || 'Approval audit could not be recorded. Paper status was rolled back.'
    };
  }

  return { success: true, auditLogged: true };
}
