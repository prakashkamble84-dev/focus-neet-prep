import { sdk } from '@/services/sdk';

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

export async function reviewGraphRelationship(edge, status, reviewerId) {
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
