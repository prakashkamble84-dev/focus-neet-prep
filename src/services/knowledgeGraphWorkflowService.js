import { sdk } from '@/services/sdk';
import { getLookupId, validateProposedRelationship } from '@/services/knowledgeGraphRules';

async function saveApprovalEvent(reviewerId, recordType, recordId, recordName, decision, notes) {
  if (!reviewerId) return false;
  try {
    const result = await sdk.table('content_approvals_c').create({
      Name: recordType + ' · ' + recordName + ' · ' + decision,
      content_type_c: 'Graph',
      record_identifier_c: recordType + ':' + String(recordId),
      content_version_c: String(recordId),
      review_status_c: decision === 'Rejected' ? 'Rejected' : 'Approved',
      reviewer_user_c: reviewerId,
      submitted_by_c: reviewerId,
      decision_notes_c: notes || 'Graph review decision recorded.',
      submitted_at_c: new Date().toISOString(),
      resolved_at_c: new Date().toISOString()
    });
    return Boolean(result.data?.length);
  } catch {
    return false;
  }
}

export function hasVerifiedGraphEvidence(node) {
  const sourceVersion = node?.sourceVersion;
  const sourceDocument = node?.sourceDocument;
  const rights = sourceVersion?.rights_status_c || sourceDocument?.rights_status_c;
  return Boolean(
    sourceVersion &&
    sourceVersion.ingestion_status_c === 'Verified' &&
    sourceDocument?.verification_status_c === 'Verified' &&
    ['Public', 'Licensed'].includes(rights) &&
    Number(node.source_page_start_c) > 0 &&
    Number(node.source_page_end_c) >= Number(node.source_page_start_c) &&
    String(node.source_excerpt_c || '').trim()
  );
}

export async function reviewGraphRelationship(edge, status, reviewerId, nodes = [], relationships = []) {
  if (status === 'Verified') {
    const fromId = getLookupId(edge.from_node_c);
    const toId = getLookupId(edge.to_node_c);
    const fromNode = nodes.find((node) => String(node.Id) === String(fromId));
    const toNode = nodes.find((node) => String(node.Id) === String(toId));
    if (!fromNode || !toNode || fromNode.status_c !== 'Published' || toNode.status_c !== 'Published' ||
        fromNode.verified_c !== true || toNode.verified_c !== true) {
      return { success: false, message: 'Both endpoint concepts must be published and expert-verified before the relationship can be verified.' };
    }
    const existingEdges = relationships.filter((item) => String(item.Id) !== String(edge.Id));
    const validation = validateProposedRelationship(nodes, existingEdges, fromId, toId, edge.relationship_type_c);
    if (!validation.valid) return { success: false, message: validation.reason };
  }
  const existingNotes = String(edge.review_notes_c || '').trim();
  const action = status === 'Verified' ? 'verified' : 'rejected';
  const notes = (existingNotes ? existingNotes + '\n' : '') +
    'Academic relationship ' + action + ' on ' + new Date().toISOString() + '.';
  const result = await sdk.table('concept_relationships_c').update({
    Id: edge.Id,
    status_c: status,
    review_notes_c: notes
  });
  if (!result.data?.length) {
    return { success: false, message: result.messages?.join('; ') || result.message || 'Relationship review was not saved' };
  }
  const auditLogged = await saveApprovalEvent(
    reviewerId,
    'relationship',
    edge.Id,
    edge.Name || edge.Id,
    status === 'Verified' ? 'Approved' : 'Rejected',
    notes
  );
  return { success: true, auditLogged };
}

export async function reviewQuestionMapping(mapping, status, reviewerId) {
  if (status === 'Verified') {
    const question = mapping.question;
    const concept = mapping.node;
    if (!question || question.status_c !== 'Published' || !['Public', 'Licensed'].includes(question.rights_status_c)) {
      return { success: false, message: 'The mapped question must be published and have Public or Licensed usage rights.' };
    }
    if (!concept || concept.node_type_c !== 'Concept' || concept.status_c !== 'Published' || concept.verified_c !== true) {
      return { success: false, message: 'The mapped Concept must already be published and expert-verified.' };
    }
  }
  const result = await sdk.table('question_concept_mappings_c').update({
    Id: mapping.Id,
    status_c: status,
    verified_c: status === 'Verified',
    reviewer_user_c: reviewerId || undefined
  });
  if (!result.data?.length) {
    return { success: false, message: result.messages?.join('; ') || result.message || 'Question mapping review was not saved' };
  }
  const auditLogged = await saveApprovalEvent(
    reviewerId,
    'question-concept mapping',
    mapping.Id,
    mapping.Name || mapping.Id,
    status === 'Verified' ? 'Approved' : 'Rejected',
    'Question-to-concept mapping review decision: ' + status
  );
  return { success: true, auditLogged };
}

export async function reviewHistoricalCrosswalk(row, status, reviewerId) {
  if (status === 'Verified') {
    const sourceVersionId = getLookupId(row.source_version_c);
    const targetVersionId = getLookupId(row.target_version_c);
    if (!sourceVersionId || !targetVersionId || String(sourceVersionId) === String(targetVersionId)) {
      return { success: false, message: 'A verified historical crosswalk needs two different syllabus versions.' };
    }
    if (!String(row.mapping_notes_c || '').trim()) {
      return { success: false, message: 'Add the evidence behind this historical syllabus mapping before verifying it.' };
    }
    const sourceNodeId = getLookupId(row.source_node_c);
    const targetNodeId = getLookupId(row.target_node_c);
    if (row.mapping_type_c === 'Added' && (!targetNodeId || sourceNodeId)) {
      return { success: false, message: 'An Added mapping must have a target node and no source node.' };
    }
    if (row.mapping_type_c === 'Removed' && (!sourceNodeId || targetNodeId)) {
      return { success: false, message: 'A Removed mapping must have a source node and no target node.' };
    }
    if (!['Added', 'Removed'].includes(row.mapping_type_c)) {
      if (!sourceNodeId || !targetNodeId) {
        return { success: false, message: 'This mapping type needs both a source node and a target node.' };
      }
      if (String(getLookupId(row.sourceNode?.syllabus_version_c)) !== String(sourceVersionId) ||
          String(getLookupId(row.targetNode?.syllabus_version_c)) !== String(targetVersionId)) {
        return { success: false, message: 'Each crosswalk node must belong to the selected source or target syllabus version.' };
      }
    }
  }
  const result = await sdk.table('historical_syllabus_crosswalks_c').update({
    Id: row.Id,
    status_c: status,
    reviewer_user_c: reviewerId || undefined
  });
  if (!result.data?.length) {
    return { success: false, message: result.messages?.join('; ') || result.message || 'Historical crosswalk review was not saved' };
  }
  const auditLogged = await saveApprovalEvent(
    reviewerId,
    'historical crosswalk',
    row.Id,
    row.Name || row.Id,
    status === 'Verified' ? 'Approved' : 'Rejected',
    'Historical syllabus crosswalk review decision: ' + status
  );
  return { success: true, auditLogged };
}

export async function verifyGraphNode(node, reviewerId) {
  if (!hasVerifiedGraphEvidence(node)) {
    return {
      success: false,
      message: 'Attach a verified source version, verify the parent source record and rights, and record a page range plus source excerpt.'
    };
  }
  const result = await sdk.table('curriculum_nodes_c').update({
    Id: node.Id,
    verified_c: true,
    status_c: 'Review'
  });
  if (!result.data?.length) {
    return { success: false, message: result.messages?.join('; ') || result.message || 'Node verification was not saved' };
  }
  const auditLogged = await saveApprovalEvent(
    reviewerId,
    'node',
    node.Id,
    node.Name,
    'Approved',
    'Source evidence verified. Node remains in Review until publication approval.'
  );
  return { success: true, auditLogged };
}

export async function publishGraphNode(node, reviewerId) {
  const parentReady = node.node_type_c === 'Subject' || (
    node.parentNode &&
    node.parentNode.status_c === 'Published' &&
    node.parentNode.verified_c === true
  );
  const syllabusReady = !node.hasSyllabusVersion || node.syllabusStatus === 'Published';
  if (!node.verified_c || !hasVerifiedGraphEvidence(node) || !syllabusReady || !parentReady) {
    return {
      success: false,
      message: 'Required: expert-verified node, verified source rights and page evidence, published syllabus (when linked), and a published verified parent path.'
    };
  }
  const result = await sdk.table('curriculum_nodes_c').update({
    Id: node.Id,
    status_c: 'Published',
    verified_c: true
  });
  if (!result.data?.length) {
    return { success: false, message: result.messages?.join('; ') || result.message || 'Node publication was not saved' };
  }
  const auditLogged = await saveApprovalEvent(
    reviewerId,
    'node',
    node.Id,
    node.Name,
    'Approved',
    'Node published to the student knowledge graph after source and parent-path checks.'
  );
  return { success: true, auditLogged };
}
