import { useState } from 'react';
import { toast } from 'sonner';
import { useFunction } from '@/hooks/useFunction';
import { useAuth } from '@/layouts/RootLayout';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const route = { path: '/ai-tutor', layout: 'owner', access: 'authenticated' };
export const nav = { label: 'AI teacher', icon: 'Bot', group: 'Learn', order: 30 };

const SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'Biology', 'Other'];
const DEPTHS = [
  { value: 'hint', label: 'Hints first' },
  { value: 'full', label: 'Full solution' }
];

export default function AITutor() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('Physics');
  const [depth, setDepth] = useState('hint');
  const [draft, setDraft] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);

  const { invoke, loading } = useFunction(import.meta.env.VITE_AI_TUTOR, { showError: true });

  const canSend = Boolean(user?.userId) && draft.trim().length >= 3 && !loading;

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
    setMessages((prev) => [...prev, { role: 'Teacher', text: result.reply }]);
  };

  const startNewSession = () => {
    setConversationId(null);
    setMessages([]);
    setDraft('');
    toast.success('Started a new session');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Guided problem solving</p>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">AI teacher and doubt solver</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={subject} onValueChange={setSubject} disabled={Boolean(conversationId)}>
            <SelectTrigger className="w-36" aria-label="Subject">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={depth} onValueChange={setDepth}>
            <SelectTrigger className="w-40" aria-label="Explanation depth">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPTHS.map((item) => (
                <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={startNewSession} disabled={loading && !messages.length}>
            New session
          </Button>
        </div>
      </div>

      <Card className="flex flex-col h-[65vh] min-h-[420px]">
        <CardContent className="flex flex-1 min-h-0 flex-col gap-4 p-4">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask a doubt from {subject}. Hints come first unless you pick a full solution. The teacher explains the method and does not claim sources it cannot verify.
              </p>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={
                    message.role === 'Student'
                      ? 'ml-auto max-w-[85%] rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words'
                      : 'mr-auto max-w-[85%] rounded-lg border border-border bg-card px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words'
                  }
                >
                  {message.text}
                </div>
              ))
            )}
            {loading && (
              <p className="text-xs text-muted-foreground">The teacher is working on your question…</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-end gap-2 min-w-0">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type your doubt"
              maxLength={2000}
              rows={2}
              className="min-w-0 flex-1 resize-none"
              aria-label="Your question"
            />
            <Button type="submit" disabled={!canSend} className="shrink-0">
              <ApperIcon name="Send" />
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
