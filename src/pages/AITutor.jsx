import { useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useFunction } from '@/hooks/useFunction';
import { useAuth } from '@/layouts/RootLayout';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const route = {
  path: '/ai-tutor',
  layout: 'owner',
  access: "profile === 'User' || profile === 'User_c'"
};

export const nav = {
  label: 'AI teacher',
  icon: 'Bot',
  group: 'Learn',
  order: 30,
  profiles: ['User', 'User_c']
};

const SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'Biology', 'Other'];
const DEPTHS = [
  { value: 'hint', label: 'Hints first' },
  { value: 'full', label: 'Full solution' }
];

async function fetchRecentConversations(studentUserId) {
  if (!studentUserId) return [];
  const { eq } = window.ApperSDK.CoreSDK;
  const result = await sdk.table('ai_conversations_c')
    .select(['Id', 'Name', 'topic_type_c', 'status_c', 'last_activity_at_c'])
    .where(eq('student_user_c', studentUserId))
    .orderByDesc('last_activity_at_c')
    .limit(20, 0)
    .fetch();

  if (!result.success) {
    throw new Error(result.messages?.join('; ') || result.message || 'Your private tutor sessions could not be loaded.');
  }
  return result.data || [];
}

function formatActivity(value) {
  if (!value) return 'Recent session';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Recent session'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function AITutor() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('Physics');
  const [depth, setDepth] = useState('hint');
  const [draft, setDraft] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [readOnly, setReadOnly] = useState(false);
  const [openingConversation, setOpeningConversation] = useState(false);

  const {
    data: recentConversations,
    loading: sessionsLoading,
    error: sessionsError,
    run: refreshSessions
  } = useFetch(
    () => fetchRecentConversations(user?.userId),
    [user?.userId]
  );

  const {
    invoke,
    loading,
    error: tutorError
  } = useFunction(import.meta.env.VITE_AI_TUTOR, { showError: true });

  const canSend = Boolean(
    user?.userId &&
    draft.trim().length >= 3 &&
    draft.trim().length <= 2000 &&
    !loading &&
    !openingConversation &&
    !readOnly
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSend) return;

    const text = draft.trim();
    setDraft('');
    setMessages((prev) => [...prev, { role: 'Student', text }]);

    const result = await invoke({
      message: text,
      studentUserId: user.userId,
      subject,
      depth,
      conversationId
    });

    if (!result) {
      setDraft(text);
      setMessages((prev) => prev.slice(0, -1));
      return;
    }

    if (result.conversationId) setConversationId(String(result.conversationId));
    setReadOnly(false);
    setMessages((prev) => [...prev, { role: 'Teacher', text: result.reply }]);
    refreshSessions();
  };

  const openConversation = async (conversation) => {
    if (loading || openingConversation) return;
    setOpeningConversation(true);
    try {
      const { eq } = window.ApperSDK.CoreSDK;
      const response = await sdk.table('ai_messages_c')
        .select(['Id', 'message_role_c', 'message_body_c', 'CreatedOn'])
        .where(eq('conversation_c', conversation.Id))
        .orderByDesc('CreatedOn')
        .limit(60, 0)
        .fetch();

      if (!response.success) {
        throw new Error(response.messages?.join('; ') || response.message || 'This tutor session could not be opened.');
      }

      const restoredMessages = [...(response.data || [])].reverse().map((item) => ({
        role: item.message_role_c === 'Assistant' ? 'Teacher' : 'Student',
        text: item.message_body_c || '',
        createdOn: item.CreatedOn
      }));

      setMessages(restoredMessages);
      setConversationId(String(conversation.Id));
      setSubject(SUBJECTS.includes(conversation.topic_type_c) ? conversation.topic_type_c : 'Other');
      setReadOnly(conversation.status_c !== 'Open');
      setDraft('');
    } catch (error) {
      toast.error('Tutor session could not be opened', {
        description: error.message || 'The saved conversation is unavailable.'
      });
    } finally {
      setOpeningConversation(false);
    }
  };

  const startNewSession = () => {
    setConversationId(null);
    setMessages([]);
    setDraft('');
    setReadOnly(false);
    toast.success('Started a new session');
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div className="max-w-3xl space-y-2">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Phase 8 · personalised learning
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            AI teacher and doubt solver
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Work through a question with hints, or ask for a complete explanation. The teacher can use your verified curriculum, mastery signals and open repair notes when that evidence exists.
          </p>
        </div>
        <Button variant="outline" onClick={startNewSession} disabled={loading || openingConversation}>
          <ApperIcon name="Plus" size={15} className="mr-2" />
          New session
        </Button>
      </header>

      <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your recent sessions</h2>
            <Badge variant="outline">{recentConversations?.length || 0}</Badge>
          </div>
          <div className="space-y-2">
            {sessionsLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : sessionsError ? (
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-destructive">{sessionsError}</p>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={refreshSessions}>
                  Retry
                </Button>
              </div>
            ) : recentConversations?.length ? (
              recentConversations.map((conversation) => {
                const active = String(conversation.Id) === String(conversationId);
                return (
                  <button
                    key={conversation.Id}
                    type="button"
                    onClick={() => openConversation(conversation)}
                    disabled={loading || openingConversation}
                    aria-current={active ? 'page' : undefined}
                    className={'w-full rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ' + (
                      active ? 'border-primary bg-accent/70' : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30'
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{conversation.topic_type_c || 'Tutoring'}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{formatActivity(conversation.last_activity_at_c)}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {conversation.Name || 'Tutoring session'}
                    </span>
                    <span className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {conversation.status_c === 'Open' ? 'Can continue' : 'Read only'}
                      </span>
                      {active && <ApperIcon name="Check" size={13} className="text-primary" />}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4">
                <ApperIcon name="MessagesSquare" size={19} className="text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">No saved sessions yet</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Your tutoring conversations will appear here after the first reply is saved.
                </p>
              </div>
            )}
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            Conversations are private to your student account. Older sessions can be reopened for reading.
          </p>
        </aside>

        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={subject} onValueChange={setSubject} disabled={Boolean(conversationId) || openingConversation}>
                <SelectTrigger className="w-36" aria-label="Subject">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={depth} onValueChange={setDepth} disabled={readOnly || openingConversation}>
                <SelectTrigger className="w-40" aria-label="Explanation depth">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEPTHS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="secondary">
              {depth === 'hint' ? 'Hints first' : 'Worked solution'}
            </Badge>
          </div>

          <Card className="flex h-[68vh] min-h-[460px] flex-col">
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" aria-live="polite">
                {messages.length === 0 ? (
                  <div className="flex min-h-full flex-col items-start justify-center py-8">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary">
                      <ApperIcon name="GraduationCap" size={24} />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold">Let's work through the doubt</h2>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                      Ask a question from {subject}. Choose hints first to work towards the answer yourself, or request a full solution when you need the complete method.
                    </p>
                    <div className="mt-5 grid w-full gap-2 sm:grid-cols-2">
                      {[
                        'Explain the core idea behind this topic.',
                        'Give me a hint for a problem I am stuck on.',
                        'Show the steps and check the units.',
                        'Help me understand a recurring mistake.'
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setDraft(suggestion)}
                          className="rounded-md border border-border p-3 text-left text-xs leading-5 text-muted-foreground transition hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={message.Id || message.createdOn || message.role + '-' + index}
                      className={
                        message.role === 'Student'
                          ? 'ml-auto max-w-[88%] rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words'
                          : 'mr-auto max-w-[92%] rounded-lg border border-border bg-card px-3 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words'
                      }
                    >
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {message.role === 'Student' ? 'You' : 'Northstar teacher'}
                      </span>
                      {message.text}
                    </div>
                  ))
                )}

                {loading && (
                  <div className="mr-auto flex max-w-[90%] items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 text-xs text-muted-foreground">
                    <ApperIcon name="LoaderCircle" size={14} className="animate-spin" />
                    Checking your learning context and preparing an explanation…
                  </div>
                )}
                {openingConversation && (
                  <p className="text-xs text-muted-foreground">Opening saved session…</p>
                )}
              </div>

              {readOnly && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  This session is closed or archived. You can read it, or start a new session to continue learning.
                </div>
              )}

              {tutorError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  {tutorError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex min-w-0 items-end gap-2 border-t border-border pt-3">
                <Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type your doubt or paste a question (up to 2,000 characters)"
                  maxLength={2000}
                  rows={2}
                  className="min-w-0 flex-1 resize-none"
                  aria-label="Your question"
                  disabled={readOnly || loading || openingConversation}
                />
                <Button type="submit" disabled={!canSend} className="shrink-0">
                  <ApperIcon name="Send" size={15} className="mr-2" />
                  Send
                </Button>
              </form>
              <p className="text-[11px] leading-5 text-muted-foreground">
                The teacher uses your available study evidence where permitted. It can still make mistakes; verify important formulas and exam rules against the official source material.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
