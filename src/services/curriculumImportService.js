import { sdk } from '@/services/sdk';
import { CURRICULA } from '@/services/curriculumImportData';

const { eq } = window.ApperSDK.CoreSDK;

async function findSyllabus(label) {
  const result = await sdk.table('syllabus_versions_c')
    .select(['Id', 'Name', 'version_label_c', 'source_document_version_c'])
    .where(eq('version_label_c', label))
    .limit(1, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not find the syllabus version');
  return result.data?.[0] ?? null;
}

async function findImportBatch(name) {
  const result = await sdk.table('curriculum_import_batches_c')
    .select(['Id', 'Name', 'status_c'])
    .where(eq('Name', name))
    .limit(1, 0).fetch();
  if (!result.success) throw new Error(result.message || 'Could not find the import batch');
  return result.data?.[0] ?? null;
}

export async function importCurriculumOutline(curriculumKey) {
  const curriculum = CURRICULA.find((item) => item.key === curriculumKey);
  if (!curriculum) throw new Error('Unknown curriculum import definition');

  const syllabus = await findSyllabus(curriculum.label);
  if (!syllabus) throw new Error(`Register the official source baseline before importing ${curriculum.label}`);

  const batch = await findImportBatch(`INITIAL-${curriculum.key}`);
  if (!batch) throw new Error(`The import batch for ${curriculum.label} is missing. Re-register the official source baseline.`);

  const versionId = syllabus.source_document_version_c?.Id ?? syllabus.source_document_version_c;
  if (!versionId) throw new Error('This syllabus version has no linked source document version');

  const existingResult = await sdk.table('curriculum_nodes_c')
    .select(['Id', 'node_code_c'])
    .where(eq('syllabus_version_c', syllabus.Id))
    .limit(500, 0).fetch();
  if (!existingResult.success) throw new Error(existingResult.message || 'Could not check existing curriculum nodes');

  const existingCodes = new Set((existingResult.data ?? []).map((node) => node.node_code_c));
  const nodes = [];
  const subjectCodes = {};

  for (const subject of curriculum.subjects) {
    const code = `${curriculum.key}-${subject.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;
    subjectCodes[subject] = code;
    if (existingCodes.has(code)) continue;
    const subjectUnits = curriculum.units.filter((unit) => unit.subject === subject);
    nodes.push({
      Name: subject,
      syllabus_version_c: syllabus.Id,
      node_code_c: code,
      node_type_c: 'Subject',
      subject_c: subject,
      node_path_c: `${curriculum.label} / ${subject}`,
      description_c: `Subject heading taken from ${curriculum.source}. Detailed topic extraction is pending.`,
      learning_objectives_c: 'Learning objectives and topic-level details await page-by-page extraction and academic review.',
      status_c: 'Review',
      verified_c: false,
      sort_order_c: curriculum.subjects.indexOf(subject) + 1,
      source_document_version_c: versionId,
      source_page_start_c: Math.min(...subjectUnits.map((unit) => unit.pages[0])),
      source_page_end_c: Math.max(...subjectUnits.map((unit) => unit.pages[1])),
      source_excerpt_c: `Subject: ${subject}`,
      import_batch_c: batch.Id
    });
  }

  for (const unit of curriculum.units) {
    const subjectCode = subjectCodes[unit.subject];
    const code = `${curriculum.key}-${unit.subject.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-U${String(unit.number).padStart(2, '0')}`;
    if (existingCodes.has(code)) continue;
    nodes.push({
      Name: unit.title,
      syllabus_version_c: syllabus.Id,
      node_code_c: code,
      node_type_c: 'Unit',
      subject_c: unit.subject,
      parent_node_code_c: subjectCode,
      node_path_c: `${curriculum.label} / ${unit.subject} / Unit ${unit.number}`,
      description_c: 'Official unit heading imported from the source PDF. Subtopics and learning objectives have not yet been extracted.',
      learning_objectives_c: 'Pending page-level extraction and academic review.',
      status_c: 'Review',
      verified_c: false,
      sort_order_c: unit.number,
      source_document_version_c: versionId,
      source_page_start_c: unit.pages[0],
      source_page_end_c: unit.pages[1],
      source_excerpt_c: `UNIT ${unit.number}: ${unit.title}`,
      import_batch_c: batch.Id
    });
  }

  let created = 0;
  for (let start = 0; start < nodes.length; start += 25) {
    const chunk = nodes.slice(start, start + 25);
    const result = await sdk.table('curriculum_nodes_c').create(chunk);
    if (!result.success || !result.data?.length) {
      throw new Error(result.messages?.join('; ') || result.message || 'No curriculum nodes were saved');
    }
    created += result.data.length;
  }

  const expectedTotal = (existingResult.data?.length ?? 0) + created;
  const updateBatch = await sdk.table('curriculum_import_batches_c').update({
    Id: batch.Id,
    status_c: 'Review',
    nodes_created_c: created,
    nodes_updated_c: 0,
    import_notes_c: `${curriculum.note} ${created} new nodes created in this run; ${expectedTotal} records now exist for this syllabus version. Await expert review before publication.`
  });
  if (!updateBatch.data?.length) throw new Error(updateBatch.messages?.join('; ') || 'Nodes created, but import batch summary was not updated');

  return { created, total: expectedTotal, label: curriculum.label };
}

export { CURRICULA };
