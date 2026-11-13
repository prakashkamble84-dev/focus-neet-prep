export const MASTERY_STAGES = [
  { code: 'M1', title: 'Explain', criterion: 'Can explain the concept in their own words.' },
  { code: 'M2', title: 'Recognise', criterion: 'Can identify when the concept applies.' },
  { code: 'M3', title: 'Apply', criterion: 'Can solve standard problems using the concept.' },
  { code: 'M4', title: 'Transfer', criterion: 'Can solve an unfamiliar problem using the concept.' },
  { code: 'M5', title: 'Integrate', criterion: 'Can combine the concept with another concept.' },
  { code: 'M6', title: 'Timed', criterion: 'Can solve under examination conditions.' },
  { code: 'M7', title: 'Retain', criterion: 'Can solve after a delayed interval.' }
];

export const MASTERY_CONTRACT_OPEN = '[MASTERY CONTRACT]';
export const MASTERY_CONTRACT_CLOSE = '[/MASTERY CONTRACT]';

export function getLookupId(value) {
  if (value && typeof value === 'object') return value.Id ?? null;
  return value ?? null;
}

export function getLookupName(value) {
  if (value && typeof value === 'object') return value.Name ?? '';
  return '';
}

export function getMasteryContractText(learningObjectives = '') {
  const source = String(learningObjectives || '');
  const start = source.indexOf(MASTERY_CONTRACT_OPEN);
  const end = source.indexOf(MASTERY_CONTRACT_CLOSE);
  if (start < 0 || end < start) {
    return MASTERY_STAGES.map((stage) => stage.code + ' — ' + stage.title + ': ' + stage.criterion).join('\n');
  }
  return source.slice(start + MASTERY_CONTRACT_OPEN.length, end).trim();
}

export function mergeMasteryContract(learningObjectives = '', contractText = '') {
  const source = String(learningObjectives || '').trim();
  const start = source.indexOf(MASTERY_CONTRACT_OPEN);
  const end = source.indexOf(MASTERY_CONTRACT_CLOSE);
  const retained = start >= 0 && end >= start
    ? (source.slice(0, start) + source.slice(end + MASTERY_CONTRACT_CLOSE.length)).trim()
    : source;
  const block = MASTERY_CONTRACT_OPEN + '\n' + String(contractText || '').trim() + '\n' + MASTERY_CONTRACT_CLOSE;
  return retained ? retained + '\n\n' + block : block;
}

export function findPrerequisiteCycles(nodes = [], relationships = []) {
  const nodeIds = new Set(nodes.map((node) => String(node.Id)));
  const adjacency = new Map();
  for (const edge of relationships) {
    if (edge.relationship_type_c !== 'Prereq' || edge.status_c === 'Rejected') continue;
    const fromId = String(getLookupId(edge.from_node_c) || '');
    const toId = String(getLookupId(edge.to_node_c) || '');
    if (!nodeIds.has(fromId) || !nodeIds.has(toId)) continue;
    if (!adjacency.has(fromId)) adjacency.set(fromId, []);
    adjacency.get(fromId).push(toId);
  }

  const visited = new Set();
  const active = new Set();
  const stack = [];
  const cycles = [];
  const cycleKeys = new Set();

  function visit(nodeId) {
    if (active.has(nodeId)) {
      const cycleStart = stack.indexOf(nodeId);
      const cycle = [...stack.slice(cycleStart), nodeId];
      const canonical = cycle.slice(0, -1).sort().join('|');
      if (!cycleKeys.has(canonical)) {
        cycleKeys.add(canonical);
        cycles.push(cycle);
      }
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    active.add(nodeId);
    stack.push(nodeId);
    for (const nextId of adjacency.get(nodeId) || []) visit(nextId);
    stack.pop();
    active.delete(nodeId);
  }

  for (const node of nodes) visit(String(node.Id));
  return cycles;
}

export function validateProposedRelationship(nodes = [], relationships = [], fromId, toId, type = 'Prereq') {
  const left = String(fromId || '');
  const right = String(toId || '');
  if (!left || !right) return { valid: false, reason: 'Choose both concepts.' };
  if (left === right) return { valid: false, reason: 'A concept cannot be related to itself.' };

  const from = nodes.find((node) => String(node.Id) === left);
  const to = nodes.find((node) => String(node.Id) === right);
  if (!from || !to) return { valid: false, reason: 'Both concepts must exist in the current graph.' };
  if (from.node_type_c !== 'Concept' || to.node_type_c !== 'Concept') {
    return { valid: false, reason: 'Relationship edges must connect Concept nodes. Use the curriculum hierarchy for Subject, Unit, Chapter, Topic and Subtopic containment.' };
  }

  const symmetric = ['Related', 'Confused'].includes(type);
  const duplicate = relationships.some((edge) => {
    if (edge.status_c === 'Rejected' || edge.relationship_type_c !== type) return false;
    const existingFrom = String(getLookupId(edge.from_node_c) || '');
    const existingTo = String(getLookupId(edge.to_node_c) || '');
    return (existingFrom === left && existingTo === right) ||
      (symmetric && existingFrom === right && existingTo === left);
  });
  if (duplicate) return { valid: false, reason: 'This relationship already exists.' };

  if (type === 'Prereq') {
    const cycles = findPrerequisiteCycles(nodes, [...relationships, {
      Id: '__proposed__',
      from_node_c: left,
      to_node_c: right,
      relationship_type_c: 'Prereq',
      status_c: 'Draft'
    }]);
    if (cycles.length) return { valid: false, reason: 'This prerequisite would create a dependency cycle. A prerequisite chain must remain acyclic.' };
  }

  return { valid: true, reason: '' };
}

export function buildGraphDiagnostics(nodes = [], relationships = [], mappings = []) {
  const issues = [];
  const ids = new Set(nodes.map((node) => String(node.Id)));
  const codeBuckets = new Map();

  for (const node of nodes) {
    const code = String(node.node_code_c || '').trim().toUpperCase();
    const versionId = String(getLookupId(node.syllabus_version_c) || 'KNOWLEDGE_CORE');
    if (code) {
      const key = versionId + '|' + code;
      if (!codeBuckets.has(key)) codeBuckets.set(key, []);
      codeBuckets.get(key).push(node);
    }
  }

  for (const [key, bucket] of codeBuckets.entries()) {
    if (bucket.length > 1) {
      issues.push({
        code: 'DUPLICATE_NODE_CODE',
        severity: 'error',
        message: 'Duplicate node code within the same syllabus version: ' + key.split('|').slice(1).join('|'),
        ids: bucket.map((node) => node.Id)
      });
    }
  }

  const byVersionAndCode = new Map();
  for (const node of nodes) {
    const versionId = String(getLookupId(node.syllabus_version_c) || 'KNOWLEDGE_CORE');
    const code = String(node.node_code_c || '').trim();
    if (code) byVersionAndCode.set(versionId + '|' + code, node);
  }

  const allowedParentTypes = {
    Unit: ['Subject'],
    Chapter: ['Unit'],
    Topic: ['Chapter', 'Unit'],
    Subtopic: ['Topic'],
    Concept: ['Topic', 'Subtopic', 'Concept']
  };

  for (const node of nodes) {
    const parentCode = String(node.parent_node_code_c || '').trim();
    const requiredParent = node.node_type_c !== 'Subject';
    if (!parentCode) {
      if (requiredParent) {
        issues.push({
          code: 'MISSING_PARENT',
          severity: 'error',
          message: (node.node_type_c || 'Node') + ' has no parent node: ' + (node.Name || node.node_code_c),
          ids: [node.Id]
        });
      }
      continue;
    }
    const versionId = String(getLookupId(node.syllabus_version_c) || 'KNOWLEDGE_CORE');
    const parent = byVersionAndCode.get(versionId + '|' + parentCode) ||
      (versionId !== 'KNOWLEDGE_CORE' ? byVersionAndCode.get('KNOWLEDGE_CORE|' + parentCode) : null);
    if (!parent) {
      issues.push({
        code: 'MISSING_PARENT',
        severity: 'error',
        message: 'Parent node ' + parentCode + ' is missing for ' + (node.Name || node.node_code_c),
        ids: [node.Id]
      });
      continue;
    }
    const allowed = allowedParentTypes[node.node_type_c] || [];
    if (!allowed.includes(parent.node_type_c)) {
      issues.push({
        code: 'INVALID_PARENT_TYPE',
        severity: 'error',
        message: (node.node_type_c || 'Node') + ' cannot have a ' + parent.node_type_c + ' parent: ' + parent.Name,
        ids: [node.Id, parent.Id]
      });
    }
  }

  const seenEdges = new Set();
  for (const edge of relationships) {
    const fromId = String(getLookupId(edge.from_node_c) || '');
    const toId = String(getLookupId(edge.to_node_c) || '');
    if (!ids.has(fromId) || !ids.has(toId)) {
      issues.push({
        code: 'DANGLING_RELATIONSHIP',
        severity: 'error',
        message: 'Relationship ' + (edge.Name || edge.Id) + ' points to a missing curriculum node.',
        ids: [edge.Id]
      });
      continue;
    }
    const fromNode = nodes.find((node) => String(node.Id) === fromId);
    const toNode = nodes.find((node) => String(node.Id) === toId);
    if (fromNode?.node_type_c !== 'Concept' || toNode?.node_type_c !== 'Concept') {
      issues.push({
        code: 'INVALID_RELATIONSHIP_ENDPOINT',
        severity: 'error',
        message: 'Concept relationship edges must connect Concept nodes.',
        ids: [edge.Id]
      });
    }
    const symmetric = ['Related', 'Confused'].includes(edge.relationship_type_c);
    const pair = symmetric ? [fromId, toId].sort() : [fromId, toId];
    const key = [...pair, edge.relationship_type_c].join('|');
    if (seenEdges.has(key) && edge.status_c !== 'Rejected') {
      issues.push({
        code: 'DUPLICATE_RELATIONSHIP',
        severity: 'warning',
        message: 'Duplicate ' + edge.relationship_type_c + ' relationship exists.',
        ids: [edge.Id]
      });
    }
    if (edge.status_c !== 'Rejected') seenEdges.add(key);
  }

  for (const cycle of findPrerequisiteCycles(nodes, relationships)) {
    issues.push({
      code: 'PREREQUISITE_CYCLE',
      severity: 'error',
      message: 'Prerequisite cycle detected: ' + cycle.join(' → '),
      ids: cycle
    });
  }

  const nodeIdsWithMappings = new Set(
    mappings
      .filter((item) => item.status_c === 'Verified' && item.verified_c === true)
      .map((item) => String(getLookupId(item.curriculum_node_c) || ''))
      .filter(Boolean)
  );
  for (const node of nodes) {
    if (node.node_type_c === 'Concept' && node.status_c === 'Published' && !nodeIdsWithMappings.has(String(node.Id))) {
      issues.push({
        code: 'NO_QUESTION_MAPPING',
        severity: 'info',
        message: 'Published concept has no mapped question evidence yet: ' + node.Name,
        ids: [node.Id]
      });
    }
  }

  return {
    issues,
    errors: issues.filter((item) => item.severity === 'error').length,
    warnings: issues.filter((item) => item.severity === 'warning').length,
    info: issues.filter((item) => item.severity === 'info').length
  };
}

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
      { Id: 'CORE', Name: 'Vectors', node_code_c: 'PHY-VECTORS', node_type_c: 'Concept' },
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

  return {
    passed: tests.filter((test) => test.passed).length,
    failed: tests.filter((test) => !test.passed).length,
    tests
  };
}
