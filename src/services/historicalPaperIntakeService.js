import { sdk } from '@/services/sdk';
import { replaceSourcePdf } from '@/services/sourceUploadService';

async function fetchLookupRows(request, tableName) {
  const result = await request;
  if (!result.success) {
    throw new Error(result.message || 'Could not load ' + tableName);
  }
  return result.data || [];
}

export async function fetchHistoricalPaperIntakeLookups() {
  const [examinations, authorities] = await Promise.all([
    fetchLookupRows(
      sdk.table('examinations_c')
        .select(['Id', 'Name', 'code_c', 'exam_type_c', 'active_c'])
        .limit(100, 0)
        .fetch(),
      'examinations_c'
    ),
    fetchLookupRows(
      sdk.table('source_registry_c')
        .select(['Id', 'Name', 'source_code_c', 'organisation_name_c', 'official_domain_c', 'website_url_c', 'active_c', 'is_authoritative_c'])
        .limit(200, 0)
        .fetch(),
      'source_registry_c'
    )
  ]);

  return {
    examinations: examinations.filter((item) => item.active_c !== false),
    authorities: authorities.filter((item) => item.active_c === true && item.is_authoritative_c === true)
  };
}

async function createOne(tableName, payload, label) {
  const result = await sdk.table(tableName).create(payload);
  if (!result.data?.length) {
    throw new Error(result.messages?.join('; ') || result.message || label + ' could not be created.');
  }
  return result.data[0];
}

async function saveBatch(tableName, rows, label) {
  const saved = [];
  for (let index = 0; index < rows.length; index += 25) {
    const batch = rows.slice(index, index + 25);
    const result = await sdk.table(tableName).create(batch);
    if (result.messages?.length) {
      throw new Error(label + ' batch ' + (Math.floor(index / 25) + 1) + ': ' + result.messages.join('; '));
    }
    saved.push(...(result.data || []));
    if (result.data?.length !== batch.length || result.partial) {
      throw new Error(label + ' was only partially saved. ' + saved.length + ' of ' + rows.length + ' rows were saved.');
    }
  }
  return saved;
}

function makeQuestionRows(candidates, paper, document, pageConfidence) {
  return candidates.map((candidate) => ({
    Name: paper.Name + ' · Q' + candidate.questionNumber,
    examination_c: paper.examination_c,
    source_type_c: 'Historical',
    question_type_c: candidate.questionType,
    question_body_c: candidate.body,
    status_c: 'Review',
    historical_year_c: paper.exam_year_c,
    historical_session_c: paper.session_c || '',
    historical_question_number_c: String(candidate.questionNumber),
    historical_page_number_c: candidate.pageNumber,
    historical_paper_c: paper.Id,
    source_document_c: document.Id,
    rights_status_c: document.rights_status_c || 'Unknown',
    extraction_confidence_c: pageConfidence.get(candidate.pageNumber) ?? 0,
    extraction_status_c: 'Review',
    answer_validation_status_c: 'Pending',
    rights_notes_c: 'Imported from a user-supplied historical paper. Source reuse rights and answer key validation remain pending.'
  }));
}

export async function registerHistoricalPaperBundle({
  examination,
  authority,
  academicYear,
  session,
  paperCode,
  paperType,
  sourceCategory,
  officialUrl,
  file,
  pages,
  selectedCandidates,
  uploaderId
}) {
  if (!examination?.Id || !authority?.Id || !uploaderId) {
    throw new Error('Examination, issuing authority and signed-in uploader are required.');
  }
  if (!Number.isInteger(Number(academicYear)) || Number(academicYear) < 1997 || Number(academicYear) > new Date().getFullYear()) {
    throw new Error('Exam year must be between 1997 and the current year.');
  }
  if (!/^https:\/\//i.test(String(officialUrl || '').trim())) {
    throw new Error('Record an HTTPS URL for the official source page or PDF.');
  }
  if (!file || !Array.isArray(pages) || pages.length === 0) {
    throw new Error('Analyse the PDF before saving the paper record.');
  }
  if (!String(paperCode || '').trim()) {
    throw new Error('Paper code is required.');
  }

  const { eq } = window.ApperSDK.CoreSDK;
  const duplicate = await sdk.table('historical_papers_c')
    .select(['Id', 'Name', 'paper_code_c', 'exam_year_c'])
    .where(eq('paper_code_c', String(paperCode).trim()))
    .limit(1, 0)
    .fetch();
  if (!duplicate.success) {
    throw new Error(duplicate.message || 'Could not check for duplicate paper codes.');
  }
  if (duplicate.data?.length) {
    throw new Error('Paper code already exists. Use a unique code for each exam session or paper slot.');
  }

  let storedFile;
  let sourceDocument;
  let sourceVersion;
  let paper;

  try {
    storedFile = await sdk.storage.upload(file);
    if (!storedFile?.Id) {
      throw new Error('The PDF upload did not return a stored file record.');
    }

    const paperName = [
      examination.Name,
      Number(academicYear),
      String(session || '').trim(),
      String(paperCode).trim()
    ].filter(Boolean).join(' · ');

    sourceDocument = await createOne('source_documents_c', {
      Name: paperName + ' · source PDF',
      examination_c: examination.Id,
      source_registry_c: authority.Id,
      issuing_authority_c: authority.organisation_name_c || authority.Name,
      source_category_c: sourceCategory,
      document_type_c: 'Paper',
      official_url_c: String(officialUrl).trim(),
      academic_year_c: Number(academicYear),
      document_version_c: String(academicYear),
      rights_status_c: 'Unknown',
      verification_status_c: 'Review',
      ingestion_status_c: 'Queued',
      review_notes_c: 'Historical paper PDF registered. Confirm origin, document identity and reuse rights, then complete first-pass and independent source verification.'
    }, 'Source document');

    sourceVersion = await createOne('source_document_versions_c', {
      Name: paperName + ' · PDF',
      source_document_c: sourceDocument.Id,
      source_registry_c: authority.Id,
      version_label_c: String(academicYear) + (session ? ' · ' + session : ''),
      official_title_c: paperName,
      document_url_c: String(officialUrl).trim(),
      mime_type_c: 'application/pdf',
      rights_status_c: 'Unknown',
      rights_notes_c: 'Reuse rights are unknown. Do not redistribute until the authorised source review is complete.',
      ingestion_status_c: 'Discovered',
      version_status_c: 'Current',
      academic_year_c: Number(academicYear),
      change_summary_c: 'Historical exam paper uploaded for page-level extraction and academic review.'
    }, 'Source document version');

    const uploadResult = await replaceSourcePdf({
      version: sourceVersion,
      document: sourceDocument,
      files: [storedFile],
      reviewerId: uploaderId
    });

    if (!uploadResult.success) {
      throw new Error('PDF is stored but source registration is blocked: ' + uploadResult.message);
    }

    paper = await createOne('historical_papers_c', {
      Name: paperName,
      examination_c: examination.Id,
      source_document_c: sourceDocument.Id,
      exam_year_c: Number(academicYear),
      session_c: String(session || '').trim(),
      paper_code_c: String(paperCode).trim(),
      paper_type_c: paperType,
      rights_status_c: 'Unknown',
      status_c: 'New',
      review_notes_c: 'PDF stored and page extraction completed. Paper stays New until source rights, authority, metadata and every page are independently verified.'
    }, 'Historical paper');

    const extractionRows = pages.map((page) => ({
      Name: 'Page ' + page.pageNumber + ' · ' + (page.contentKind || 'Text'),
      document_version_c: sourceVersion.Id,
      page_number_c: page.pageNumber,
      section_title_c: 'Historical paper · page ' + page.pageNumber,
      content_kind_c: page.contentKind,
      extraction_method_c: page.method,
      extracted_text_c: page.text || '[No readable text extracted from this page]',
      confidence_c: Number(page.confidence || 0),
      image_count_c: Number(page.imageCount || 0),
      equation_count_c: Number(page.equationCount || 0),
      quality_status_c: 'Review',
      reviewer_notes_c: page.reviewerNotes + ' OCR and diagram interpretations require human review.'
    }));

    const savedExtractions = await saveBatch('source_extractions_c', extractionRows, 'Page extraction records');

    const confidenceAverage = pages.reduce((sum, page) => sum + Number(page.confidence || 0), 0) / pages.length;
    const parentUpdate = await sdk.table('source_documents_c').update({
      Id: sourceDocument.Id,
      extracted_page_count_c: pages.length,
      extraction_confidence_c: confidenceAverage,
      ingestion_status_c: 'Extracted',
      extracted_text_c: 'Page-level extraction records are stored in source_extractions_c. Review each page record before source verification.'
    });
    if (!parentUpdate.data?.length) {
      throw new Error(parentUpdate.messages?.join('; ') || 'Page extraction was saved, but the source document summary could not be updated.');
    }

    const versionUpdate = await sdk.table('source_document_versions_c').update({
      Id: sourceVersion.Id,
      ingestion_status_c: 'Extracted'
    });
    if (!versionUpdate.data?.length) {
      throw new Error(versionUpdate.messages?.join('; ') || 'Page extraction was saved, but the source version could not be marked Extracted.');
    }

    const confidenceByPage = new Map(pages.map((page) => [page.pageNumber, Number(page.confidence || 0)]));
    const questionRows = makeQuestionRows(selectedCandidates || [], paper, sourceDocument, confidenceByPage);
    const savedQuestions = questionRows.length
      ? await saveBatch('questions_c', questionRows, 'Historical question drafts')
      : [];

    return {
      success: true,
      paper,
      sourceDocument,
      sourceVersion,
      pageCount: savedExtractions.length,
      questionCount: savedQuestions.length,
      note: 'Paper and question records remain in review states. Page verification, source rights approval and answer validation are still required.'
    };
  } catch (error) {
    const completed = {
      sourceDocumentId: sourceDocument?.Id || null,
      sourceVersionId: sourceVersion?.Id || null,
      paperId: paper?.Id || null,
      storedFileId: storedFile?.Id || null
    };
    const wrapped = new Error(error.message + ' Partial records, if any, were retained for recovery: ' + JSON.stringify(completed));
    wrapped.partial = completed;
    throw wrapped;
  }
}
