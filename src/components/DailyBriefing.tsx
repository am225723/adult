import { useState } from "react";
import { Sparkles, AlertCircle, Database, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWidgetData } from "@/hooks/useWidgetData";
import { useAuth } from "@/hooks/useAuth";
import { useAIBriefing, type BriefingResult } from "@/hooks/useAIBriefing";
import {
  useTodayBriefing,
  useAIBriefingHistory,
  useInvalidateBriefingCache,
  type BriefingEntry,
} from "@/hooks/useAIBriefingHistory";

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

function formatBriefingDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function BriefingView({
  briefing,
  sources,
  savedIndicator,
  onReset,
}: {
  briefing: string;
  sources: string[];
  savedIndicator?: boolean;
  onReset?: () => void;
}) {
  return (
    <div className="space-y-2">
      {savedIndicator && (
        <div className="flex items-center gap-1 text-[10px] text-emerald-600">
          <Check size={10} />
          <span>Saved today</span>
        </div>
      )}
      <p className="text-sm text-foreground leading-relaxed">{briefing}</p>
      <SourceBadge sources={sources} />
      <p className="text-[10px] text-muted-foreground">Powered by Claude · Not a substitute for your own judgement</p>
      {onReset && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground h-7"
          onClick={onReset}
        >
          Show summary instead
        </Button>
      )}
    </div>
  );
}

function HistorySection({ entries }: { entries: BriefingEntry[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const past = entries.filter((e) => e.briefing_date !== today);
  if (past.length === 0) return <p className="text-xs text-muted-foreground italic">No past briefings yet.</p>;
  return (
    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
      {past.map((e) => (
        <div key={e.id} className="border-l-2 border-border pl-3 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">{formatBriefingDate(e.briefing_date)}</p>
          <p className="text-xs text-foreground leading-relaxed">{e.briefing_text}</p>
          <SourceBadge sources={e.sources} />
        </div>
      ))}
    </div>
  );
}

export function DailyBriefing() {
  const widget = useWidgetData();
  const { user } = useAuth();
  const aiMutation = useAIBriefing();
  const todayBriefing = useTodayBriefing();
  const history = useAIBriefingHistory(14);
  const invalidateCache = useInvalidateBriefingCache();
  const [overrideResult, setOverrideResult] = useState<BriefingResult | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

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

  // Determine what to show: overrideResult > saved today > fallback to summary
  const activeBriefing: BriefingResult | null = overrideResult ?? (
    !showSummary && todayBriefing.data
      ? { briefing: todayBriefing.data.briefing_text, sources: todayBriefing.data.sources }
      : null
  );

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
        onSuccess: (data) => {
          setOverrideResult(data);
          setShowSummary(false);
          invalidateCache();
        },
      },
    );
  }

  function handleReset() {
    setOverrideResult(null);
    setShowSummary(true);
    aiMutation.reset();
  }

  const hasPastBriefings = (history.data ?? []).some(
    (e) => e.briefing_date !== new Date().toISOString().slice(0, 10),
  );

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3",
        hasUrgent && !activeBriefing ? "border-destructive/30 bg-destructive/5" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Daily briefing</h3>
        <Sparkles size={14} className="text-amber-500 shrink-0 mt-0.5" />
      </div>

      {/* AI-generated or saved briefing */}
      {activeBriefing ? (
        <BriefingView
          briefing={activeBriefing.briefing}
          sources={activeBriefing.sources}
          savedIndicator={!overrideResult && !!todayBriefing.data}
          onReset={handleReset}
        />
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

      {/* Briefing history */}
      {hasPastBriefings && (
        <div className="border-t border-border pt-3">
          <button
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground w-full"
            onClick={() => setHistoryExpanded((v) => !v)}
          >
            {historyExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            Past briefings
          </button>
          {historyExpanded && (
            <div className="mt-2">
              {history.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : (
                <HistorySection entries={history.data ?? []} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
