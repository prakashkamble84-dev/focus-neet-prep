import { sdk } from '@/services/sdk';

const { eq } = window.ApperSDK.CoreSDK;

export const OFFICIAL_AUTHORITIES = [
  {
    source_code_c: 'NTA-JEE',
    Name: 'National Testing Agency · JEE Main',
    organisation_name_c: 'National Testing Agency',
    organisation_type_c: 'ExamAuthority',
    official_domain_c: 'jeemain.nta.nic.in',
    website_url_c: 'https://jeemain.nta.nic.in/',
    jurisdiction_c: 'India',
    authority_scope_c: 'Official JEE Main examination notices, syllabus, information bulletins, question papers and answer keys.'
  },
  {
    source_code_c: 'NTA-NEET',
    Name: 'National Testing Agency · NEET UG',
    organisation_name_c: 'National Testing Agency',
    organisation_type_c: 'ExamAuthority',
    official_domain_c: 'neet.nta.nic.in',
    website_url_c: 'https://neet.nta.nic.in/',
    jurisdiction_c: 'India',
    authority_scope_c: 'Official NEET UG examination notices, information bulletins, question papers and answer keys.'
  },
  {
    source_code_c: 'JEE-ADV',
    Name: 'JEE Advanced · Organising Institute',
    organisation_name_c: 'JEE Advanced organising institute',
    organisation_type_c: 'ExamAuthority',
    official_domain_c: 'jeeadv.ac.in',
    website_url_c: 'https://jeeadv.ac.in/',
    jurisdiction_c: 'India',
    authority_scope_c: 'Official JEE Advanced syllabus, information brochure, examination notices and papers.'
  },
  {
    source_code_c: 'NMC-UGMEB',
    Name: 'National Medical Commission · UGMEB',
    organisation_name_c: 'National Medical Commission · Undergraduate Medical Education Board',
    organisation_type_c: 'Regulator',
    official_domain_c: 'nmc.org.in',
    website_url_c: 'https://www.nmc.org.in/',
    jurisdiction_c: 'India',
    authority_scope_c: 'Official NEET UG syllabus recommendations and undergraduate medical education notices.'
  },
  {
    source_code_c: 'NCERT',
    Name: 'National Council of Educational Research and Training',
    organisation_name_c: 'National Council of Educational Research and Training',
    organisation_type_c: 'EducationBoard',
    official_domain_c: 'ncert.nic.in',
    website_url_c: 'https://ncert.nic.in/',
    jurisdiction_c: 'India',
    authority_scope_c: 'Official NCERT textbooks, curriculum documents and educational resources.'
  },
  {
    source_code_c: 'MOE',
    Name: 'Ministry of Education · Government of India',
    organisation_name_c: 'Ministry of Education',
    organisation_type_c: 'Ministry',
    official_domain_c: 'education.gov.in',
    website_url_c: 'https://www.education.gov.in/',
    jurisdiction_c: 'India',
    authority_scope_c: 'Government of India education policy and official ministry notifications.'
  }
];

export const OFFICIAL_EXAMINATIONS = [
  { code_c: 'JEE_MAIN', Name: 'JEE Main', exam_type_c: 'JEE Main', governing_authority_c: 'National Testing Agency', official_website_c: 'https://jeemain.nta.nic.in/', active_c: true },
  { code_c: 'JEE_ADV', Name: 'JEE Advanced', exam_type_c: 'JEE Adv', governing_authority_c: 'JEE Advanced organising institute', official_website_c: 'https://jeeadv.ac.in/', active_c: true },
  { code_c: 'NEET_UG', Name: 'NEET UG', exam_type_c: 'NEET UG', governing_authority_c: 'National Testing Agency', official_website_c: 'https://neet.nta.nic.in/', active_c: true }
];

export const OFFICIAL_DOCUMENTS = [
  {
    key: 'JEE_MAIN_2026_SYLLABUS',
    Name: 'JEE Main Paper 1 Syllabus · 2026',
    examCode: 'JEE_MAIN',
    sourceCode: 'NTA-JEE',
    document_type_c: 'Syllabus',
    document_url_c: 'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/10/202510311323551056.pdf',
    version_label_c: '2026 · Paper 1',
    official_title_c: 'Syllabus for JEE Main Paper 1 (B.E./B.Tech.) · Mathematics, Physics and Chemistry',
    academic_year_c: 2026,
    ingestion_status_c: 'Discovered',
    change_summary_c: 'Official NTA Paper 1 syllabus PDF. Binary upload, rights review and academic approval remain pending.'
  },
  {
    key: 'JEE_MAIN_2026_BULLETIN',
    Name: 'JEE Main Information Bulletin · 2026',
    examCode: 'JEE_MAIN',
    sourceCode: 'NTA-JEE',
    document_type_c: 'Bulletin',
    document_url_c: 'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/11/202511021649722475.pdf',
    version_label_c: '2026',
    official_title_c: 'Information Bulletin for JEE Main 2026',
    academic_year_c: 2026,
    ingestion_status_c: 'Discovered',
    change_summary_c: 'Official NTA information bulletin. Rule extraction and page-level verification remain pending.'
  },
  {
    key: 'JEE_ADV_2026_SYLLABUS',
    Name: 'JEE Advanced Syllabus · 2026',
    examCode: 'JEE_ADV',
    sourceCode: 'JEE-ADV',
    document_type_c: 'Syllabus',
    document_url_c: 'https://jeeadv.ac.in/documents/jee-advanced-2026-syllabus.pdf',
    version_label_c: '2026',
    official_title_c: 'JEE (Advanced) 2026 Syllabus',
    academic_year_c: 2026,
    ingestion_status_c: 'Discovered',
    change_summary_c: 'The official PDF states that the 2026 syllabus remains the same as JEE Advanced 2025. Detailed topic extraction and review remain pending.'
  },
  {
    key: 'JEE_ADV_2026_BULLETIN',
    Name: 'JEE Advanced Information Brochure · 2026',
    examCode: 'JEE_ADV',
    sourceCode: 'JEE-ADV',
    document_type_c: 'Bulletin',
    document_url_c: 'https://jeeadv.ac.in/documents/IBEnglish_2026.pdf',
    version_label_c: '2026',
    official_title_c: 'JEE (Advanced) 2026 Information Brochure',
    academic_year_c: 2026,
    ingestion_status_c: 'Discovered',
    change_summary_c: 'Official organiser brochure URL recorded. Binary retrieval and exam-rule extraction remain pending.'
  },
  {
    key: 'NEET_2026_SYLLABUS',
    Name: 'NEET UG Syllabus · 2026',
    examCode: 'NEET_UG',
    sourceCode: 'NMC-UGMEB',
    document_type_c: 'Syllabus',
    document_url_c: 'https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/01/202601081066816297.pdf',
    version_label_c: '2026',
    official_title_c: 'Syllabus for NEET (UG) · 2026',
    academic_year_c: 2026,
    publication_date_c: '2025-12-22',
    ingestion_status_c: 'Discovered',
    change_summary_c: 'NMC UGMEB public notice dated 22 December 2025 states that the NEET UG 2026 syllabus was finalised for academic session 2026–27. Binary upload and academic approval remain pending.'
  },
  {
    key: 'NEET_2026_BULLETIN',
    Name: 'NEET UG Information Bulletin · 2026',
    examCode: 'NEET_UG',
    sourceCode: 'NTA-NEET',
    document_type_c: 'Bulletin',
    document_url_c: 'https://neet.nta.nic.in/document/information-bulletin-english/',
    version_label_c: '2026',
    official_title_c: 'NEET (UG) 2026 Information Bulletin · official document page',
    academic_year_c: 2026,
    ingestion_status_c: 'Discovered',
    change_summary_c: 'Official NTA bulletin document page recorded. Direct binary retrieval and rule extraction remain pending.'
  }
];

async function ensureAuthority(record) {
  const found = await sdk.table('source_registry_c')
    .select(['Id', 'Name', 'source_code_c'])
    .where(eq('source_code_c', record.source_code_c))
    .limit(1, 0).fetch();
  if (!found.success) throw new Error(found.message || 'Could not read source registry');
  if (found.data?.[0]) return { record: found.data[0], created: false };
  const saved = await sdk.table('source_registry_c').create({ ...record, is_authoritative_c: true, active_c: true });
  if (!saved.data?.length) throw new Error(saved.messages?.join('; ') || 'Could not create source authority');
  return { record: saved.data[0], created: true };
}

async function ensureExamination(record) {
  const found = await sdk.table('examinations_c')
    .select(['Id', 'Name', 'code_c', 'exam_type_c'])
    .where(eq('code_c', record.code_c))
    .limit(1, 0).fetch();
  if (!found.success) throw new Error(found.message || 'Could not read examination');
  if (found.data?.[0]) return { record: found.data[0], created: false };
  const saved = await sdk.table('examinations_c').create(record);
  if (!saved.data?.length) throw new Error(saved.messages?.join('; ') || 'Could not create examination');
  return { record: saved.data[0], created: true };
}

async function ensureSourceDocument(spec, exam, authority) {
  const found = await sdk.table('source_documents_c')
    .select(['Id', 'Name', 'examination_c', 'source_registry_c', 'document_version_c'])
    .where(eq('Name', spec.Name))
    .limit(1, 0).fetch();
  if (!found.success) throw new Error(found.message || 'Could not read source document');
  if (found.data?.[0]) return { record: found.data[0], created: false };
  const saved = await sdk.table('source_documents_c').create({
    Name: spec.Name,
    examination_c: exam.Id,
    source_registry_c: authority.Id,
    issuing_authority_c: authority.Name,
    source_category_c: 'Official',
    document_type_c: spec.document_type_c,
    official_url_c: spec.document_url_c,
    published_date_c: spec.publication_date_c,
    academic_year_c: spec.academic_year_c,
    document_version_c: spec.version_label_c,
    rights_status_c: 'Unknown',
    verification_status_c: 'Review',
    ingestion_status_c: 'Queued',
    review_notes_c: 'Official source indexed. Upload the PDF, inspect provenance and rights, and complete academic review before publication.'
  });
  if (!saved.data?.length) throw new Error(saved.messages?.join('; ') || 'Could not create source document');
  return { record: saved.data[0], created: true };
}

async function ensureDocumentVersion(spec, doc, authority) {
  const found = await sdk.table('source_document_versions_c')
    .select(['Id', 'Name', 'source_document_c', 'version_label_c', 'document_url_c', 'ingestion_status_c'])
    .where(eq('source_document_c', doc.Id))
    .limit(1, 0).fetch();
  if (!found.success) throw new Error(found.message || 'Could not read source document version');
  if (found.data?.[0]) return { record: found.data[0], created: false };
  const saved = await sdk.table('source_document_versions_c').create({
    Name: spec.official_title_c,
    source_document_c: doc.Id,
    source_registry_c: authority.Id,
    version_label_c: spec.version_label_c,
    official_title_c: spec.official_title_c,
    document_url_c: spec.document_url_c,
    mime_type_c: 'application/pdf',
    publication_date_c: spec.publication_date_c,
    rights_status_c: 'Unknown',
    rights_notes_c: 'Reuse rights have not yet been reviewed. Do not redistribute until an authorised reviewer records a permitted-use basis.',
    ingestion_status_c: spec.ingestion_status_c,
    version_status_c: 'Current',
    academic_year_c: spec.academic_year_c,
    change_summary_c: spec.change_summary_c
  });
  if (!saved.data?.length) throw new Error(saved.messages?.join('; ') || 'Could not create source document version');
  return { record: saved.data[0], created: true };
}

async function ensureSyllabusVersion(spec, exam, doc, version) {
  const found = await sdk.table('syllabus_versions_c')
    .select(['Id', 'Name', 'version_label_c', 'examination_c', 'source_document_version_c'])
    .where(eq('version_label_c', spec.label))
    .limit(1, 0).fetch();
  if (!found.success) throw new Error(found.message || 'Could not read syllabus version');
  if (found.data?.[0]) return { record: found.data[0], created: false };
  const saved = await sdk.table('syllabus_versions_c').create({
    Name: spec.label,
    examination_c: exam.Id,
    source_document_c: doc.Id,
    source_document_version_c: version.Id,
    academic_year_c: 2026,
    version_label_c: spec.label,
    status_c: 'Review',
    change_summary_c: spec.note
  });
  if (!saved.data?.length) throw new Error(saved.messages?.join('; ') || 'Could not create syllabus version');
  return { record: saved.data[0], created: true };
}

async function ensureExamVersion(spec, exam, version) {
  const found = await sdk.table('examination_versions_c')
    .select(['Id', 'Name', 'version_code_c', 'status_c'])
    .where(eq('version_code_c', spec.versionCode))
    .limit(1, 0).fetch();
  if (!found.success) throw new Error(found.message || 'Could not read examination version');
  if (found.data?.[0]) return { record: found.data[0], created: false };
  const saved = await sdk.table('examination_versions_c').create({
    Name: spec.label,
    examination_c: exam.Id,
    academic_year_c: 2026,
    version_code_c: spec.versionCode,
    version_label_c: spec.label,
    status_c: 'Review',
    source_document_version_c: version.Id,
    notes_c: spec.note
  });
  if (!saved.data?.length) throw new Error(saved.messages?.join('; ') || 'Could not create examination version');
  return { record: saved.data[0], created: true };
}

async function ensureImportBatch(code, examVersion, version) {
  const found = await sdk.table('curriculum_import_batches_c')
    .select(['Id', 'Name', 'examination_version_c', 'status_c'])
    .where(eq('Name', code))
    .limit(1, 0).fetch();
  if (!found.success) throw new Error(found.message || 'Could not read import batch');
  if (found.data?.[0]) return { record: found.data[0], created: false };
  const saved = await sdk.table('curriculum_import_batches_c').create({
    Name: code,
    examination_version_c: examVersion.Id,
    document_version_c: version.Id,
    import_type_c: 'Initial',
    status_c: 'Draft',
    import_notes_c: 'Official source baseline registered. Curriculum nodes remain subject to academic review and publication approval.'
  });
  if (!saved.data?.length) throw new Error(saved.messages?.join('; ') || 'Could not create curriculum import batch');
  return { record: saved.data[0], created: true };
}

export async function registerOfficialBaseline() {
  const summary = { authorities: 0, examinations: 0, documents: 0, versions: 0, syllabusVersions: 0, examinationVersions: 0, batches: 0 };
  const authorityByCode = {};
  const examByCode = {};

  for (const authority of OFFICIAL_AUTHORITIES) {
    const result = await ensureAuthority(authority);
    authorityByCode[authority.source_code_c] = result.record;
    if (result.created) summary.authorities += 1;
  }

  for (const exam of OFFICIAL_EXAMINATIONS) {
    const result = await ensureExamination(exam);
    examByCode[exam.code_c] = result.record;
    if (result.created) summary.examinations += 1;
  }

  const documentByKey = {};
  const versionByKey = {};
  for (const spec of OFFICIAL_DOCUMENTS) {
    const exam = examByCode[spec.examCode];
    const authority = authorityByCode[spec.sourceCode];
    const documentResult = await ensureSourceDocument(spec, exam, authority);
    const versionResult = await ensureDocumentVersion(spec, documentResult.record, authority);
    documentByKey[spec.key] = documentResult.record;
    versionByKey[spec.key] = versionResult.record;
    if (documentResult.created) summary.documents += 1;
    if (versionResult.created) summary.versions += 1;
  }

  const syllabusSpecs = [
    { key: 'JEE_MAIN_2026_SYLLABUS', examCode: 'JEE_MAIN', label: 'JEE Main Paper 1 · 2026', versionCode: 'JEE_MAIN_2026_P1', note: 'Paper 1 syllabus record. Subject and unit outline import is available for academic review.' },
    { key: 'JEE_ADV_2026_SYLLABUS', examCode: 'JEE_ADV', label: 'JEE Advanced · 2026', versionCode: 'JEE_ADV_2026', note: 'Official syllabus PDF records that the 2026 syllabus remains unchanged from 2025. Detailed extraction is pending.' },
    { key: 'NEET_2026_SYLLABUS', examCode: 'NEET_UG', label: 'NEET UG · 2026', versionCode: 'NEET_UG_2026', note: 'NMC UGMEB finalised the syllabus on 22 December 2025 for academic session 2026–27. Outline import is available for academic review.' }
  ];

  for (const spec of syllabusSpecs) {
    const exam = examByCode[spec.examCode];
    const doc = documentByKey[spec.key];
    const version = versionByKey[spec.key];
    const syllabusResult = await ensureSyllabusVersion(spec, exam, doc, version);
    const examVersionResult = await ensureExamVersion(spec, exam, version);
    const batchResult = await ensureImportBatch(`INITIAL-${spec.versionCode}`, examVersionResult.record, version);
    if (syllabusResult.created) summary.syllabusVersions += 1;
    if (examVersionResult.created) summary.examinationVersions += 1;
    if (batchResult.created) summary.batches += 1;
  }

  return { summary };
}
