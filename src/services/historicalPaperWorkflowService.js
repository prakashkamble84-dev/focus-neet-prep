import { sdk } from '@/services/sdk';

function getId(value) {
  if (value && typeof value === 'object') return value.Id ?? value.id ?? null;
  return value ?? null;
}

function timeValue(row) {
  const value = row?.ModifiedOn || row?.CreatedOn || row?.verified_at_c;
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function auditTimeValue(row) {
  const value = row?.CreatedOn || row?.verified_at_c || row?.ModifiedOn;
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function latest(rows) {
  return [...rows].sort((a, b) => auditTimeValue(b) - auditTimeValue(a))[0] || null;
}

async function fetchRows(request, label) {
  const result = await request;
  if (!result.success) throw new Error(result.message || 'Could not load ' + label);
  return result.data || [];
}

async function fetchAllRows(tableName, fields, filter, label) {
  const rows = [];
  let offset = 0;

  while (true) {
    const result = await sdk.table(tableName)
      .select(fields)
      .where(filter)
      .limit(1000, offset)
      .fetch();

    if (!result.success) {
      throw new Error(result.message || 'Could not load ' + label);
    }

    const page = result.data || [];
    rows.push(...page);

    if (result.hasMore === false || page.length < 1000 || !page.length) break;
    if (result.total !== null && result.total !== undefined &&
      Number.isFinite(Number(result.total)) && rows.length >= Number(result.total)) {
      break;
    }

    offset += page.length;
    if (rows.length >= 50000) {
      throw new Error('More than 50,000 ' + label + ' rows. Verification stopped safely.');
    }
  }

  return rows;
}

export async function transitionHistoricalPaper(paper, nextStatus, reviewerId, reviewerProfile) {
  if (!paper?.Id || !reviewerId) {
    return { success: false, message: 'A paper record and signed-in reviewer are required.' };
  }
  if (!['Verified', 'Published'].includes(nextStatus)) {
    return { success: false, message: 'Only the Verified and Published transitions are supported here.' };
  }
  if (nextStatus === 'Published' && paper.status_c !== 'Verified') {
    return { success: false, message: 'A paper must be Verified before publication.' };
  }
  if (nextStatus === 'Verified' && reviewerProfile !== 'AcademicExpert_c') {
    return { success: false, message: 'Only an Academic Expert can verify a historical paper.' };
  }
  if (nextStatus === 'Published' && !['CEO', 'CEO_c', 'Manager', 'Manager_c'].includes(reviewerProfile)) {
    return { success: false, message: 'Only a CEO or Manager can publish an academically verified paper.' };
  }
  if (nextStatus === 'Verified' && !['New', 'Review'].includes(paper.status_c)) {
    return { success: false, message: 'Only New or Review papers can move to Verified.' };
  }

  const documentId = getId(paper.source_document_c);
  if (!documentId) {
    return { success: false, message: 'The paper is not linked to a source document.' };
  }

  const documents = await fetchRows(
    sdk.table('source_documents_c')
      .select([
        'Id',
        'Name',
        'CreatedBy',
        'Owner',
        'ModifiedOn',
        'examination_c',
        'academic_year_c',
        'source_registry_c',
        'official_url_c',
        'document_type_c',
        'source_category_c',
        'rights_status_c',
        'verification_status_c',
        'ingestion_status_c',
        'extracted_page_count_c'
      ])
      .where(window.ApperSDK.CoreSDK.eq('Id', documentId))
      .limit(1, 0)
      .fetch(),
    'source document'
  );

  const document = documents[0];
  if (!document) {
    return { success: false, message: 'The linked source document is unavailable.' };
  }

  const paperExamId = getId(paper.examination_c);
  const documentExamId = getId(document.examination_c);
  if (
    String(getId(paper.source_document_c) || '') !== String(document.Id) ||
    document.document_type_c !== 'Paper' ||
    !['Official', 'Archive'].includes(document.source_category_c) ||
    !/^https:\/\//i.test(String(document.official_url_c || '')) ||
    !paperExamId ||
    !documentExamId ||
    String(paperExamId) !== String(documentExamId) ||
    !Number.isFinite(Number(paper.exam_year_c)) ||
    Number(paper.exam_year_c) !== Number(document.academic_year_c)
  ) {
    return {
      success: false,
      message: 'Historical paper metadata, source type, official provenance, examination and academic year must all match.'
    };
  }

  const authorityId = getId(document.source_registry_c);
  const authorities = authorityId
    ? await fetchRows(
        sdk.table('source_registry_c')
          .select(['Id', 'Name', 'active_c', 'is_authoritative_c', 'official_domain_c'])
          .where(window.ApperSDK.CoreSDK.eq('Id', authorityId))
          .limit(1, 0)
          .fetch(),
        'issuing authority'
      )
    : [];

  const authority = authorities[0];
  if (
    !authority ||
    authority.active_c !== true ||
    authority.is_authoritative_c !== true ||
    !authority.official_domain_c
  ) {
    return {
      success: false,
      message: 'The linked issuing authority must still be active, authoritative and have an official domain.'
    };
  }

  if (!['Public', 'Licensed'].includes(document.rights_status_c)) {
    return { success: false, message: 'Source reuse rights are not cleared.' };
  }
  if (document.verification_status_c !== 'Verified' || document.ingestion_status_c !== 'Complete') {
    return {
      success: false,
      message: 'Source document rights, authority and independent verification must be complete first.'
    };
  }

  const versions = await fetchRows(
    sdk.table('source_document_versions_c')
      .select([
        'Id',
        'Name',
        'ModifiedOn',
        'source_document_c',
        'source_registry_c',
        'document_file_c',
        'rights_status_c',
        'ingestion_status_c',
        'version_status_c'
      ])
      .where(window.ApperSDK.CoreSDK.eq('source_document_c', document.Id))
      .limit(20, 0)
      .fetch(),
    'source document versions'
  );

  const version = versions.find((item) => (
    item.version_status_c === 'Current' &&
    String(getId(item.source_document_c) || '') === String(document.Id) &&
    String(getId(item.source_registry_c) || '') === String(authority.Id) &&
    ['Public', 'Licensed'].includes(item.rights_status_c) &&
    item.rights_status_c === document.rights_status_c &&
    item.ingestion_status_c === 'Verified' &&
    Array.isArray(item.document_file_c) &&
    item.document_file_c.length > 0
  ));

  if (!version) {
    return {
      success: false,
      message: 'No current source version has a stored PDF, matching rights and authority decisions, and Verified ingestion status.'
    };
  }

  const verifications = await fetchAllRows(
    'source_verification_records_c',
    [
      'Id',
      'Name',
      'CreatedOn',
      'document_version_c',
      'verification_type_c',
      'decision_c',
      'reviewer_user_c',
      'verified_at_c',
      'independent_check_c',
      'verification_notes_c'
    ],
    window.ApperSDK.CoreSDK.eq('document_version_c', version.Id),
    'source verification records'
  );

  if (nextStatus === 'Verified') {
    const primaryReviewerIds = new Set();
    const independentReviewerIds = new Set();

    for (const type of ['Rights', 'Authority', 'Metadata']) {
      const primary = latest(verifications.filter((row) => (
        row.verification_type_c === type &&
        row.independent_check_c !== true
      )));
      const independent = latest(verifications.filter((row) => (
        row.verification_type_c === type &&
        row.independent_check_c === true
      )));

      if (
        !primary ||
        primary.decision_c !== 'Verified' ||
        !independent ||
        independent.decision_c !== 'Verified'
      ) {
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
      const latestSourceEdit = Math.max(timeValue(version), timeValue(document));
      if (auditTimeValue(primary) <= latestSourceEdit || auditTimeValue(independent) <= latestSourceEdit) {
        return {
          success: false,
          message: 'Source ' + type.toLowerCase() + ' reviews must be newer than the last source version or parent-document edit.'
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

    if (
      uploaderIds.includes(String(reviewerId)) ||
      primaryReviewerIds.has(String(reviewerId)) ||
      independentReviewerIds.has(String(reviewerId))
    ) {
      return {
        success: false,
        message: 'Paper verification must be completed by an Academic Expert who did not upload the paper or perform source verification.'
      };
    }

    const extractions = await fetchAllRows(
      'source_extractions_c',
      [
        'Id',
        'CreatedOn',
        'ModifiedOn',
        'CreatedBy',
        'Owner',
        'ModifiedBy',
        'page_number_c',
        'quality_status_c',
        'document_version_c'
      ],
      window.ApperSDK.CoreSDK.eq('document_version_c', version.Id),
      'page extraction records'
    );

    const expectedPages = Number(document.extracted_page_count_c || 0);
    if (!Number.isInteger(expectedPages) || expectedPages < 1) {
      return {
        success: false,
        message: 'The source document has no extracted page count. Re-run page extraction first.'
      };
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
        message: 'Every PDF page must have a current extraction record. Expected ' +
          expectedPages + ' page(s); found ' + latestByPage.size + '.'
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
      const pageAudit = verifications.find((audit) => (
        audit.verification_type_c === 'Academic' &&
        audit.decision_c === 'Verified' &&
        audit.independent_check_c === true &&
        String(getId(audit.reviewer_user_c) || '') === String(reviewerOfPage || '') &&
        String(audit.verification_notes_c || '').includes('Extraction record ' + row.Id + '.') &&
        auditTimeValue(audit) > timeValue(row)
      ));

      if (
        !extractorId ||
        !reviewerOfPage ||
        String(extractorId) === String(reviewerOfPage) ||
        !pageAudit
      ) {
        return {
          success: false,
          message: 'PDF page ' + page + ' must have an independent review audit by someone other than its extractor.'
        };
      }
    }
  }

  if (nextStatus === 'Published') {
    const academicVerification = latest(verifications.filter((row) => (
      row.verification_type_c === 'Academic' &&
      row.decision_c === 'Verified' &&
      row.independent_check_c !== true &&
      String(row.Name || '').startsWith('Historical paper Verified ·')
    )));

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
    decision_c: 'Verified',
    reviewer_user_c: reviewerId,
    verified_at_c: new Date().toISOString(),
    verification_notes_c: 'Historical paper ' + paper.Id + ' moved to ' + nextStatus +
      '. Audit decision Verified records that the source and academic evidence gate passed. ' +
      'Source rights, first-pass and independent source checks, stored PDF, and every current page extraction were validated before the state transition.',
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
