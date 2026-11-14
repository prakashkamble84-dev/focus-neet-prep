import { sdk } from '@/services/sdk';

const QUESTION_SNAPSHOT_FIELDS = [
  'Id',
  'Name',
  'examination_c',
  'syllabus_version_c',
  'question_type_c',
  'question_body_c',
  'answer_key_c',
  'solution_c',
  'maximum_marks_c',
  'negative_marks_c',
  'difficulty_c',
  'source_type_c',
  'status_c',
  'rights_notes_c',
  'historical_year_c',
  'historical_session_c',
  'historical_question_number_c',
  'historical_page_number_c',
  'question_family_code_c',
  'concept_dna_c',
  'skill_dna_c',
  'approach_pattern_c',
  'concept_count_c',
  'recurring_pattern_group_c',
  'concept_combination_c',
  'extraction_confidence_c',
  'extraction_status_c',
  'answer_validation_status_c',
  'curriculum_node_c',
  'source_document_c',
  'historical_paper_c',
  'rights_status_c'
];

async function readQuestionRows(tableName, fields, questionId, label) {
  const { eq } = window.ApperSDK.CoreSDK;
  const table = tableName === 'question_options_c'
    ? sdk.table('question_options_c')
    : tableName === 'question_concept_mappings_c'
      ? sdk.table('question_concept_mappings_c')
      : null;

  if (!table) {
    throw new Error('Unsupported question snapshot dependency: ' + tableName);
  }

  const rows = [];
  const maxRows = 10000;
  let offset = 0;

  while (offset < maxRows) {
    const requestLimit = Math.min(1000, maxRows - offset);
    const result = await table
      .select(fields)
      .where(eq('question_c', questionId))
      .limit(requestLimit, offset)
      .fetch();

    if (!result.success) {
      throw new Error(result.message || label + ' could not be captured.');
    }

    const batch = result.data || [];
    rows.push(...batch);
    offset += batch.length;

    const total = Number(result.total);
    const inferredMore = Number.isFinite(total)
      ? total > rows.length
      : batch.length === requestLimit;
    const hasMore = result.hasMore === true ||
      (result.hasMore !== false && inferredMore);

    if (!hasMore || !batch.length) break;

    if (offset >= maxRows) {
      throw new Error(label + ' exceeds the 10,000-row version snapshot safety limit. No partial version was created.');
    }
  }

  return rows;
}

function selectFields(record, fields) {
  return Object.fromEntries(
    fields
      .filter((field) => record[field] !== undefined)
      .map((field) => [field, record[field]])
  );
}

export async function beginQuestionVersion({
  question,
  changeKind,
  reason,
  reviewerId
}) {
  if (!question?.Id || !reviewerId) {
    return {
      success: false,
      message: 'A question and signed-in academic editor are required before creating a version.'
    };
  }

  if (!['Content', 'Answer', 'Classification', 'Source', 'Mapping', 'Publication'].includes(changeKind)) {
    return {
      success: false,
      message: 'Choose a supported question version change type.'
    };
  }

  if (!String(reason || '').trim()) {
    return {
      success: false,
      message: 'A reason is required for the question version record.'
    };
  }

  try {
    const { eq } = window.ApperSDK.CoreSDK;
    const [questionResult, options, mappings, latestVersions] = await Promise.all([
      sdk.table('questions_c')
        .select(QUESTION_SNAPSHOT_FIELDS)
        .get(question.Id),
      readQuestionRows('question_options_c', [
        'Id',
        'Name',
        'option_key_c',
        'option_text_c',
        'sequence_c',
        'is_correct_c',
        'status_c'
      ], question.Id, 'Answer options'),
      readQuestionRows('question_concept_mappings_c', [
        'Id',
        'Name',
        'curriculum_node_c',
        'mapping_type_c',
        'confidence_c',
        'verified_c',
        'reviewer_user_c',
        'status_c'
      ], question.Id, 'Concept mappings'),
      sdk.table('question_versions_c')
        .select(['Id', 'version_number_c'])
        .where(eq('question_c', question.Id))
        .orderByDesc('version_number_c')
        .limit(1, 0)
        .fetch()
    ]);

    if (!questionResult.success || !questionResult.data) {
      throw new Error(questionResult.message || 'The latest question record could not be captured.');
    }

    if (!latestVersions.success) {
      throw new Error(latestVersions.message || 'The current version number could not be checked.');
    }

    const currentQuestion = questionResult.data;
    const versionNumber = Number(latestVersions.data?.[0]?.version_number_c || 0) + 1;
    const snapshot = {
      schemaVersion: 1,
      question: selectFields(currentQuestion, QUESTION_SNAPSHOT_FIELDS),
      options,
      mappings
    };

    const created = await sdk.table('question_versions_c').create({
      Name: 'Question version ' + versionNumber + ' · ' + currentQuestion.Name,
      question_c: question.Id,
      version_number_c: versionNumber,
      change_kind_c: changeKind,
      change_reason_c: String(reason).trim(),
      snapshot_json_c: JSON.stringify(snapshot),
      version_status_c: 'Pending'
    });

    if (!created.data?.length) {
      throw new Error(created.messages?.join('; ') || created.message || 'The question version snapshot could not be saved.');
    }

    return {
      success: true,
      versionId: created.data[0].Id,
      versionNumber
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'The question version snapshot could not be saved.'
    };
  }
}

export async function finalizeQuestionVersion(versionId, status) {
  if (!versionId || !['Committed', 'Abandoned'].includes(status)) {
    return {
      success: false,
      message: 'A version record and final snapshot state are required.'
    };
  }

  const result = await sdk.table('question_versions_c').update({
    Id: versionId,
    version_status_c: status
  });

  if (!result.data?.length) {
    return {
      success: false,
      message: result.messages?.join('; ') || result.message || 'The version snapshot state could not be finalised.'
    };
  }

  return { success: true };
}
