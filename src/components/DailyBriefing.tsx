import { useWidgetData } from "@/hooks/useWidgetData";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DailyBriefing() {
  const widget = useWidgetData();

  if (widget.isLoading || widget.error) {
    return null;
  }

  const totalItems =
    widget.dueTodayTasksCount +
    widget.overdueTasksCount +
    widget.unreadEmailsCount +
    widget.missedCallsCount +
    widget.unreadMessagesCount;

  if (totalItems === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Daily briefing</h3>
        <p className="text-sm text-muted-foreground">
          You're all caught up! No pending items for today.
        </p>
      </div>
    );
  }

  const priorities: string[] = [];

  if (widget.overdueTasksCount > 0) {
    priorities.push(`${widget.overdueTasksCount} overdue task${widget.overdueTasksCount !== 1 ? "s" : ""}`);
  }
  if (widget.missedCallsCount > 0) {
    priorities.push(`${widget.missedCallsCount} missed call${widget.missedCallsCount !== 1 ? "s" : ""}`);
  }
  if (widget.unreadEmailsCount > 0) {
    priorities.push(`${widget.unreadEmailsCount} unread email${widget.unreadEmailsCount !== 1 ? "s" : ""}`);
  }
  if (widget.dueTodayTasksCount > 0) {
    priorities.push(`${widget.dueTodayTasksCount} task${widget.dueTodayTasksCount !== 1 ? "s" : ""} due today`);
  }
  if (widget.unreadMessagesCount > 0) {
    priorities.push(`${widget.unreadMessagesCount} unread message${widget.unreadMessagesCount !== 1 ? "s" : ""}`);
  }

  const hasUrgent = widget.overdueTasksCount > 0 || widget.missedCallsCount > 0;

  return (
    <div className={cn(
      "rounded-xl border bg-card p-4 space-y-3",
      hasUrgent ? "border-destructive/30 bg-destructive/5" : "border-border"
    )}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Daily briefing</h3>
        <Sparkles size={14} className="text-amber-500 shrink-0 mt-0.5" />
      </div>

      <div className="space-y-2">
        <p className={cn(
          "text-sm",
          hasUrgent ? "text-destructive font-medium" : "text-foreground"
        )}>
          {hasUrgent ? "You have some urgent items:" : "Here's what's waiting for you:"}
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

      <div className="pt-2">
        <p className="text-xs text-muted-foreground mb-2">
          AI-powered briefing coming soon. Focus on what matters most.
        </p>
        <Button variant="outline" size="sm" className="w-full text-xs" disabled>
          <Sparkles size={12} className="mr-1" />
          Generate AI summary
        </Button>
      </div>
    </div>
  );
}
