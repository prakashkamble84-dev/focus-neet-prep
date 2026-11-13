import { sdk } from '@/services/sdk';

const DNA_FIELDS = [
  'question_family_code_c',
  'recurring_pattern_group_c',
  'concept_dna_c',
  'skill_dna_c',
  'approach_pattern_c',
  'concept_combination_c',
  'concept_count_c',
  'difficulty_c'
];

export async function saveHistoricalQuestionDNA(question, values, reviewerId) {
  if (!question?.Id || !reviewerId) {
    return { success: false, message: 'A question and signed-in academic reviewer are required.' };
  }
  if (!['Historical'].includes(question.source_type_c)) {
    return { success: false, message: 'Question DNA editing is limited to historical questions in Phase 4.' };
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
  const concepts = String(next.concept_dna_c || '')
    .split(/[;,\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  next.concept_count_c = concepts.length;

  const update = await sdk.table('questions_c').update({
    Id: question.Id,
    ...next,
    status_c: 'Review'
  });
  if (!update.data?.length) {
    return {
      success: false,
      message: update.messages?.join('; ') || update.message || 'Question DNA could not be saved.'
    };
  }

  const audit = await sdk.table('question_reviews_c').create({
    Name: 'Historical question DNA update · ' + question.Name,
    question_c: question.Id,
    review_type_c: 'Academic',
    review_status_c: 'Changes',
    reviewer_user_c: reviewerId,
    reviewed_at_c: new Date().toISOString(),
    review_notes_c: 'Question DNA classification updated. Status remains Review; this event does not approve the answer key, rights or publication.'
  });

  if (!audit.data?.length) {
    await sdk.table('questions_c').update({
      Id: question.Id,
      ...previous,
      status_c: question.status_c
    });
    return {
      success: false,
      message: audit.messages?.join('; ') || audit.message || 'Audit record failed. Question DNA was rolled back.'
    };
  }

  return { success: true, auditLogged: true };
}
