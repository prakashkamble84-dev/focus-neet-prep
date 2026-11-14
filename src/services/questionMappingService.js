import { sdk } from '@/services/sdk';
import {
  beginQuestionVersion,
  finalizeQuestionVersion
} from '@/services/questionVersionService';

const ACADEMIC_EDITORS = [
  'CEO',
  'CEO_c',
  'Manager',
  'Manager_c',
  'AcademicExpert_c'
];

function getId(value) {
  if (value && typeof value === 'object') {
    return value.Id ?? value.id ?? value.value ?? null;
  }

  return value ?? null;
}

async function readQuestion(questionId) {
  const result = await sdk.table('questions_c')
    .select([
      'Id',
      'Name',
      'status_c',
      'source_type_c',
      'question_body_c',
      'answer_key_c',
      'solution_c',
      'question_type_c',
      'answer_validation_status_c',
      'rights_status_c',
      'historical_paper_c',
      'source_document_c',
      'curriculum_node_c'
    ])
    .get(questionId);

  if (!result.success || !result.data) {
    throw new Error(result.message || 'The question could not be loaded.');
  }

  return result.data;
}

async function readEligibleConcept(nodeId) {
  const result = await sdk.table('curriculum_nodes_c')
    .select([
      'Id',
      'Name',
      'node_type_c',
      'status_c',
      'verified_c',
      'subject_c'
    ])
    .get(nodeId);

  if (!result.success || !result.data) {
    throw new Error(result.message || 'The target concept could not be loaded.');
  }

  const node = result.data;
  if (
    node.node_type_c !== 'Concept' ||
    node.status_c !== 'Published' ||
    node.verified_c !== true
  ) {
    throw new Error('Mappings can only target published, expert-verified Concept nodes.');
  }

  return node;
}

async function recordMappingAudit(question, reviewerId, action, notes) {
  const result = await sdk.table('question_reviews_c').create({
    Name: 'Question concept mapping ' + action + ' · ' + question.Name,
    question_c: question.Id,
    review_type_c: 'Academic',
    review_status_c: action === 'verified' ? 'Approved' : 'Changes',
    reviewer_user_c: reviewerId,
    reviewed_at_c: new Date().toISOString(),
    review_notes_c: 'Action: mapping verification | ' + action + ' | ' + String(notes || '').trim()
  });

  if (!result.data?.length) {
    throw new Error(result.messages?.join('; ') || result.message || 'The mapping review event could not be saved.');
  }
}

export async function createQuestionConceptMapping({
  questionId,
  nodeId,
  mappingType,
  confidence,
  reason,
  reviewerId,
  reviewerProfile
}) {
  if (!ACADEMIC_EDITORS.includes(reviewerProfile) || !reviewerId) {
    return {
      success: false,
      message: 'Only authorised academic editors can propose a question-to-concept mapping.'
    };
  }

  if (!['Primary', 'Secondary', 'Prereq', 'Skill'].includes(mappingType)) {
    return {
      success: false,
      message: 'Choose a supported mapping type.'
    };
  }

  const confidenceValue = Number(confidence);
  if (!Number.isFinite(confidenceValue) || confidenceValue < 0 || confidenceValue > 1) {
    return {
      success: false,
      message: 'Mapping confidence must be a number from 0 to 1.'
    };
  }

  if (!String(reason || '').trim()) {
    return {
      success: false,
      message: 'Explain why this concept mapping is appropriate.'
    };
  }

  let version;
  let question;
  try {
    question = await readQuestion(questionId);
    if (!['Draft', 'Review'].includes(question.status_c)) {
      return {
        success: false,
        message: 'Mappings can only be proposed while the question is in Draft or Review. Reopen published content through its formal review process.'
      };
    }

    const node = await readEligibleConcept(nodeId);
    const { eq } = window.ApperSDK.CoreSDK;
    const existing = await sdk.table('question_concept_mappings_c')
      .select(['Id', 'curriculum_node_c', 'status_c'])
      .where(eq('question_c', questionId))
      .limit(100, 0)
      .fetch();

    if (!existing.success) {
      throw new Error(existing.message || 'Existing mappings could not be checked.');
    }

    const duplicate = (existing.data || []).some((mapping) => (
      String(getId(mapping.curriculum_node_c)) === String(node.Id) &&
      mapping.status_c !== 'Rejected'
    ));

    if (duplicate) {
      throw new Error('This question already has an active mapping to that concept.');
    }

    version = await beginQuestionVersion({
      question,
      changeKind: 'Mapping',
      reason,
      reviewerId
    });

    if (!version.success) {
      throw new Error(version.message);
    }

    const created = await sdk.table('question_concept_mappings_c').create({
      Name: question.Name + ' → ' + node.Name,
      question_c: question.Id,
      curriculum_node_c: node.Id,
      mapping_type_c: mappingType,
      confidence_c: confidenceValue,
      verified_c: false,
      status_c: 'Review'
    });

    if (!created.data?.length) {
      throw new Error(created.messages?.join('; ') || created.message || 'The concept mapping could not be created.');
    }

    try {
      await recordMappingAudit(question, reviewerId, 'proposed', reason);
    } catch (auditError) {
      await sdk.table('question_concept_mappings_c').update({
        Id: created.data[0].Id,
        status_c: 'Rejected',
        verified_c: false
      });
      await finalizeQuestionVersion(version.versionId, 'Abandoned');
      throw auditError;
    }

    const finalised = await finalizeQuestionVersion(version.versionId, 'Committed');
    return {
      success: true,
      mappingId: created.data[0].Id,
      warning: finalised.success ? '' : finalised.message,
      message: finalised.success
        ? 'Mapping saved in Review. An Academic Expert must verify it before analytics or student-facing concept filters can use it.'
        : 'Mapping saved, but its version snapshot remains pending: ' + finalised.message
    };
  } catch (error) {
    if (version?.versionId) {
      await finalizeQuestionVersion(version.versionId, 'Abandoned');
    }

    return {
      success: false,
      message: error.message || 'The concept mapping could not be saved.'
    };
  }
}

export async function verifyQuestionConceptMapping({
  questionId,
  mappingId,
  reviewerId,
  reviewerProfile,
  notes
}) {
  if (reviewerProfile !== 'AcademicExpert_c' || !reviewerId) {
    return {
      success: false,
      message: 'Only an Academic Expert can independently verify a question-to-concept mapping.'
    };
  }

  if (!String(notes || '').trim()) {
    return {
      success: false,
      message: 'Verification notes are required.'
    };
  }

  let version;
  let mapping;
  let question;
  try {
    question = await readQuestion(questionId);
    if (!['Draft', 'Review'].includes(question.status_c)) {
      return {
        success: false,
        message: 'A verified, published or rejected question cannot be remapped without reopening its review.'
      };
    }

    const result = await sdk.table('question_concept_mappings_c')
      .select([
        'Id',
        'Name',
        'question_c',
        'curriculum_node_c',
        'mapping_type_c',
        'confidence_c',
        'verified_c',
        'reviewer_user_c',
        'status_c',
        'CreatedBy',
        'Owner'
      ])
      .get(mappingId);

    if (!result.success || !result.data) {
      throw new Error(result.message || 'The mapping could not be loaded.');
    }

    mapping = result.data;
    if (String(getId(mapping.question_c)) !== String(questionId)) {
      throw new Error('This concept mapping does not belong to the selected question.');
    }

    if (!['Draft', 'Review'].includes(mapping.status_c) || mapping.verified_c === true) {
      throw new Error('Only an unverified Draft or Review mapping can be approved.');
    }

    const mappingCreatorId = getId(mapping.CreatedBy) || getId(mapping.Owner);
    if (!mappingCreatorId) {
      throw new Error('The mapping creator identity is unavailable, so independent verification cannot be established.');
    }
    if (String(mappingCreatorId) === String(reviewerId)) {
      throw new Error('The person who proposed this concept mapping cannot independently verify it.');
    }

    await readEligibleConcept(getId(mapping.curriculum_node_c));

    version = await beginQuestionVersion({
      question,
      changeKind: 'Mapping',
      reason: notes,
      reviewerId
    });

    if (!version.success) {
      throw new Error(version.message);
    }

    const updated = await sdk.table('question_concept_mappings_c').update({
      Id: mapping.Id,
      status_c: 'Verified',
      verified_c: true,
      reviewer_user_c: reviewerId
    });

    if (!updated.data?.length) {
      throw new Error(updated.messages?.join('; ') || updated.message || 'The mapping could not be verified.');
    }

    try {
      await recordMappingAudit(question, reviewerId, 'verified', notes);
    } catch (auditError) {
      await sdk.table('question_concept_mappings_c').update({
        Id: mapping.Id,
        status_c: mapping.status_c,
        verified_c: mapping.verified_c,
        reviewer_user_c: getId(mapping.reviewer_user_c)
      });
      await finalizeQuestionVersion(version.versionId, 'Abandoned');
      throw auditError;
    }

    const finalised = await finalizeQuestionVersion(version.versionId, 'Committed');
    return {
      success: true,
      warning: finalised.success ? '' : finalised.message,
      message: finalised.success
        ? 'Concept mapping independently verified and added to the question history.'
        : 'Mapping verified, but its version snapshot remains pending: ' + finalised.message
    };
  } catch (error) {
    if (version?.versionId) {
      await finalizeQuestionVersion(version.versionId, 'Abandoned');
    }

    return {
      success: false,
      message: error.message || 'The concept mapping could not be verified.'
    };
  }
}
