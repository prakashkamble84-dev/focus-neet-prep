import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useFunction } from '@/hooks/useFunction';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';

export const route = {
  path: '/diagnostics',
  layout: 'owner',
  access: "profile === 'User' || profile === 'User_c'"
};

export const nav = {
  label: 'My profile & diagnostics',
  icon: 'ClipboardList',
  group: 'Start',
  order: 5
};

const EXAM_TARGETS = ['JEE Main', 'JEE Adv', 'NEET UG'];
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

function formatExamTarget(value) {
  return value === 'JEE Adv' ? 'JEE Advanced' : value;
}

function ScoreSummary({ result }) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Baseline result</CardTitle>
            <CardDescription>
              Based on the published, answer-verified questions completed in this session.
            </CardDescription>
          </div>
          <Badge variant="secondary">Saved to your profile</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {result.percentage === null ? '—' : Math.round(result.percentage) + '%'}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Correct</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{result.correctCount}</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Incorrect</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{result.incorrectCount}</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Unattempted</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{result.unattemptedCount}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Marks awarded</span>
            <span className="font-mono tabular-nums">{Number(result.score || 0).toFixed(2)} / {Number(result.maximumScore || 0).toFixed(2)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: Math.max(0, Math.min(100, Number(result.percentage || 0))) + '%' }}
            />
          </div>
        </div>

        {result.mastery?.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Concept evidence updated</h3>
            <div className="divide-y divide-border rounded-lg border border-border">
              {result.mastery.map((item) => (
                <div key={item.conceptId} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <p className="text-sm font-medium">{item.conceptName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.correctCount} correct of {item.attemptCount} recorded attempts
                    </p>
                  </div>
                  <Badge variant="outline">{item.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.masteryWarnings?.length > 0 && (
          <p className="text-xs text-warning-foreground">
            Some attempt records were saved, but a mastery summary could not be updated for every concept: {result.masteryWarnings.join(' ')}
          </p>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Answer review</h3>
          {result.feedback?.map((item, index) => (
            <div key={item.questionId} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium">{index + 1}. {item.questionName}</p>
                {item.answered
                  ? <Badge variant={item.correct ? 'secondary' : 'destructive'}>{item.correct ? 'Correct' : 'Incorrect'}</Badge>
                  : <Badge variant="outline">Not attempted</Badge>}
              </div>
              {item.answered && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Your answer: {item.submittedAnswer || '—'} · Correct answer: {item.correctAnswer || 'Not available'}
                </p>
              )}
              {item.solution && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.solution}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Diagnostics() {
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preparation profile</CardTitle>
                <CardDescription>
                  These details personalise your study plan. School or coaching details and learning preferences are optional.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={saveProfile}>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Target examinations</legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {EXAM_TARGETS.map((target) => (
                        <label key={target} className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/60">
                          <Checkbox
                            checked={form.examTargets.includes(target)}
                            onCheckedChange={(checked) => toggleExamTarget(target, checked === true)}
                          />
                          <span>{formatExamTarget(target)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-exam-year">Target examination year</Label>
                      <Input
                        id="profile-exam-year"
                        type="number"
                        min="2026"
                        max="2040"
                        step="1"
                        value={form.targetExamYear}
                        onChange={(event) => updateForm('targetExamYear', event.target.value)}
                        placeholder="2027"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-class-level">Academic level</Label>
                      <select
                        id="profile-class-level"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={form.classLevel}
                        onChange={(event) => updateForm('classLevel', event.target.value)}
                      >
                        <option value="">Choose your level</option>
                        <option value="11">Class 11</option>
                        <option value="12">Class 12</option>
                        <option value="Dropper">Dropper</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-language">Preferred language</Label>
                      <select
                        id="profile-language"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={form.preferredLanguage}
                        onChange={(event) => updateForm('preferredLanguage', event.target.value)}
                      >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Marathi">Marathi</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-hours">Study hours available per day</Label>
                      <Input
                        id="profile-hours"
                        type="number"
                        min="0.5"
                        max="16"
                        step="0.5"
                        value={form.availableHours}
                        onChange={(event) => updateForm('availableHours', event.target.value)}
                        placeholder="4"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-stage">Preparation stage</Label>
                      <select
                        id="profile-stage"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={form.preparationStage}
                        onChange={(event) => updateForm('preparationStage', event.target.value)}
                      >
                        <option value="">Choose stage</option>
                        <option value="Starting">Starting</option>
                        <option value="Building">Building</option>
                        <option value="Revision">Revision</option>
                        <option value="Final">Final revision</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="profile-level">Current preparation level</Label>
                      <select
                        id="profile-level"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={form.currentLevel}
                        onChange={(event) => updateForm('currentLevel', event.target.value)}
                      >
                        <option value="">Choose level</option>
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-coaching">School or coaching (optional)</Label>
                    <Input
                      id="profile-coaching"
                      value={form.schoolOrCoaching}
                      onChange={(event) => updateForm('schoolOrCoaching', event.target.value)}
                      placeholder="Optional"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-preferences">Learning preferences (optional)</Label>
                    <Textarea
                      id="profile-preferences"
                      rows={3}
                      value={form.learningPreferences}
                      onChange={(event) => updateForm('learningPreferences', event.target.value)}
                      placeholder="For example: worked examples first, then timed practice."
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <p className="max-w-md text-xs leading-5 text-muted-foreground">
                      Your profile and learning records are scoped to your student account by the database access policies.
                    </p>
                    <Button type="submit" disabled={savingProfile}>
                      {savingProfile
                        ? <><ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" />Saving profile…</>
                        : <><ApperIcon name="Save" size={15} className="mr-2" />Save profile</>}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Your diagnostic evidence</CardTitle>
                  <CardDescription>
                    Only submitted answers are counted. Skipped questions do not become false mistakes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Recorded answers</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{attempts.length}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Historical accuracy</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {diagnosticAccuracy === null ? '—' : diagnosticAccuracy + '%'}
                    </p>
                  </div>
                  <div className="col-span-2 border-t border-border pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Concept mastery signals</p>
                      <Badge variant="outline">{mastery.length} tracked</Badge>
                    </div>
                    {mastery.length ? (
                      <div className="mt-3 space-y-2">
                        {mastery.slice(0, 5).map((item) => (
                          <div key={item.Id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate">{item.curriculum_node_c?.Name || 'Curriculum concept'}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {Math.round(Number(item.mastery_score_c || 0) * 100)}% · {item.mastery_status_c}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        No concept evidence yet. Your first completed diagnostic will start the mastery record.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Start a baseline diagnostic</CardTitle>
                  <CardDescription>
                    Up to ten questions, sampled from your selected examination's published, answer-verified and rights-cleared question set.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="diagnostic-examination">Examination</Label>
                    <select
                      id="diagnostic-examination"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={selectedExamId}
                      onChange={(event) => {
                        setSelectedExamId(event.target.value);
                        setAssessment(null);
                        setResult(null);
                      }}
                      disabled={!formReady || diagnosticLoading || eligibleExams.length === 0}
                    >
                      <option value="">Select a target examination</option>
                      {eligibleExams.map((exam) => (
                        <option key={exam.Id} value={exam.Id}>{exam.Name}</option>
                      ))}
                    </select>
                  </div>

                  {!formReady && (
                    <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs leading-5 text-warning-foreground">
                      Save your profile with a target examination and target year first. The baseline is then unlocked.
                    </p>
                  )}

                  {formReady && !eligibleExams.length && (
                    <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs leading-5 text-warning-foreground">
                      No active examination record matches your selected targets yet. Ask an administrator to verify the examination setup.
                    </p>
                  )}

                  <Button
                    type="button"
                    className="w-full"
                    onClick={startDiagnostic}
                    disabled={!formReady || !selectedExamId || diagnosticLoading || !eligibleExams.length}
                  >
                    {diagnosticLoading
                      ? <><ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" />Preparing diagnostic…</>
                      : <><ApperIcon name="ClipboardCheck" size={15} className="mr-2" />Start baseline diagnostic</>}
                  </Button>

                  <p className="text-xs leading-5 text-muted-foreground">
                    Your answer key stays server-side until you submit. The diagnostic is a starting measurement, not a predicted rank or a final judgement of ability.
                  </p>
                  <div className="border-t border-border pt-3">
                    <Link to="/question-bank" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      Browse published question bank
                      <ApperIcon name="ArrowUpRight" size={13} />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {diagnosticError && !assessment && !result && (
            <Card>
              <CardContent className="p-4 text-sm text-destructive">{diagnosticError}</CardContent>
            </Card>
          )}

          {assessment && (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Baseline assessment</CardTitle>
                    <CardDescription>
                      {assessment.questionCount} questions · {assessment.availableQuestionPool} eligible questions in the published bank
                    </CardDescription>
                  </div>
                  <Badge variant="outline">{answeredCount} of {assessment.questionCount} answered</Badge>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: (answeredCount / Math.max(1, assessment.questionCount)) * 100 + '%' }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {assessment.questions.map((question) => {
                  const questionAnswer = answers[question.id];
                  const selectedValues = Array.isArray(questionAnswer) ? questionAnswer : [];
                  const answered = Array.isArray(questionAnswer)
                    ? questionAnswer.length > 0
                    : String(questionAnswer || '').trim().length > 0;

                  return (
                    <section key={question.id} className="space-y-3 border-b border-border pb-5 last:border-b-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">Question {question.number}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {question.subject || 'Subject not mapped'} · {question.conceptName} · {question.difficulty} · {question.maximumMarks} marks
                          </p>
                        </div>
                        <Badge variant={answered ? 'secondary' : 'outline'}>
                          {question.questionType === 'Multi' ? 'Multiple correct' : question.questionType}
                        </Badge>
                      </div>

                      <p className="whitespace-pre-wrap text-sm leading-6">{question.questionText}</p>

                      {question.questionType === 'Numeric' ? (
                        <div className="max-w-sm space-y-1.5">
                          <Label htmlFor={'answer-' + question.id}>Numerical answer</Label>
                          <Input
                            id={'answer-' + question.id}
                            inputMode="decimal"
                            value={String(questionAnswer || '')}
                            onChange={(event) => setSingleAnswer(question.id, event.target.value)}
                            placeholder="Enter your answer"
                          />
                        </div>
                      ) : question.options.length ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {question.options.map((option) => {
                            const selected = question.questionType === 'Multi'
                              ? selectedValues.includes(option.label)
                              : questionAnswer === option.label;

                            return (
                              <button
                                key={option.label}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => question.questionType === 'Multi'
                                  ? toggleMultipleAnswer(question.id, option.label, !selected)
                                  : setSingleAnswer(question.id, option.label)}
                                className={'flex min-h-12 items-start gap-3 rounded-md border p-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' + (
                                  selected ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'
                                )}
                              >
                                <span className="font-mono font-semibold">{option.label}.</span>
                                <span className="whitespace-pre-wrap">{option.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
                          No published answer options are available for this question. Skip it and flag it for editorial review.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor={'confidence-' + question.id} className="text-xs text-muted-foreground">How confident are you?</Label>
                        <select
                          id={'confidence-' + question.id}
                          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                          value={confidence[question.id] || 'Medium'}
                          onChange={(event) => setConfidence((current) => ({ ...current, [question.id]: event.target.value }))}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                    </section>
                  );
                })}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="max-w-xl text-xs leading-5 text-muted-foreground">
                    You can leave questions unanswered. Only questions you answer become attempt records; skipped questions are counted separately.
                  </p>
                  <Button type="button" onClick={submitDiagnostic} disabled={diagnosticLoading || answeredCount === 0}>
                    {diagnosticLoading
                      ? <><ApperIcon name="LoaderCircle" size={15} className="mr-2 animate-spin" />Evaluating…</>
                      : <><ApperIcon name="CheckCircle2" size={15} className="mr-2" />Submit diagnostic</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <div className="space-y-3">
              <ScoreSummary result={result} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => {
                  setResult(null);
                  setAnswers({});
                  setConfidence({});
                }}>
                  Run another baseline
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setResult(null);
                  setAssessment(null);
                  setRefreshRevision((value) => value + 1);
                }}>
                  Return to profile
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
