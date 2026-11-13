import {
  buildHistoricalIntelligence,
  evaluateHistoricalPaper,
  evaluateHistoricalQuestion
} from '@/services/historicalIntelligenceRules';
import { splitQuestionsFromPage } from '@/services/historicalPdfIngestionService';
import { inferQuestionType, parseQuestionOptions } from '@/services/historicalQuestionOptionParser';

function fixture(overrides = {}) {
  const sourceDocuments = [{
    Id: 'doc-1',
    Name: 'Official paper PDF',
    document_type_c: 'Paper',
    source_category_c: 'Official',
    examination_c: 'exam-1',
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

  test('Unknown paper rights block evidence', () =>
    !evaluateHistoricalPaper({ ...goodPaper, rights_status_c: 'Unknown' }, goodDoc).eligible);

  test('Paper and source rights must match', () =>
    !evaluateHistoricalPaper(goodPaper, { ...goodDoc, rights_status_c: 'Licensed' }).eligible);

  test('Restricted source rights block evidence', () =>
    !evaluateHistoricalPaper(goodPaper, { ...goodDoc, rights_status_c: 'Restricted' }).eligible);

  test('Unverified source document blocks evidence', () =>
    !evaluateHistoricalPaper(goodPaper, { ...goodDoc, verification_status_c: 'Review' }).eligible);

  test('Incomplete source ingestion blocks evidence', () =>
    !evaluateHistoricalPaper(goodPaper, { ...goodDoc, ingestion_status_c: 'Extracted' }).eligible);

  test('Secondary source is excluded from exam trend evidence', () =>
    !evaluateHistoricalPaper(goodPaper, { ...goodDoc, source_category_c: 'Secondary' }).eligible);

  test('Unclassified source category is excluded', () =>
    !evaluateHistoricalPaper(goodPaper, { ...goodDoc, source_category_c: 'Other' }).eligible);

  test('Syllabus document cannot serve as a historical paper', () =>
    !evaluateHistoricalPaper(goodPaper, { ...goodDoc, document_type_c: 'Syllabus' }).eligible);

  test('Paper and source examination must match', () =>
    !evaluateHistoricalPaper(goodPaper, { ...goodDoc, examination_c: 'exam-2' }).eligible);

  test('Missing paper examination blocks evidence', () =>
    !evaluateHistoricalPaper({ ...goodPaper, examination_c: null }, goodDoc).eligible);

  test('Missing paper source link blocks evidence', () =>
    !evaluateHistoricalPaper({ ...goodPaper, source_document_c: null }, goodDoc).eligible);

  test('Draft paper is excluded', () =>
    !evaluateHistoricalPaper({ ...goodPaper, status_c: 'Review' }, goodDoc).eligible);

  test('Verified historical question is evidence-ready', () =>
    evaluateHistoricalQuestion(goodQuestion, goodPaper, goodDoc).eligible);

  test('Question without paper link is excluded', () =>
    !evaluateHistoricalQuestion({ ...goodQuestion, historical_paper_c: null }, goodPaper, goodDoc).eligible);

  test('Question and paper record IDs must match', () =>
    !evaluateHistoricalQuestion({ ...goodQuestion, historical_paper_c: 'paper-2' }, goodPaper, goodDoc).eligible);

  test('Unverified extraction is excluded', () =>
    !evaluateHistoricalQuestion({ ...goodQuestion, extraction_status_c: 'Review' }, goodPaper, goodDoc).eligible);

  test('Unvalidated answer key is excluded', () =>
    !evaluateHistoricalQuestion({ ...goodQuestion, answer_validation_status_c: 'Pending' }, goodPaper, goodDoc).eligible);

  test('Question rights must match the paper', () =>
    !evaluateHistoricalQuestion({ ...goodQuestion, rights_status_c: 'Licensed' }, goodPaper, goodDoc).eligible);

  test('Question year mismatch is excluded', () =>
    !evaluateHistoricalQuestion({ ...goodQuestion, historical_year_c: 2025 }, goodPaper, goodDoc).eligible);

  test('Missing question year is excluded', () =>
    !evaluateHistoricalQuestion({ ...goodQuestion, historical_year_c: null }, goodPaper, goodDoc).eligible);

  test('Question examination mismatch is excluded', () =>
    !evaluateHistoricalQuestion({ ...goodQuestion, examination_c: 'exam-2' }, goodPaper, goodDoc).eligible);

  test('Missing question examination is excluded', () =>
    !evaluateHistoricalQuestion({ ...goodQuestion, examination_c: null }, goodPaper, goodDoc).eligible);

  test('Question source mismatch is excluded', () =>
    !evaluateHistoricalQuestion({ ...goodQuestion, source_document_c: 'doc-2' }, goodPaper, goodDoc).eligible);

  test('Missing question source is excluded', () =>
    !evaluateHistoricalQuestion({ ...goodQuestion, source_document_c: null }, goodPaper, goodDoc).eligible);

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

  test('Ineligible paper questions are visible in evidence exclusions', () => {
    const model = buildHistoricalIntelligence(fixture({
      papers: [{ ...goodPaper, status_c: 'Review' }]
    }), { currentYear: 2026, fromYear: 2026, toYear: 2026 });
    return model.stats.verifiedQuestions === 0 &&
      model.quality.excludedQuestions === 1 &&
      model.quality.reasons.some((row) => row.reason === 'Paper has not passed academic verification');
  });

  test('Unlinked historical questions are counted exactly once', () => {
    const model = buildHistoricalIntelligence(fixture({
      questions: [{ ...goodQuestion, historical_paper_c: null }]
    }), { currentYear: 2026, fromYear: 2026, toYear: 2026 });
    return model.quality.excludedQuestions === 1 &&
      model.quality.reasons.some((row) => row.reason === 'Question is not linked to a historical paper');
  });

  test('Thirty-year series includes every year, including zero-paper years', () => {
    const model = buildHistoricalIntelligence(base, { currentYear: 2026, fromYear: 1997, toYear: 2026 });
    return model.yearTrend.length === 30 &&
      model.yearTrend[0].year === '1997' &&
      model.yearTrend[0].papers === 0;
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

  test('Multiple numbered questions split into blocks', () => {
    const input = '1. A body moves with constant acceleration.\nA. Option one\nB. Option two\n2. Find the final velocity of the body.';
    return splitQuestionsFromPage(input, 4).length === 2;
  });

  test('Single numbered question is retained', () => {
    const input = 'Q1. Calculate the resultant force acting on a body of mass 2 kg.';
    const rows = splitQuestionsFromPage(input, 3);
    return rows.length === 1 && rows[0].pageNumber === 3;
  });

  test('Unnumbered prose is not segmented as a question', () => {
    const input = 'This paragraph describes the examination rules and candidate instructions but contains no numbered question.';
    return splitQuestionsFromPage(input, 1).length === 0;
  });

  test('Multiple-choice options are extracted as structured rows', () => {
    const options = parseQuestionOptions('1. Find the force.\\n(A) 2 N\\n(B) 4 N\\n(C) 6 N\\n(D) 8 N');
    return options.length === 4 && options[0].key === 'A' && options[3].text === '8 N';
  });

  test('Multi-select instruction is distinguished from single-correct MCQ', () => {
    const body = 'Select all that apply.\\nA. One\\nB. Two\\nC. Three';
    const options = parseQuestionOptions(body);
    return options.length === 3 && inferQuestionType(body, options) === 'Multi';
  });

  test('Numerical response is classified when option rows are absent', () => {
    const body = 'Enter the numerical value of the acceleration in m/s squared.';
    return inferQuestionType(body, []) === 'Numeric';
  });

  const passed = checks.filter((item) => item.passed).length;
  return {
    passed,
    failed: checks.length - passed,
    total: checks.length,
    checks
  };
}
