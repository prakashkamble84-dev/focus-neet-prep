import { sdk } from '@/services/sdk';

const DNA_FIELDS = [
  'question_family_code_c',
  'recurring_pattern_group_c',
  'concept_dna_c',
  'skill_dna_c',
  'approach_pattern_c',
  'concept_combination_c',
  'concept_count_c',
  'difficulty_c',
  'question_type_c'
];

const QUESTION_TYPES = new Set(['MCQ', 'Multi', 'Numeric', 'Assert', 'Other']);

async function rollbackOptions(snapshots) {
  const failures = [];
  for (const snapshot of [...snapshots].reverse()) {
    const result = await sdk.table('question_options_c').update(snapshot);
    if (!result.data?.length) {
      failures.push(snapshot.Id);
    }
  }
  return failures;
}

export async function saveHistoricalQuestionDNA(question, values, reviewerId, reviewerProfile, existingOptions = []) {
  if (!question?.Id || !reviewerId) {
    return { success: false, message: 'A question and signed-in academic reviewer are required.' };
  }
  if (question.source_type_c !== 'Historical') {
    return { success: false, message: 'Question DNA editing is limited to historical questions in Phase 4.' };
  }
  if (!['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'].includes(reviewerProfile)) {
    return { success: false, message: 'Only academic editors can change historical question DNA.' };
  }
  if (['Verified', 'Published'].includes(question.status_c)) {
    return { success: false, message: 'A verified or published question cannot be silently reclassified. Reopen it through the formal content-review process.' };
  }

  const previous = {};
  const next = {};
  for (const field of DNA_FIELDS) {
    previous[field] = question[field] ?? null;
    next[field] = values[field] ?? null;
  }
  if (!QUESTION_TYPES.has(next.question_type_c)) {
    return { success: false, message: 'Choose one of the supported examination question types.' };
  }

  const concepts = String(next.concept_dna_c || '')
    .split(/[;,\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  next.concept_count_c = concepts.length;

  const typeChanged = String(next.question_type_c || '') !== String(question.question_type_c || '');
  const previousQuestionState = {
    status_c: question.status_c,
    answer_key_c: question.answer_key_c ?? null,
    solution_c: question.solution_c ?? null,
    answer_validation_status_c: question.answer_validation_status_c ?? 'Pending'
  };

  const questionUpdate = {
    Id: question.Id,
    ...next,
    status_c: 'Review'
  };

  if (typeChanged) {
    questionUpdate.answer_key_c = null;
    questionUpdate.solution_c = null;
    questionUpdate.answer_validation_status_c = 'Pending';
  }

  const update = await sdk.table('questions_c').update(questionUpdate);
  if (!update.data?.length) {
    return {
      success: false,
      message: update.messages?.join('; ') || update.message || 'Question DNA could not be saved.'
    };
  }

  const optionSnapshots = [];
  if (typeChanged) {
    try {
      for (const option of existingOptions.filter((row) => row.status_c !== 'Retired')) {
        const snapshot = {
          Id: option.Id,
          is_correct_c: option.is_correct_c ?? false,
          status_c: option.status_c
        };
        const result = await sdk.table('question_options_c').update({
          Id: option.Id,
          is_correct_c: false,
          status_c: 'Draft'
        });
        if (!result.data?.length) {
          throw new Error(result.messages?.join('; ') || result.message || 'Existing answer options could not be reset.');
        }
        optionSnapshots.push(snapshot);
      }
    } catch (error) {
      const optionRollbackFailures = await rollbackOptions(optionSnapshots);
      const questionRollback = await sdk.table('questions_c').update({
        Id: question.Id,
        ...previous,
        ...previousQuestionState
      });
      const warnings = [];
      if (!questionRollback.data?.length) warnings.push('The question record could not be fully rolled back.');
      if (optionRollbackFailures.length) warnings.push('Some option rows could not be restored: ' + optionRollbackFailures.join(', '));
      return {
        success: false,
        message: error.message + (warnings.length ? ' ' + warnings.join(' ') : ' Question and option changes were rolled back.')
      };
    }
  }

  const audit = await sdk.table('question_reviews_c').create({
    Name: 'Historical question DNA update · ' + question.Name,
    question_c: question.Id,
    review_type_c: 'Academic',
    review_status_c: 'Changes',
    reviewer_user_c: reviewerId,
    reviewed_at_c: new Date().toISOString(),
    review_notes_c: typeChanged
      ? 'Question DNA and question type changed to ' + next.question_type_c +
        '. The answer key and prior answer validation were cleared. Existing options were reset to Draft and must be re-reviewed.'
      : 'Question DNA classification updated. Status remains Review; this event does not approve the answer key, rights or publication.'
  });

  if (!audit.data?.length) {
    const optionRollbackFailures = await rollbackOptions(optionSnapshots);
    const questionRollback = await sdk.table('questions_c').update({
      Id: question.Id,
      ...previous,
      ...previousQuestionState
    });
    const warnings = [];
    if (!questionRollback.data?.length) warnings.push('The question record could not be rolled back.');
    if (optionRollbackFailures.length) warnings.push('Some option rows could not be restored: ' + optionRollbackFailures.join(', '));
    return {
      success: false,
      message: (audit.messages?.join('; ') || audit.message || 'Audit record failed.') +
        (warnings.length ? ' ' + warnings.join(' ') : ' Question and option changes were rolled back.')
    };
  }

  return {
    success: true,
    auditLogged: true,
    typeChanged,
    message: typeChanged
      ? 'Question type changed. Answer validation was cleared and any existing option approvals were reset.'
      : 'Question DNA classification saved. The question remains in Review.'
  };
}
