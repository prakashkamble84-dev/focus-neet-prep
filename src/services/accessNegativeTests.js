import { PROFILES, TABLE_PERMISSIONS, getTableAccess, getFieldAccess, getProfileMeta } from '@/services/userPermissions';

const STUDENT = 'User_c';
const PARENT = 'Parent_c';
const MENTOR = 'Mentor_c';
const TEACHER = 'Teacher_c';
const EXPERT = 'AcademicExpert_c';
const REVIEWER = 'ContentReviewer_c';
const ADMIN = 'Manager_c';

const tests = [
  {
    name: 'Every defined profile has a permission map',
    check: () => Object.keys(PROFILES).every((profile) => Boolean(TABLE_PERMISSIONS[profile]))
  },
  {
    name: 'An unknown profile gets no table access',
    check: () => !getTableAccess('Unknown_c', 'examinations_c').canRead
  },
  {
    name: 'Student cannot write exam reference data',
    check: () => {
      const access = getTableAccess(STUDENT, 'examinations_c');
      return !access.canCreate && !access.canUpdate && !access.canDelete;
    }
  },
  {
    name: 'Student cannot read answer keys or solutions',
    check: () => getFieldAccess(STUDENT, 'questions_c', 'answer_key_c').hidden && getFieldAccess(STUDENT, 'questions_c', 'solution_c').hidden
  },
  {
    name: 'Student cannot read correct-option flags',
    check: () => getFieldAccess(STUDENT, 'question_options_c', 'is_correct_c').hidden
  },
  {
    name: 'Student cannot read source storage paths or extracted text',
    check: () => ['storage_path_c', 'extracted_text_c'].every((field) => getFieldAccess(STUDENT, 'source_documents_c', field).hidden)
  },
  {
    name: 'Student cannot change graded scores',
    check: () => getFieldAccess(STUDENT, 'student_attempts_c', 'score_awarded_c').readOnly
      && getFieldAccess(STUDENT, 'student_attempts_c', 'is_correct_c').readOnly
      && getFieldAccess(STUDENT, 'test_attempts_c', 'score_obtained_c').readOnly
  },
  {
    name: 'Student has no access to audit or review tables',
    check: () => ['audit_events_c', 'content_approvals_c', 'question_generation_batches_c', 'question_generation_checks_c']
      .every((table) => !getTableAccess(STUDENT, table).canRead)
  },
  {
    name: 'Student cannot manage the team',
    check: () => !getProfileMeta(STUDENT).canManageTeam
  },
  {
    name: 'Only Super Admin and Admin can manage the team',
    check: () => Object.entries(PROFILES)
      .filter(([, meta]) => meta.canManageTeam)
      .every(([profile]) => ['CEO', 'CEO_c', 'Manager', 'Manager_c'].includes(profile))
  },
  {
    name: 'Parent cannot create or edit student profiles',
    check: () => {
      const access = getTableAccess(PARENT, 'student_profiles_c');
      return !access.canCreate && !access.canUpdate;
    }
  },
  {
    name: 'Mentor cannot create study plans',
    check: () => !getTableAccess(MENTOR, 'study_plans_c').canCreate
  },
  {
    name: 'Teacher cannot read question generation batches',
    check: () => !getTableAccess(TEACHER, 'question_generation_batches_c').canRead
  },
  {
    name: 'Academic expert cannot read AI teacher conversations',
    check: () => !getTableAccess(EXPERT, 'ai_conversations_c').canRead
  },
  {
    name: 'Content reviewer cannot update questions',
    check: () => !getTableAccess(REVIEWER, 'questions_c').canUpdate
  },
  {
    name: 'Admin cannot read private AI teacher conversations',
    check: () => !getTableAccess(ADMIN, 'ai_conversations_c').canRead
  }
];

export function runAccessNegativeTests() {
  const results = tests.map((test) => {
    let passed = false;
    try {
      passed = Boolean(test.check());
    } catch {
      passed = false;
    }
    return { name: test.name, passed };
  });

  return {
    passed: results.filter((result) => result.passed).length,
    tests: results
  };
}