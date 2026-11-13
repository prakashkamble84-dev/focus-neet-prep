import { sdk } from '@/services/sdk';

function getId(value) {
  if (value && typeof value === 'object') {
    return value.Id ?? value.id ?? value.value ?? null;
  }
  return value ?? null;
}

function getTime(row) {
  const value = row?.reviewed_at_c || row?.CreatedOn;
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function prefix(action) {
  return 'Action: ' + action + ' verification';
}

function latestAction(rows, action) {
  const marker = prefix(action);
  return rows
    .filter((row) => String(row.review_notes_c || '').startsWith(marker))
    .sort((a, b) => getTime(b) - getTime(a))[0] || null;
}

async function readOne(table, id, fields, label) {
  if (!id) return null;
  const result = await sdk.table(table).select(fields).get(id);
  if (!result.success || !result.data) {
    throw new Error(result.message || label + ' could not be loaded.');
  }
  return result.data;
}

async function readRows(request, label) {
  const result = await request;
  if (!result.success) throw new Error(result.message || label + ' could not be loaded.');
  return result.data || [];
}

async function writeReview(question, reviewerId, type, status, action, notes) {
  const result = await sdk.table('question_reviews_c').create({
    Name: 'Historical question ' + action.toLowerCase() + ' · ' + question.Name,
    question_c: question.Id,
    review_type_c: type,
    review_status_c: status,
    reviewer_user_c: reviewerId,
    reviewed_at_c: new Date().toISOString(),
    review_notes_c: prefix(action) + ' | ' + String(notes || '').trim()
  });

  if (!result.data?.length) {
    throw new Error(result.messages?.join('; ') || result.message || 'The review record could not be saved.');
  }
  return result.data[0];
}

export async function fetchHistoricalQuestionReviewData(questionId) {
  const question = await readOne('questions_c', questionId, [
    'Id',
    'Name',
    'CreatedBy',
    'Owner',
    'question_body_c',
    'source_type_c',
    'status_c',
    'question_type_c',
    'answer_key_c',
    'solution_c',
    'difficulty_c',
    'historical_year_c',
    'historical_session_c',
    'historical_question_number_c',
    'historical_page_number_c',
    'question_family_code_c',
    'concept_dna_c',
    'skill_dna_c',
    'approach_pattern_c',
    'recurring_pattern_group_c',
    'concept_combination_c',
    'concept_count_c',
    'extraction_confidence_c',
    'extraction_status_c',
    'answer_validation_status_c',
    'rights_status_c',
    'rights_notes_c',
    'historical_paper_c',
    'source_document_c',
    'examination_c'
  ], 'Historical question');

  if (question.source_type_c !== 'Historical') {
    throw new Error('This review page only handles historical questions.');
  }

  const paperId = getId(question.historical_paper_c);
  const documentId = getId(question.source_document_c);
  const [paper, sourceDocument, reviews, options] = await Promise.all([
    readOne('historical_papers_c', paperId, [
      'Id',
      'Name',
      'CreatedBy',
      'Owner',
      'examination_c',
      'source_document_c',
      'exam_year_c',
      'session_c',
      'status_c',
      'rights_status_c',
      'paper_code_c'
    ], 'Historical paper'),
    readOne('source_documents_c', documentId, [
      'Id',
      'Name',
      'official_url_c',
      'document_type_c',
      'source_category_c',
      'rights_status_c',
      'verification_status_c',
      'ingestion_status_c'
    ], 'Source document'),
    readRows(
      sdk.table('question_reviews_c')
        .select(['Id', 'Name', 'question_c', 'review_type_c', 'review_status_c', 'reviewer_user_c', 'reviewed_at_c', 'review_notes_c'])
        .where(window.ApperSDK.CoreSDK.eq('question_c', question.Id))
        .limit(200, 0)
        .fetch(),
      'Question reviews'
    ),
    readRows(
      sdk.table('question_options_c')
        .select(['Id', 'Name', 'question_c', 'option_key_c', 'option_text_c', 'sequence_c', 'is_correct_c', 'status_c'])
        .where(window.ApperSDK.CoreSDK.eq('question_c', question.Id))
        .limit(30, 0)
        .fetch(),
      'Question options'
    )
  ]);

  const paperSourceId = getId(paper?.source_document_c);
  const questionSourceId = getId(question.source_document_c);
  return {
    question,
    paper,
    sourceDocument,
    reviews,
    options,
    creatorId: getId(question.CreatedBy) || getId(question.Owner),
    sourceMatches: Boolean(paperSourceId && questionSourceId && String(paperSourceId) === String(questionSourceId)),
    latestExtractionReview: latestAction(reviews, 'extraction'),
    latestAnswerReview: latestAction(reviews, 'answer'),
    latestCopyrightReview: latestAction(reviews, 'copyright'),
    latestAcademicReview: latestAction(reviews, 'academic')
  };
}

export async function recordHistoricalQuestionReview({
  question,
  paper,
  sourceDocument,
  reviews = [],
  options = [],
  creatorId,
  reviewerId,
  reviewerProfile,
  action,
  decision = 'Approved',
  answerKey,
  solution,
  notes
}) {
  const academicProfiles = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'];
  const allowedReviewers = [...academicProfiles, 'ContentReviewer_c'];
  const canEditQuestion = academicProfiles.includes(reviewerProfile);

  if (!question?.Id || !reviewerId) {
    return { success: false, message: 'A historical question and signed-in reviewer are required.' };
  }
  if (!allowedReviewers.includes(reviewerProfile)) {
    return { success: false, message: 'Your profile cannot review historical questions.' };
  }
  if (!['Approved', 'Rejected', 'Changes'].includes(decision)) {
    return { success: false, message: 'Choose an available review decision.' };
  }
  if (!String(notes || '').trim()) {
    return { success: false, message: 'Review notes are required for an auditable decision.' };
  }
  if (String(creatorId || '') === String(reviewerId)) {
    return { success: false, message: 'The person who created this question cannot independently approve its extraction, answer, rights or academic accuracy.' };
  }
  if (['Verified', 'Published', 'Rejected'].includes(question.status_c) && action !== 'publish') {
    return { success: false, message: 'This question is not in an editable review state.' };
  }

  const paperSourceId = getId(paper?.source_document_c);
  const questionSourceId = getId(question.source_document_c);
  const sourceMatches = Boolean(
    paper && sourceDocument && paperSourceId && questionSourceId &&
    String(paperSourceId) === String(questionSourceId) &&
    String(sourceDocument.Id) === String(questionSourceId)
  );
  if (!sourceMatches) {
    return { success: false, message: 'The question, paper and source document links do not match.' };
  }

  if (action === 'extraction') {
    if (decision === 'Approved' && String(question.question_body_c || '').trim().length < 20) {
      return { success: false, message: 'The extracted question text is missing or too short to verify.' };
    }
    await writeReview(question, reviewerId, 'Academic', decision, 'extraction', notes);
    return {
      success: true,
      statusUpdated: false,
      message: 'Independent extraction review recorded. An Academic Expert must apply this decision to the question record.'
    };
  }

  if (!canEditQuestion) {
    return { success: false, message: 'Only CEO, Manager and Academic Expert profiles can update question answer, rights and publication status.' };
  }

  const previous = {
    status_c: question.status_c,
    extraction_status_c: question.extraction_status_c,
    answer_validation_status_c: question.answer_validation_status_c,
    answer_key_c: question.answer_key_c,
    solution_c: question.solution_c,
    rights_status_c: question.rights_status_c,
    rights_notes_c: question.rights_notes_c
  };

  let update = null;
  let reviewType = 'Academic';
  let auditAction = action;

  if (action === 'applyExtraction') {
    const extractionReview = latestAction(reviews, 'extraction');
    if (!extractionReview || extractionReview.review_status_c !== 'Approved' ||
      String(getId(extractionReview.reviewer_user_c) || '') === String(reviewerId)) {
      return { success: false, message: 'A different reviewer must first approve the extracted question text.' };
    }
    update = { Id: question.Id, extraction_status_c: 'Verified', status_c: 'Review' };
    auditAction = 'extraction application';
  } else if (action === 'answer') {
    reviewType = 'Answer';
    if (question.extraction_status_c !== 'Verified') {
      return { success: false, message: 'Extraction must be independently verified before the answer key can be validated.' };
    }
    if (decision === 'Approved' && !String(answerKey || '').trim()) {
      return { success: false, message: 'Enter the answer key before approving answer validation.' };
    }
    if (decision === 'Approved' && ['MCQ', 'Multi'].includes(question.question_type_c)) {
      const availableOptions = options.filter((option) => option.status_c !== 'Retired');
      if (availableOptions.length < 2) {
        return { success: false, message: 'This multiple-choice question has fewer than two extracted options. Correct the option extraction before answer validation.' };
      }
      const selectedKeys = String(answerKey || '')
        .toUpperCase()
        .split(/[,;+\\s]+/)
        .map((key) => key.trim())
        .filter(Boolean);
      const availableKeys = new Set(availableOptions.map((option) => String(option.option_key_c || '').toUpperCase()));
      if (!selectedKeys.length || selectedKeys.some((key) => !availableKeys.has(key))) {
        return { success: false, message: 'The answer key must refer only to extracted option labels.' };
      }
      if (question.question_type_c === 'MCQ' && selectedKeys.length !== 1) {
        return { success: false, message: 'A single-correct MCQ must have exactly one answer option.' };
      }
      if (new Set(selectedKeys).size !== selectedKeys.length) {
        return { success: false, message: 'The answer key contains duplicate option labels.' };
      }
    }
    update = {
      Id: question.Id,
      answer_key_c: String(answerKey || '').trim(),
      solution_c: String(solution || '').trim(),
      answer_validation_status_c: decision === 'Approved' ? 'Verified' : decision === 'Rejected' ? 'Rejected' : 'Pending',
      status_c: 'Review'
    };
  } else if (action === 'copyright') {
    reviewType = 'Copyright';
    if (decision === 'Approved' && (
      !['Public', 'Licensed'].includes(sourceDocument.rights_status_c) ||
      sourceDocument.verification_status_c !== 'Verified' ||
      sourceDocument.ingestion_status_c !== 'Complete'
    )) {
      return { success: false, message: 'The parent source must have independently verified rights and complete ingestion before this question’s reuse can be approved.' };
    }
    update = {
      Id: question.Id,
      rights_status_c: decision === 'Approved' ? sourceDocument.rights_status_c : decision === 'Rejected' ? 'Restricted' : 'Review',
      rights_notes_c: String(notes).trim(),
      status_c: 'Review'
    };
  } else if (action === 'academic') {
    const extractionReview = latestAction(reviews, 'extraction');
    const answerReview = latestAction(reviews, 'answer');
    const copyrightReview = latestAction(reviews, 'copyright');

    if (decision === 'Approved') {
      if (!extractionReview || extractionReview.review_status_c !== 'Approved' ||
        String(getId(extractionReview.reviewer_user_c) || '') === String(reviewerId) ||
        question.extraction_status_c !== 'Verified') {
        return { success: false, message: 'An independent extraction reviewer must approve the text, then an Academic Expert must apply that approval.' };
      }
      if (!answerReview || answerReview.review_status_c !== 'Approved' ||
        String(getId(answerReview.reviewer_user_c) || '') === String(reviewerId) ||
        question.answer_validation_status_c !== 'Verified') {
        return { success: false, message: 'A separate answer reviewer must validate the answer key before academic verification.' };
      }
      if (!copyrightReview || copyrightReview.review_status_c !== 'Approved' ||
        String(getId(copyrightReview.reviewer_user_c) || '') === String(reviewerId) ||
        !['Public', 'Licensed'].includes(question.rights_status_c) ||
        question.rights_status_c !== sourceDocument.rights_status_c) {
        return { success: false, message: 'A separate copyright review and matching source rights decision are required.' };
      }
      if (sourceDocument.verification_status_c !== 'Verified' || sourceDocument.ingestion_status_c !== 'Complete') {
        return { success: false, message: 'The source document must be independently verified and fully ingested.' };
      }
      update = { Id: question.Id, status_c: 'Verified' };
    } else {
      update = { Id: question.Id, status_c: decision === 'Rejected' ? 'Rejected' : 'Review' };
    }
  } else if (action === 'publish') {
    reviewType = 'Academic';
    auditAction = 'publish';
    const academicReview = latestAction(reviews, 'academic');
    if (question.status_c !== 'Verified' ||
      paper.status_c !== 'Published' ||
      question.extraction_status_c !== 'Verified' ||
      question.answer_validation_status_c !== 'Verified' ||
      !['Public', 'Licensed'].includes(question.rights_status_c) ||
      question.rights_status_c !== sourceDocument.rights_status_c ||
      sourceDocument.verification_status_c !== 'Verified' ||
      sourceDocument.ingestion_status_c !== 'Complete' ||
      !academicReview ||
      academicReview.review_status_c !== 'Approved' ||
      String(getId(academicReview.reviewer_user_c) || '') === String(reviewerId)
    ) {
      return {
        success: false,
        message: 'Question publication requires a Published paper, verified extraction, validated answer, matching cleared rights, a fully verified source, and academic approval by a different reviewer.'
      };
    }
    update = { Id: question.Id, status_c: 'Published' };
  } else {
    return { success: false, message: 'Unsupported historical question review action.' };
  }

  const result = await sdk.table('questions_c').update(update);
  if (!result.data?.length) {
    return {
      success: false,
      message: result.messages?.join('; ') || result.message || 'Question update failed.'
    };
  }

  const changedOptions = [];
  try {
    if (action === 'answer' && ['MCQ', 'Multi'].includes(question.question_type_c)) {
      const selectedKeys = decision === 'Approved'
        ? new Set(String(answerKey || '').toUpperCase().split(/[,;+\\s]+/).map((key) => key.trim()).filter(Boolean))
        : new Set();
      for (const option of options.filter((row) => row.status_c !== 'Retired')) {
        const optionUpdate = await sdk.table('question_options_c').update({
          Id: option.Id,
          is_correct_c: selectedKeys.has(String(option.option_key_c || '').toUpperCase())
        });
        if (!optionUpdate.data?.length) {
          throw new Error(optionUpdate.messages?.join('; ') || optionUpdate.message || 'An answer option could not be updated.');
        }
        changedOptions.push({
          Id: option.Id,
          is_correct_c: option.is_correct_c ?? false,
          status_c: option.status_c
        });
      }
    }

    if (action === 'publish') {
      for (const option of options.filter((row) => row.status_c !== 'Retired')) {
        const optionUpdate = await sdk.table('question_options_c').update({
          Id: option.Id,
          status_c: 'Published'
        });
        if (!optionUpdate.data?.length) {
          throw new Error(optionUpdate.messages?.join('; ') || optionUpdate.message || 'A question option could not be published.');
        }
        changedOptions.push({
          Id: option.Id,
          is_correct_c: option.is_correct_c ?? false,
          status_c: option.status_c
        });
      }
    }

  } catch (optionError) {
    for (const snapshot of changedOptions.reverse()) {
      await sdk.table('question_options_c').update(snapshot);
    }
    await sdk.table('questions_c').update({ Id: question.Id, ...previous });
    return {
      success: false,
      message: optionError.message + ' The question and any changed options were rolled back where possible.'
    };
  }

  try {
    const reviewStatus = action === 'applyExtraction' ? 'Approved' : decision;
    await writeReview(question, reviewerId, reviewType, reviewStatus, auditAction, notes);
  } catch (error) {
    for (const snapshot of changedOptions.reverse()) {
      await sdk.table('question_options_c').update(snapshot);
    }
    const rollback = await sdk.table('questions_c').update({ Id: question.Id, ...previous });
    return {
      success: false,
      message: error.message + (rollback.data?.length ? ' The question and option updates were rolled back where possible.' : ' WARNING: rollback failed; check the question record immediately.')
    };
  }

  return { success: true, statusUpdated: true, status: update.status_c || question.status_c };
}
