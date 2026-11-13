import {
  buildHistoricalIntelligence,
  evaluateHistoricalPaper,
  evaluateHistoricalQuestion
} from '@/services/historicalIntelligenceRules';

function fixture(overrides = {}) {
  const sourceDocuments = [{
    Id: 'doc-1',
    Name: 'Official paper PDF',
    document_type_c: 'Paper',
    source_category_c: 'Official',
    rights_status_c: 'Public',
    verification_status_c: 'Verified',
    ingestion_status_c: 'Complete'
  }];
  const examinations = [{
    Id: 'exam-1',
    Name: 'JEE Main',
    exam_type_c: 'JEE Main'
  }];
  const papers = [{
    Id: 'paper-1',
    Name: 'JEE Main 2026 Session 1',
    examination_c: 'exam-1',
    source_document_c: 'doc-1',
    exam_year_c: 2026,
    session_c: 'Session 1',
    paper_code_c: 'JM-2026-S1',
    paper_type_c: 'Main',
    question_count_c: 1,
    rights_status_c: 'Public',
    status_c: 'Published'
  }];
  const questions = [{
    Id: 'question-1',
    Name: 'Question 1',
    examination_c: 'exam-1',
    source_type_c: 'Historical',
    status_c: 'Published',
    question_type_c: 'MCQ',
    difficulty_c: 'Moderate',
    historical_year_c: 2026,
    historical_question_number_c: '1',
    question_family_code_c: 'FAM-01',
    recurring_pattern_group_c: 'Vectors',
    concept_combination_c: 'Vectors + Kinematics',
    skill_dna_c: 'Vector decomposition',
    extraction_status_c: 'Verified',
    answer_validation_status_c: 'Verified',
    source_document_c: 'doc-1',
    historical_paper_c: 'paper-1',
    rights_status_c: 'Public'
  }];
  const mappings = [{
    Id: 'mapping-1',
    question_c: 'question-1',
    curriculum_node_c: 'node-1',
    mapping_type_c: 'Primary',
    verified_c: true,
    status_c: 'Verified'
  }];
  const nodes = [{
    Id: 'node-1',
    Name: 'Vectors',
    node_type_c: 'Concept',
    subject_c: 'Physics',
    status_c: 'Published',
    verified_c: true
  }];

  return {
    sourceDocuments,
    examinations,
    papers,
    questions,
    mappings,
    nodes,
    ...overrides
  };
}

export function runHistoricalIntelligenceSelfTests() {
  const checks = [];
  const test = (name, fn) => {
    try {
      const passed = Boolean(fn());
      checks.push({ name, passed, detail: passed ? 'Passed' : 'Assertion returned false' });
    } catch (error) {
      checks.push({ name, passed: false, detail: error.message });
    }
  };

  const base = fixture();
  const goodPaper = base.papers[0];
  const goodDoc = base.sourceDocuments[0];
  const goodQuestion = base.questions[0];

  test('Verified official paper is evidence-ready', () =>
    evaluateHistoricalPaper(goodPaper, goodDoc).eligible);

  test('Missing source document blocks paper evidence', () =>
    !evaluateHistoricalPaper(goodPaper, null).eligible);

  test('Unknown rights block paper evidence', () => {
    const paper = { ...goodPaper, rights_status_c: 'Unknown' };
    return !evaluateHistoricalPaper(paper, goodDoc).eligible;
  });

  test('Restricted source rights block paper evidence', () => {
    const doc = { ...goodDoc, rights_status_c: 'Restricted' };
    return !evaluateHistoricalPaper(goodPaper, doc).eligible;
  });

  test('Unverified source document blocks paper evidence', () => {
    const doc = { ...goodDoc, verification_status_c: 'Review' };
    return !evaluateHistoricalPaper(goodPaper, doc).eligible;
  });

  test('Incomplete source ingestion blocks paper evidence', () => {
    const doc = { ...goodDoc, ingestion_status_c: 'Extracted' };
    return !evaluateHistoricalPaper(goodPaper, doc).eligible;
  });

  test('Secondary source is excluded from exam trend evidence', () => {
    const doc = { ...goodDoc, source_category_c: 'Secondary' };
    return !evaluateHistoricalPaper(goodPaper, doc).eligible;
  });

  test('Draft paper is excluded', () => {
    const paper = { ...goodPaper, status_c: 'Review' };
    return !evaluateHistoricalPaper(paper, goodDoc).eligible;
  });

  test('Verified historical question is evidence-ready', () =>
    evaluateHistoricalQuestion(goodQuestion, goodPaper, goodDoc).eligible);

  test('Question without paper link is excluded', () => {
    const question = { ...goodQuestion, historical_paper_c: null };
    return !evaluateHistoricalQuestion(question, goodPaper, goodDoc).eligible;
  });

  test('Unverified extraction is excluded', () => {
    const question = { ...goodQuestion, extraction_status_c: 'Review' };
    return !evaluateHistoricalQuestion(question, goodPaper, goodDoc).eligible;
  });

  test('Unvalidated answer key is excluded', () => {
    const question = { ...goodQuestion, answer_validation_status_c: 'Pending' };
    return !evaluateHistoricalQuestion(question, goodPaper, goodDoc).eligible;
  });

  test('Question year mismatch is excluded', () => {
    const question = { ...goodQuestion, historical_year_c: 2025 };
    return !evaluateHistoricalQuestion(question, goodPaper, goodDoc).eligible;
  });

  test('Question examination mismatch is excluded', () => {
    const question = { ...goodQuestion, examination_c: 'exam-2' };
    return !evaluateHistoricalQuestion(question, goodPaper, goodDoc).eligible;
  });

  test('Question source mismatch is excluded', () => {
    const question = { ...goodQuestion, source_document_c: 'doc-2' };
    return !evaluateHistoricalQuestion(question, goodPaper, goodDoc).eligible;
  });

  test('Only verified mappings count toward concept coverage', () => {
    const data = fixture({
      mappings: [{ ...base.mappings[0], status_c: 'Review', verified_c: false }]
    });
    const model = buildHistoricalIntelligence(data, { currentYear: 2026, fromYear: 2026, toYear: 2026 });
    return model.stats.mappingRate === 0;
  });

  test('Published verified concept mapping contributes to coverage', () => {
    const model = buildHistoricalIntelligence(base, { currentYear: 2026, fromYear: 2026, toYear: 2026 });
    return model.stats.mappingRate === 100 && model.subjectCounts[0]?.subject === 'Physics';
  });

  test('Thirty-year series includes every year, including zero-paper years', () => {
    const model = buildHistoricalIntelligence(base, { currentYear: 2026, fromYear: 1997, toYear: 2026 });
    return model.yearTrend.length === 30 && model.yearTrend[0].year === '1997' && model.yearTrend[0].papers === 0;
  });

  test('Year filter excludes papers outside the selected range', () => {
    const model = buildHistoricalIntelligence(base, { currentYear: 2026, fromYear: 2024, toYear: 2025 });
    return model.stats.visiblePapers === 0 && model.stats.verifiedQuestions === 0;
  });

  test('Exam filter excludes papers from other examinations', () => {
    const otherExam = { Id: 'exam-2', Name: 'NEET UG' };
    const model = buildHistoricalIntelligence({
      ...base,
      examinations: [...base.examinations, otherExam]
    }, { currentYear: 2026, fromYear: 2026, toYear: 2026, examFilter: 'NEET UG' });
    return model.stats.visiblePapers === 0;
  });

  const passed = checks.filter((item) => item.passed).length;
  return {
    passed,
    failed: checks.length - passed,
    total: checks.length,
    checks
  };
}
