import {
  buildGraphDiagnostics,
  findPrerequisiteCycles,
  validateProposedRelationship,
  buildLatestVerifiedSourcePageKeys,
  hasVerifiedSourcePageRange
} from '@/services/knowledgeGraphRules';

export function runKnowledgeGraphSelfTests() {
  const nodes = [
    { Id: 'A', Name: 'Vectors', node_code_c: 'PHY-VECTORS', node_type_c: 'Concept' },
    { Id: 'B', Name: 'Newton Laws', node_code_c: 'PHY-NLM', node_type_c: 'Concept' },
    { Id: 'C', Name: 'Friction', node_code_c: 'PHY-FRICTION', node_type_c: 'Concept' }
  ];
  const edge = (from, to) => ({
    Id: from + '-' + to,
    from_node_c: from,
    to_node_c: to,
    relationship_type_c: 'Prereq',
    status_c: 'Verified'
  });
  const tests = [];
  const assert = (name, condition, detail) => tests.push({ name, passed: Boolean(condition), detail });

  assert(
    'Accepts an acyclic prerequisite chain',
    findPrerequisiteCycles(nodes, [edge('A', 'B'), edge('B', 'C')]).length === 0,
    'Vectors → Newton Laws → Friction has no cycle.'
  );
  assert(
    'Detects a prerequisite cycle',
    findPrerequisiteCycles(nodes, [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')]).length > 0,
    'A → B → C → A must be rejected.'
  );
  assert(
    'Rejects a self-dependency',
    !validateProposedRelationship(nodes, [], 'A', 'A', 'Prereq').valid,
    'A node cannot be its own prerequisite.'
  );
  assert(
    'Rejects a relationship with a missing node',
    !validateProposedRelationship(nodes, [], 'A', 'MISSING', 'Prereq').valid,
    'Both relationship endpoints must exist.'
  );
  assert(
    'Rejects a duplicate prerequisite edge',
    !validateProposedRelationship(nodes, [edge('A', 'B')], 'A', 'B', 'Prereq').valid,
    'The same directed prerequisite may not be recorded twice.'
  );
  assert(
    'Rejects a reverse duplicate for symmetric relationships',
    !validateProposedRelationship(nodes, [{
      Id: 'B-A',
      from_node_c: 'B',
      to_node_c: 'A',
      relationship_type_c: 'Related',
      status_c: 'Verified'
    }], 'A', 'B', 'Related').valid,
    'A symmetric Related edge may only exist once regardless of endpoint order.'
  );
  assert(
    'Allows the same parent code in separate syllabus versions',
    buildGraphDiagnostics([
      { Id: 'S1', Name: 'Physics', node_code_c: 'PHYSICS', node_type_c: 'Subject', syllabus_version_c: 'V1' },
      { Id: 'S2', Name: 'Physics', node_code_c: 'PHYSICS', node_type_c: 'Subject', syllabus_version_c: 'V2' }
    ], [], []).errors === 0,
    'Stable curriculum codes are unique within a syllabus version, not globally.'
  );
  assert(
    'Accepts a shared Knowledge Core parent',
    buildGraphDiagnostics([
      { Id: 'CORE-SUBJECT', Name: 'Physics', node_code_c: 'PHYSICS', node_type_c: 'Subject' },
      { Id: 'CORE-UNIT', Name: 'Mechanics', node_code_c: 'MECHANICS', node_type_c: 'Unit', parent_node_code_c: 'PHYSICS' },
      { Id: 'CORE-CHAPTER', Name: 'Vectors and motion', node_code_c: 'VECTORS-MOTION', node_type_c: 'Chapter', parent_node_code_c: 'MECHANICS' },
      { Id: 'CORE-TOPIC', Name: 'Vectors', node_code_c: 'PHY-VECTORS-TOPIC', node_type_c: 'Topic', parent_node_code_c: 'VECTORS-MOTION' },
      { Id: 'CORE', Name: 'Vector concept', node_code_c: 'PHY-VECTORS', node_type_c: 'Concept', parent_node_code_c: 'PHY-VECTORS-TOPIC' },
      { Id: 'CURRENT', Name: 'Vector resolution', node_code_c: 'PHY-VECTOR-RESOLUTION', node_type_c: 'Concept', parent_node_code_c: 'PHY-VECTORS', syllabus_version_c: 'V1' }
    ], [], []).errors === 0,
    'A syllabus-linked concept may extend a source-grounded shared Knowledge Core concept.'
  );
  assert(
    'Flags reverse-direction symmetric duplicate relationships',
    buildGraphDiagnostics(nodes, [
      { Id: 'RELATED-1', from_node_c: 'A', to_node_c: 'B', relationship_type_c: 'Related', status_c: 'Verified' },
      { Id: 'RELATED-2', from_node_c: 'B', to_node_c: 'A', relationship_type_c: 'Related', status_c: 'Verified' }
    ], []).warnings === 1,
    'Related and Confused edges are symmetric and should only exist once per unordered pair.'
  );
  assert(
    'Requires verified mappings before a concept is considered question-covered',
    buildGraphDiagnostics([
      { Id: 'TOPIC', Name: 'A concept', node_code_c: 'TOPIC', node_type_c: 'Concept', status_c: 'Published' }
    ], [], [
      { curriculum_node_c: 'TOPIC', status_c: 'Review', verified_c: false }
    ]).info === 1,
    'Draft and Review mappings do not count as verified question evidence.'
  );
  assert(
    'Detects an invalid hierarchy parent type',
    buildGraphDiagnostics([
      { Id: 'SUBJECT', Name: 'Physics', node_code_c: 'PHYSICS', node_type_c: 'Subject', syllabus_version_c: 'V1' },
      { Id: 'TOPIC', Name: 'Friction', node_code_c: 'FRICTION', node_type_c: 'Topic', parent_node_code_c: 'PHYSICS', syllabus_version_c: 'V1' }
    ], [], []).issues.some((issue) => issue.code === 'INVALID_PARENT_TYPE'),
    'A Topic cannot be directly nested under a Subject.'
  );
  assert(
    'Rejects relationships that connect non-concept hierarchy nodes',
    buildGraphDiagnostics([
      { Id: 'SUBJECT', Name: 'Physics', node_code_c: 'PHYSICS', node_type_c: 'Subject' },
      { Id: 'CONCEPT', Name: 'Vectors', node_code_c: 'VECTORS', node_type_c: 'Concept', parent_node_code_c: 'PHYSICS' }
    ], [{
      Id: 'BAD-EDGE',
      from_node_c: 'SUBJECT',
      to_node_c: 'CONCEPT',
      relationship_type_c: 'Prereq',
      status_c: 'Verified'
    }], []).errors > 0,
    'Relationship edges connect Concept nodes only; hierarchy is represented by parent links.'
  );
  const verifiedPage = {
    document_version_c: 'V1',
    page_number_c: 4,
    quality_status_c: 'Verified',
    CreatedOn: '2026-11-13T10:00:00.000Z',
    ModifiedOn: '2026-11-13T10:00:00.000Z'
  };
  const latestRejected = {
    ...verifiedPage,
    Id: 'EXTRACTION-NEW',
    quality_status_c: 'Rejected',
    CreatedOn: '2026-11-13T11:00:00.000Z',
    ModifiedOn: '2026-11-13T11:00:00.000Z'
  };
  assert(
    'Rejects a page when its latest extraction was rejected',
    !buildLatestVerifiedSourcePageKeys([verifiedPage, latestRejected]).has('V1|4'),
    'An older Verified extraction cannot override a newer Rejected extraction.'
  );
  assert(
    'Accepts a page when its latest extraction is verified',
    buildLatestVerifiedSourcePageKeys([latestRejected, verifiedPage]).has('V1|4') === false &&
      buildLatestVerifiedSourcePageKeys([
        { ...verifiedPage, Id: 'EXTRACTION-LATEST', CreatedOn: '2026-11-13T12:00:00.000Z', ModifiedOn: '2026-11-13T12:00:00.000Z' }
      ]).has('V1|4'),
    'The newest independent page review determines whether the page is trusted.'
  );
  assert(
    'Requires every page in a concept source range',
    !hasVerifiedSourcePageRange('V1', 4, 6, new Set(['V1|4', 'V1|5'])),
    'A node cannot publish when even one page in its cited range is missing or unverified.'
  );

  return {
    passed: tests.filter((test) => test.passed).length,
    failed: tests.filter((test) => !test.passed).length,
    tests
  };
}
