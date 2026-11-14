import { useState } from 'react';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/layouts/RootLayout';
import { formatLocalDate, DATE_FORMATS } from '@/utils/date';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ApperIcon from '@/components/ApperIcon';

export const route = { path: '/mentors', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'Parent and mentor', icon: 'Users', group: 'Support', order: 100 };

const PARENT_PROFILE = 'Parent_c';
const ADVISOR_PROFILES = ['Teacher_c', 'Mentor_c'];
const RELATIONSHIPS = ['Parent', 'Guardian'];
const LINK_FIELDS = ['Id', 'parent_user_c', 'student_user_c', 'relationship_c', 'consent_status_c', 'verified_at_c'];
const ASSIGNMENT_FIELDS = ['Id', 'student_user_c', 'assignment_type_c', 'scope_c', 'starts_on_c', 'ends_on_c'];
const CLOSED_LINK_STATUSES = ['Revoked', 'Rejected'];
const EMPTY_ACCESS = { links: [], assignments: [] };

const CONSENT_STYLES = {
  Pending: 'border-warning/20 bg-warning/10 text-warning',
  Active: 'border-success/20 bg-success/10 text-success',
  Revoked: 'border-border bg-muted text-muted-foreground',
  Rejected: 'border-destructive/20 bg-destructive/10 text-destructive',
};

const lookupId = (value) => (value && typeof value === 'object' ? String(value.Id ?? '') : String(value ?? ''));
const lookupName = (value, fallback) => (value && typeof value === 'object' && value.Name ? value.Name : fallback);

async function fetchAccess(userId, profile) {
  const { and, eq } = window.ApperSDK.CoreSDK;
  const isParent = profile === PARENT_PROFILE;
  const isAdvisor = ADVISOR_PROFILES.includes(profile);

  const [linksResult, assignmentsResult] = await Promise.all([
    isAdvisor
      ? Promise.resolve(null)
      : sdk.table('parent_student_links_c')
          .select(LINK_FIELDS)
          .where(eq(isParent ? 'parent_user_c' : 'student_user_c', userId))
          .orderByDesc('CreatedOn')
          .limit(100, 0)
          .fetch(),
    isAdvisor
      ? sdk.table('mentor_assignments_c')
          .select(ASSIGNMENT_FIELDS)
          .where(and(eq('assigned_user_c', userId), eq('status_c', 'Active')))
          .orderByDesc('CreatedOn')
          .limit(100, 0)
          .fetch()
      : Promise.resolve(null),
  ]);

  if (linksResult && !linksResult.success) {
    throw new Error(linksResult.messages?.join('; ') || linksResult.message || 'Parent links could not be loaded.');
  }
  if (assignmentsResult && !assignmentsResult.success) {
    throw new Error(assignmentsResult.messages?.join('; ') || assignmentsResult.message || 'Learner assignments could not be loaded.');
  }

  return {
    links: (linksResult?.data ?? []).map((row) => ({
      id: String(row.Id),
      parentId: lookupId(row.parent_user_c),
      parentName: lookupName(row.parent_user_c, 'Parent account'),
      studentId: lookupId(row.student_user_c),
      studentName: lookupName(row.student_user_c, 'Student account'),
      relationship: row.relationship_c || 'Parent',
      consent: row.consent_status_c || 'Pending',
      verifiedAt: row.verified_at_c || null,
    })),
    assignments: (assignmentsResult?.data ?? []).map((row) => ({
      id: String(row.Id),
      learnerName: lookupName(row.student_user_c, 'Learner account'),
      type: row.assignment_type_c || 'Teacher',
      scope: row.scope_c || '',
      startsOn: row.starts_on_c || null,
      endsOn: row.ends_on_c || null,
    })),
  };
}

function reportWriteError(res, fallback) {
  const messages = res?.messages ?? [];
  toast.error(messages[0] || fallback, {
    description: messages.slice(1).join('\n') || undefined,
    duration: 8000,
  });
  console.error(`${fallback} ${messages.join('; ')}`.trim());
}

async function changeLink(linkId, changes, fallback) {
  try {
    const res = await sdk.table('parent_student_links_c').update({ Id: linkId, ...changes });
    if (res.messages.length) {
      reportWriteError(res, fallback);
      return false;
    }
    return true;
  } catch (err) {
    toast.error(fallback);
    console.error(`${fallback} ${err.message}`);
    return false;
  }
}

function ConsentBadge({ status }) {
  return <Badge variant="outline" className={CONSENT_STYLES[status] ?? ''}>{status}</Badge>;
}

function StudentView({ userId, requests, linked, busyId, onRespond, onRevoke }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your account ID</CardTitle>
          <CardDescription>
            Share this ID only with a parent or guardian you trust. They can send a link request, which stays pending until you approve it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">{userId}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Link requests</CardTitle>
          <CardDescription>Parents and guardians waiting for your approval.</CardDescription>
        </CardHeader>
        {requests.length === 0 ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No pending requests. A parent or guardian can send one using your account ID.
          </CardContent>
        ) : (
          <CardContent className="divide-y divide-border p-0">
            {requests.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium" title={link.parentName}>{link.parentName}</p>
                  <p className="text-xs text-muted-foreground">{link.relationship}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" disabled={busyId === link.id} onClick={() => onRespond(link, 'Active')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === link.id} onClick={() => onRespond(link, 'Rejected')}>
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approved parents and guardians</CardTitle>
          <CardDescription>You can revoke any of these at any time.</CardDescription>
        </CardHeader>
        {linked.length === 0 ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No parent or guardian has access to your progress.
          </CardContent>
        ) : (
          <CardContent className="divide-y divide-border p-0">
            {linked.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium" title={link.parentName}>{link.parentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {link.relationship}
                    {link.verifiedAt ? ` · approved ${formatLocalDate(link.verifiedAt, DATE_FORMATS.SHORT)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <ConsentBadge status={link.consent} />
                  <Button size="sm" variant="outline" disabled={busyId === link.id} onClick={() => onRevoke(link)}>
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function ParentView({ links, studentIdInput, onStudentIdChange, relationship, onRelationshipChange, submitting, onSubmit }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request access to a student</CardTitle>
          <CardDescription>
            Enter the account ID the student shares with you. Access starts only after the student approves the request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="student-account-id">Student account ID</Label>
              <Input
                id="student-account-id"
                value={studentIdInput}
                onChange={(event) => onStudentIdChange(event.target.value)}
                placeholder="Paste the student account ID"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Select value={relationship} onValueChange={onRelationshipChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={submitting || !studentIdInput.trim()}>
              <ApperIcon name="Send" size={15} className="mr-2" />
              {submitting ? 'Sending…' : 'Send request'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your students</CardTitle>
          <CardDescription>
            Link status only. Progress data is not released through this screen.
          </CardDescription>
        </CardHeader>
        {links.length === 0 ? (
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            You have not requested access to any student yet.
          </CardContent>
        ) : (
          <CardContent className="divide-y divide-border p-0">
            {links.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium" title={link.studentName}>{link.studentName}</p>
                  <p className="text-xs text-muted-foreground">{link.relationship}</p>
                </div>
                <ConsentBadge status={link.consent} />
              </div>
            ))}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function AdvisorView({ assignments }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assigned learners</CardTitle>
        <CardDescription>Active assignments made by an administrator.</CardDescription>
      </CardHeader>
      {assignments.length === 0 ? (
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No active learner assignments.
        </CardContent>
      ) : (
        <CardContent className="divide-y divide-border p-0">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium" title={assignment.learnerName}>{assignment.learnerName}</p>
                <p className="text-xs text-muted-foreground">
                  {assignment.scope || 'Scope not set'}
                  {assignment.startsOn ? ` · from ${formatLocalDate(assignment.startsOn, DATE_FORMATS.SHORT)}` : ''}
                  {assignment.endsOn ? ` to ${formatLocalDate(assignment.endsOn, DATE_FORMATS.SHORT)}` : ''}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">{assignment.type}</Badge>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function NoAccessView() {
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        Your profile has no parent, teacher or mentor access on this page.
      </CardContent>
    </Card>
  );
}

export default function Mentors() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const userId = user?.userId || '';
  const isParent = profile === PARENT_PROFILE;
  const isAdvisor = ADVISOR_PROFILES.includes(profile);

  const [studentIdInput, setStudentIdInput] = useState('');
  const [relationship, setRelationship] = useState(RELATIONSHIPS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const { data, loading, error, run } = useFetch(
    () => (userId ? fetchAccess(userId, profile) : Promise.resolve(EMPTY_ACCESS)),
    [userId, profile]
  );

  const links = data?.links ?? [];
  const assignments = data?.assignments ?? [];
  const requests = links.filter((link) => link.consent === 'Pending' && link.studentId === userId);
  const linked = links.filter((link) => link.consent === 'Active' && link.studentId === userId);

  const respondToRequest = async (link, decision) => {
    setBusyId(link.id);
    const approving = decision === 'Active';
    const ok = await changeLink(
      link.id,
      {
        consent_status_c: decision,
        ...(approving ? { verified_at_c: new Date().toISOString() } : {}),
      },
      approving ? 'Could not approve the link request.' : 'Could not decline the link request.'
    );
    setBusyId(null);
    if (ok) {
      toast.success(approving ? 'Link approved.' : 'Link request declined.');
      run();
    }
  };

  const revokeLink = async (link) => {
    setBusyId(link.id);
    const ok = await changeLink(link.id, { consent_status_c: 'Revoked' }, 'Could not revoke access.');
    setBusyId(null);
    if (ok) {
      toast.success('Access revoked.');
      run();
    }
  };

  const sendRequest = async (event) => {
    event.preventDefault();
    const studentId = studentIdInput.trim();
    if (!studentId) return;
    if (studentId === userId) {
      toast.error('Enter the student account ID, not your own.');
      return;
    }
    if (links.some((link) => link.studentId === studentId && !CLOSED_LINK_STATUSES.includes(link.consent))) {
      toast.error('A link to this student is already pending or active.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await sdk.table('parent_student_links_c').create({
        Name: 'Parent student link',
        parent_user_c: userId,
        student_user_c: studentId,
        relationship_c: relationship,
        consent_status_c: 'Pending',
        requested_by_c: userId,
      });
      if (res.messages.length) {
        reportWriteError(res, 'Link request was not sent.');
        return;
      }
      setStudentIdInput('');
      toast.success('Link request sent. The student must approve it.');
      run();
    } catch (err) {
      toast.error('Link request was not sent.');
      console.error(`Link request was not sent. ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="space-y-2 border-b border-border pb-5">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Phase 14 · authorised support
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Parent and mentor access</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Students decide who can see their progress. Parents, teachers and mentors only see what has been approved or assigned to them.
        </p>
      </header>

      {error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">{error.message}</CardContent>
        </Card>
      ) : loading && !data ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Loading access details…</CardContent>
        </Card>
      ) : isParent ? (
        <ParentView
          links={links}
          studentIdInput={studentIdInput}
          onStudentIdChange={setStudentIdInput}
          relationship={relationship}
          onRelationshipChange={setRelationship}
          submitting={submitting}
          onSubmit={sendRequest}
        />
      ) : isAdvisor ? (
        <AdvisorView assignments={assignments} />
      ) : profile ? (
        <StudentView
          userId={userId}
          requests={requests}
          linked={linked}
          busyId={busyId}
          onRespond={respondToRequest}
          onRevoke={revokeLink}
        />
      ) : (
        <NoAccessView />
      )}
    </div>
  );
}
