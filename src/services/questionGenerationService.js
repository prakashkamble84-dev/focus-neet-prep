import { sdk } from '@/services/sdk';

const {
  eq,
  and,
  isIn,
  hasValue
} = window.ApperSDK.CoreSDK;

const PROMPT_VERSION = 'northstar-question-generation-v1';
const MODEL = 'gemini-3.8-flash';
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
const EDITORS = ['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'];
const REVIEWERS = [...EDITORS, 'ContentReviewer_c'];
const PUBLISHERS = ['CEO', 'CEO_c', 'Manager', 'Manager_c'];

function getId(value) {
  if (value && typeof value === 'object') {
    return value.Id ?? value.id ?? value.value ?? null;
  }

  return value ?? null;
}

function lookupId(value) {
  const id = getId(value);
  return id === null || id === undefined ? '' : String(id);
}

function lookupName(value) {
  return value && typeof value === 'object' ? value.Name || value.name || '' : '';
}

async function fetchRows(request, label) {
  const result = await request;
  if (!result.success) {
    throw new Error(result.messages?.join('; ') || result.message || label + ' could not be loaded.');
  }

  return result.data || [];
}

async function fetchRecord(table, id, fields, label) {
  const result = await sdk.table(table).select(fields).get(id);
  if (!result.success || !result.data) {
    throw new Error(result.message || label + ' could not be loaded.');
  }

  return result.data;
}

function tokenSimilarity(left, right) {
  const toSet = (value) => new Set(
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
  const a = toSet(left);
  const b = toSet(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) {
    if (b.has(word)) shared += 1;
  }

  return shared / (a.size + b.size - shared);
}

function rankCandidates(rows, concept, instruction) {
  const target = [
    concept.Name,
    concept.node_path_c,
    concept.description_c,
    concept.learning_objectives_c,
    instruction
  ].join(' ');

  return rows
    .map((row) => ({
      row,
      score: tokenSimilarity(target, [
        row.question_body_c,
        row.concept_dna_c,
        row.skill_dna_c,
        row.question_family_code_c,
        row.recurring_pattern_group_c
      ].join(' '))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map(({ row }) => ({
      id: String(row.Id),
      title: row.Name || '',
      questionText: String(row.question_body_c || '').slice(0, 800),
      questionType: row.question_type_c || '',
      difficulty: row.difficulty_c || '',
      concepts: String(row.concept_dna_c || '').slice(0, 300)
    }));
}

function sameAnswer(left, right, type) {
  const normalize = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (['MCQ', 'Multi', 'Assert'].includes(type)) {
      return raw.toUpperCase().split(/[,;+\s]+/).map((part) => part.trim()).filter(Boolean).sort().join(',');
    }
    const numericText = raw.replace(/,/g, '');
    if (/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(numericText)) {
      return 'NUM:' + Number(numericText).toPrecision(12);
    }
    return raw.toLowerCase().replace(/\s+/g, ' ');
  };

  return Boolean(normalize(left)) && normalize(left) === normalize(right);
}

function optionsAreValid(question) {
  const options = Array.isArray(question.options) ? question.options : [];
  const type = question.questionType;
  if (!['MCQ', 'Multi', 'Assert'].includes(type)) {
    return options.length === 0 && Boolean(String(question.answerKey || '').trim());
  }
  if (options.length < 2 || options.length > 4) return false;

  const labels = options.map((option) => String(option.label || '').trim().toUpperCase());
  if (
    labels.some((label) => !['A', 'B', 'C', 'D'].includes(label)) ||
    new Set(labels).size !== labels.length ||
    options.some((option) => !String(option.text || '').trim())
  ) {
    return false;
  }

  const answer = String(question.answerKey || '')
    .toUpperCase()
    .split(/[,;+\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
  const correct = options
    .filter((option) => option.isCorrect === true)
    .map((option) => String(option.label || '').toUpperCase())
    .sort();

  return answer.length > 0 &&
    answer.length === correct.length &&
    answer.every((label, index) => label === correct[index]) &&
    (type !== 'MCQ' || correct.length === 1);
}

async function writeReview(question, reviewerId, type, status, action, notes) {
  const result = await sdk.table('question_reviews_c').create({
    Name: 'Original question ' + action + ' · ' + question.Name,
    question_c: question.Id,
    review_type_c: type,
    review_status_c: status,
    reviewer_user_c: reviewerId,
    reviewed_at_c: new Date().toISOString(),
    review_notes_c: 'Action: ' + action + ' | ' + String(notes || '').trim()
  });

  if (!result.data?.length) {
    throw new Error(result.messages?.join('; ') || result.message || 'The review history could not be saved.');
  }
}

async function writeCheck(batchId, questionId, provider, model, promptVersion, check) {
  const result = await sdk.table('question_generation_checks_c').create({
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

  if (!result.data?.length) {
    throw new Error(result.messages?.join('; ') || result.message || 'A generated-question check could not be saved.');
  }
}

export async function fetchQuestionGenerationLookups() {
  const [examinations, versions, concepts] = await Promise.all([
    fetchRows(
      sdk.table('examinations_c')
        .select(['Id', 'Name', 'code_c', 'exam_type_c', 'active_c'])
        .where(eq('active_c', true))
        .orderBy('Name')
        .limit(100, 0)
        .fetch(),
      'Active examinations'
    ),
    fetchRows(
      sdk.table('syllabus_versions_c')
        .select(['Id', 'Name', 'examination_c', 'academic_year_c', 'version_label_c', 'status_c'])
        .where(eq('status_c', 'Published'))
        .limit(1000, 0)
        .fetch(),
      'Published syllabus versions'
    ),
    fetchRows(
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

  const versionsById = new Map(versions.map((version) => [String(version.Id), version]));
  const examIds = new Set(examinations.map((exam) => String(exam.Id)));
  const verifiedConcepts = concepts.filter((node) => {
    const version = versionsById.get(lookupId(node.syllabus_version_c));
    return version && examIds.has(lookupId(version.examination_c));
  }).map((node) => ({
    ...node,
    syllabus: versionsById.get(lookupId(node.syllabus_version_c))
  }));

  return {
    examinations,
    syllabusVersions: versions,
    concepts: verifiedConcepts
  };
}

export async function createQuestionGenerationBatch({ input, userId }) {
  if (!userId) throw new Error('A signed-in academic editor is required.');

  const exam = await fetchRecord(
    'examinations_c',
    input.examinationId,
    ['Id', 'Name', 'code_c', 'exam_type_c', 'active_c'],
    'Examination'
  );
  const node = await fetchRecord(
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
  );
  const syllabus = await fetchRecord(
    'syllabus_versions_c',
    lookupId(node.syllabus_version_c),
    ['Id', 'Name', 'examination_c', 'academic_year_c', 'version_label_c', 'status_c'],
    'Syllabus version'
  );

  if (exam.active_c !== true) {
    throw new Error('Select an active examination.');
  }
  if (
    node.node_type_c !== 'Concept' ||
    node.status_c !== 'Published' ||
    node.verified_c !== true ||
    node.subject_c !== input.subject
  ) {
    throw new Error('The target must be a published, expert-verified Concept in the selected subject.');
  }
  if (
    syllabus.status_c !== 'Published' ||
    lookupId(syllabus.examination_c) !== String(exam.Id)
  ) {
    throw new Error('The concept must belong to a published syllabus for this examination.');
  }
  if (!['MCQ', 'Multi', 'Numeric', 'Assert', 'Other'].includes(input.questionType)) {
    throw new Error('Choose a supported question format.');
  }
  if (!['Basic', 'Moderate', 'Advanced'].includes(input.difficulty)) {
    throw new Error('Choose a supported difficulty.');
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
    generation_model_c: MODEL,
    prompt_version_c: PROMPT_VERSION,
    request_json_c: JSON.stringify({
      ...input,
      examinationName: exam.Name,
      conceptName: node.Name,
      syllabusVersionName: syllabus.Name
    }),
    started_at_c: startedAt
  });

  if (!created.data?.length) {
    throw new Error(created.messages?.join('; ') || created.message || 'Generation batch could not be created.');
  }

  return { batch: created.data[0], exam, node, syllabus };
}

export async function fetchExistingQuestionCandidates({ input, node }) {
  const rows = await fetchRows(
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
    'Existing examination questions'
  );

  const target = [node.Name, node.node_path_c, node.description_c, node.learning_objectives_c, input.instruction].join(' ');
  return rows.map((row) => ({
    row,
    score: tokenSimilarity(target, [
      row.question_body_c,
      row.concept_dna_c,
      row.skill_dna_c,
      row.question_family_code_c,
      row.recurring_pattern_group_c
    ].join(' '))
  })).sort((a, b) => b.score - a.score).slice(0, 40).map(({ row }) => ({
    id: String(row.Id),
    title: row.Name || '',
    questionText: String(row.question_body_c || '').slice(0, 800),
    questionType: row.question_type_c || '',
    difficulty: row.difficulty_c || '',
    concepts: String(row.concept_dna_c || '').slice(0, 300)
  }));
}

async function saveGeneratedQuestion({ batch, exam, node, syllabus, input, generated, provider, model, promptVersion, index }) {
  const questionName = String(generated.title || (
    input.subject + ' · ' + node.Name + ' · Original ' + (index + 1)
  )).slice(0, 180);
  const concepts = Array.isArray(generated.conceptTags) ? generated.conceptTags : [];
  const skills = Array.isArray(generated.skillTags) ? generated.skillTags : [];
  const options = Array.isArray(generated.options) ? generated.options : [];

  const questionResult = await sdk.table('questions_c').create({
    Name: questionName,
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
    rights_notes_c: 'Original AI-generated draft. Reuse basis has not been determined and requires a human rights decision.',
    extraction_status_c: 'Pending',
    answer_validation_status_c: 'Pending',
    concept_dna_c: concepts.join(', '),
    skill_dna_c: skills.join(', '),
    approach_pattern_c: generated.approachPattern || '',
    concept_count_c: concepts.length,
    concept_combination_c: concepts.join(' + '),
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
  });

  if (!questionResult.data?.length) {
    throw new Error(questionResult.messages?.join('; ') || questionResult.message || 'Generated question could not be saved.');
  }

  const question = questionResult.data[0];
  const persistenceErrors = [];

  for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
    const option = options[optionIndex];
    const created = await sdk.table('question_options_c').create({
      Name: question.Name + ' · Option ' + option.label,
      question_c: question.Id,
      option_key_c: option.label,
      option_text_c: option.text,
      sequence_c: optionIndex + 1,
      is_correct_c: option.isCorrect === true,
      status_c: 'Draft'
    });
    if (!created.data?.length) {
      persistenceErrors.push(
        'Option ' + option.label + ' was not saved: ' +
        (created.messages?.join('; ') || created.message || 'Unknown option error.')
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
    persistenceErrors.push(
      mappingCreated.messages?.join('; ') || mappingCreated.message || 'Primary concept mapping could not be saved.'
    );
  }

  for (const check of generated.checks || []) {
    try {
      await writeCheck(batch.Id, question.Id, provider, model, promptVersion, check);
    } catch (error) {
      persistenceErrors.push(error.message);
    }
  }

  if (persistenceErrors.length) {
    await sdk.table('questions_c').update({
      Id: question.Id,
      ai_generation_status_c: 'NeedsReview',
      ai_generation_notes_c: [
        generated.validationNotes,
        'Persistence follow-up:',
        ...persistenceErrors
      ].filter(Boolean).join('\n')
    });
  }

  return {
    question,
    persistenceErrors,
    generationStatus: persistenceErrors.length ? 'NeedsReview' : generated.generationStatus
  };
}

export async function persistQuestionGenerationResult({ batch, exam, node, syllabus, input, result }) {
  if (!result?.success || !Array.isArray(result.questions) || result.questions.length !== Number(input.count)) {
    throw new Error(result?.message || 'The provider did not return the requested number of complete questions.');
  }

  const saved = [];
  const errors = [];
  for (let index = 0; index < result.questions.length; index += 1) {
    try {
      const record = await saveGeneratedQuestion({
        batch,
        exam,
        node,
        syllabus,
        input,
        generated: result.questions[index],
        provider: result.provider || 'Google Gemini',
        model: result.model || MODEL,
        promptVersion: result.promptVersion || PROMPT_VERSION,
        index
      });
      saved.push(record.question);
      errors.push(...record.persistenceErrors);
    } catch (error) {
      errors.push('Question ' + (index + 1) + ': ' + error.message);
    }
  }

  const allValidated = result.questions.every((question) => question.generationStatus === 'Validated');
  const batchStatus = errors.length || saved.length !== Number(input.count) || !allValidated
    ? 'NeedsReview'
    : 'Completed';
  const completedAt = new Date().toISOString();

  const updated = await sdk.table('question_generation_batches_c').update({
    Id: batch.Id,
    generated_count_c: saved.length,
    published_count_c: 0,
    status_c: batchStatus,
    generation_provider_c: result.provider || 'Google Gemini',
    generation_model_c: result.model || MODEL,
    prompt_version_c: result.promptVersion || PROMPT_VERSION,
    result_summary_c: [
      'Saved ' + saved.length + ' of ' + input.count + ' requested question(s).',
      result.questions.filter((question) => question.generationStatus === 'Validated').length + ' passed automated checks.',
      'All generated questions remain Draft until human academic approval and CEO/Manager publication.'
    ].join(' '),
    error_message_c: errors.length ? errors.join('\n').slice(0, 4000) : null,
    completed_at_c: completedAt,
    duration_ms_c: Math.max(0, Date.parse(completedAt) - Date.parse(batch.started_at_c))
  });
  if (!updated.data?.length) {
    errors.push(updated.messages?.join('; ') || updated.message || 'Batch completion summary could not be saved.');
  }

  return { batchStatus, questions: saved, errors };
}

export async function markQuestionGenerationBatchFailed(batchId, message) {
  const updated = await sdk.table('question_generation_batches_c').update({
    Id: batchId,
    status_c: 'Failed',
    error_message_c: String(message || 'Question generation failed.').slice(0, 4000),
    completed_at_c: new Date().toISOString()
  });

  return { success: Boolean(updated.data?.length) };
}

export async function fetchQuestionGenerationStudioData() {
  const [batches, questions] = await Promise.all([
    fetchRows(
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
          'error_message_c',
          'result_summary_c'
        ])
        .orderByDesc('CreatedOn')
        .limit(30, 0)
        .fetch(),
      'Generation batches'
    ),
    fetchRows(
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
        .where(eq('source_type_c', 'Original'))
        .orderByDesc('CreatedOn')
        .limit(60, 0)
        .fetch(),
      'Generated questions'
    )
  ]);

  return { batches, questions };
}

export async function fetchGeneratedQuestionReviewData(questionId) {
  const question = await fetchRecord(
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
    throw new Error('This review page only handles original Phase 6 generated questions.');
  }

  const [batch, options, checks, mappings, reviews] = await Promise.all([
    fetchRecord(
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
        'prompt_version_c'
      ],
      'Generation batch'
    ),
    fetchRows(
      sdk.table('question_options_c')
        .select(['Id', 'Name', 'option_key_c', 'option_text_c', 'sequence_c', 'is_correct_c', 'status_c'])
        .where(eq('question_c', question.Id))
        .orderBy('sequence_c')
        .limit(20, 0)
        .fetch(),
      'Generated answer options'
    ),
    fetchRows(
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
    fetchRows(
      sdk.table('question_concept_mappings_c')
        .select(['Id', 'Name', 'question_c', 'curriculum_node_c', 'mapping_type_c', 'confidence_c', 'verified_c', 'reviewer_user_c', 'status_c', 'CreatedBy', 'Owner'])
        .where(eq('question_c', question.Id))
        .limit(30, 0)
        .fetch(),
      'Question concept mappings'
    ),
    fetchRows(
      sdk.table('question_reviews_c')
        .select(['Id', 'Name', 'review_type_c', 'review_status_c', 'reviewer_user_c', 'reviewed_at_c', 'review_notes_c'])
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

async function writeGeneratedReview(question, reviewerId, type, status, action, notes) {
  const created = await sdk.table('question_reviews_c').create({
    Name: 'Original question ' + action + ' · ' + question.Name,
    question_c: question.Id,
    review_type_c: type,
    review_status_c: status,
    reviewer_user_c: reviewerId,
    reviewed_at_c: new Date().toISOString(),
    review_notes_c: 'Action: ' + action + ' | ' + String(notes || '').trim()
  });
  if (!created.data?.length) {
    throw new Error(created.messages?.join('; ') || created.message || 'Review event could not be saved.');
  }
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
    return { success: false, message: 'Review notes are required.' };
  }

  if (action === 'request_changes' || action === 'reject') {
    if (!['Draft', 'Review'].includes(question.status_c)) {
      return { success: false, message: 'Only draft or review-state generated questions can be changed or rejected.' };
    }
    const nextStatus = action === 'reject' ? 'Rejected' : 'Review';
    const update = await sdk.table('questions_c').update({
      Id: question.Id,
      status_c: nextStatus,
      ai_generation_status_c: action === 'reject' ? 'Rejected' : 'NeedsReview'
    });
    if (!update.data?.length) {
      return { success: false, message: update.messages?.join('; ') || update.message || 'Question status could not be updated.' };
    }

    try {
      await writeGeneratedReview(
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
      return { success: false, message: error.message + ' The question status was rolled back where possible.' };
    }

    return {
      success: true,
      message: action === 'reject'
        ? 'Generated question rejected.'
        : 'Changes requested. This question remains excluded from student-facing content.'
    };
  }

  if (action === 'approve') {
    if (reviewerProfile !== 'AcademicExpert_c') {
      return { success: false, message: 'Only an Academic Expert can approve generated content academically.' };
    }
    if (!['Draft', 'Review'].includes(question.status_c)) {
      return { success: false, message: 'Only draft or review-state questions can be academically approved.' };
    }

    const creatorId = getId(question.CreatedBy) || getId(question.Owner);
    if (!creatorId || String(creatorId) === String(reviewerId)) {
      return { success: false, message: 'The question creator cannot independently approve their own generated content.' };
    }
    if (
      question.ai_generation_status_c !== 'Validated' ||
      question.ai_independent_answer_match_c !== true ||
      question.ai_duplicate_status_c !== 'Clear'
    ) {
      return { success: false, message: 'Automated validation, independent answer agreement and a clear duplicate check must pass before approval.' };
    }
    if (!['Public', 'Licensed'].includes(rightsStatus)) {
      return { success: false, message: 'A human rights decision must select Public or Licensed before approval.' };
    }

    const passed = new Set(checks.filter((check) => check.check_status_c === 'Passed').map((check) => check.check_type_c));
    const missing = CHECK_TYPES.filter((type) => !passed.has(type));
    if (missing.length) {
      return { success: false, message: 'These validation checks are not passed: ' + missing.join(', ') + '.' };
    }
    if (!optionsAreValidForStoredQuestion(question, options)) {
      return { success: false, message: 'Correct the saved answer options or key before academic approval.' };
    }

    const primaryMapping = mappings.find((mapping) => lookupId(mapping.curriculum_node_c) === lookupId(question.curriculum_node_c));
    if (!primaryMapping) {
      return { success: false, message: 'A primary mapping to the source concept is required.' };
    }
    if (primaryMapping.status_c === 'Verified' && primaryMapping.verified_c === true) {
      return { success: false, message: 'The mapping is already verified. Refresh the question before continuing.' };
    }
    const mappingCreator = getId(primaryMapping.CreatedBy) || getId(primaryMapping.Owner);
    if (!mappingCreator || String(mappingCreator) === String(reviewerId)) {
      return { success: false, message: 'The mapping proposer cannot independently verify the concept mapping.' };
    }

    const questionBefore = {
      status_c: question.status_c,
      answer_validation_status_c: question.answer_validation_status_c,
      rights_status_c: question.rights_status_c,
      rights_notes_c: question.rights_notes_c
    };
    const mappingBefore = {
      status_c: primaryMapping.status_c,
      verified_c: primaryMapping.verified_c,
      reviewer_user_c: getId(primaryMapping.reviewer_user_c)
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
      return { success: false, message: questionUpdate.messages?.join('; ') || questionUpdate.message || 'Question academic approval failed.' };
    }

    const mappingUpdate = await sdk.table('question_concept_mappings_c').update({
      Id: primaryMapping.Id,
      status_c: 'Verified',
      verified_c: true,
      reviewer_user_c: reviewerId
    });
    if (!mappingUpdate.data?.length) {
      await sdk.table('questions_c').update({ Id: question.Id, ...questionBefore });
      return { success: false, message: 'Concept mapping approval failed. The question status was rolled back where possible.' };
    }

    try {
      await writeGeneratedReview(question, reviewerId, 'Answer', 'Approved', 'answer independently verified', notes);
      await writeGeneratedReview(question, reviewerId, 'Copyright', 'Approved', 'reuse basis confirmed', rightsStatus + ' · ' + notes);
      await writeGeneratedReview(question, reviewerId, 'Academic', 'Approved', 'academic approval', notes);
    } catch (error) {
      await sdk.table('question_concept_mappings_c').update({ Id: primaryMapping.Id, ...mappingBefore });
      await sdk.table('questions_c').update({ Id: question.Id, ...questionBefore });
      return { success: false, message: error.message + ' Question and mapping updates were rolled back where possible.' };
    }

    return {
      success: true,
      message: 'Question academically verified. A CEO or Manager must publish it before students can access it.'
    };
  }

  if (action === 'publish') {
    if (!PUBLISHERS.includes(reviewerProfile)) {
      return { success: false, message: 'Only a CEO or Manager can publish an academically verified question.' };
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
      return { success: false, message: 'Publication requires academic approval, cleared rights, answer agreement, clean duplicate scan and a verified concept mapping.' };
    }

    const questionUpdate = await sdk.table('questions_c').update({
      Id: question.Id,
      status_c: 'Published'
    });
    if (!questionUpdate.data?.length) {
      return { success: false, message: questionUpdate.messages?.join('; ') || questionUpdate.message || 'Question could not be published.' };
    }

    const changedOptions = [];
    try {
      for (const option of options.filter((item) => item.status_c !== 'Retired')) {
        const updated = await sdk.table('question_options_c').update({
          Id: option.Id,
          status_c: 'Published'
        });
        if (!updated.data?.length) {
          throw new Error(updated.messages?.join('; ') || updated.message || 'An answer option could not be published.');
        }
        changedOptions.push(option);
      }
      await writeGeneratedReview(question, reviewerId, 'Academic', 'Approved', 'published', notes);
    } catch (error) {
      for (const option of changedOptions.reverse()) {
        await sdk.table('question_options_c').update({
          Id: option.Id,
          status_c: option.status_c
        });
      }
      await sdk.table('questions_c').update({ Id: question.Id, status_c: 'Verified' });
      return { success: false, message: error.message + ' Question and option states were rolled back where possible.' };
    }

    return {
      success: true,
      message: 'Generated question published to the Question Bank.'
    };
  }

  return { success: false, message: 'Unsupported review action.' };
}

function optionsAreValidForStoredQuestion(question, options) {
  const active = options.filter((option) => option.status_c !== 'Retired');
  if (!['MCQ', 'Multi', 'Assert'].includes(question.question_type_c)) {
    return String(question.answer_key_c || '').trim().length > 0;
  }
  if (active.length < 2 || active.length > 4) return false;
  const keys = active.map((option) => String(option.option_key_c || '').toUpperCase());
  if (keys.some((key) => !['A', 'B', 'C', 'D'].includes(key)) || new Set(keys).size !== keys.length) return false;
  const answer = String(question.answer_key_c || '').toUpperCase().split(/[,;+\s]+/).filter(Boolean).sort();
  const correct = active.filter((option) => option.is_correct_c === true).map((option) => String(option.option_key_c || '').toUpperCase()).sort();
  return answer.length > 0 && answer.length === correct.length && answer.every((value, index) => value === correct[index]) &&
    (question.question_type_c !== 'MCQ' || correct.length === 1);
}
