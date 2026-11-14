import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ApperIcon from '@/components/ApperIcon';

function formatActivity(value) {
  if (!value) return 'Recent session';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Recent session'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function TutorSessionList({
  conversations,
  loading,
  error,
  activeId,
  busy,
  onOpen,
  onRetry
}) {
  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Your recent sessions</h2>
        <Badge variant="outline">{conversations?.length || 0}</Badge>
      </div>

      <div className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : error ? (
          <div className="rounded-md border border-border p-3">
            <p className="text-xs text-destructive">{error}</p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : conversations?.length ? (
          conversations.map((conversation) => {
            const active = String(conversation.Id) === String(activeId);
            return (
              <button
                key={conversation.Id}
                type="button"
                onClick={() => onOpen(conversation)}
                disabled={busy}
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
  );
}
