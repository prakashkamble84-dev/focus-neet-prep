import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useFunction } from '@/hooks/useFunction';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import StudentProfileCard from '@/components/diagnostics/StudentProfileCard';
import DiagnosticEvidencePanel from '@/components/diagnostics/DiagnosticEvidencePanel';
import DiagnosticQuestionPanel from '@/components/diagnostics/DiagnosticQuestionPanel';
import DiagnosticResultPanel from '@/components/diagnostics/DiagnosticResultPanel';

export const route = {
  path: '/diagnostics',
  layout: 'owner',
  access: "profile === 'User' || profile === 'User_c'"
};

export const nav = {
  label: 'My profile & diagnostics',
  icon: 'ClipboardList',
  group: 'Start',
  order: 5,
  profiles: ['User', 'User_c']
};

const EMPTY_FORM = {
  examTargets: [],
  targetExamYear: '2027',
  classLevel: '',
  preferredLanguage: 'English',
  availableHours: '4',
  preparationStage: 'Building',
  currentLevel: 'Intermediate',
  schoolOrCoaching: '',
  learningPreferences: ''
};

function toArray(value) {
  if (Array.isArray(value)) return value;
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function mapProfileToForm(profile) {
  if (!profile) return EMPTY_FORM;
  return {
    examTargets: toArray(profile.exam_targets_c),
    targetExamYear: String(profile.target_exam_year_c || ''),
    classLevel: profile.class_level_c || '',
    preferredLanguage: profile.preferred_language_c || 'English',
    availableHours: String(profile.available_hours_c ?? ''),
    preparationStage: profile.preparation_stage_c || '',
    currentLevel: profile.current_level_c || '',
    schoolOrCoaching: profile.school_or_coaching_c || '',
    learningPreferences: profile.learning_preferences_c || ''
  };
}

async function fetchStudentWorkspace(studentUserId) {
  if (!studentUserId) {
    return {
      profile: null,
      examinations: [],
      attempts: [],
      mastery: []
    };
  }

  const { eq } = window.ApperSDK.CoreSDK;
  const [profileResult, examinationResult, attemptResult, masteryResult] = await Promise.all([
    sdk.table('student_profiles_c')
      .select([
        'Id',
        'Name',
        'student_user_c',
        'exam_targets_c',
        'target_exam_year_c',
        'class_level_c',
        'preferred_language_c',
        'available_hours_c',
        'preparation_stage_c',
        'current_level_c',
        'onboarding_completed_c',
        'school_or_coaching_c',
        'learning_preferences_c'
      ])
      .where(eq('student_user_c', studentUserId))
      .limit(1, 0)
      .fetch(),
    sdk.table('examinations_c')
      .select(['Id', 'Name', 'exam_type_c', 'active_c'])
      .where(eq('active_c', true))
      .orderBy('Name')
      .limit(100, 0)
      .fetch(),
    sdk.table('student_attempts_c')
      .select([
        'Id',
        'question_c',
        'is_correct_c',
        'score_awarded_c',
        'confidence_c',
        'attempt_source_c',
        'attempted_at_c'
      ])
      .where(eq('student_user_c', studentUserId))
      .where(eq('attempt_source_c', 'Diagnostic'))
      .orderByDesc('attempted_at_c')
      .limit(100, 0)
      .fetch(),
    sdk.table('student_concept_mastery_c')
      .select([
        'Id',
        'curriculum_node_c',
        'mastery_score_c',
        'mastery_status_c',
        'attempt_count_c',
        'correct_count_c',
        'confidence_score_c',
        'last_assessed_at_c'
      ])
      .where(eq('student_user_c', studentUserId))
      .orderByDesc('last_assessed_at_c')
      .limit(60, 0)
      .fetch()
  ]);

  const results = [
    [profileResult, 'Student profile'],
    [examinationResult, 'Examinations'],
    [attemptResult, 'Diagnostic history'],
    [masteryResult, 'Concept mastery']
  ];

  for (const [result, label] of results) {
    if (!result.success) {
      throw new Error(result.messages?.join('; ') || result.message || label + ' could not be loaded.');
    }
  }

  return {
    profile: profileResult.data?.[0] || null,
    examinations: examinationResult.data || [],
    attempts: attemptResult.data || [],
    mastery: masteryResult.data || []
  };
}

export default function Diagnostics() {export default function Diagnostics() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [confidence, setConfidence] = useState({});
  const [result, setResult] = useState(null);

  const {
    data,
    loading,
    error,
    run: refreshWorkspace
  } = useFetch(
    () => fetchStudentWorkspace(user?.userId),
    [user?.userId, refreshRevision]
  );

  const {
    invoke: runDiagnostic,
    loading: diagnosticLoading,
    error: diagnosticError
  } = useFunction(import.meta.env.VITE_STUDENT_DIAGNOSTIC, {
    showError: true
  });

  const studentProfile = data?.profile || null;
  const examinations = data?.examinations || [];
  const attempts = data?.attempts || [];
  const mastery = data?.mastery || [];
  const formReady = Boolean(
    studentProfile?.onboarding_completed_c === true &&
    toArray(studentProfile?.exam_targets_c).length &&
    studentProfile?.target_exam_year_c
  );

  const examTargets = form.examTargets;
  const eligibleExams = useMemo(
    () => examinations.filter((exam) => examTargets.includes(exam.exam_type_c)),
    [examinations, examTargets]
  );

  useEffect(() => {
    if (data?.profile) {
      setForm(mapProfileToForm(data.profile));
    }
  }, [data?.profile?.Id, data?.profile?.ModifiedOn]);

  useEffect(() => {
    if (!selectedExamId && eligibleExams.length) {
      setSelectedExamId(String(eligibleExams[0].Id));
    }
  }, [eligibleExams, selectedExamId]);

  const diagnosticCorrect = attempts.filter((attempt) => attempt.is_correct_c === true).length;
  const diagnosticAccuracy = attempts.length
    ? Math.round((diagnosticCorrect / attempts.length) * 100)
    : null;

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleExamTarget(target, checked) {
    setForm((current) => ({
      ...current,
      examTargets: checked
        ? [...new Set([...current.examTargets, target])]
        : current.examTargets.filter((item) => item !== target)
    }));
  }

  async function saveProfile(event) {
    event.preventDefault();

    if (!user?.userId) {
      toast.error('Your signed-in student account could not be identified.');
      return;
    }

    if (!form.examTargets.length) {
      toast.error('Choose at least one target examination.');
      return;
    }

    const examYear = Number(form.targetExamYear);
    const studyHours = Number(form.availableHours);
    if (!Number.isInteger(examYear) || examYear < 2026 || examYear > 2040) {
      toast.error('Enter a valid target examination year between 2026 and 2040.');
      return;
    }
    if (!Number.isFinite(studyHours) || studyHours < 0.5 || studyHours > 16) {
      toast.error('Available study time must be between 0.5 and 16 hours per day.');
      return;
    }

    const completed = Boolean(
      form.classLevel &&
      form.preferredLanguage &&
      form.preparationStage &&
      form.currentLevel
    );

    const payload = {
      Name: studentProfile?.Name || 'Student profile',
      student_user_c: user.userId,
      exam_targets_c: form.examTargets,
      target_exam_year_c: examYear,
      class_level_c: form.classLevel || null,
      preferred_language_c: form.preferredLanguage || 'English',
      available_hours_c: studyHours,
      preparation_stage_c: form.preparationStage || null,
      current_level_c: form.currentLevel || null,
      onboarding_completed_c: completed,
      school_or_coaching_c: form.schoolOrCoaching.trim(),
      learning_preferences_c: form.learningPreferences.trim()
    };

    setSavingProfile(true);
    try {
      const response = studentProfile?.Id
        ? await sdk.table('student_profiles_c').update({
            Id: studentProfile.Id,
            ...payload
          })
        : await sdk.table('student_profiles_c').create(payload);

      if (!response.data?.length) {
        throw new Error(response.messages?.join('; ') || response.message || 'Your profile could not be saved.');
      }

      toast.success(completed ? 'Student profile saved.' : 'Profile saved. Complete the remaining fields to unlock the baseline diagnostic.');
      setRefreshRevision((value) => value + 1);
    } catch (saveError) {
      toast.error('Profile save failed', { description: saveError.message || 'The student profile could not be saved.' });
    } finally {
      setSavingProfile(false);
    }
  }

  async function startDiagnostic() {
    if (!studentProfile?.Id || !formReady || !selectedExamId) {
      toast.error('Save your student profile and select one of your target examinations first.');
      return;
    }

    setResult(null);
    setAssessment(null);
    setAnswers({});
    setConfidence({});

    const response = await runDiagnostic({
      action: 'start',
      examinationId: selectedExamId
    });

    if (!response?.success) {
      toast.error(diagnosticError || 'A baseline question set could not be prepared.');
      return;
    }

    setAssessment(response);
  }

  function setSingleAnswer(questionId, value) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function toggleMultipleAnswer(questionId, value, checked) {
    setAnswers((current) => {
      const selected = Array.isArray(current[questionId]) ? current[questionId] : [];
      return {
        ...current,
        [questionId]: checked
          ? [...new Set([...selected, value])]
          : selected.filter((item) => item !== value)
      };
    });
  }

  async function submitDiagnostic() {
    if (!assessment?.questions?.length) return;

    const responses = assessment.questions.map((question) => ({
      questionId: question.id,
      answer: answers[question.id] ?? '',
      confidence: confidence[question.id] || 'Medium'
    }));

    const attemptedCount = responses.filter((item) => (
      Array.isArray(item.answer) ? item.answer.length > 0 : String(item.answer).trim().length > 0
    )).length;

    if (!attemptedCount) {
      toast.error('Answer at least one question before submitting the diagnostic.');
      return;
    }

    const response = await runDiagnostic({
      action: 'submit',
      examinationId: assessment.examinationId,
      studentUserId: user.userId,
      responses
    });

    if (!response?.success) {
      toast.error(diagnosticError || 'Your diagnostic could not be evaluated.');
      return;
    }

    setResult(response);
    setAssessment(null);
    setRefreshRevision((value) => value + 1);
    toast.success('Diagnostic evaluated and saved to your learning profile.');
  }

  const answeredCount = assessment?.questions?.filter((question) => {
    const answer = answers[question.id];
    return Array.isArray(answer) ? answer.length > 0 : String(answer || '').trim().length > 0;
  }).length || 0;

  if (profile !== 'User' && profile !== 'User_c') {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="font-semibold">Student workspace only</p>
          <p className="text-sm text-muted-foreground">Sign in with a student account to manage a personal preparation profile and baseline diagnostic.</p>
          <Link to="/" className="text-sm font-semibold text-primary hover:underline">Return to dashboard</Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Phase 7 · student baseline
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your learning profile</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Set your examination goals, then take a short baseline using published questions with verified answers and cleared usage rights. Your responses build the first evidence for concept mastery.
            </p>
          </div>
          <Badge variant={formReady ? 'secondary' : 'outline'}>
            {formReady ? 'Profile complete' : 'Profile setup'}
          </Badge>
        </div>
      </header>

      {loading && !data ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
          <Skeleton className="h-[420px] w-full" />
          <Skeleton className="h-[260px] w-full" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="font-semibold">Your student workspace could not be loaded</p>
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={refreshWorkspace}>Retry</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <StudentProfileCard
              form={form}
              updateForm={updateForm}
              toggleExamTarget={toggleExamTarget}
              saveProfile={saveProfile}
              savingProfile={savingProfile}
            />

            <DiagnosticEvidencePanel
              attempts={attempts}
              mastery={mastery}
              diagnosticAccuracy={diagnosticAccuracy}
              formReady={formReady}
              eligibleExams={eligibleExams}
              selectedExamId={selectedExamId}
              setSelectedExamId={setSelectedExamId}
              setAssessment={setAssessment}
              setResult={setResult}
              startDiagnostic={startDiagnostic}
              diagnosticLoading={diagnosticLoading}
            />
          </div>

          {diagnosticError && !assessment && !result && (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">{diagnosticError}</CardContent>
            </Card>
          )}

          {assessment && (
            <DiagnosticQuestionPanel
              assessment={assessment}
              answers={answers}
              confidence={confidence}
              answeredCount={answeredCount}
              setSingleAnswer={setSingleAnswer}
              toggleMultipleAnswer={toggleMultipleAnswer}
              setConfidence={setConfidence}
              submitDiagnostic={submitDiagnostic}
              diagnosticLoading={diagnosticLoading}
            />
          )}

          {result && (
            <DiagnosticResultPanel
              result={result}
              onRunAnother={() => {
                setResult(null);
                setAnswers({});
                setConfidence({});
              }}
              onReturn={() => {
                setResult(null);
                setAssessment(null);
                setRefreshRevision((value) => value + 1);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
