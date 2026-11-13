import { sdk } from '@/services/sdk';
import { CURRICULA } from '@/services/curriculumImportData';

const SOURCE_URLS = {
  JEE_MAIN_2026_P1: 'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311323551056.pdf',
  NEET_UG_2026: 'https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/01/202601081066816297.pdf'
};

const EXAM_LABELS = {
  JEE_MAIN_2026_P1: 'JEE Main',
  NEET_UG_2026: 'NEET UG'
};

function lookupId(value) {
  return value && typeof value === 'object' ? value.Id : value;
}

function lookupName(value) {
  return value && typeof value === 'object' ? value.Name : '';
}

export async function fetchCurriculumLibrary() {
  const [syllabusResult, nodeResult, sourceResult] = await Promise.all([
    sdk.table('syllabus_versions_c')
      .select(['Id', 'Name', 'examination_c', 'source_document_c', 'academic_year_c', 'version_label_c', 'status_c'])
      .limit(300, 0).fetch(),
    sdk.table('curriculum_nodes_c')
      .select(['Id', 'Name', 'syllabus_version_c', 'node_code_c', 'node_type_c', 'subject_c', 'parent_node_code_c', 'node_path_c', 'status_c', 'verified_c', 'source_page_start_c', 'source_page_end_c'])
      .limit(2000, 0).fetch(),
    sdk.table('source_documents_c')
      .select(['Id', 'Name', 'official_url_c', 'source_category_c', 'rights_status_c', 'verification_status_c'])
      .limit(500, 0).fetch()
  ]);

  if (!syllabusResult.success) throw new Error(syllabusResult.message || 'Could not load syllabus versions');
  if (!nodeResult.success) throw new Error(nodeResult.message || 'Could not load curriculum topics');
  if (!sourceResult.success) throw new Error(sourceResult.message || 'Could not load curriculum sources');

  return {
    syllabi: syllabusResult.data || [],
    nodes: nodeResult.data || [],
    sources: sourceResult.data || []
  };
}

export function buildCurriculumRows(data = {}) {
  const syllabi = data.syllabi || [];
  const nodes = data.nodes || [];
  const sources = data.sources || [];
  const syllabusById = new Map(syllabi.map((item) => [String(item.Id), item]));
  const sourceById = new Map(sources.map((item) => [String(item.Id), item]));

  const publishedRows = nodes.filter((node) => {
    const syllabus = syllabusById.get(String(lookupId(node.syllabus_version_c)));
    return syllabus?.status_c === 'Published' && node.status_c === 'Published' && node.verified_c === true;
  }).map((node) => {
    const syllabus = syllabusById.get(String(lookupId(node.syllabus_version_c)));
    const source = sourceById.get(String(lookupId(syllabus?.source_document_c)));
    return {
      id: node.Id,
      exam: lookupName(syllabus?.examination_c) || syllabus?.version_label_c?.split('·')[0]?.trim() || 'Examination',
      year: syllabus?.academic_year_c || '',
      subject: node.subject_c || '',
      level: node.node_type_c || 'Topic',
      title: node.Name,
      parentCode: node.parent_node_code_c || '',
      parentTitle: node.parent_node_code_c || '',
      path: node.node_path_c || node.Name,
      sourceTitle: source?.Name || syllabus?.Name || 'Published curriculum source',
      sourceType: source?.source_category_c || 'Official',
      sourceUrl: source?.official_url_c || '',
      pageStart: node.source_page_start_c || '',
      pageEnd: node.source_page_end_c || '',
      state: 'Published · expert verified',
      verified: true
    };
  });

  const yearsWithPublishedUnits = new Set(
    publishedRows.filter((row) => row.level !== 'Subject').map((row) => row.exam + '|' + row.year)
  );
  const referenceRows = [];

  for (const curriculum of CURRICULA) {
    const exam = EXAM_LABELS[curriculum.key];
    const year = 2026;
    if (yearsWithPublishedUnits.has(exam + '|' + year)) continue;
    const sourceUrl = SOURCE_URLS[curriculum.key];

    for (const subject of curriculum.subjects) {
      const units = curriculum.units.filter((unit) => unit.subject === subject);
      referenceRows.push({
        id: curriculum.key + '-' + subject,
        exam,
        year,
        subject,
        level: 'Subject',
        title: subject,
        parentCode: '',
        parentTitle: '',
        path: curriculum.label + ' / ' + subject,
        sourceTitle: curriculum.source,
        sourceType: 'Official source snapshot',
        sourceUrl,
        pageStart: Math.min(...units.map((unit) => unit.pages[0])),
        pageEnd: Math.max(...units.map((unit) => unit.pages[1])),
        state: 'Reference snapshot · not yet expert-published in Northstar',
        verified: false
      });

      for (const unit of units) {
        referenceRows.push({
          id: curriculum.key + '-' + subject + '-' + unit.number,
          exam,
          year,
          subject,
          level: 'Unit',
          title: unit.title,
          parentCode: subject,
          parentTitle: subject,
          path: curriculum.label + ' / ' + subject + ' / Unit ' + unit.number,
          sourceTitle: curriculum.source,
          sourceType: 'Official source snapshot',
          sourceUrl,
          pageStart: unit.pages[0],
          pageEnd: unit.pages[1],
          state: 'Reference snapshot · unit headings only',
          verified: false
        });
      }
    }
  }

  const parentNames = new Map(publishedRows.map((row) => [row.parentCode, row.title]));
  return [...publishedRows, ...referenceRows].map((row) => ({
    ...row,
    parentTitle: parentNames.get(row.parentCode) || row.parentTitle
  }));
}
