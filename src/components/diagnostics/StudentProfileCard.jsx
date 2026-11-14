import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ApperIcon from '@/components/ApperIcon';

const EXAM_TARGETS = ['JEE Main', 'JEE Adv', 'NEET UG'];

function formatExamTarget(value) {
  return value === 'JEE Adv' ? 'JEE Advanced' : value;
}

export default function StudentProfileCard({
  form,
  updateForm,
  toggleExamTarget,
  saveProfile,
  savingProfile
}) {
  return (
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
  );
}
