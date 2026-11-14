import { useState } from 'react';
import { toast } from 'sonner';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useFunction } from '@/hooks/useFunction';
import { useAuth } from '@/layouts/RootLayout';
import { Button } from '@/components/ui/button';
import ApperIcon from '@/components/ApperIcon';
import TutorSessionList from '@/components/tutor/TutorSessionList';
import TutorChatPanel from '@/components/tutor/TutorChatPanel';

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

const DEFAULT_SUBJECT = 'Physics';

export default function AITutor() {
  const { user } = useAuth();
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSend) return;

    const text = draft.trim();
    setDraft('');
    setMessages((previous) => [...previous, { role: 'Student', text }]);

    const response = await invoke({
      message: text,
      studentUserId: user.userId,
      subject,
      depth,
      conversationId
    });

    if (!response) {
      setDraft(text);
      setMessages((previous) => previous.slice(0, -1));
      return;
    }

    if (response.conversationId) setConversationId(String(response.conversationId));
    setReadOnly(false);
    setMessages((previous) => [...previous, { role: 'Teacher', text: response.reply }]);
    refreshSessions();
  }

  async function openConversation(conversation) {
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

      setMessages([...(response.data || [])].reverse().map((item) => ({
        Id: item.Id,
        role: item.message_role_c === 'Assistant' ? 'Teacher' : 'Student',
        text: item.message_body_c || '',
        createdOn: item.CreatedOn
      })));
      setConversationId(String(conversation.Id));
      setSubject(['Physics', 'Chemistry', 'Maths', 'Biology', 'Other'].includes(conversation.topic_type_c)
        ? conversation.topic_type_c
        : 'Other');
      setReadOnly(conversation.status_c !== 'Open');
      setDraft('');
    } catch (error) {
      toast.error('Tutor session could not be opened', {
        description: error.message || 'The saved conversation is unavailable.'
      });
    } finally {
      setOpeningConversation(false);
    }
  }

  function startNewSession() {
    setConversationId(null);
    setMessages([]);
    setDraft('');
    setReadOnly(false);
    setSubject(DEFAULT_SUBJECT);
    setDepth('hint');
    toast.success('Started a new session');
  }

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
        <TutorSessionList
          conversations={recentConversations}
          loading={sessionsLoading}
          error={sessionsError}
          activeId={conversationId}
          busy={loading || openingConversation}
          onOpen={openConversation}
          onRetry={refreshSessions}
        />
        <TutorChatPanel
          subject={subject}
          setSubject={setSubject}
          depth={depth}
          setDepth={setDepth}
          messages={messages}
          draft={draft}
          setDraft={setDraft}
          loading={loading}
          openingConversation={openingConversation}
          readOnly={readOnly}
          error={tutorError}
          canSend={canSend}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
