import { sdk } from '@/services/sdk';

async function fetchRows(tableName, fields, limit = 5000) {
  const result = await sdk.table(tableName)
    .select(fields)
    .limit(limit, 0)
    .fetch();

  if (!result.success) {
    throw new Error(result.message || 'Could not load ' + tableName);
  }

  const rows = result.data || [];
  return {
    rows,
    total: Number(result.total ?? rows.length),
    truncated: Boolean(result.hasMore) || Number(result.total ?? rows.length) > rows.length
  };
}

export async function fetchHistoricalIntelligenceData({ includeReviews = false } = {}) {
  const tasks = [
    fetchRows('historical_papers_c', [
      'Id',
      'Name',
      'examination_c',
      'source_document_c',
      'exam_year_c',
      'session_c',
      'paper_code_c',
      'paper_type_c',
      'question_count_c',
      'rights_status_c',
      'status_c',
      'difficulty_summary_c',
      'review_notes_c',
      'CreatedOn',
      'ModifiedOn'
    ]),
    fetchRows('questions_c', [
      'Id',
      'Name',
      'examination_c',
      'source_type_c',
      'status_c',
      'question_type_c',
      'difficulty_c',
      'historical_year_c',
      'historical_session_c',
      'historical_question_number_c',
      'historical_page_number_c',
      'question_family_code_c',
      'concept_dna_c',
      'skill_dna_c',
      'approach_pattern_c',
      'concept_count_c',
      'recurring_pattern_group_c',
      'concept_combination_c',
      'extraction_confidence_c',
      'extraction_status_c',
      'answer_validation_status_c',
      'source_document_c',
      'historical_paper_c',
      'rights_status_c'
    ]),
    fetchRows('question_concept_mappings_c', [
      'Id',
      'question_c',
      'curriculum_node_c',
      'mapping_type_c',
      'confidence_c',
      'verified_c',
      'status_c'
    ]),
    fetchRows('curriculum_nodes_c', [
      'Id',
      'Name',
      'node_type_c',
      'subject_c',
      'status_c',
      'verified_c',
      'node_path_c'
    ]),
    fetchRows('examinations_c', [
      'Id',
      'Name',
      'code_c',
      'exam_type_c',
      'active_c'
    ]),
    fetchRows('source_documents_c', [
      'Id',
      'Name',
      'document_type_c',
      'source_category_c',
      'rights_status_c',
      'verification_status_c',
      'ingestion_status_c',
      'official_url_c',
      'examination_c'
    ])
  ];

  if (includeReviews) {
    tasks.push(fetchRows('question_reviews_c', [
      'Id',
      'Name',
      'question_c',
      'review_type_c',
      'review_status_c',
      'reviewer_user_c',
      'reviewed_at_c',
      'review_notes_c'
    ]));
  }

  const results = await Promise.all(tasks);
  const [papers, questions, mappings, nodes, examinations, sourceDocuments, reviews] = results;

  return {
    papers: papers.rows,
    questions: questions.rows,
    mappings: mappings.rows,
    nodes: nodes.rows,
    examinations: examinations.rows,
    sourceDocuments: sourceDocuments.rows,
    reviews: reviews?.rows || [],
    meta: {
      papers: papers.total,
      questions: questions.total,
      mappings: mappings.total,
      nodes: nodes.total,
      examinations: examinations.total,
      sourceDocuments: sourceDocuments.total,
      reviews: reviews?.total || 0,
      truncated: results.some((result) => result.truncated)
    }
  };
}
