import { useState } from "react";
import { Sparkles, AlertCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWidgetData } from "@/hooks/useWidgetData";
import { useAuth } from "@/hooks/useAuth";
import { useAIBriefing, type BriefingResult } from "@/hooks/useAIBriefing";

function SourceBadge({ sources }: { sources: string[] }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Database size={10} className="text-muted-foreground shrink-0" />
      <span className="text-[10px] text-muted-foreground">Sources:</span>
      {sources.map((s) => (
        <span
          key={s}
          className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

export function DailyBriefing() {
  const widget = useWidgetData();
  const { user } = useAuth();
  const aiMutation = useAIBriefing();
  const [result, setResult] = useState<BriefingResult | null>(null);

  if (widget.isLoading || widget.error) return null;

  const totalItems =
    widget.dueTodayTasksCount +
    widget.overdueTasksCount +
    widget.unreadEmailsCount +
    widget.missedCallsCount +
    widget.unreadMessagesCount;

  const hasUrgent = widget.overdueTasksCount > 0 || widget.missedCallsCount > 0;

  const priorities: string[] = [];
  if (widget.overdueTasksCount > 0)
    priorities.push(`${widget.overdueTasksCount} overdue task${widget.overdueTasksCount !== 1 ? "s" : ""}`);
  if (widget.missedCallsCount > 0)
    priorities.push(`${widget.missedCallsCount} missed call${widget.missedCallsCount !== 1 ? "s" : ""}`);
  if (widget.unreadEmailsCount > 0)
    priorities.push(`${widget.unreadEmailsCount} unread email${widget.unreadEmailsCount !== 1 ? "s" : ""}`);
  if (widget.dueTodayTasksCount > 0)
    priorities.push(`${widget.dueTodayTasksCount} task${widget.dueTodayTasksCount !== 1 ? "s" : ""} due today`);
  if (widget.unreadMessagesCount > 0)
    priorities.push(`${widget.unreadMessagesCount} unread message${widget.unreadMessagesCount !== 1 ? "s" : ""}`);

  function handleGenerate() {
    const userName =
      user?.user_metadata?.full_name?.split(" ")[0]?.trim() ||
      user?.email?.split("@")[0]?.trim() ||
      "";
    aiMutation.mutate(
      {
        date: new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }),
        userName,
        eventsToday: widget.todayEventsCount,
        tasksDueToday: widget.dueTodayTasksCount,
        tasksOverdue: widget.overdueTasksCount,
        unreadEmails: widget.unreadEmailsCount,
        missedCalls: widget.missedCallsCount,
        unreadMessages: widget.unreadMessagesCount,
      },
      {
        onSuccess: (data) => setResult(data),
      },
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3",
        hasUrgent && !result ? "border-destructive/30 bg-destructive/5" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Daily briefing</h3>
        <Sparkles size={14} className="text-amber-500 shrink-0 mt-0.5" />
      </div>

      {/* AI-generated briefing */}
      {result ? (
        <div className="space-y-2">
          <p className="text-sm text-foreground leading-relaxed">{result.briefing}</p>
          <SourceBadge sources={result.sources} />
          <p className="text-[10px] text-muted-foreground">Powered by Claude · Not a substitute for your own judgement</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground h-7"
            onClick={() => { setResult(null); aiMutation.reset(); }}
          >
            Show summary instead
          </Button>
        </div>
      ) : (
        <>
          {/* Rule-based summary */}
          {totalItems === 0 ? (
            <p className="text-sm text-muted-foreground">
              You're all caught up! No pending items for today.
            </p>
          ) : (
            <div className="space-y-2">
              <p className={cn("text-sm", hasUrgent ? "text-destructive font-medium" : "text-foreground")}>
                {hasUrgent ? "You have urgent items:" : "Here's what's waiting for you:"}
              </p>
              <ul className="space-y-1">
                {priorities.map((item, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI error state */}
          {aiMutation.isError && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10">
              <AlertCircle size={12} className="text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">
                {aiMutation.error?.message === "AI service not configured"
                  ? "AI briefing requires an Anthropic API key in Supabase secrets."
                  : "AI service is currently unavailable. The summary above is based on your live data."}
              </p>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleGenerate}
            disabled={aiMutation.isPending}
          >
            {aiMutation.isPending ? (
              <>
                <Sparkles size={12} className="mr-1.5 animate-pulse" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={12} className="mr-1.5" />
                Generate AI summary
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
