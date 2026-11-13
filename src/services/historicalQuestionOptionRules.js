export function answerOptionsMatch(question, options = []) {
  const activeOptions = options.filter((option) => option.status_c !== 'Retired');
  if (activeOptions.length < 2) return false;

  const optionKeys = activeOptions.map((option) => String(option.option_key_c || '').toUpperCase());
  if (
    optionKeys.some((key) => !['A', 'B', 'C', 'D'].includes(key)) ||
    new Set(optionKeys).size !== optionKeys.length
  ) {
    return false;
  }

  const answerKeys = String(question?.answer_key_c || '')
    .toUpperCase()
    .split(/[,;+ ]+/)
    .map((key) => key.trim())
    .filter(Boolean);

  if (!answerKeys.length || new Set(answerKeys).size !== answerKeys.length) return false;
  if (question.question_type_c === 'MCQ' && answerKeys.length !== 1) return false;

  const markedCorrect = new Set(activeOptions
    .filter((option) => option.is_correct_c === true)
    .map((option) => String(option.option_key_c || '').toUpperCase()));

  return markedCorrect.size === answerKeys.length &&
    answerKeys.every((key) => markedCorrect.has(key));
}
