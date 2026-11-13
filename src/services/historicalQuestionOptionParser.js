export function parseQuestionOptions(questionBody) {
  const lines = String(questionBody || '').split(/\r?\n/);
  const options = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(/^\s*(?:\(([A-D])\)|([A-D])[.)])\s*(.*?)\s*$/i);
    if (match) {
      current = {
        key: String(match[1] || match[2]).toUpperCase(),
        text: String(match[3] || '').trim()
      };
      options.push(current);
      continue;
    }

    if (current && line) {
      current.text = (current.text + ' ' + line).trim();
    }
  }

  return options.filter((option) => option.text.length > 0);
}

export function inferQuestionType(questionBody, options = []) {
  const text = String(questionBody || '').toLowerCase();
  if (options.length > 0) {
    return /select all that apply|select one or more|choose all|more than one correct|more than one option|one or more correct|multiple correct|multiple answers/i.test(text)
      ? 'Multi'
      : 'MCQ';
  }
  if (/numerical value|nearest integer|integer answer|enter the value|numeric answer/i.test(text)) {
    return 'Numeric';
  }
  if (/assertion|reason\s*\(r\)|statement\s*i/i.test(text)) {
    return 'Assert';
  }
  return 'Other';
}
