import { sdk } from '@/services/sdk';

function getLookupId(value) {
  return value && typeof value === 'object' ? value.Id ?? null : value ?? null;
}

async function fetchRows(request, tableName) {
  const result = await request;
  if (!result.success) {
    throw new Error(result.message || 'Could not inspect ' + tableName + ' dependencies');
  }
  return result.data || [];
}

async function updateRow(request, tableName, id) {
  const result = await request;
  if (!result.data?.length) {
    throw new Error(result.messages?.join('; ') || result.message || 'Could not invalidate ' + tableName + ' record ' + id);
  }
}

export async function invalidateSourceDependents(versionId, reviewerId, notes) {
  if (!versionId || !reviewerId) {
    return { success: false, message: 'A source version and signed-in reviewer are required to invalidate dependent academic content.' };
  }

  try {
    const [syllabi, nodes, relationships, questionMappings, crosswalks] = await Promise.all([
      fetchRows(
        sdk.table('syllabus_versions_c')
          .select(['Id', 'Name', 'source_document_version_c', 'status_c'])
          .limit(1000, 0).fetch(),
        'syllabus_versions_c'
      ),
      fetchRows(
        sdk.table('curriculum_nodes_c')
          .select(['Id', 'Name', 'syllabus_version_c', 'source_document_version_c', 'status_c', 'verified_c'])
          .limit(5000, 0).fetch(),
        'curriculum_nodes_c'
      ),
      fetchRows(
        sdk.table('concept_relationships_c')
          .select(['Id', 'Name', 'from_node_c', 'to_node_c', 'status_c'])
          .limit(5000, 0).fetch(),
        'concept_relationships_c'
      ),
      fetchRows(
        sdk.table('question_concept_mappings_c')
          .select(['Id', 'Name', 'curriculum_node_c', 'status_c', 'verified_c'])
          .limit(5000, 0).fetch(),
        'question_concept_mappings_c'
      ),
      fetchRows(
        sdk.table('historical_syllabus_crosswalks_c')
          .select(['Id', 'Name', 'source_version_c', 'target_version_c', 'status_c'])
          .limit(3000, 0).fetch(),
        'historical_syllabus_crosswalks_c'
      )
    ]);

    const linkedSyllabi = syllabi.filter((row) =>
      String(getLookupId(row.source_document_version_c) || '') === String(versionId)
    );
    const syllabusIds = new Set(linkedSyllabi.map((row) => String(row.Id)));
    const invalidatedNodes = nodes.filter((node) =>
      syllabusIds.has(String(getLookupId(node.syllabus_version_c) || '')) ||
      String(getLookupId(node.source_document_version_c) || '') === String(versionId)
    );
    const nodeIds = new Set(invalidatedNodes.map((node) => String(node.Id)));

    for (const syllabus of linkedSyllabi) {
      if (syllabus.status_c !== 'Review') {
        await updateRow(
          sdk.table('syllabus_versions_c').update({ Id: syllabus.Id, status_c: 'Review' }),
          'syllabus_versions_c',
          syllabus.Id
        );
      }
    }

    for (const node of invalidatedNodes) {
      if (node.status_c !== 'Review' || node.verified_c === true) {
        await updateRow(
          sdk.table('curriculum_nodes_c').update({
            Id: node.Id,
            status_c: 'Review',
            verified_c: false
          }),
          'curriculum_nodes_c',
          node.Id
        );
      }
    }

    const linkedRelationships = relationships.filter((edge) =>
      nodeIds.has(String(getLookupId(edge.from_node_c) || '')) ||
      nodeIds.has(String(getLookupId(edge.to_node_c) || ''))
    );
    for (const edge of linkedRelationships) {
      if (edge.status_c !== 'Review') {
        await updateRow(
          sdk.table('concept_relationships_c').update({ Id: edge.Id, status_c: 'Review' }),
          'concept_relationships_c',
          edge.Id
        );
      }
    }

    const linkedMappings = questionMappings.filter((mapping) =>
      nodeIds.has(String(getLookupId(mapping.curriculum_node_c) || ''))
    );
    for (const mapping of linkedMappings) {
      if (mapping.status_c !== 'Review' || mapping.verified_c === true) {
        await updateRow(
          sdk.table('question_concept_mappings_c').update({
            Id: mapping.Id,
            status_c: 'Review',
            verified_c: false
          }),
          'question_concept_mappings_c',
          mapping.Id
        );
      }
    }

    const linkedCrosswalks = crosswalks.filter((row) =>
      String(getLookupId(row.source_version_c) || '') === String(versionId) ||
      String(getLookupId(row.target_version_c) || '') === String(versionId) ||
      syllabusIds.has(String(getLookupId(row.source_version_c) || '')) ||
      syllabusIds.has(String(getLookupId(row.target_version_c) || ''))
    );
    for (const crosswalk of linkedCrosswalks) {
      if (crosswalk.status_c !== 'Review') {
        await updateRow(
          sdk.table('historical_syllabus_crosswalks_c').update({ Id: crosswalk.Id, status_c: 'Review' }),
          'historical_syllabus_crosswalks_c',
          crosswalk.Id
        );
      }
    }

    const invalidationCounts = {
      syllabi: syllabusIds.size,
      nodes: nodeIds.size,
      relationships: linkedRelationships.length,
      questionMappings: linkedMappings.length,
      crosswalks: linkedCrosswalks.length
    };

    if (Object.values(invalidationCounts).some((count) => count > 0)) {
      const audit = await sdk.table('content_approvals_c').create({
        Name: 'Source change invalidated dependent academic content · ' + versionId,
        content_type_c: 'Source',
        record_identifier_c: 'source-version:' + String(versionId),
        content_version_c: String(versionId),
        review_status_c: 'Changes',
        reviewer_user_c: reviewerId,
        submitted_by_c: reviewerId,
        decision_notes_c: String(notes || 'Source review reopened.') +
          '\nInvalidated ' + invalidationCounts.syllabi + ' syllabus versions, ' +
          invalidationCounts.nodes + ' curriculum nodes, ' + invalidationCounts.relationships +
          ' concept relationships, ' + invalidationCounts.questionMappings +
          ' question mappings and ' + invalidationCounts.crosswalks +
          ' historical crosswalks. All must be reviewed again before learner release.',
        submitted_at_c: new Date().toISOString(),
        resolved_at_c: new Date().toISOString()
      });
      if (!audit.data?.length) {
        throw new Error(audit.messages?.join('; ') || audit.message || 'Source-change invalidation audit could not be recorded.');
      }
    }

    return { success: true, invalidated: invalidationCounts };
  } catch (error) {
    return { success: false, message: error.message || 'Dependent academic content could not be fully invalidated.' };
  }
}
