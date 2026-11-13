import { sdk } from '@/services/sdk';
import { buildSourceInvalidationPlan } from '@/services/sourceInvalidationRules';

const PAGE_SIZE = 1000;
const MAX_ROWS_PER_TABLE = 50000;

function getLookupId(value) {
  return value && typeof value === 'object'
    ? value.Id ?? value.id ?? null
    : value ?? null;
}

async function fetchAllRows(tableName, fields, filter = null) {
  const allRows = [];
  let offset = 0;

  while (true) {
    let query = sdk.table(tableName).select(fields);
    if (filter) query = query.where(filter);

    const result = await query.limit(PAGE_SIZE, offset).fetch();
    if (!result.success) {
      throw new Error(result.message || 'Could not inspect ' + tableName + ' dependencies');
    }

    const rows = result.data || [];
    allRows.push(...rows);
    if (allRows.length > MAX_ROWS_PER_TABLE) {
      throw new Error(
        'More than ' + MAX_ROWS_PER_TABLE + ' ' + tableName +
        ' rows are in scope. Invalidation stopped safely rather than leaving a partial dependency set.'
      );
    }

    if (result.hasMore === false || rows.length < PAGE_SIZE) break;
    if (Number.isFinite(Number(result.total)) && Number(result.total) <= allRows.length) break;
    if (!rows.length) break;
    offset += rows.length;
  }

  return allRows;
}

async function updateRow(request, tableName, id) {
  const result = await request;
  if (!result.data?.length) {
    throw new Error(result.messages?.join('; ') || result.message || 'Could not invalidate ' + tableName + ' record ' + id);
  }
}

export async function invalidateSourceDependents(versionId, reviewerId, notes, invalidatePages = false) {
  if (!versionId || !reviewerId) {
    return { success: false, message: 'A source version and signed-in reviewer are required to invalidate dependent academic content.' };
  }

  try {
    const { eq } = window.ApperSDK.CoreSDK;
    const versions = await fetchAllRows(
      'source_document_versions_c',
      ['Id', 'source_document_c'],
      eq('Id', versionId)
    );
    const sourceVersion = versions[0];
    if (!sourceVersion) {
      throw new Error('The source document version could not be found. No dependent content was changed.');
    }

    const sourceDocumentId = getLookupId(sourceVersion.source_document_c);
    const documents = sourceDocumentId
      ? await fetchAllRows(
          'source_documents_c',
          ['Id', 'Name', 'document_type_c'],
          eq('Id', sourceDocumentId)
        )
      : [];
    const sourceDocument = documents[0] || null;

    const [syllabi, nodes, relationships, questionMappings, crosswalks] = await Promise.all([
      fetchAllRows('syllabus_versions_c',
        ['Id', 'Name', 'source_document_version_c', 'status_c']),
      fetchAllRows('curriculum_nodes_c',
        ['Id', 'Name', 'syllabus_version_c', 'source_document_version_c', 'status_c', 'verified_c']),
      fetchAllRows('concept_relationships_c',
        ['Id', 'Name', 'from_node_c', 'to_node_c', 'status_c']),
      fetchAllRows('question_concept_mappings_c',
        ['Id', 'Name', 'curriculum_node_c', 'status_c', 'verified_c']),
      fetchAllRows('historical_syllabus_crosswalks_c',
        ['Id', 'Name', 'source_version_c', 'target_version_c', 'status_c'])
    ]);

    const [
      historicalPapers,
      historicalQuestions,
      historicalQuestionMappings,
      historicalQuestionOptions
    ] = sourceDocument?.document_type_c === 'Paper'
      ? await Promise.all([
          fetchAllRows(
            'historical_papers_c',
            ['Id', 'Name', 'source_document_c', 'status_c', 'rights_status_c', 'review_notes_c'],
            eq('source_document_c', sourceDocumentId)
          ),
          fetchAllRows(
            'questions_c',
            ['Id', 'Name', 'source_document_c', 'historical_paper_c', 'status_c', 'extraction_status_c', 'answer_validation_status_c', 'answer_key_c', 'solution_c', 'rights_status_c', 'rights_notes_c']
          ),
          fetchAllRows(
            'question_concept_mappings_c',
            ['Id', 'Name', 'question_c', 'curriculum_node_c', 'status_c', 'verified_c']
          ),
          fetchAllRows(
            'question_options_c',
            ['Id', 'Name', 'question_c', 'status_c', 'is_correct_c']
          )
        ])
      : [[], [], [], []];

    const sourceExtractions = invalidatePages
      ? await fetchAllRows(
          'source_extractions_c',
          ['Id', 'Name', 'document_version_c', 'page_number_c', 'quality_status_c'],
          eq('document_version_c', versionId)
        )
      : [];

    const plan = buildSourceInvalidationPlan({
      versionId,
      sourceDocumentId,
      syllabi,
      nodes,
      relationships,
      questionMappings,
      crosswalks,
      sourceExtractions,
      historicalPapers,
      historicalQuestions,
      historicalQuestionMappings,
      historicalQuestionOptions,
      invalidatePages
    });

    for (const syllabus of plan.linkedSyllabi) {
      if (syllabus.status_c !== 'Review') {
        await updateRow(
          sdk.table('syllabus_versions_c').update({ Id: syllabus.Id, status_c: 'Review' }),
          'syllabus_versions_c',
          syllabus.Id
        );
      }
    }

    for (const node of plan.invalidatedNodes) {
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

    for (const edge of plan.linkedRelationships) {
      if (edge.status_c !== 'Review') {
        await updateRow(
          sdk.table('concept_relationships_c').update({ Id: edge.Id, status_c: 'Review' }),
          'concept_relationships_c',
          edge.Id
        );
      }
    }

    for (const mapping of plan.linkedMappings) {
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

    for (const crosswalk of plan.linkedCrosswalks) {
      if (crosswalk.status_c !== 'Review') {
        await updateRow(
          sdk.table('historical_syllabus_crosswalks_c').update({ Id: crosswalk.Id, status_c: 'Review' }),
          'historical_syllabus_crosswalks_c',
          crosswalk.Id
        );
      }
    }

    for (const extraction of plan.invalidatedPageExtractions) {
      if (extraction.quality_status_c !== 'Review') {
        await updateRow(
          sdk.table('source_extractions_c').update({ Id: extraction.Id, quality_status_c: 'Review' }),
          'source_extractions_c',
          extraction.Id
        );
      }
    }

    for (const paper of plan.linkedHistoricalPapers) {
      if (paper.status_c !== 'Review' || paper.rights_status_c !== 'Unknown') {
        await updateRow(
          sdk.table('historical_papers_c').update({
            Id: paper.Id,
            status_c: 'Review',
            rights_status_c: 'Unknown',
            review_notes_c: String(paper.review_notes_c || '') +
              '\nSource PDF or rights metadata changed. Re-run source verification, all page reviews, paper verification and academic publication.'
          }),
          'historical_papers_c',
          paper.Id
        );
      }
    }

    for (const question of plan.invalidatedHistoricalQuestions) {
      if (
        question.status_c !== 'Review' ||
        question.extraction_status_c !== 'Review' ||
        question.answer_validation_status_c !== 'Pending' ||
        question.answer_key_c ||
        question.solution_c ||
        question.rights_status_c !== 'Unknown'
      ) {
        await updateRow(
          sdk.table('questions_c').update({
            Id: question.Id,
            status_c: 'Review',
            extraction_status_c: 'Review',
            answer_validation_status_c: 'Pending',
            answer_key_c: null,
            solution_c: null,
            rights_status_c: 'Unknown',
            rights_notes_c: String(question.rights_notes_c || '') +
              '\nSource PDF or rights metadata changed. Previous extraction, answer and reuse approvals were invalidated; review the new source again.'
          }),
          'questions_c',
          question.Id
        );
      }
    }

    for (const mapping of plan.invalidatedHistoricalMappings) {
      if (mapping.status_c !== 'Review' || mapping.verified_c === true) {
        await updateRow(
          sdk.table('question_concept_mappings_c').update({
            Id: mapping.Id,
            status_c: 'Review',
            verified_c: false
          }),
          'historical question concept mappings',
          mapping.Id
        );
      }
    }

    for (const option of plan.invalidatedHistoricalOptions) {
      if (option.status_c !== 'Draft' || option.is_correct_c === true) {
        await updateRow(
          sdk.table('question_options_c').update({
            Id: option.Id,
            status_c: 'Draft',
            is_correct_c: false
          }),
          'question_options_c',
          option.Id
        );
      }
    }

    if (Object.values(plan.counts).some((count) => count > 0)) {
      const audit = await sdk.table('content_approvals_c').create({
        Name: 'Source change invalidated dependent academic content · ' + versionId,
        content_type_c: 'Source',
        record_identifier_c: 'source-version:' + String(versionId),
        content_version_c: String(versionId),
        review_status_c: 'Changes',
        reviewer_user_c: reviewerId,
        submitted_by_c: reviewerId,
        decision_notes_c: String(notes || 'Source review reopened.') +
          '\nInvalidated ' + plan.counts.syllabi + ' syllabus versions, ' +
          plan.counts.nodes + ' curriculum nodes, ' +
          plan.counts.relationships + ' concept relationships, ' +
          plan.counts.questionMappings + ' graph question mappings, ' +
          plan.counts.crosswalks + ' historical syllabus crosswalks, ' +
          plan.counts.pageExtractions + ' page extractions, ' +
          plan.counts.historicalPapers + ' historical papers, ' +
          plan.counts.historicalQuestions + ' historical question records, ' +
          plan.counts.historicalQuestionMappings + ' historical question-concept mappings, and ' +
          plan.counts.historicalQuestionOptions + ' historical answer-option rows. ' +
          'Affected records must be reviewed again before learner release.',
        submitted_at_c: new Date().toISOString(),
        resolved_at_c: new Date().toISOString()
      });

      if (!audit.data?.length) {
        throw new Error(audit.messages?.join('; ') || audit.message || 'Source-change invalidation audit could not be recorded.');
      }
    }

    return { success: true, invalidated: plan.counts };
  } catch (error) {
    return { success: false, message: error.message || 'Dependent academic content could not be fully invalidated.' };
  }
}
