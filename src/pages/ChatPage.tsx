import { MessageSquare } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { usePhoneMessages } from "@/hooks/usePhoneMessages";

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatPage() {
  const { data: messages = [], isLoading, error } = usePhoneMessages("all");

  if (isLoading) {
    return <LoadingSpinner message="Loading messages…" />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-2 text-destructive">
        <MessageSquare size={24} strokeWidth={1.25} />
        <p className="text-sm">Failed to load SMS messages.</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-2 text-muted-foreground">
        <MessageSquare size={24} strokeWidth={1.25} />
        <p className="text-sm">No SMS messages yet.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border max-w-2xl mx-auto">
      <div className="px-6 py-4 sticky top-0 bg-background z-10">
        <h1 className="text-lg font-semibold">SMS Messages</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {messages.length} message{messages.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="px-6 py-4 border-b border-border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground">
                    {msg.direction === "incoming" ? "Incoming" : "Outgoing"}
                  </p>
                  {msg.is_read === false && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <p className="text-sm text-foreground">{msg.body || "(empty message)"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {relativeTime(msg.occurred_at)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
