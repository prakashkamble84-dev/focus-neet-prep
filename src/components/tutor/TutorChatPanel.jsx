import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ApperIcon from '@/components/ApperIcon';

const SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'Biology', 'Other'];
const DEPTHS = [
  { value: 'hint', label: 'Hints first' },
  { value: 'full', label: 'Full solution' }
];

export default function TutorChatPanel({
  subject,
  setSubject,
  depth,
  setDepth,
  messages,
  draft,
  setDraft,
  loading,
  openingConversation,
  readOnly,
  error,
  canSend,
  onSubmit
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={subject} onValueChange={setSubject} disabled={messages.length > 0 || openingConversation}>
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

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="flex min-w-0 items-end gap-2 border-t border-border pt-3">
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
  );
}
