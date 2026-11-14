import { sdk } from '@/services/sdk';
import {
  beginQuestionVersion,
  finalizeQuestionVersion
} from '@/services/questionVersionService';

const {
  eq,
  and,
  isIn,
  hasValue
} = window.ApperSDK.CoreSDK;

const PROMPT_VERSION = 'northstar-question-generation-v1';
const GEMINI_MODEL = 'gemini-3.8-flash';
const EDITORS = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'];
const REVIEWERS = [...EDITORS, 'ContentReviewer_c'];
const PUBLISHERS = ['CEO', 'CEO_c', 'Manager', 'Manager_c'];
const CHECK_TYPES = [
  'IndependentSolve',
  'AnswerAgreement',
  'SyllabusFit',
  'DifficultyCalibration',
  'Clarity',
  'Ambiguity',
  'DuplicateScan',
  'OptionIntegrity'
];

function getId(value) {
  if (value && typeof value === 'object') {
    return value.Id ?? value.id ?? value.value ?? null;
  }

  return value ?? null;
}

function getName(value) {
  if (value && typeof value === 'object') {
    return value.Name || value.name || '';
  }

  return '';
}

function resultData(result, label) {
  if (!result.success) {
    throw new Error(result.messages?.join('; ') || result.message || label + ' failed.');
  }

  return result.data || [];
}

async function readOne(table, id, fields, label) {
  if (!id) {
    throw new Error(label + ' is missing.');
  }

  const result = await sdk.table(table).select(fields).get(id);
  if (!result.success || !result.data) {
    throw new Error(result.message || label + ' could not be loaded.');
  }

  return result.data;
}

async function readRows(request, label) {
  const result = await request;
  return resultData(result, label);
}

function normalizeId(value) {
  const id = getId(value);
  return id === null || id === undefined ? '' : String(id);
}

function tokenOverlap(left, right) {
  const tokenize = (value) => new Set(
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
  const a = tokenize(left);
  const b = tokenize(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const token of a) {
    if (b.has(token)) common += 1;
  }

  return common / (a.size + b.size - common);
}

function rankCandidates(rows, concept, learningObjectives, count = 40) {
  const target = [concept.Name, concept.node_path_c, concept.description_c, learningObjectives].join(' ');
  return rows
    .map((question) => ({
      question,
      score: tokenOverlap(
        target,
        [
          question.question_body_c,
          question.concept_dna_c,
          question.skill_dna_c,
          question.question_family_code_c,
          question.recurring_pattern_group_c
        ].join(' ')
      )
    }))
    .sort((a, b) => b.score - a.score || Date.parse(b.question.CreatedOn || 0) - Date.parse(a.question.CreatedOn || 0))
    .slice(0, count)
    .map(({ question }) => ({
      id: String(question.Id),
      title: question.Name || '',
      questionText: String(question.question_body_c || '').slice(0, 700),
      questionType: question.question_type_c || '',
      difficulty: question.difficulty_c || '',
      concepts: String(question.concept_dna_c || '').slice(0, 240)
    }));
}

function isQuestionChoiceType(questionType) {
  return ['MCQ', 'Multi', 'Assert'].includes(questionType);
}

function answerOptionsMatch(question, options) {
  const active = (options || []).filter((option) => option.status_c !== 'Retired');
  if (!isQuestionChoiceType(question.question_type_c)) {
    return active.length === 0 || String(question.answer_key_c || '').trim().length > 0;
  }

  if (active.length < 2 || active.length > 4) return false;
  const labels = active.map((option) => String(option.option_key_c || '').trim().toUpperCase());
  if (labels.some((label) => !['A', 'B', 'C', 'D'].includes(label)) || new Set(labels).size !== labels.length) {
    return false;
  }

  const answer = String(question.answer_key_c || '')
    .toUpperCase()
    .split(/[,;+\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .sort();
  const correct = active
    .filter((option) => option.is_correct_c === true)
    .map((option) => String(option.option_key_c || '').toUpperCase())
    .sort();

  if (!answer.length || answer.length !== correct.length) return false;
  if (answer.some((label, index) => label !== correct[index])) return false;
  if (question.question_type_c === 'MCQ' && correct.length !== 1) return false;
  return correct.length > 0;
}

async function writeReview(question, reviewerId, reviewType, status, action, notes) {
  const created = await sdk.table('question_reviews_c').create({
    Name: 'Original question ' + action + ' · ' + question.Name,
    question_c: question.Id,
    review_type_c: reviewType,
    review_status_c: status,
    reviewer_user_c: reviewerId,
    reviewed_at_c: new Date().toISOString(),
    review_notes_c: 'Action: ' + action + ' | ' + String(notes || '').trim()
  });

  if (!created.data?.length) {
    throw new Error(created.messages?.join('; ') || created.message || 'Question review history could not be recorded.');
  }

  return created.data[0];
}

async function writeQuestionCheck(batchId, questionId, provider, model, promptVersion, check) {
  const created = await sdk.table('question_generation_checks_c').create({
    Name: 'Generation check · ' + questionId + ' · ' + check.type,
    generation_batch_c: batchId,
    question_c: questionId,
    check_type_c: check.type,
    check_status_c: check.status,
    score_c: check.score === null || check.score === undefined ? null : Number(check.score),
    details_c: String(check.details || ''),
    evidence_json_c: JSON.stringify(check.evidence || {}),
    related_question_ids_c: check.type === 'DuplicateScan'
      ? JSON.stringify(check.evidence?.similarCandidates || [])
      : null,
    provider_c: provider,
    model_c: model,
    prompt_version_c: promptVersion,
    is_independent_c: check.independent === true,
    run_at_c: new Date().toISOString()
  });

  if (!created.data?.length) {
    throw new Error(created.messages?.join('; ') || created.message || 'A validation check could not be saved.');
  }

  return created.data[0];
}

export async function fetchQuestionGenerationLookups() {
  const [exams, versions, nodes] = await Promise.all([
    readRows(
      sdk.table('examinations_c')
        .select(['Id', 'Name', 'code_c', 'exam_type_c', 'active_c'])
        .where(eq('active_c', true))
        .orderBy('Name')
        .limit(100, 0)
        .fetch(),
      'Active examinations'
    ),
    readRows(
      sdk.table('syllabus_versions_c')
        .select(['Id', 'Name', 'examination_c', 'academic_year_c', 'version_label_c', 'status_c'])
        .where(eq('status_c', 'Published'))
        .limit(1000, 0)
        .fetch(),
      'Published syllabus versions'
    ),
    readRows(
      sdk.table('curriculum_nodes_c')
        .select([
          'Id',
          'Name',
          'syllabus_version_c',
          'node_code_c',
          'node_type_c',
          'subject_c',
          'node_path_c',
          'description_c',
          'learning_objectives_c',
          'difficulty_c',
          'status_c',
          'verified_c'
        ])
        .where(eq('node_type_c', 'Concept'))
        .where(eq('status_c', 'Published'))
        .where(eq('verified_c', true))
        .orderBy('Name')
        .limit(3000, 0)
        .fetch(),
      'Published verified concepts'
    )
  ]);

  const publishedVersionIds = new Set(
    versions.map((version) => String(version.Id))
  );
  const syllabusById = new Map(
    versions.map((version) => [String(version.Id), version])
  );

  const verifiedConcepts = nodes.filter((node) => (
    publishedVersionIds.has(normalizeId(node.syllabus_version_c))
  ));

  return {
    examinations: exams,
    syllabusVersions: versions,
    concepts: verifiedConcepts.map((node) => ({
      ...node,
      syllabus: syllabusById.get(normalizeId(node.syllabus_version_c))
    }))
  };
}

export async function fetchQuestionGenerationStudioData() {
  const [batches, questions] = await Promise.all([
    readRows(
      sdk.table('question_generation_batches_c')
        .select([
          'Id',
          'Name',
          'examination_c',
          'subject_c',
          'curriculum_node_c',
          'question_type_c',
          'difficulty_c',
          'requested_count_c',
          'generated_count_c',
          'published_count_c',
          'status_c',
          'generation_model_c',
          'started_at_c',
          'completed_at_c',
          'error_message_c'
        ])
        .orderByDesc('CreatedOn')
        .limit(30, 0)
        .fetch(),
      'Generation batches'
    ),
    readRows(
      sdk.table('questions_c')
        .select([
          'Id',
          'Name',
          'CreatedOn',
          'question_body_c',
          'examination_c',
          'question_type_c',
          'difficulty_c',
          'status_c',
          'source_type_c',
          'generation_batch_c',
          'ai_generation_status_c',
          'ai_duplicate_status_c',
          'ai_independent_answer_match_c',
          'ai_validation_score_c'
        ])
        .where(hasValue('generation_batch_c'))
        .orderByDesc('CreatedOn')
        .limit(40, 0)
        .fetch(),
      'Generated questions'
    )
  ]);

  return { batches, questions };
}

export async function createQuestionGenerationBatch({ input, userId }) {
  if (!userId) {
    throw new Error('A signed-in academic editor is required to start generation.');
  }

  const [exam, node] = await Promise.all([
    readOne(
      'examinations_c',
      input.examinationId,
      ['Id', 'Name', 'code_c', 'exam_type_c', 'active_c'],
      'Examination'
    ),
    readOne(
      'curriculum_nodes_c',
      input.curriculumNodeId,
      [
        'Id',
        'Name',
        'syllabus_version_c',
        'node_type_c',
        'subject_c',
        'node_path_c',
        'description_c',
        'learning_objectives_c',
        'status_c',
        'verified_c'
      ],
      'Target concept'
    )
  ]);

  if (exam.active_c !== true) {
    throw new Error('Question generation is restricted to active examinations.');
  }

  if (
    node.node_type_c !== 'Concept' ||
    node.status_c !== 'Published' ||
    node.verified_c !== true ||
    node.subject_c !== input.subject
  ) {
    throw new Error('Choose a published, expert-verified Concept node in the selected subject.');
  }

  const syllabusVersionId = getId(node.syllabus_version_c);
  const syllabus = await readOne(
    'syllabus_versions_c',
    syllabusVersionId,
    ['Id', 'Name', 'examination_c', 'academic_year_c', 'version_label_c', 'status_c'],
    'Syllabus version'
  );

  if (
    syllabus.status_c !== 'Published' ||
    String(getId(syllabus.examination_c)) !== String(exam.Id)
  ) {
    throw new Error('The selected concept must belong to a published syllabus version for the selected examination.');
  }

  if (!['MCQ', 'Multi', 'Numeric', 'Assert', 'Other'].includes(input.questionType)) {
    throw new Error('Choose a supported question format.');
  }

  if (!['Basic', 'Moderate', 'Advanced'].includes(input.difficulty)) {
    throw new Error('Choose a supported difficulty level.');
  }

  if (!Number.isInteger(Number(input.count)) || Number(input.count) < 1 || Number(input.count) > 3) {
    throw new Error('Generate between one and three questions per batch.');
  }

  const startedAt = new Date().toISOString();
  const created = await sdk.table('question_generation_batches_c').create({
    Name: exam.Name + ' · ' + input.subject + ' · ' + node.Name + ' · ' + startedAt.slice(0, 16).replace('T', ' '),
    examination_c: exam.Id,
    syllabus_version_c: syllabus.Id,
    curriculum_node_c: node.Id,
    subject_c: input.subject,
    question_type_c: input.questionType,
    difficulty_c: input.difficulty,
    requested_count_c: Number(input.count),
    generated_count_c: 0,
    published_count_c: 0,
    status_c: 'Generating',
    generation_provider_c: 'Google Gemini',
    generation_model_c: GEMINI_MODEL,
    prompt_version_c: PROMPT_VERSION,
    request_json_c: JSON.stringify({
      ...input,
      examinationId: exam.Id,
      examinationName: exam.Name,
      curriculumNodeId: node.Id,
      curriculumNodeName: node.Name,
      syllabusVersionId: syllabus.Id,
      syllabusVersionName: syllabus.Name
    }),
    started_at_c: startedAt
  });

  if (!created.data?.length) {
    throw new Error(created.messages?.join('; ') || created.message || 'Generation batch could not be created.');
  }

  return {
    batch: created.data[0],
    exam,
    node,
    syllabus
  };
}

export async function fetchExistingQuestionCandidates({ input, node }) {
  const rows = await readRows(
    sdk.table('questions_c')
      .select([
        'Id',
        'Name',
        'CreatedOn',
        'question_body_c',
        'question_type_c',
        'difficulty_c',
        'status_c',
        'source_type_c',
        'concept_dna_c',
        'skill_dna_c',
        'question_family_code_c',
        'recurring_pattern_group_c'
      ])
      .where(eq('examination_c', input.examinationId))
      .where(eq('question_type_c', input.questionType))
      .where(isIn('status_c', ['Draft', 'Review', 'Verified', 'Published']))
      .orderByDesc('CreatedOn')
      .limit(500, 0)
      .fetch(),
    'Existing questions for duplicate checking'
  );

  return rankCandidates(rows, node, input.instruction || '', 40);
}

async function createQuestionRecord({ batch, exam, node, syllabus, input, generated, index, provider, model, promptVersion }) {
  const name = String(generated.title || (
    input.subject + ' · ' + node.Name + ' · AI draft ' + (index + 1)
  )).slice(0, 180);
  const optionRows = Array.isArray(generated.options) ? generated.options : [];
  const conceptTags = Array.isArray(generated.conceptTags) ? generated.conceptTags : [];
  const skillTags = Array.isArray(generated.skillTags) ? generated.skillTags : [];
  const questionPayload = {
    Name: name,
    examination_c: exam.Id,
    syllabus_version_c: syllabus.Id,
    curriculum_node_c: node.Id,
    question_type_c: generated.questionType,
    question_body_c: generated.questionText,
    answer_key_c: generated.answerKey,
    solution_c: generated.solution,
    maximum_marks_c: Number(input.maximumMarks),
    negative_marks_c: Number(input.negativeMarks),
    difficulty_c: generated.difficulty,
    source_type_c: 'Original',
    status_c: 'Draft',
    rights_status_c: 'Unknown',
    rights_notes_c: 'AI-generated original draft. Reuse status is undetermined and requires an authorised human rights review before publication.',
    extraction_status_c: 'Pending',
    answer_validation_status_c: 'Pending',
    concept_dna_c: conceptTags.join(', '),
    skill_dna_c: skillTags.join(', '),
    approach_pattern_c: generated.approachPattern || '',
    concept_count_c: conceptTags.length,
    concept_combination_c: conceptTags.join(' + '),
    generation_batch_c: batch.Id,
    ai_generation_provider_c: provider,
    ai_generation_model_c: model,
    ai_generation_prompt_version_c: promptVersion,
    ai_generation_status_c: generated.generationStatus,
    ai_validation_score_c: Number(generated.validationScore || 0),
    ai_duplicate_status_c: generated.duplicateStatus,
    ai_independent_answer_match_c: generated.answerAgreement === true,
    ai_generation_notes_c: String(generated.validationNotes || ''),
    ai_generated_at_c: new Date().toISOString()
  };

  const created = await sdk.table('questions_c').create(questionPayload);
  if (!created.data?.length) {
    throw new Error(created.messages?.join('; ') || created.message || 'Generated question could not be saved.');
  }

  const question = created.data[0];
  const errors = [];

  for (let optionIndex = 0; optionIndex < optionRows.length; optionIndex += 1) {
    const option = optionRows[optionIndex];
    const optionCreated = await sdk.table('question_options_c').create({
      Name: question.Name + ' · Option ' + option.label,
      question_c: question.Id,
      option_key_c: option.label,
      option_text_c: option.text,
      sequence_c: optionIndex + 1,
      is_correct_c: option.isCorrect === true,
      status_c: 'Draft'
    });

    if (!optionCreated.data?.length) {
      errors.push(
        'Option ' + option.label + ' could not be saved: ' +
        (optionCreated.messages?.join('; ') || optionCreated.message || 'Unknown option error.')
      );
    }
  }

  const mappingCreated = await sdk.table('question_concept_mappings_c').create({
    Name: question.Name + ' → ' + node.Name,
    question_c: question.Id,
    curriculum_node_c: node.Id,
    mapping_type_c: 'Primary',
    confidence_c: Math.max(0, Math.min(1, Number(generated.syllabusFitScore || 0))),
    verified_c: false,
    status_c: 'Review'
  });

  if (!mappingCreated.data?.length) {
    errors.push(
      'The primary concept mapping could not be saved: ' +
      (mappingCreated.messages?.join('; ') || mappingCreated.message || 'Unknown mapping error.')
    );
  }

  for (const check of generated.checks || []) {
    try {
      await writeQuestionCheck(
        batch.Id,
        question.Id,
        provider,
        model,
        promptVersion,
        check
      );
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length) {
    await sdk.table('questions_c').update({
      Id: question.Id,
      ai_generation_status_c: 'NeedsReview',
      ai_generation_notes_c: [
        generated.validationNotes,
        'Persistence follow-up required:',
        ...errors
      ].filter(Boolean).join('\n')
    });
  }

  return {
    question,
    status: errors.length ? 'NeedsReview' : generated.generationStatus,
    errors
  };
}

export async function persistQuestionGenerationResult({
  batch,
  exam,
  node,
  syllabus,
  input,
  result
}) {
  if (!result?.success || !Array.isArray(result.questions) || result.questions.length !== Number(input.count)) {
    throw new Error(result?.message || 'The AI response did not contain the requested number of complete questions.');
  }

  const createdQuestions = [];
  const errors = [];

  for (let index = 0; index < result.questions.length; index += 1) {
    try {
      const persisted = await createQuestionRecord({
        batch,
        exam,
        node,
        syllabus,
        input,
        generated: result.questions[index],
        index,
        provider: result.provider || 'Google Gemini',
        model: result.model || GEMINI_MODEL,
        promptVersion: result.promptVersion || PROMPT_VERSION
      });
      createdQuestions.push(persisted.question);
      errors.push(...persisted.errors);
    } catch (error) {
      errors.push('Question ' + (index + 1) + ': ' + error.message);
    }
  }

  const allChecksClear = result.questions.every((question) => question.generationStatus === 'Validated');
  const finalStatus = errors.length || createdQuestions.length !== Number(input.count) || !allChecksClear
    ? 'NeedsReview'
    : 'Completed';

  const summary = [
    'Generated ' + createdQuestions.length + ' of ' + input.count + ' requested question(s).',
    result.questions.filter((question) => question.generationStatus === 'Validated').length + ' passed automated checks.',
    result.questions.filter((question) => question.generationStatus !== 'Validated').length + ' require additional review.',
    'Human academic approval and publication are still required.'
  ].join(' ');

  const updated = await sdk.table('question_generation_batches_c').update({
    Id: batch.Id,
    generated_count_c: createdQuestions.length,
    published_count_c: 0,
    status_c: finalStatus,
    generation_provider_c: result.provider || 'Google Gemini',
    generation_model_c: result.model || GEMINI_MODEL,
    prompt_version_c: result.promptVersion || PROMPT_VERSION,
    result_summary_c: summary,
    error_message_c: errors.length ? errors.join('\n').slice(0, 4000) : null,
    completed_at_c: result.generatedAt || new Date().toISOString(),
    duration_ms_c: Date.parse(result.generatedAt || new Date().toISOString()) - Date.parse(batch.started_at_c)
  });

  if (!updated.data?.length) {
    errors.push(updated.messages?.join('; ') || updated.message || 'Batch summary could not be saved.');
  }

  return {
    batchStatus: finalStatus,
    questions: createdQuestions,
    errors,
    summary
  };
}

export async function markQuestionGenerationBatchFailed(batchId, errorMessage) {
  if (!batchId) return { success: false };

  const updated = await sdk.table('question_generation_batches_c').update({
    Id: batchId,
    status_c: 'Failed',
    error_message_c: String(errorMessage || 'Question generation failed.').slice(0, 4000),
    completed_at_c: new Date().toISOString()
  });

  return {
    success: Boolean(updated.data?.length),
    message: updated.messages?.join('; ') || updated.message || ''
  };
}

export async function fetchGeneratedQuestionReviewData(questionId) {
  const question = await readOne(
    'questions_c',
    questionId,
    [
      'Id',
      'Name',
      'CreatedOn',
      'CreatedBy',
      'Owner',
      'examination_c',
      'syllabus_version_c',
      'curriculum_node_c',
      'question_type_c',
      'question_body_c',
      'answer_key_c',
      'solution_c',
      'maximum_marks_c',
      'negative_marks_c',
      'difficulty_c',
      'source_type_c',
      'status_c',
      'rights_status_c',
      'rights_notes_c',
      'answer_validation_status_c',
      'generation_batch_c',
      'ai_generation_provider_c',
      'ai_generation_model_c',
      'ai_generation_prompt_version_c',
      'ai_generation_status_c',
      'ai_validation_score_c',
      'ai_duplicate_status_c',
      'ai_independent_answer_match_c',
      'ai_generation_notes_c',
      'ai_generated_at_c'
    ],
    'Generated question'
  );

  if (question.source_type_c !== 'Original' || !getId(question.generation_batch_c)) {
    throw new Error('This route only handles original questions created by the Phase 6 generation pipeline.');
  }

  const [batch, options, checks, mappings, reviews] = await Promise.all([
    readOne(
      'question_generation_batches_c',
      getId(question.generation_batch_c),
      [
        'Id',
        'Name',
        'examination_c',
        'subject_c',
        'curriculum_node_c',
        'question_type_c',
        'difficulty_c',
        'status_c',
        'generation_model_c',
        'prompt_version_c',
        'started_at_c',
        'completed_at_c'
      ],
      'Generation batch'
    ),
    readRows(
      sdk.table('question_options_c')
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
        .where(eq('question_c', question.Id))
        .orderBy('sequence_c')
        .limit(20, 0)
        .fetch(),
      'Generated answer options'
    ),
    readRows(
      sdk.table('question_generation_checks_c')
        .select([
          'Id',
          'Name',
          'check_type_c',
          'check_status_c',
          'score_c',
          'details_c',
          'evidence_json_c',
          'related_question_ids_c',
          'provider_c',
          'model_c',
          'prompt_version_c',
          'is_independent_c',
          'run_at_c'
        ])
        .where(eq('question_c', question.Id))
        .orderBy('run_at_c')
        .limit(50, 0)
        .fetch(),
      'Generation validation checks'
    ),
    readRows(
      sdk.table('question_concept_mappings_c')
        .select([
          'Id',
          'Name',
          'question_c',
          'curriculum_node_c',
          'mapping_type_c',
          'confidence_c',
          'verified_c',
          'reviewer_user_c',
          'status_c',
          'CreatedBy',
          'Owner'
        ])
        .where(eq('question_c', question.Id))
        .limit(30, 0)
        .fetch(),
      'Question concept mappings'
    ),
    readRows(
      sdk.table('question_reviews_c')
        .select([
          'Id',
          'Name',
          'review_type_c',
          'review_status_c',
          'reviewer_user_c',
          'reviewed_at_c',
          'review_notes_c'
        ])
        .where(eq('question_c', question.Id))
        .orderByDesc('reviewed_at_c')
        .limit(100, 0)
        .fetch(),
      'Question review history'
    )
  ]);

  return {
    question,
    batch,
    options,
    checks,
    mappings,
    reviews,
    creatorId: getId(question.CreatedBy) || getId(question.Owner)
  };
}

export async function reviewGeneratedQuestion({
  question,
  options = [],
  checks = [],
  mappings = [],
  action,
  reviewerId,
  reviewerProfile,
  rightsStatus,
  notes
}) {
  if (!question?.Id || !reviewerId) {
    return { success: false, message: 'A question and signed-in reviewer are required.' };
  }

  if (!REVIEWERS.includes(reviewerProfile)) {
    return { success: false, message: 'Your profile cannot review generated questions.' };
  }

  if (!String(notes || '').trim()) {
    return { success: false, message: 'Review notes are required for an auditable decision.' };
  }

  if (question.source_type_c !== 'Original' || !getId(question.generation_batch_c)) {
    return { success: false, message: 'Only original Phase 6 generated questions can use this review workflow.' };
  }

  if (action === 'request_changes' || action === 'reject') {
    if (!['Draft', 'Review'].includes(question.status_c)) {
      return { success: false, message: 'Only draft or review-state questions can be returned or rejected.' };
    }

    const nextStatus = action === 'reject' ? 'Rejected' : 'Review';
    const nextGenerationStatus = action === 'reject' ? 'Rejected' : 'NeedsReview';
    const update = await sdk.table('questions_c').update({
      Id: question.Id,
      status_c: nextStatus,
      ai_generation_status_c: nextGenerationStatus
    });

    if (!update.data?.length) {
      return {
        success: false,
        message: update.messages?.join('; ') || update.message || 'The question review state could not be saved.'
      };
    }

    try {
      await writeReview(
        question,
        reviewerId,
        action === 'reject' && question.ai_duplicate_status_c !== 'Clear' ? 'Duplicate' : 'Academic',
        action === 'reject' ? 'Rejected' : 'Changes',
        action === 'reject' ? 'rejected' : 'changes requested',
        notes
      );
    } catch (error) {
      await sdk.table('questions_c').update({
        Id: question.Id,
        status_c: question.status_c,
        ai_generation_status_c: question.ai_generation_status_c
      });
      return { success: false, message: error.message + ' The question state was rolled back where possible.' };
    }

    return {
      success: true,
      message: action === 'reject'
        ? 'Generated question rejected and removed from the approval queue.'
        : 'Changes requested. The question remains excluded from student-facing content.'
    };
  }

  if (action === 'approve') {
    if (reviewerProfile !== 'AcademicExpert_c') {
      return { success: false, message: 'Only an Academic Expert can complete generated-question academic approval.' };
    }

    if (!['Draft', 'Review'].includes(question.status_c)) {
      return { success: false, message: 'Only draft or review-state questions can be academically approved.' };
    }

    const creatorId = normalizeId(question.CreatedBy) || normalizeId(question.Owner);
    if (!creatorId || creatorId === String(reviewerId)) {
      return { success: false, message: 'The person who generated this question cannot approve it. A different Academic Expert must sign off.' };
    }

    if (question.ai_generation_status_c !== 'Validated' ||
      question.ai_independent_answer_match_c !== true ||
      question.ai_duplicate_status_c !== 'Clear') {
      return {
        success: false,
        message: 'Academic approval is blocked until answer agreement, all automated quality checks and the duplicate scan pass.'
      };
    }

    if (!['Public', 'Licensed'].includes(rightsStatus)) {
      return { success: false, message: 'Select Public or Licensed only after your organisation has determined the reuse basis for this generated material.' };
    }

    const passedTypes = new Set(
      checks.filter((check) => check.check_status_c === 'Passed').map((check) => check.check_type_c)
    );
    const missingChecks = CHECK_TYPES.filter((type) => !passedTypes.has(type));
    if (missingChecks.length) {
      return { success: false, message: 'Required checks are missing or not passed: ' + missingChecks.join(', ') + '.' };
    }

    if (!answerOptionsMatch(question, options)) {
      return { success: false, message: 'The saved answer key and answer options do not match. Correct the question before approval.' };
    }

    const primaryNodeId = normalizeId(question.curriculum_node_c);
    const mapping = mappings.find((item) => normalizeId(item.curriculum_node_c) === primaryNodeId);
    if (!mapping) {
      return { success: false, message: 'A primary question-to-concept mapping is required before academic approval.' };
    }
    if (mapping.status_c === 'Verified' && mapping.verified_c === true) {
      return { success: false, message: 'This question mapping was already verified. Refresh the record before approving it again.' };
    }

    const mappingCreatorId = normalizeId(mapping.CreatedBy) || normalizeId(mapping.Owner);
    if (!mappingCreatorId || mappingCreatorId === String(reviewerId)) {
      return { success: false, message: 'The person who proposed this concept mapping cannot independently verify it.' };
    }

    const version = await beginQuestionVersion({
      question,
      changeKind: 'Publication',
      reason: notes,
      reviewerId
    });

    if (!version.success) {
      return { success: false, message: version.message };
    }

    const previousQuestion = {
      status_c: question.status_c,
      answer_validation_status_c: question.answer_validation_status_c,
      rights_status_c: question.rights_status_c,
      rights_notes_c: question.rights_notes_c
    };
    const previousMapping = {
      status_c: mapping.status_c,
      verified_c: mapping.verified_c,
      reviewer_user_c: getId(mapping.reviewer_user_c)
    };

    const questionUpdate = await sdk.table('questions_c').update({
      Id: question.Id,
      status_c: 'Verified',
      answer_validation_status_c: 'Verified',
      rights_status_c: rightsStatus,
      rights_notes_c: String(notes).trim(),
      ai_generation_status_c: 'Validated'
    });

    if (!questionUpdate.data?.length) {
      await finalizeQuestionVersion(version.versionId, 'Abandoned');
      return {
        success: false,
        message: questionUpdate.messages?.join('; ') || questionUpdate.message || 'Question academic approval could not be saved.'
      };
    }

    const mappingUpdate = await sdk.table('question_concept_mappings_c').update({
      Id: mapping.Id,
      status_c: 'Verified',
      verified_c: true,
      reviewer_user_c: reviewerId
    });

    if (!mappingUpdate.data?.length) {
      await sdk.table('questions_c').update({ Id: question.Id, ...previousQuestion });
      await finalizeQuestionVersion(version.versionId, 'Abandoned');
      return {
        success: false,
        message: (mappingUpdate.messages?.join('; ') || mappingUpdate.message || 'Concept mapping approval failed.') +
          ' The question state was rolled back where possible.'
      };
    }

    try {
      await writeReview(question, reviewerId, 'Answer', 'Approved', 'answer independently verified', notes);
      await writeReview(question, reviewerId, 'Copyright', 'Approved', 'reuse basis confirmed', rightsStatus + ' · ' + notes);
      await writeReview(question, reviewerId, 'Academic', 'Approved', 'academic approval', notes);
    } catch (error) {
      await sdk.table('question_concept_mappings_c').update({
        Id: mapping.Id,
        ...previousMapping
      });
      await sdk.table('questions_c').update({
        Id: question.Id,
        ...previousQuestion
      });
      await finalizeQuestionVersion(version.versionId, 'Abandoned');
      return {
        success: false,
        message: error.message + ' Question and concept mapping were rolled back where possible.'
      };
    }

    const finalised = await finalizeQuestionVersion(version.versionId, 'Committed');
    return {
      success: true,
      warning: finalised.success ? '' : finalised.message,
      message: finalised.success
        ? 'Question academically verified. A CEO or Manager must publish it before students can access it.'
        : 'Question verified, but its version snapshot remains pending: ' + finalised.message
    };
  }

  if (action === 'publish') {
    if (!PUBLISHERS.includes(reviewerProfile)) {
      return { success: false, message: 'Only a CEO or Manager can publish an academically verified generated question.' };
    }

    if (
      question.status_c !== 'Verified' ||
      question.answer_validation_status_c !== 'Verified' ||
      !['Public', 'Licensed'].includes(question.rights_status_c) ||
      question.ai_generation_status_c !== 'Validated' ||
      question.ai_duplicate_status_c !== 'Clear' ||
      question.ai_independent_answer_match_c !== true ||
      !mappings.some((mapping) => mapping.status_c === 'Verified' && mapping.verified_c === true)
    ) {
      return { success: false, message: 'Publication requires verified answer, academic approval, cleared rights, an independent answer match, a clear duplicate scan and a verified concept mapping.' };
    }

    const version = await beginQuestionVersion({
      question,
      changeKind: 'Publication',
      reason: notes,
      reviewerId
    });

    if (!version.success) {
      return { success: false, message: version.message };
    }

    const optionSnapshots = options
      .filter((option) => option.status_c !== 'Retired')
      .map((option) => ({
        Id: option.Id,
        status_c: option.status_c,
        is_correct_c: option.is_correct_c
      }));

    const questionUpdate = await sdk.table('questions_c').update({
      Id: question.Id,
      status_c: 'Published'
    });

    if (!questionUpdate.data?.length) {
      await finalizeQuestionVersion(version.versionId, 'Abandoned');
      return {
        success: false,
        message: questionUpdate.messages?.join('; ') || questionUpdate.message || 'Generated question could not be published.'
      };
    }

    const optionSnapshotsChanged = [];
    try {
      for (const option of options.filter((item) => item.status_c !== 'Retired')) {
        const updated = await sdk.table('question_options_c').update({
          Id: option.Id,
          status_c: 'Published'
        });
        if (!updated.data?.length) {
          throw new Error(updated.messages?.join('; ') || updated.message || 'An answer option could not be published.');
        }
        optionSnapshotsChanged.push(optionSnapshots.find((item) => item.Id === option.Id));
      }

      await writeReview(question, reviewerId, 'Academic', 'Approved', 'published', notes);
    } catch (error) {
      for (const snapshot of optionSnapshotsChanged.reverse()) {
        if (snapshot) await sdk.table('question_options_c').update(snapshot);
      }
      await sdk.table('questions_c').update({ Id: question.Id, status_c: 'Verified' });
      await finalizeQuestionVersion(version.versionId, 'Abandoned');
      return {
        success: false,
        message: error.message + ' Question and option states were rolled back where possible.'
      };
    }

    const finalised = await finalizeQuestionVersion(version.versionId, 'Committed');
    return {
      success: true,
      warning: finalised.success ? '' : finalised.message,
      message: finalised.success
        ? 'Generated question published to the student-facing Question Bank.'
        : 'Question published, but its version snapshot remains pending: ' + finalised.message
    };
  }

  return { success: false, message: 'Unsupported generated-question review action.' };
}
