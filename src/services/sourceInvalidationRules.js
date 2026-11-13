function getLookupId(value) {
  return value && typeof value === 'object' ? value.Id ?? null : value ?? null;
}

export function buildSourceInvalidationPlan({
  versionId,
  syllabi = [],
  nodes = [],
  relationships = [],
  questionMappings = [],
  crosswalks = []
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

  return {
    linkedSyllabi,
    invalidatedNodes,
    linkedRelationships,
    linkedMappings,
    linkedCrosswalks,
    counts: {
      syllabi: linkedSyllabi.length,
      nodes: invalidatedNodes.length,
      relationships: linkedRelationships.length,
      questionMappings: linkedMappings.length,
      crosswalks: linkedCrosswalks.length
    }
  };
}
