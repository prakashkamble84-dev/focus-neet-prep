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
  {
    code_c: 'JEE_MAIN',
    Name: 'JEE Main',
    exam_type_c: 'JEE Main',
    governing_authority_c: 'National Testing Agency',
    official_website_c: 'https://jeemain.nta.nic.in/',
    active_c: true
  },
  {
    code_c: 'JEE_ADV',
    Name: 'JEE Advanced',
    exam_type_c: 'JEE Adv',
    governing_authority_c: 'JEE Advanced organising institute',
    official_website_c: 'https://jeeadv.ac.in/',
    active_c: true
  },
  {
    code_c: 'NEET_UG',
    Name: 'NEET UG',
    exam_type_c: 'NEET UG',
    governing_authority_c: 'National Testing Agency',
    official_website_c: 'https://neet.nta.nic.in/',
    active_c: true
  }
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
    publication_date_c: '2025-10-31',
    ingestion_status_c: 'Retrieved',
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
    ingestion_status_c: 'Retrieved',
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
    ingestion_status_c: 'Retrieved',
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
    ingestion_status_c: 'Retrieved',
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

async function fetchOne(table, field, value, fields) {
  const result = await sdk.table(table)
    .select(fields)
    .where(eq(field, value))
    .limit(1, 0)
    .fetch();
  if (!result.success) throw new Error(result.message || `Could not read ${table}`);
  return result.data?.[0] ?? null;
}

async function ensureRecord(table, field, value, payload, fields) {
  const existing = await fetchOne(table, field, value, fields);
  if (existing) return { record: existing, created: false };

  const result = await sdk.table(table).create(payload);
  if (!result.data?.length) {
    throw new Error(result.messages?.join('; ') || result.message || `Could not create ${table}`);
  }
  return { record: result.data[0], created: true };
}

export async function registerOfficialBaseline() {
  const summary = { authorities: 0, examinations: 0, documents: 0, versions: 0, syllabusVersions: 0, examinationVersions: 0, batches: 0 };

  const authorityByCode = {};
  for (const authority of OFFICIAL_AUTHORITIES) {
    const { record, created } = await ensureRecord(
      'source_registry_c',
      'source_code_c',
      authority.source_code_c,
      { ...authority, is_authoritative_c: true, active_c: true },
      ['Id', 'Name', 'source_code_c']
    );
    authorityByCode[authority.source_code_c] = record;
    if (created) summary.authorities += 1;
  }

  const examByCode = {};
  for (const exam of OFFICIAL_EXAMINATIONS) {
    const { record, created } = await ensureRecord(
      'examinations_c',
      'code_c',
      exam.code_c,
      exam,
      ['Id', 'Name', 'code_c', 'exam_type_c']
    );
    examByCode[exam.code_c] = record;
    if (created) summary.examinations += 1;
  }

  const documentByKey = {};
  const versionByKey = {};
  for (const spec of OFFICIAL_DOCUMENTS) {
    const exam = examByCode[spec.examCode];
    const authority = authorityByCode[spec.sourceCode];
    const { record: doc, created: docCreated } = await ensureRecord(
      'source_documents_c',
      'Name',
      spec.Name,
      {
        Name: spec.Name,
        examination_c: exam.Id,
        source_registry_c: authority.Id,
        issuing_authority_c: authority.organisation_name_c || authority.Name,
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
      },
      ['Id', 'Name', 'examination_c', 'source_registry_c', 'document_version_c']
    );
    documentByKey[spec.key] = doc;
    if (docCreated) summary.documents += 1;

    const { record: version, created: versionCreated } = await ensureRecord(
      'source_document_versions_c',
      'version_label_c',
      spec.version_label_c,
      {
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
      },
      ['Id', 'Name', 'source_document_c', 'version_label_c', 'document_url_c', 'ingestion_status_c']
    );
    versionByKey[spec.key] = version;
    if (versionCreated) summary.versions += 1;
  }

  const syllabusSpecs = [
    { key: 'JEE_MAIN_2026_SYLLABUS', examCode: 'JEE_MAIN', label: 'JEE Main Paper 1 · 2026', versionCode: 'JEE_MAIN_2026_P1', note: 'Paper 1 syllabus record. Subject and unit outline import is available for academic review.' },
    { key: 'JEE_ADV_2026_SYLLABUS', examCode: 'JEE_ADV', label: 'JEE Advanced · 2026', versionCode: 'JEE_ADV_2026', note: 'Official syllabus PDF records that the 2026 syllabus remains unchanged from 2025. Detailed extraction is pending.' },
    { key: 'NEET_2026_SYLLABUS', examCode: 'NEET_UG', label: 'NEET UG · 2026', versionCode: 'NEET_UG_2026', note: 'NMC UGMEB finalised the syllabus on 22 December 2025 for academic session 2026–27. Outline import is available for academic review.' }
  ];

  for (const spec of syllabusSpecs) {
    const exam = examByCode[spec.examCode];
    const version = versionByKey[spec.key];
    const { record: syllabus, created: syllabusCreated } = await ensureRecord(
      'syllabus_versions_c',
      'version_label_c',
      spec.label,
      {
        Name: spec.label,
        examination_c: exam.Id,
        source_document_c: documentByKey[spec.key].Id,
        source_document_version_c: version.Id,
        academic_year_c: 2026,
        version_label_c: spec.label,
        status_c: 'Review',
        effective_date_c: '2026-01-01',
        change_summary_c: spec.note
      },
      ['Id', 'Name', 'version_label_c', 'examination_c', 'source_document_version_c']
    );
    if (syllabusCreated) summary.syllabusVersions += 1;

    const { created: examVersionCreated } = await ensureRecord(
      'examination_versions_c',
      'version_code_c',
      spec.versionCode,
      {
        Name: spec.label,
        examination_c: exam.Id,
        academic_year_c: 2026,
        version_code_c: spec.versionCode,
        version_label_c: spec.label,
        status_c: 'Review',
        source_document_version_c: version.Id,
        notes_c: spec.note
      },
      ['Id', 'Name', 'version_code_c', 'status_c']
    );
    if (examVersionCreated) summary.examinationVersions += 1;

    const examVersion = await fetchOne('examination_versions_c', 'version_code_c', spec.versionCode, ['Id', 'Name', 'version_code_c']);
    const batchCode = `INITIAL-${spec.versionCode}`;
    const { created: batchCreated } = await ensureRecord(
      'curriculum_import_batches_c',
      'Name',
      batchCode,
      {
        Name: batchCode,
        examination_version_c: examVersion.Id,
        document_version_c: version.Id,
        import_type_c: 'Initial',
        status_c: 'Draft',
        import_notes_c: 'Seeded source baseline. Curriculum nodes remain subject to academic review and publication approval.'
      },
      ['Id', 'Name', 'examination_version_c', 'status_c']
    );
    if (batchCreated) summary.batches += 1;
  }

  return { summary, authorities: authorityByCode, examinations: examByCode, documents: documentByKey, versions: versionByKey };
}
