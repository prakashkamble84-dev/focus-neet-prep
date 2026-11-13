function getLookupId(value) {
  return value && typeof value === 'object'
    ? value.Id ?? value.id ?? value.value ?? null
    : value ?? null;
}

export function buildSourceInvalidationPlan({
  versionId,
  sourceDocumentId,
  syllabi = [],
  nodes = [],
  relationships = [],
  questionMappings = [],
  crosswalks = [],
  sourceExtractions = [],
  historicalPapers = [],
  historicalQuestions = [],
  historicalQuestionMappings = [],
  historicalQuestionOptions = [],
  invalidatePages = false
}) {
  const linkedSyllabi = syllabi.filter((row) =>
    String(getLookupId(row.source_document_version_c) || '') === String(versionId)
  );
  const syllabusIds = new Set(linkedSyllabi.map((row) => String(row.Id)));

  const invalidatedNodes = nodes.filter((node) =>
    syllabusIds.has(String(getLookupId(node.syllabus_version_c) || '')) ||
    String(getLookupId(node.source_document_version_c) || '') === String(versionId)
  );
  const nodeIds = new Set(invalidatedNodes.map((node) => String(node.Id)));

  const linkedRelationships = relationships.filter((edge) =>
    nodeIds.has(String(getLookupId(edge.from_node_c) || '')) ||
    nodeIds.has(String(getLookupId(edge.to_node_c) || ''))
  );
  const linkedMappings = questionMappings.filter((mapping) =>
    nodeIds.has(String(getLookupId(mapping.curriculum_node_c) || ''))
  );
  const linkedCrosswalks = crosswalks.filter((row) =>
    String(getLookupId(row.source_version_c) || '') === String(versionId) ||
    String(getLookupId(row.target_version_c) || '') === String(versionId) ||
    syllabusIds.has(String(getLookupId(row.source_version_c) || '')) ||
    syllabusIds.has(String(getLookupId(row.target_version_c) || ''))
  );
  const invalidatedPageExtractions = invalidatePages
    ? sourceExtractions.filter((row) =>
        String(getLookupId(row.document_version_c) || '') === String(versionId)
      )
    : [];

  const linkedHistoricalPapers = sourceDocumentId
    ? historicalPapers.filter((paper) =>
        String(getLookupId(paper.source_document_c) || '') === String(sourceDocumentId)
      )
    : [];
  const historicalPaperIds = new Set(linkedHistoricalPapers.map((paper) => String(paper.Id)));

  const invalidatedHistoricalQuestions = historicalQuestions.filter((question) =>
    historicalPaperIds.has(String(getLookupId(question.historical_paper_c) || '')) ||
    (sourceDocumentId && String(getLookupId(question.source_document_c) || '') === String(sourceDocumentId))
  );
  const historicalQuestionIds = new Set(invalidatedHistoricalQuestions.map((question) => String(question.Id)));

  const invalidatedHistoricalMappings = historicalQuestionMappings.filter((mapping) =>
    historicalQuestionIds.has(String(getLookupId(mapping.question_c) || ''))
  );
  const invalidatedHistoricalOptions = historicalQuestionOptions.filter((option) =>
    historicalQuestionIds.has(String(getLookupId(option.question_c) || ''))
  );

  return {
    linkedSyllabi,
    invalidatedNodes,
    linkedRelationships,
    linkedMappings,
    linkedCrosswalks,
    invalidatedPageExtractions,
    linkedHistoricalPapers,
    invalidatedHistoricalQuestions,
    invalidatedHistoricalMappings,
    invalidatedHistoricalOptions,
    counts: {
      syllabi: linkedSyllabi.length,
      nodes: invalidatedNodes.length,
      relationships: linkedRelationships.length,
      questionMappings: linkedMappings.length,
      crosswalks: linkedCrosswalks.length,
      pageExtractions: invalidatedPageExtractions.length,
      historicalPapers: linkedHistoricalPapers.length,
      historicalQuestions: invalidatedHistoricalQuestions.length,
      historicalQuestionMappings: invalidatedHistoricalMappings.length,
      historicalQuestionOptions: invalidatedHistoricalOptions.length
    }
  };
}
