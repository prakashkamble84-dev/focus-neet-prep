import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useAuth } from '@/layouts/RootLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';

export const route = {
  path: '/settings',
  layout: 'owner',
  access: "profile === 'User' || profile === 'User_c'"
};

export const nav = {
  label: 'Preferences',
  icon: 'Settings2',
  group: 'Governance',
  profiles: ['User', 'User_c'],
  order: 140
};

const PREFERRED_LANGUAGES = ['English', 'Hindi', 'Marathi'];
const DEFAULT_LANGUAGE = 'English';

async function fetchLanguagePreference(studentUserId) {
  if (!studentUserId) return null;

  const { eq } = window.ApperSDK.CoreSDK;
  const res = await sdk.table('student_profiles_c')
    .select(['Id', 'Name', 'preferred_language_c', 'exam_targets_c', 'target_exam_year_c', 'onboarding_completed_c'])
    .where(eq('student_user_c', studentUserId))
    .limit(1, 0)
    .fetch();

  if (!res.success) throw new Error(res.message);
  return res.data?.[0] ?? null;
}

function getOnboardingSteps(studentProfile) {
  return [
    { label: 'Student profile created', done: Boolean(studentProfile) },
    { label: 'Exam target chosen', done: Boolean(studentProfile?.exam_targets_c) },
    { label: 'Target exam year set', done: Boolean(studentProfile?.target_exam_year_c) },
    { label: 'Preferred language set', done: Boolean(studentProfile?.preferred_language_c) },
    { label: 'Onboarding completed', done: studentProfile?.onboarding_completed_c === true }
  ];
}

export default function Settings() {
  const { user } = useAuth();
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [saving, setSaving] = useState(false);

  const {
    data: studentProfile,
    loading,
    error,
    run: refreshLanguage
  } = useFetch(
    () => fetchLanguagePreference(user?.userId),
    [user?.userId]
  );

  useEffect(() => {
    setLanguage(studentProfile?.preferred_language_c || DEFAULT_LANGUAGE);
  }, [studentProfile]);

  async function handleSave(event) {
    event.preventDefault();
    if (!studentProfile?.Id) return;

    setSaving(true);
    try {
      const response = await sdk.table('student_profiles_c').update({
        Id: studentProfile.Id,
        preferred_language_c: language
      });

      if (!response.data?.length) {
        const message = response.messages?.[0] || 'Your language preference could not be saved.';
        toast.error(message);
        console.error(`student_profiles_c update failed: ${(response.messages || []).join('; ')}`);
        return;
      }

      toast.success('Language preference saved.');
      refreshLanguage();
    } catch (saveError) {
      toast.error('Language preference save failed', { description: saveError.message });
      console.error(`student_profiles_c update failed: ${saveError.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !studentProfile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full max-w-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Preferences</h1>
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Your preferences could not be loaded. {error.message}</p>
          <Button variant="outline" size="sm" onClick={refreshLanguage}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="max-w-3xl space-y-3">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">Account configuration</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Preferences</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Choose the language your AI teacher and study materials use for explanations. Changes apply to your student profile.
        </p>
      </div>

      <section className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Getting started</h2>
          <span className="font-mono text-xs font-semibold text-muted-foreground tabular-nums">
            {getOnboardingSteps(studentProfile).filter((step) => step.done).length} of {getOnboardingSteps(studentProfile).length} done
          </span>
        </div>
        <ul className="divide-y divide-border">
          {getOnboardingSteps(studentProfile).map((step) => (
            <li key={step.label} className="flex items-center gap-3 py-2 text-sm">
              <ApperIcon name={step.done ? 'CheckCircle2' : 'Circle'} size={16} className={step.done ? 'shrink-0 text-success' : 'shrink-0 text-muted-foreground'} />
              <span className={step.done ? 'min-w-0' : 'min-w-0 text-muted-foreground'}>{step.label}</span>
            </li>
          ))}
        </ul>
        {!studentProfile?.onboarding_completed_c && (
          <Button asChild size="sm">
            <Link to="/diagnostics">Complete my student profile</Link>
          </Button>
        )}
      </section>

      {!studentProfile ? (
        <div className="flex max-w-xl flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Create your student profile first, then you can set your language preference.</p>
          <Button asChild size="sm">
            <Link to="/diagnostics">Open my profile</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSave} className="max-w-xl space-y-5 rounded-lg border border-border bg-card p-5 sm:p-7">
          <div className="space-y-1.5">
            <Label htmlFor="preferred-language">Preferred language</Label>
            <select
              id="preferred-language"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              disabled={saving}
            >
              {PREFERRED_LANGUAGES.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Used as the default language for AI teacher replies and practice explanations.</p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving || language === (studentProfile.preferred_language_c || DEFAULT_LANGUAGE)}>
              <ApperIcon name="Save" size={15} />
              {saving ? 'Saving...' : 'Save preference'}
            </Button>
          </div>
        </form>
      )}

      <section className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <ApperIcon name="ShieldCheck" size={19} className="mt-0.5 shrink-0 text-primary" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Privacy and your data</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Your practice answers, diagnostics, mistakes, revision items, mock test attempts and AI teacher conversations are stored against your own student account. Only you can see them, and no one else sees them unless you approve a link.
            </p>
          </div>
        </div>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          <li>Parents and mentors see your progress only after you approve the link, and you can revoke it at any time.</li>
          <li>Your AI teacher conversations are private to your account.</li>
          <li>Verified curriculum and question content is shared by every student and is not personal data.</li>
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/mentors">Manage parent and mentor links</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/ai-tutor">Open AI teacher history</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
