import { createPermissions } from '@/services/permissions';

const academicTables = [
  'examinations_c',
  'source_documents_c',
  'source_registry_c',
  'source_document_versions_c',
  'source_extractions_c',
  'source_verification_records_c',
  'syllabus_versions_c',
  'examination_versions_c',
  'examination_rules_c',
  'curriculum_import_batches_c',
  'syllabus_change_records_c',
  'historical_syllabus_crosswalks_c',
  'curriculum_nodes_c',
  'concept_relationships_c',
  'historical_papers_c',
  'questions_c',
  'question_options_c',
  'question_concept_mappings_c',
  'question_reviews_c',
  'test_blueprints_c',
  'tests_c',
  'test_questions_c'
];

const studentTables = [
  'student_profiles_c',
  'parent_student_links_c',
  'mentor_assignments_c',
  'student_attempts_c',
  'student_concept_mastery_c',
  'student_mistakes_c',
  'study_plans_c',
  'study_plan_tasks_c',
  'revision_items_c',
  'test_attempts_c',
  'test_responses_c'
];

const allTables = [
  ...academicTables,
  ...studentTables,
  'content_approvals_c',
  'audit_events_c',
  'ai_conversations_c',
  'ai_messages_c'
];

const fullAccess = Object.fromEntries(
  allTables.map((table) => [table, { access: 'Full' }])
);

const adminAccess = Object.fromEntries(
  allTables.map((table) => [
    table,
    {
      access: table === 'ai_conversations_c' || table === 'ai_messages_c'
        ? 'Inaccessible'
        : table === 'audit_events_c'
          ? 'Read'
          : 'Full'
    }
  ])
);

const expertAccess = Object.fromEntries(
  allTables.map((table) => [
    table,
    {
      access: academicTables.includes(table)
        ? 'Full'
        : table === 'content_approvals_c'
          ? 'Full'
          : table === 'audit_events_c'
            ? 'Read'
            : 'Inaccessible'
    }
  ])
);

const reviewerAccess = Object.fromEntries(
  allTables.map((table) => [
    table,
    {
      access: table === 'question_reviews_c' || table === 'content_approvals_c'
        ? 'Read,Create,Update'
        : table === 'source_documents_c' || table === 'source_document_versions_c' || table === 'source_extractions_c' || table === 'source_verification_records_c' || table === 'syllabus_change_records_c' || table === 'historical_syllabus_crosswalks_c'
          ? 'Read,Create,Update'
          : table === 'curriculum_import_batches_c'
            ? 'Read'
            : academicTables.includes(table)
              ? 'Read'
              : 'Inaccessible'
    }
  ])
);

const studentAccess = {
  examinations_c: { access: 'Read' },
  source_documents_c: { access: 'Read', inaccessibleFields: ['storage_path_c', 'extracted_text_c'] },
  source_registry_c: { access: 'Read' },
  examination_versions_c: { access: 'Read' },
  examination_rules_c: { access: 'Read' },
  syllabus_change_records_c: { access: 'Read' },
  historical_syllabus_crosswalks_c: { access: 'Read' },
  syllabus_versions_c: { access: 'Read' },
  curriculum_nodes_c: { access: 'Read' },
  concept_relationships_c: { access: 'Read' },
  historical_papers_c: { access: 'Read' },
  questions_c: { access: 'Read', inaccessibleFields: ['answer_key_c', 'solution_c'] },
  question_options_c: { access: 'Read', inaccessibleFields: ['is_correct_c'] },
  question_concept_mappings_c: { access: 'Read' },
  test_blueprints_c: { access: 'Read' },
  tests_c: { access: 'Read' },
  test_questions_c: { access: 'Read' },
  student_profiles_c: { access: 'Read,Create,Update' },
  parent_student_links_c: { access: 'Read,Create,Update' },
  mentor_assignments_c: { access: 'Read' },
  student_attempts_c: { access: 'Read,Create,Update', readOnlyFields: ['is_correct_c', 'score_awarded_c'] },
  student_concept_mastery_c: { access: 'Read' },
  student_mistakes_c: { access: 'Read' },
  study_plans_c: { access: 'Read,Create,Update' },
  study_plan_tasks_c: { access: 'Read,Update' },
  revision_items_c: { access: 'Read,Create,Update' },
  test_attempts_c: { access: 'Read,Create,Update', readOnlyFields: ['total_marks_c', 'score_obtained_c', 'correct_count_c', 'wrong_count_c', 'unattempted_count_c'] },
  test_responses_c: { access: 'Read,Create,Update', readOnlyFields: ['is_correct_c', 'marks_awarded_c'] },
  ai_conversations_c: { access: 'Read,Create,Update' },
  ai_messages_c: { access: 'Read,Create,Update' }
};

const teacherAccess = {
  ...Object.fromEntries(academicTables.map((table) => [
    table,
    {
      access: ['source_document_versions_c', 'source_extractions_c', 'source_verification_records_c', 'curriculum_import_batches_c'].includes(table) ? 'Inaccessible' : 'Read',
      ...(table === 'questions_c' ? { inaccessibleFields: ['answer_key_c', 'solution_c'] } : {}),
      ...(table === 'question_options_c' ? { inaccessibleFields: ['is_correct_c'] } : {}),
      ...(table === 'source_documents_c' ? { inaccessibleFields: ['storage_path_c', 'extracted_text_c'] } : {})
    }
  ])),
  student_profiles_c: { access: 'Read' },
  mentor_assignments_c: { access: 'Read' },
  student_attempts_c: { access: 'Read' },
  student_concept_mastery_c: { access: 'Read' },
  student_mistakes_c: { access: 'Read' },
  study_plans_c: { access: 'Read,Create,Update' },
  study_plan_tasks_c: { access: 'Read,Create,Update' },
  revision_items_c: { access: 'Read' },
  test_attempts_c: { access: 'Read' },
  test_responses_c: { access: 'Read' }
};

const mentorAccess = {
  ...Object.fromEntries(academicTables.map((table) => [
    table,
    {
      access: ['source_document_versions_c', 'source_extractions_c', 'source_verification_records_c', 'curriculum_import_batches_c'].includes(table) ? 'Inaccessible' : 'Read',
      ...(table === 'questions_c' ? { inaccessibleFields: ['answer_key_c', 'solution_c'] } : {}),
      ...(table === 'question_options_c' ? { inaccessibleFields: ['is_correct_c'] } : {}),
      ...(table === 'source_documents_c' ? { inaccessibleFields: ['storage_path_c', 'extracted_text_c'] } : {})
    }
  ])),
  student_profiles_c: { access: 'Read' },
  mentor_assignments_c: { access: 'Read' },
  student_attempts_c: { access: 'Read' },
  student_concept_mastery_c: { access: 'Read' },
  student_mistakes_c: { access: 'Read' },
  study_plans_c: { access: 'Read,Update' },
  study_plan_tasks_c: { access: 'Read,Update' },
  revision_items_c: { access: 'Read,Update' },
  test_attempts_c: { access: 'Read' },
  test_responses_c: { access: 'Read' }
};

const parentAccess = {
  ...Object.fromEntries(academicTables.map((table) => [
    table,
    {
      access: ['source_document_versions_c', 'source_extractions_c', 'source_verification_records_c', 'curriculum_import_batches_c'].includes(table) ? 'Inaccessible' : 'Read',
      ...(table === 'questions_c' ? { inaccessibleFields: ['answer_key_c', 'solution_c'] } : {}),
      ...(table === 'question_options_c' ? { inaccessibleFields: ['is_correct_c'] } : {}),
      ...(table === 'source_documents_c' ? { inaccessibleFields: ['storage_path_c', 'extracted_text_c'] } : {})
    }
  ])),
  student_profiles_c: { access: 'Read' },
  parent_student_links_c: { access: 'Read,Create' },
  student_attempts_c: { access: 'Read' },
  student_concept_mastery_c: { access: 'Read' },
  student_mistakes_c: { access: 'Read' },
  study_plans_c: { access: 'Read' },
  study_plan_tasks_c: { access: 'Read' },
  revision_items_c: { access: 'Read' },
  test_attempts_c: { access: 'Read' },
  test_responses_c: { access: 'Read' }
};

const profile = (label, reportsTo, options = {}) => ({
  label,
  isDefault: Boolean(options.isDefault),
  isPublic: false,
  canManageTeam: Boolean(options.canManageTeam),
  reportsTo: reportsTo || null
});

export const PROFILES = {
  CEO: profile('Super Admin', null, { canManageTeam: true }),
  CEO_c: profile('Super Admin', null, { canManageTeam: true }),
  Manager: profile('Admin', 'CEO', { canManageTeam: true }),
  Manager_c: profile('Admin', 'CEO', { canManageTeam: true }),
  User: profile('Student', 'Manager', { isDefault: true }),
  User_c: profile('Student', 'Manager', { isDefault: true }),
  AcademicExpert_c: profile('Academic Expert', 'Manager'),
  ContentReviewer_c: profile('Content Reviewer', 'AcademicExpert_c'),
  Teacher_c: profile('Teacher', 'Manager'),
  Mentor_c: profile('Mentor', 'Manager'),
  Parent_c: profile('Parent / Guardian', 'Manager')
};

export const TABLE_PERMISSIONS = {
  CEO: fullAccess,
  CEO_c: fullAccess,
  Manager: adminAccess,
  Manager_c: adminAccess,
  User: studentAccess,
  User_c: studentAccess,
  AcademicExpert_c: expertAccess,
  ContentReviewer_c: reviewerAccess,
  Teacher_c: teacherAccess,
  Mentor_c: mentorAccess,
  Parent_c: parentAccess
};

export const {
  getProfileMeta,
  getTableAccess,
  getFieldAccess
} = createPermissions(PROFILES, TABLE_PERMISSIONS);
