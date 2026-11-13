import { sdk } from '@/services/sdk';

function getId(value) {
  if (value && typeof value === 'object') return value.Id ?? value.id ?? null;
  return value ?? null;
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

  const documentId = getId(paper.source_document_c);
  if (!documentId) return { success: false, message: 'The paper is not linked to a source document.' };

  const documents = await fetchRows(
    sdk.table('source_documents_c')
      .select(['Id', 'Name', 'rights_status_c', 'verification_status_c', 'ingestion_status_c', 'extracted_page_count_c'])
      .where(window.ApperSDK.CoreSDK.eq('Id', documentId))
      .limit(1, 0)
      .fetch(),
    'source document'
  );
  const document = documents[0];
  if (!document) return { success: false, message: 'The linked source document is unavailable.' };
  if (!['Public', 'Licensed'].includes(document.rights_status_c)) {
    return { success: false, message: 'Source reuse rights are not cleared.' };
  }
  if (document.verification_status_c !== 'Verified' || document.ingestion_status_c !== 'Complete') {
    return { success: false, message: 'Source document rights, authority, metadata and independent verification must be complete first.' };
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

  const extractions = await fetchRows(
    sdk.table('source_extractions_c')
      .select(['Id', 'page_number_c', 'quality_status_c', 'document_version_c'])
      .where(window.ApperSDK.CoreSDK.eq('document_version_c', version.Id))
      .limit(5000, 0)
      .fetch(),
    'page extraction records'
  );
  const expectedPages = Number(document.extracted_page_count_c || 0);
  const pageNumbers = new Set(extractions
    .filter((row) => row.quality_status_c === 'Verified')
    .map((row) => Number(row.page_number_c)));
  if (!expectedPages || pageNumbers.size < expectedPages) {
    return {
      success: false,
      message: 'All PDF pages must have an independently Verified extraction. Expected ' + expectedPages + ' page(s); found ' + pageNumbers.size + '.'
    };
  }
  for (let page = 1; page <= expectedPages; page += 1) {
    if (!pageNumbers.has(page)) {
      return { success: false, message: 'PDF page ' + page + ' has no independently Verified extraction.' };
    }
  }

  if (nextStatus === 'Verified' && !['New', 'Review'].includes(paper.status_c)) {
    return { success: false, message: 'Only New or Review papers can move to Verified.' };
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
    verification_notes_c: 'Historical paper record ' + paper.Id + ' moved to ' + nextStatus + ' after linked source rights, source verification, stored PDF and every page extraction passed. Paper rights were copied from the verified parent source.',
    independent_check_c: true
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
