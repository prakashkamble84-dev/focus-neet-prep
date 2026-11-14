import { sdk } from '@/services/sdk';

const QUESTION_BANK_FIELDS = [
  'Id',
  'Name',
  'CreatedOn',
  'question_body_c',
  'examination_c',
  'question_type_c',
  'difficulty_c',
  'source_type_c',
  'status_c',
  'maximum_marks_c',
  'negative_marks_c',
  'historical_year_c',
  'historical_session_c',
  'historical_question_number_c',
  'historical_page_number_c',
  'question_family_code_c',
  'concept_dna_c',
  'skill_dna_c',
  'answer_validation_status_c',
  'extraction_status_c',
  'extraction_confidence_c',
  'rights_status_c',
  'curriculum_node_c',
  'source_document_c',
  'historical_paper_c'
];

const EDITORIAL_PROFILES = [
  'CEO',
  'CEO_c',
  'Manager',
  'Manager_c',
  'AcademicExpert_c',
  'ContentReviewer_c'
];

export function canUseEditorialQuestionBank(profile) {
  return EDITORIAL_PROFILES.includes(profile);
}

function getId(value) {
  if (value && typeof value === 'object') {
    return value.Id ?? value.id ?? value.value ?? null;
  }

  return value ?? null;
}

export async function fetchQuestionBankExaminations() {
  const result = await sdk.table('examinations_c')
    .select(['Id', 'Name', 'code_c', 'exam_type_c', 'active_c'])
    .orderBy('Name')
    .limit(100, 0)
    .fetch();

  if (!result.success) {
    throw new Error(result.message || 'Examination filters could not be loaded.');
  }

  return result.data || [];
}

async function fetchVerifiedQuestionIdsForSubject(subject) {
  const { eq, isIn } = window.ApperSDK.CoreSDK;
  const nodesResult = await sdk.table('curriculum_nodes_c')
    .select(['Id'])
    .where(eq('node_type_c', 'Concept'))
    .where(eq('subject_c', subject))
    .where(eq('status_c', 'Published'))
    .where(eq('verified_c', true))
    .limit(1000, 0)
    .fetch();

  if (!nodesResult.success) {
    throw new Error(nodesResult.message || 'Verified subject concepts could not be loaded.');
  }

  const nodeIds = (nodesResult.data || []).map((node) => node.Id);
  if (!nodeIds.length) return [];

  const mappingsResult = await sdk.table('question_concept_mappings_c')
    .select(['question_c'])
    .where(isIn('curriculum_node_c', nodeIds))
    .where(eq('status_c', 'Verified'))
    .where(eq('verified_c', true))
    .limit(5000, 0)
    .fetch();

  if (!mappingsResult.success) {
    throw new Error(mappingsResult.message || 'Verified question-to-concept mappings could not be loaded.');
  }

  return [...new Set((mappingsResult.data || [])
    .map((mapping) => getId(mapping.question_c))
    .filter(Boolean)
    .map(String))];
}

export async function fetchQuestionBankPage({
  page = 1,
  pageSize = 20,
  search = '',
  examinationId = '',
  subject = '',
  questionType = '',
  difficulty = '',
  year = '',
  status = '',
  sourceType = '',
  profile = ''
}) {
  const {
    eq,
    contains,
    or,
    and,
    isIn
  } = window.ApperSDK.CoreSDK;

  const clauses = [];
  const isEditorial = canUseEditorialQuestionBank(profile);

  if (examinationId) {
    clauses.push(eq('examination_c', examinationId));
  }

  if (questionType) {
    clauses.push(eq('question_type_c', questionType));
  }

  if (difficulty) {
    clauses.push(eq('difficulty_c', difficulty));
  }

  if (year && Number.isInteger(Number(year))) {
    clauses.push(eq('historical_year_c', Number(year)));
  }

  if (sourceType) {
    clauses.push(eq('source_type_c', sourceType));
  }

  if (isEditorial && status) {
    clauses.push(eq('status_c', status));
  }

  if (!isEditorial) {
    clauses.push(eq('status_c', 'Published'));
    clauses.push(eq('answer_validation_status_c', 'Verified'));
    clauses.push(or(
      eq('rights_status_c', 'Public'),
      eq('rights_status_c', 'Licensed')
    ));
  }

  if (subject) {
    const questionIds = await fetchVerifiedQuestionIdsForSubject(subject);
    if (!questionIds.length) {
      return {
        rows: [],
        total: 0,
        hasMore: false
      };
    }

    clauses.push(isIn('Id', questionIds));
  }

  const normalizedSearch = String(search || '').trim();
  if (normalizedSearch) {
    clauses.push(or(
      contains('Name', normalizedSearch),
      contains('question_body_c', normalizedSearch),
      contains('concept_dna_c', normalizedSearch),
      contains('skill_dna_c', normalizedSearch),
      contains('question_family_code_c', normalizedSearch)
    ));
  }

  let query = sdk.table('questions_c').select(QUESTION_BANK_FIELDS);
  if (clauses.length) {
    query = query.where(and(...clauses));
  }

  const result = await query
    .orderByDesc('CreatedOn')
    .limit(pageSize, (page - 1) * pageSize)
    .fetch();

  if (!result.success) {
    throw new Error(result.message || 'The question bank could not be loaded.');
  }

  return {
    rows: result.data || [],
    total: Number(result.total ?? result.data?.length ?? 0),
    hasMore: result.hasMore === true
  };
}

export async function fetchQuestionBankQuestionDetails(questionId, profile = '') {
  const { eq } = window.ApperSDK.CoreSDK;
  const isEditorial = canUseEditorialQuestionBank(profile);
  let optionsQuery = sdk.table('question_options_c')
    .select([
      'Id',
      'Name',
      'question_c',
      'option_key_c',
      'option_text_c',
      'sequence_c',
      'is_correct_c',
      'status_c'
    ])
    .where(eq('question_c', questionId))
    .orderBy('sequence_c');

  let mappingsQuery = sdk.table('question_concept_mappings_c')
    .select([
      'Id',
      'Name',
      'curriculum_node_c',
      'mapping_type_c',
      'confidence_c',
      'verified_c',
      'status_c'
    ])
    .where(eq('question_c', questionId))
    .orderByDesc('CreatedOn');

  if (!isEditorial) {
    optionsQuery = optionsQuery.where(eq('status_c', 'Published'));
    mappingsQuery = mappingsQuery
      .where(eq('status_c', 'Verified'))
      .where(eq('verified_c', true));
  }

  const [optionsResult, mappingsResult] = await Promise.all([
    optionsQuery.limit(20, 0).fetch(),
    mappingsQuery.limit(50, 0).fetch()
  ]);

  if (!optionsResult.success) {
    throw new Error(optionsResult.message || 'Answer choices could not be loaded.');
  }

  if (!mappingsResult.success) {
    throw new Error(mappingsResult.message || 'Verified concept mappings could not be loaded.');
  }

  return {
    options: optionsResult.data || [],
    mappings: mappingsResult.data || []
  };
}

export async function fetchQuestionBankGovernance(questionId) {
  const { eq } = window.ApperSDK.CoreSDK;
  const [versionsResult, mappingsResult, nodesResult] = await Promise.all([
    sdk.table('question_versions_c')
      .select([
        'Id',
        'Name',
        'version_number_c',
        'change_kind_c',
        'change_reason_c',
        'snapshot_json_c',
        'version_status_c',
        'CreatedOn',
        'CreatedBy'
      ])
      .where(eq('question_c', questionId))
      .where(eq('version_status_c', 'Committed'))
      .orderByDesc('version_number_c')
      .limit(100, 0)
      .fetch(),
    sdk.table('question_concept_mappings_c')
      .select([
        'Id',
        'Name',
        'curriculum_node_c',
        'mapping_type_c',
        'confidence_c',
        'verified_c',
        'reviewer_user_c',
        'status_c',
        'CreatedOn'
      ])
      .where(eq('question_c', questionId))
      .orderByDesc('CreatedOn')
      .limit(100, 0)
      .fetch(),
    sdk.table('curriculum_nodes_c')
      .select([
        'Id',
        'Name',
        'node_code_c',
        'node_type_c',
        'subject_c',
        'node_path_c',
        'status_c',
        'verified_c'
      ])
      .where(eq('node_type_c', 'Concept'))
      .where(eq('status_c', 'Published'))
      .where(eq('verified_c', true))
      .orderBy('Name')
      .limit(1000, 0)
      .fetch()
  ]);

  if (!versionsResult.success) {
    throw new Error(versionsResult.message || 'Question version history could not be loaded.');
  }

  if (!mappingsResult.success) {
    throw new Error(mappingsResult.message || 'Question concept mappings could not be loaded.');
  }

  if (!nodesResult.success) {
    throw new Error(nodesResult.message || 'Verified curriculum concepts could not be loaded.');
  }

  return {
    versions: versionsResult.data || [],
    mappings: mappingsResult.data || [],
    nodes: nodesResult.data || []
  };
}

export function getLookupName(value) {
  if (value && typeof value === 'object') {
    return value.Name || value.name || '';
  }

  return '';
}

export function getLookupId(value) {
  return getId(value);
}
