import { sdk } from '@/services/sdk';

const VALID_OPTION_KEYS = new Set(['A', 'B', 'C', 'D']);

async function writeReview(question, reviewerId, notes) {
  const result = await sdk.table('question_reviews_c').create({
    Name: 'Historical question option correction · ' + question.Name,
    question_c: question.Id,
    review_type_c: 'Academic',
    review_status_c: 'Changes',
    reviewer_user_c: reviewerId,
    reviewed_at_c: new Date().toISOString(),
    review_notes_c: 'Action: options correction verification | ' + String(notes || '').trim()
  });
  if (!result.data?.length) {
    throw new Error(result.messages?.join('; ') || result.message || 'The option correction audit could not be saved.');
  }
}

export async function saveHistoricalQuestionOptions({
  question,
  existingOptions = [],
  draftOptions = [],
  reviewerId,
  reviewerProfile,
  notes
}) {
  if (!question?.Id || !reviewerId) {
    return { success: false, message: 'A historical question and signed-in reviewer are required.' };
  }
  if (!['CEO', 'CEO_c', 'Manager', 'Manager_c', 'AcademicExpert_c'].includes(reviewerProfile)) {
    return { success: false, message: 'Only an Academic Expert or authorised academic editor can correct extracted answer options.' };
  }
  if (question.source_type_c !== 'Historical' || !['New', 'Review'].includes(question.status_c)) {
    return { success: false, message: 'Only historical questions in New or Review can have their extracted options corrected.' };
  }
  if (!String(notes || '').trim()) {
    return { success: false, message: 'Record why the extracted options were corrected.' };
  }
  if (!Array.isArray(draftOptions) || draftOptions.length < 2 || draftOptions.length > 4) {
    return { success: false, message: 'A multiple-choice question must have between two and four answer options.' };
  }

  const normalized = draftOptions.map((option, index) => ({
    Id: option.Id || null,
    key: String(option.key || '').trim().toUpperCase(),
    text: String(option.text || '').trim(),
    sequence: index + 1
  }));

  const keys = normalized.map((option) => option.key);
  if (normalized.some((option) => !VALID_OPTION_KEYS.has(option.key)) ||
    new Set(keys).size !== keys.length) {
    return { success: false, message: 'Use unique option labels A, B, C and D.' };
  }
  if (normalized.some((option) => !option.text)) {
    return { success: false, message: 'Every option needs non-empty answer text.' };
  }

  const previousQuestion = {
    answer_key_c: question.answer_key_c ?? null,
    solution_c: question.solution_c ?? null,
    answer_validation_status_c: question.answer_validation_status_c ?? 'Pending',
    status_c: question.status_c
  };
  const existingById = new Map(existingOptions.map((option) => [String(option.Id), option]));
  const submittedIds = new Set(normalized.map((option) => option.Id).filter(Boolean).map(String));
  const snapshots = [];
  const createdIds = [];

  try {
    for (const option of normalized) {
      const payload = {
        option_key_c: option.key,
        option_text_c: option.text,
        sequence_c: option.sequence,
        is_correct_c: false,
        status_c: 'Draft'
      };

      if (option.Id) {
        const previous = existingById.get(String(option.Id));
        if (!previous) throw new Error('An option being edited does not belong to this question.');
        snapshots.push({
          Id: previous.Id,
          option_key_c: previous.option_key_c,
          option_text_c: previous.option_text_c,
          sequence_c: previous.sequence_c,
          is_correct_c: previous.is_correct_c,
          status_c: previous.status_c
        });
        const update = await sdk.table('question_options_c').update({
          Id: option.Id,
          ...payload
        });
        if (!update.data?.length) {
          throw new Error(update.messages?.join('; ') || update.message || 'An option could not be updated.');
        }
      } else {
        const created = await sdk.table('question_options_c').create({
          Name: question.Name + ' · Option ' + option.key,
          question_c: question.Id,
          ...payload
        });
        if (!created.data?.length) {
          throw new Error(created.messages?.join('; ') || created.message || 'A new option could not be created.');
        }
        createdIds.push(created.data[0].Id);
      }
    }

    for (const previous of existingOptions) {
      if (submittedIds.has(String(previous.Id))) continue;
      snapshots.push({
        Id: previous.Id,
        option_key_c: previous.option_key_c,
        option_text_c: previous.option_text_c,
        sequence_c: previous.sequence_c,
        is_correct_c: previous.is_correct_c,
        status_c: previous.status_c
      });
      const retired = await sdk.table('question_options_c').update({
        Id: previous.Id,
        status_c: 'Retired',
        is_correct_c: false
      });
      if (!retired.data?.length) {
        throw new Error(retired.messages?.join('; ') || retired.message || 'An unused option could not be retired.');
      }
    }

    const questionUpdate = await sdk.table('questions_c').update({
      Id: question.Id,
      answer_key_c: null,
      solution_c: null,
      answer_validation_status_c: 'Pending',
      status_c: 'Review'
    });
    if (!questionUpdate.data?.length) {
      throw new Error(questionUpdate.messages?.join('; ') || questionUpdate.message || 'The question could not be reset for answer validation.');
    }

    await writeReview(question, reviewerId, notes);
    return {
      success: true,
      message: 'Corrected options saved as Draft. Any old answer-key approval was cleared and must be reviewed again.'
    };
  } catch (error) {
    const rollbackMessages = [];
    for (const snapshot of snapshots.reverse()) {
      const rollback = await sdk.table('question_options_c').update(snapshot);
      if (!rollback.data?.length) rollbackMessages.push('Could not restore option ' + snapshot.Id);
    }
    for (const createdId of createdIds) {
      const rollback = await sdk.table('question_options_c').update({
        Id: createdId,
        status_c: 'Retired',
        is_correct_c: false
      });
      if (!rollback.data?.length) rollbackMessages.push('Could not retire newly created option ' + createdId);
    }
    const questionRollback = await sdk.table('questions_c').update({ Id: question.Id, ...previousQuestion });
    if (!questionRollback.data?.length) rollbackMessages.push('Could not restore the question answer-validation state');
    const detail = rollbackMessages.length ? ' Rollback warnings: ' + rollbackMessages.join('; ') : ' Question and option changes were rolled back.';
    return { success: false, message: error.message + detail };
  }
}
