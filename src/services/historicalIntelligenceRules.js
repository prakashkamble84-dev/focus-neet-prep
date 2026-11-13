const APPROVED_RIGHTS = new Set(['Public', 'Licensed']);
const APPROVED_PAPER_STATUSES = new Set(['Verified', 'Published']);
const APPROVED_QUESTION_STATUSES = new Set(['Verified', 'Published']);
const ACCEPTED_PAPER_SOURCES = new Set(['Official', 'Archive']);

export function getLookupId(value) {
  if (value && typeof value === 'object') {
    return value.Id ?? value.id ?? value.value ?? null;
  }
  return value ?? null;
}

export function getLookupName(value) {
  if (value && typeof value === 'object') {
    return value.Name ?? value.name ?? '';
  }
  return '';
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function inYearRange(year, fromYear, toYear) {
  return year !== null && year >= fromYear && year <= toYear;
}

export function evaluateHistoricalPaper(paper, sourceDocument) {
  if (!paper) return { eligible: false, reason: 'Historical paper record is missing' };
  if (!getLookupId(paper.examination_c)) return { eligible: false, reason: 'Paper examination is missing' };
  if (!getLookupId(paper.source_document_c)) return { eligible: false, reason: 'Paper source-document link is missing' };
  if (asNumber(paper.exam_year_c) === null) return { eligible: false, reason: 'Exam year is missing' };
  if (!APPROVED_RIGHTS.has(paper.rights_status_c)) return { eligible: false, reason: 'Paper reuse rights are not cleared' };
  if (!APPROVED_PAPER_STATUSES.has(paper.status_c)) return { eligible: false, reason: 'Paper has not passed academic verification' };
  if (!sourceDocument) return { eligible: false, reason: 'Linked source document is not visible or is missing' };
  if (String(getLookupId(paper.source_document_c)) !== String(sourceDocument.Id)) {
    return { eligible: false, reason: 'Paper and source-document references do not match' };
  }
  if (sourceDocument.document_type_c !== 'Paper') {
    return { eligible: false, reason: 'Linked source document is not classified as a question paper' };
  }
  if (!ACCEPTED_PAPER_SOURCES.has(sourceDocument.source_category_c)) {
    return { eligible: false, reason: 'Source is not an official issuer or an identified archive' };
  }
  if (!APPROVED_RIGHTS.has(sourceDocument.rights_status_c) || sourceDocument.rights_status_c !== paper.rights_status_c) {
    return { eligible: false, reason: 'Paper and source-document rights are missing or inconsistent' };
  }
  if (sourceDocument.verification_status_c !== 'Verified') {
    return { eligible: false, reason: 'Source document is not verified' };
  }
  if (sourceDocument.ingestion_status_c !== 'Complete') {
    return { eligible: false, reason: 'Source document ingestion is incomplete' };
  }
  const documentExamId = getLookupId(sourceDocument.examination_c);
  const paperExamId = getLookupId(paper.examination_c);
  if (!documentExamId || String(documentExamId) !== String(paperExamId)) {
    return { eligible: false, reason: 'Paper and source document examinations do not match' };
  }
  return { eligible: true, reason: 'Evidence-ready' };
}

export function evaluateHistoricalQuestion(question, paper, sourceDocument) {
  if (!question) return { eligible: false, reason: 'Question record is missing' };
  if (question.source_type_c !== 'Historical') return { eligible: false, reason: 'Question is not classified as historical' };

  const questionPaperId = getLookupId(question.historical_paper_c);
  if (!questionPaperId) return { eligible: false, reason: 'Question is not linked to a historical paper' };
  if (!paper || String(questionPaperId) !== String(paper.Id)) {
    return { eligible: false, reason: 'Question and historical paper references do not match' };
  }

  const paperDecision = evaluateHistoricalPaper(paper, sourceDocument);
  if (!paperDecision.eligible) return { eligible: false, reason: paperDecision.reason };
  if (!APPROVED_RIGHTS.has(question.rights_status_c) || question.rights_status_c !== paper.rights_status_c) {
    return { eligible: false, reason: 'Question and paper rights are missing or inconsistent' };
  }
  if (!APPROVED_QUESTION_STATUSES.has(question.status_c)) {
    return { eligible: false, reason: 'Question is not academically verified' };
  }
  if (question.extraction_status_c !== 'Verified') {
    return { eligible: false, reason: 'Question extraction is not verified' };
  }
  if (question.answer_validation_status_c !== 'Verified') {
    return { eligible: false, reason: 'Answer key is not validated' };
  }

  const questionYear = asNumber(question.historical_year_c);
  const paperYear = asNumber(paper.exam_year_c);
  if (questionYear === null || questionYear !== paperYear) {
    return { eligible: false, reason: 'Question year is missing or does not match its paper' };
  }

  const questionExamId = getLookupId(question.examination_c);
  const paperExamId = getLookupId(paper.examination_c);
  if (!questionExamId || !paperExamId || String(questionExamId) !== String(paperExamId)) {
    return { eligible: false, reason: 'Question examination is missing or does not match its paper' };
  }

  const questionSourceId = getLookupId(question.source_document_c);
  const paperSourceId = getLookupId(paper.source_document_c);
  if (!questionSourceId || !paperSourceId ||
    String(questionSourceId) !== String(paperSourceId) ||
    String(getLookupId(sourceDocument)) !== String(questionSourceId)) {
    return { eligible: false, reason: 'Question source document link is missing or inconsistent' };
  }

  return { eligible: true, reason: 'Evidence-ready' };
}

function groupCounts(items, getKey, getLabel = (key) => key) {
  const counts = new Map();
  for (const item of items) {
    const key = String(getKey(item) ?? '').trim();
    if (!key) continue;
    if (!counts.has(key)) counts.set(key, { key, label: getLabel(key, item), count: 0 });
    counts.get(key).count += 1;
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildYearSeries(fromYear, toYear, papers, questions) {
  const rows = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    rows.push({
      year: String(year),
      papers: papers.filter((paper) => asNumber(paper.exam_year_c) === year).length,
      questions: questions.filter((question) => asNumber(question.paper?.exam_year_c) === year).length
    });
  }
  return rows;
}

export function buildHistoricalIntelligence(data = {}, filters = {}) {
  const currentYear = Number(filters.currentYear || new Date().getFullYear());
  const fromYear = Math.max(1997, Math.min(currentYear, Number(filters.fromYear || currentYear - 29)));
  const toYear = Math.max(fromYear, Math.min(currentYear, Number(filters.toYear || currentYear)));
  const examFilter = filters.examFilter || 'all';

  const examinations = data.examinations || [];
  const papers = data.papers || [];
  const questions = data.questions || [];
  const mappings = data.mappings || [];
  const nodes = data.nodes || [];
  const sourceDocuments = data.sourceDocuments || [];

  const examById = new Map(examinations.map((exam) => [String(exam.Id), exam]));
  const sourceById = new Map(sourceDocuments.map((document) => [String(document.Id), document]));
  const nodeById = new Map(nodes.map((node) => [String(node.Id), node]));
  const paperById = new Map(papers.map((paper) => [String(paper.Id), paper]));

  const visiblePapers = papers
    .filter((paper) => {
      const year = asNumber(paper.exam_year_c);
      if (!inYearRange(year, fromYear, toYear)) return false;
      const examName = examById.get(String(getLookupId(paper.examination_c)))?.Name || getLookupName(paper.examination_c);
      return examFilter === 'all' || examName === examFilter;
    })
    .map((paper) => {
      const sourceDocument = sourceById.get(String(getLookupId(paper.source_document_c)));
      const decision = evaluateHistoricalPaper(paper, sourceDocument);
      return {
        ...paper,
        examName: examById.get(String(getLookupId(paper.examination_c)))?.Name || getLookupName(paper.examination_c) || 'Unassigned exam',
        sourceDocument,
        trendEligible: decision.eligible,
        evidenceReason: decision.reason
      };
    })
    .sort((a, b) => Number(b.exam_year_c || 0) - Number(a.exam_year_c || 0));

  const visiblePaperById = new Map(visiblePapers.map((paper) => [String(paper.Id), paper]));
  const eligiblePapers = visiblePapers.filter((paper) => paper.trendEligible);
  const eligiblePaperIds = new Set(eligiblePapers.map((paper) => String(paper.Id)));
  const eligibleQuestions = [];
  const excludedQuestions = [];

  for (const question of questions) {
    if (question.source_type_c !== 'Historical') continue;

    const paperId = getLookupId(question.historical_paper_c);
    const linkedPaper = paperById.get(String(paperId || '')) || null;
    const questionYear = asNumber(question.historical_year_c);
    const paperYear = asNumber(linkedPaper?.exam_year_c);
    const yearToCheck = paperYear ?? questionYear;
    if (!inYearRange(yearToCheck, fromYear, toYear)) continue;

    const questionExamName = examById.get(String(getLookupId(question.examination_c)))?.Name || getLookupName(question.examination_c);
    const linkedPaperExamName = examById.get(String(getLookupId(linkedPaper?.examination_c)))?.Name || getLookupName(linkedPaper?.examination_c);
    const examToCheck = linkedPaperExamName || questionExamName;
    if (examFilter !== 'all' && examToCheck && examToCheck !== examFilter) continue;

    const visiblePaper = visiblePaperById.get(String(paperId || '')) || null;
    const questionSource = sourceById.get(String(getLookupId(question.source_document_c))) || null;
    const paperSource = sourceById.get(String(getLookupId(linkedPaper?.source_document_c))) || null;
    const sourceDocument = questionSource || paperSource;
    const decision = evaluateHistoricalQuestion(question, linkedPaper, sourceDocument);

    if (!decision.eligible) {
      excludedQuestions.push({ ...question, exclusionReason: decision.reason, paper: linkedPaper });
      continue;
    }
    if (!visiblePaper || !eligiblePaperIds.has(String(linkedPaper.Id))) {
      excludedQuestions.push({ ...question, exclusionReason: 'Linked paper is not eligible for trends', paper: linkedPaper });
      continue;
    }

    eligibleQuestions.push({
      ...question,
      paper: visiblePaper,
      examName: visiblePaper.examName,
      examYear: asNumber(visiblePaper.exam_year_c)
    });
  }

  const verifiedQuestionIds = new Set(eligibleQuestions.map((question) => String(question.Id)));
  const verifiedMappings = mappings.filter((mapping) => {
    if (mapping.status_c !== 'Verified' || mapping.verified_c !== true) return false;
    if (!verifiedQuestionIds.has(String(getLookupId(mapping.question_c)))) return false;
    const node = nodeById.get(String(getLookupId(mapping.curriculum_node_c)));
    return Boolean(node && node.status_c === 'Published' && node.verified_c === true);
  });

  const subjectsByQuestion = new Map();
  const conceptsById = new Map();
  for (const mapping of verifiedMappings) {
    const questionId = String(getLookupId(mapping.question_c));
    const node = nodeById.get(String(getLookupId(mapping.curriculum_node_c)));
    if (!node || node.node_type_c !== 'Concept') continue;

    if (!subjectsByQuestion.has(questionId)) subjectsByQuestion.set(questionId, new Set());
    if (hasValue(node.subject_c)) subjectsByQuestion.get(questionId).add(node.subject_c);
    if (!conceptsById.has(String(node.Id))) {
      conceptsById.set(String(node.Id), {
        label: node.Name || node.node_path_c || 'Unnamed concept',
        count: 0,
        subject: node.subject_c || 'Unclassified'
      });
    }
    conceptsById.get(String(node.Id)).count += 1;
  }

  const mappedQuestionCount = subjectsByQuestion.size;
  const mappingRate = eligibleQuestions.length
    ? Math.round((mappedQuestionCount / eligibleQuestions.length) * 100)
    : 0;

  const subjectQuestionSets = new Map();
  for (const [questionId, subjectSet] of subjectsByQuestion.entries()) {
    for (const subject of subjectSet) {
      if (!subjectQuestionSets.has(subject)) subjectQuestionSets.set(subject, new Set());
      subjectQuestionSets.get(subject).add(questionId);
    }
  }

  const subjectCounts = [...subjectQuestionSets.entries()]
    .map(([subject, ids]) => ({ subject, count: ids.size }))
    .sort((a, b) => b.count - a.count);

  const difficultyOrder = ['Basic', 'Moderate', 'Advanced', 'Unrated'];
  const difficultyCounts = difficultyOrder.map((difficulty) => ({
    difficulty,
    count: eligibleQuestions.filter((question) => (question.difficulty_c || 'Unrated') === difficulty).length
  }));

  const questionFamilies = groupCounts(
    eligibleQuestions,
    (question) => question.question_family_code_c || question.recurring_pattern_group_c
  ).slice(0, 12);

  const recurringPatterns = groupCounts(
    eligibleQuestions,
    (question) => question.recurring_pattern_group_c
  ).slice(0, 12);

  const skillProfiles = groupCounts(
    eligibleQuestions,
    (question) => question.skill_dna_c
  ).slice(0, 10);

  const conceptCombinations = groupCounts(
    eligibleQuestions,
    (question) => question.concept_combination_c || question.concept_dna_c
  ).slice(0, 10);

  const yearTrend = buildYearSeries(fromYear, toYear, eligiblePapers, eligibleQuestions);
  const yearsCovered = yearTrend.filter((row) => Number(row.papers) > 0).length;
  const declaredQuestions = eligiblePapers.reduce((sum, paper) => sum + (asNumber(paper.question_count_c) || 0), 0);
  const observedQuestions = eligibleQuestions.length;
  const paperQuestionCoverage = declaredQuestions > 0
    ? Math.round((observedQuestions / declaredQuestions) * 100)
    : 0;

  const qualityReasons = new Map();
  for (const paper of visiblePapers.filter((item) => !item.trendEligible)) {
    qualityReasons.set(paper.evidenceReason, (qualityReasons.get(paper.evidenceReason) || 0) + 1);
  }
  for (const question of excludedQuestions) {
    qualityReasons.set(question.exclusionReason, (qualityReasons.get(question.exclusionReason) || 0) + 1);
  }

  return {
    filters: { fromYear, toYear, examFilter },
    examinations,
    papers: visiblePapers,
    eligiblePapers,
    questions: eligibleQuestions,
    excludedQuestions,
    mappings: verifiedMappings,
    yearTrend,
    subjectCounts,
    difficultyCounts,
    questionFamilies,
    recurringPatterns,
    skillProfiles,
    conceptCombinations,
    concepts: [...conceptsById.values()].sort((a, b) => b.count - a.count).slice(0, 12),
    stats: {
      visiblePapers: visiblePapers.length,
      eligiblePapers: eligiblePapers.length,
      verifiedQuestions: eligibleQuestions.length,
      yearsCovered,
      mappedQuestions: mappedQuestionCount,
      mappingRate,
      declaredQuestions,
      paperQuestionCoverage
    },
    quality: {
      papersPending: visiblePapers.length - eligiblePapers.length,
      excludedQuestions: excludedQuestions.length,
      reasons: [...qualityReasons.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
      unmappedQuestions: eligibleQuestions.length - mappedQuestionCount,
      truncated: Boolean(data.meta?.truncated)
    }
  };
}
