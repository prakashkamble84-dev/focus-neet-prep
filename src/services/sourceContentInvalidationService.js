import { sdk } from '@/services/sdk';
import { getLookupId } from '@/services/sourceVerificationService';

async function fetchRows(table, fields, limit = 5000) {
  const result = await sdk.table(table).select(fields).limit(limit, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not inspect ' + table + ' dependencies');
  return result.data || [];
}

async function updateRow(table, values) {
  const result = await sdk.table(table).update(values);
  if (!result.data?.length) {
    throw new Error(result.messages?.join('; ') || result.message || 'Could not invalidate ' + table + ' record ' + values.Id);
  }
}

export async function invalidateSourceDependents(versionId, reviewerId, notes) {
  if (!versionId || !reviewerId) {
    return { success: false, message: 'A source version and signed-in reviewer are required to invalidate dependent academic content.' };
  }

  try {
    const [
      syllabi,
      nodes,
      relationships,
      questionMappings,
      crosswalks
    ] = await Promise.all([
      fetchRows('syllabus_versions_c', ['Id', 'Name', 'source_document_version_c', 'status_c'], 1000),
      fetchRows('curriculum_nodes_c', ['Id', 'Name', 'syllabus_version_c', 'source_document_version_c', 'status_c', 'verified_c'], 5000),
      fetchRows('concept_relationships_c', ['Id', 'Name', 'from_node_c', 'to_node_c', 'status_c'], 5000),
      fetchRows('question_concept_mappings_c', ['Id', 'Name', 'curriculum_node_c', 'status_c', 'verified_c'], 5000),
      fetchRows('historical_syllabus_crosswalks_c', ['Id', 'Name', 'source_version_c', 'target_version_c', 'status_c'], 3000)
    ]);

    const linkedSyllabi = syllabi.filter((row) => (
      String(getLookupId(row.source_document_version_c) || '') === String(versionId)
    ));
    const syllabusIds = new Set(linkedSyllabi.map((row) => String(row.Id)));
    const invalidatedNodes = nodes.filter((node) => (
      syllabusIds.has(String(getLookupId(node.syllabus_version_c) || '')) ||
      String(getLookupId(node.source_document_version_c) || '') === String(versionId)
    ));
    const nodeIds = new Set(invalidatedNodes.map((node) => String(node.Id)));

    for (const syllabus of linkedSyllabi) {
      if (syllabus.status_c !== 'Review') {
        await updateRow('syllabus_versions_c', { Id: syllabus.Id, status_c: 'Review' });
      }
    }

    for (const node of invalidatedNodes) {
      if (node.status_c !== 'Review' || node.verified_c === true) {
        await updateRow('curriculum_nodes_c', {
          Id: node.Id,
          status_c: 'Review',
          verified_c: false
        });
      }
    }

    const linkedRelationships = relationships.filter((edge) => (
      nodeIds.has(String(getLookupId(edge.from_node_c) || '')) ||
      nodeIds.has(String(getLookupId(edge.to_node_c) || ''))
    ));
    for (const edge of linkedRelationships) {
      if (edge.status_c !== 'Review') {
        await updateRow('concept_relationships_c', { Id: edge.Id, status_c: 'Review' });
      }
    }

    const linkedMappings = questionMappings.filter((mapping) => (
      nodeIds.has(String(getLookupId(mapping.curriculum_node_c) || ''))
    ));
    for (const mapping of linkedMappings) {
      if (mapping.status_c !== 'Review' || mapping.verified_c === true) {
        await updateRow('question_concept_mappings_c', {
          Id: mapping.Id,
          status_c: 'Review',
          verified_c: false
        });
      }
    }

    const linkedCrosswalks = crosswalks.filter((row) => (
      String(getLookupId(row.source_version_c) || '') === String(versionId) ||
      String(getLookupId(row.target_version_c) || '') === String(versionId) ||
      syllabusIds.has(String(getLookupId(row.source_version_c) || '')) ||
      syllabusIds.has(String(getLookupId(row.target_version_c) || ''))
    ));
    for (const crosswalk of linkedCrosswalks) {
      if (crosswalk.status_c !== 'Review') {
        await updateRow('historical_syllabus_crosswalks_c', { Id: crosswalk.Id, status_c: 'Review' });
      }
    }

    if (syllabusIds.size || nodeIds.size || linkedRelationships.length || linkedMappings.length || linkedCrosswalks.length) {
      const audit = await sdk.table('content_approvals_c').create({
        Name: 'Source change invalidated dependent academic content · ' + versionId,
        content_type_c: 'Source',
        record_identifier_c: 'source-version:' + String(versionId),
        content_version_c: String(versionId),
        review_status_c: 'Changes',
        reviewer_user_c: reviewerId,
        submitted_by_c: reviewerId,
        decision_notes_c: String(notes || 'Source review reopened.') +
          '\nInvalidated ' + syllabusIds.size + ' syllabus versions, ' +
          nodeIds.size + ' curriculum nodes, ' + linkedRelationships.length +
          ' concept relationships, ' + linkedMappings.length +
          ' question mappings and ' + linkedCrosswalks.length + ' historical crosswalks. All must be reviewed again before learner release.',
        submitted_at_c: new Date().toISOString(),
        resolved_at_c: new Date().toISOString()
      });
      if (!audit.data?.length) {
        throw new Error(audit.messages?.join('; ') || audit.message || 'Source-change invalidation audit could not be recorded.');
      }
    }

    return {
      success: true,
      invalidated: {
        syllabi: syllabusIds.size,
        nodes: nodeIds.size,
        relationships: linkedRelationships.length,
        questionMappings: linkedMappings.length,
        crosswalks: linkedCrosswalks.length
      }
    };
  } catch (error) {
    return { success: false, message: error.message || 'Dependent academic content could not be fully invalidated.' };
  }
}
