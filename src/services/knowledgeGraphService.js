import { sdk } from '@/services/sdk';
import {
  buildGraphDiagnostics,
  getLookupId,
  getLookupName
} from '@/services/knowledgeGraphRules';

async function unwrapTableRequest(request, tableName) {
  const result = await request;
  if (!result.success) throw new Error(result.message || 'Could not load ' + tableName);
  return result.data || [];
}

export async function fetchKnowledgeGraphData(includeStudentMastery = false) {
  const requests = [
    unwrapTableRequest(
      sdk.table('examinations_c').select(['Id', 'Name', 'code_c', 'exam_type_c', 'active_c']).limit(100, 0).fetch(),
      'examinations_c'
    ),
    unwrapTableRequest(
      sdk.table('syllabus_versions_c').select(['Id', 'Name', 'examination_c', 'source_document_c', 'source_document_version_c', 'academic_year_c', 'version_label_c', 'status_c']).limit(300, 0).fetch(),
      'syllabus_versions_c'
    ),
    unwrapTableRequest(
      sdk.table('curriculum_nodes_c').select(['Id', 'Name', 'syllabus_version_c', 'node_code_c', 'node_type_c', 'subject_c', 'parent_node_code_c', 'node_path_c', 'description_c', 'learning_objectives_c', 'difficulty_c', 'status_c', 'sort_order_c', 'verified_c', 'source_document_version_c', 'source_page_start_c', 'source_page_end_c', 'source_excerpt_c']).limit(3000, 0).fetch(),
      'curriculum_nodes_c'
    ),
    unwrapTableRequest(
      sdk.table('concept_relationships_c').select(['Id', 'Name', 'from_node_c', 'to_node_c', 'relationship_type_c', 'direction_c', 'confidence_c', 'status_c', 'review_notes_c']).limit(3000, 0).fetch(),
      'concept_relationships_c'
    ),
    unwrapTableRequest(
      sdk.table('questions_c').select(['Id', 'Name', 'examination_c', 'syllabus_version_c', 'curriculum_node_c', 'question_type_c', 'difficulty_c', 'source_type_c', 'status_c', 'question_family_code_c', 'historical_year_c', 'concept_count_c', 'recurring_pattern_group_c', 'rights_status_c']).limit(3000, 0).fetch(),
      'questions_c'
    ),
    unwrapTableRequest(
      sdk.table('question_concept_mappings_c').select(['Id', 'Name', 'question_c', 'curriculum_node_c', 'mapping_type_c', 'confidence_c', 'verified_c', 'status_c']).limit(4000, 0).fetch(),
      'question_concept_mappings_c'
    ),
    unwrapTableRequest(
      sdk.table('historical_syllabus_crosswalks_c').select(['Id', 'Name', 'source_version_c', 'target_version_c', 'source_node_c', 'target_node_c', 'mapping_type_c', 'confidence_c', 'status_c', 'mapping_notes_c']).limit(2000, 0).fetch(),
      'historical_syllabus_crosswalks_c'
    ),
    unwrapTableRequest(
      sdk.table('source_document_versions_c').select(['Id', 'Name', 'source_document_c', 'version_label_c', 'official_title_c', 'document_url_c', 'rights_status_c', 'ingestion_status_c', 'version_status_c', 'academic_year_c']).limit(1000, 0).fetch(),
      'source_document_versions_c'
    ),
    unwrapTableRequest(
      sdk.table('source_documents_c').select(['Id', 'Name', 'official_url_c', 'source_category_c', 'rights_status_c', 'verification_status_c', 'academic_year_c']).limit(1000, 0).fetch(),
      'source_documents_c'
    )
  ];

  if (includeStudentMastery) {
    requests.push(
      unwrapTableRequest(
        sdk.table('student_concept_mastery_c').select(['Id', 'Name', 'curriculum_node_c', 'mastery_score_c', 'mastery_status_c', 'attempt_count_c', 'correct_count_c', 'confidence_score_c', 'evidence_count_c', 'last_assessed_at_c']).limit(3000, 0).fetch(),
        'student_concept_mastery_c'
      )
    );
  }

  const [
    examinations,
    syllabusVersions,
    nodes,
    relationships,
    questions,
    questionMappings,
    crosswalks,
    sourceVersions,
    sourceDocuments,
    studentMastery = []
  ] = await Promise.all(requests);

  return {
    examinations,
    syllabusVersions,
    nodes,
    relationships,
    questions,
    questionMappings,
    crosswalks,
    sourceVersions,
    sourceDocuments,
    studentMastery
  };
}

export function buildKnowledgeGraphModel(data = {}) {
  const examinations = data.examinations || [];
  const syllabusVersions = data.syllabusVersions || [];
  const nodes = data.nodes || [];
  const relationships = data.relationships || [];
  const questions = data.questions || [];
  const questionMappings = data.questionMappings || [];
  const crosswalks = data.crosswalks || [];
  const sourceVersions = data.sourceVersions || [];
  const sourceDocuments = data.sourceDocuments || [];
  const studentMastery = data.studentMastery || [];

  const examById = new Map(examinations.map((item) => [String(item.Id), item]));
  const syllabusById = new Map(syllabusVersions.map((item) => [String(item.Id), item]));
  const sourceVersionById = new Map(sourceVersions.map((item) => [String(item.Id), item]));
  const sourceDocumentById = new Map(sourceDocuments.map((item) => [String(item.Id), item]));
  const nodeById = new Map(nodes.map((item) => [String(item.Id), item]));
  const masteryByNodeId = new Map(studentMastery.map((item) => [String(getLookupId(item.curriculum_node_c)), item]));
  const nodeCodeIndex = new Map();
  for (const node of nodes) {
    const code = String(node.node_code_c || '').trim();
    if (!code) continue;
    const versionId = String(getLookupId(node.syllabus_version_c) || 'KNOWLEDGE_CORE');
    nodeCodeIndex.set(versionId + '|' + code, node);
  }

  const enrichedNodes = nodes.map((node) => {
    const syllabus = syllabusById.get(String(getLookupId(node.syllabus_version_c)));
    const exam = examById.get(String(getLookupId(syllabus?.examination_c)));
    const sourceVersion = sourceVersionById.get(String(getLookupId(node.source_document_version_c) || getLookupId(syllabus?.source_document_version_c)));
    const sourceDocumentId = getLookupId(sourceVersion?.source_document_c) || getLookupId(syllabus?.source_document_c);
    const sourceDocument = sourceDocumentById.get(String(sourceDocumentId));
    const nodeVersionId = getLookupId(node.syllabus_version_c);
    const hasSyllabusVersion = Boolean(nodeVersionId);
    const parentCode = String(node.parent_node_code_c || '').trim();
    const currentVersionId = String(nodeVersionId || 'KNOWLEDGE_CORE');
    const parentNode = parentCode
      ? nodeCodeIndex.get(currentVersionId + '|' + parentCode) ||
        (nodeVersionId ? nodeCodeIndex.get('KNOWLEDGE_CORE|' + parentCode) : null)
      : null;
    const isHistorical = crosswalks.some((crosswalk) => {
      if (crosswalk.status_c !== 'Verified') return false;
      const sourceNodeId = getLookupId(crosswalk.source_node_c);
      const targetNodeId = getLookupId(crosswalk.target_node_c);
      const sourceVersionId = getLookupId(crosswalk.source_version_c);
      const targetVersionId = getLookupId(crosswalk.target_version_c);
      return (
        String(sourceNodeId || '') === String(node.Id) ||
        String(targetNodeId || '') === String(node.Id) ||
        Boolean(nodeVersionId && (
          String(sourceVersionId || '') === String(nodeVersionId) ||
          String(targetVersionId || '') === String(nodeVersionId)
        ))
      );
    });

    return {
      ...node,
      syllabus,
      examName: exam?.Name || getLookupName(syllabus?.examination_c) || 'Knowledge core',
      examCode: exam?.code_c || '',
      academicYear: syllabus?.academic_year_c || '',
      syllabusStatus: syllabus?.status_c || '',
      sourceVersion,
      sourceDocument,
      hasSyllabusVersion,
      parentNode,
      parentNodeType: parentNode?.node_type_c || '',
      isHistorical,
      layer: isHistorical ? 'Historical crosswalk' : hasSyllabusVersion ? 'Syllabus-linked' : 'Knowledge core',
      mastery: masteryByNodeId.get(String(node.Id)) || null
    };
  });

  const enrichedRelationships = relationships.map((edge) => ({
    ...edge,
    fromNode: nodeById.get(String(getLookupId(edge.from_node_c))),
    toNode: nodeById.get(String(getLookupId(edge.to_node_c)))
  }));

  const enrichedMappings = questionMappings.map((mapping) => ({
    ...mapping,
    question: questions.find((question) => String(question.Id) === String(getLookupId(mapping.question_c))),
    node: nodeById.get(String(getLookupId(mapping.curriculum_node_c)))
  }));

  const familyMap = new Map();
  for (const question of questions) {
    const code = String(question.question_family_code_c || '').trim();
    if (!code) continue;
    if (!familyMap.has(code)) familyMap.set(code, []);
    familyMap.get(code).push(question);
  }

  const families = [...familyMap.entries()].map(([code, familyQuestions]) => {
    const mappedConceptIds = new Set(
      enrichedMappings
        .filter((mapping) => familyQuestions.some((question) => String(question.Id) === String(getLookupId(mapping.question_c))))
        .map((mapping) => String(getLookupId(mapping.curriculum_node_c)))
    );
    return {
      code,
      questions: familyQuestions,
      conceptNodes: [...mappedConceptIds].map((id) => nodeById.get(id)).filter(Boolean),
      examNames: [...new Set(familyQuestions.map((question) => {
        const examId = getLookupId(question.examination_c);
        return examById.get(String(examId))?.Name || getLookupName(question.examination_c);
      }).filter(Boolean))]
    };
  });

  const crosswalkRows = crosswalks.map((crosswalk) => ({
    ...crosswalk,
    sourceNode: nodeById.get(String(getLookupId(crosswalk.source_node_c))),
    targetNode: nodeById.get(String(getLookupId(crosswalk.target_node_c))),
    sourceVersion: syllabusById.get(String(getLookupId(crosswalk.source_version_c))),
    targetVersion: syllabusById.get(String(getLookupId(crosswalk.target_version_c)))
  }));

  return {
    examinations,
    syllabusVersions,
    nodes: enrichedNodes,
    relationships: enrichedRelationships,
    questions,
    questionMappings: enrichedMappings,
    families,
    crosswalks: crosswalkRows,
    sourceVersions,
    sourceDocuments,
    studentMastery,
    diagnostics: buildGraphDiagnostics(nodes, relationships, questionMappings)
  };
}
