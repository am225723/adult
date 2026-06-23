import { Mail, MessageSquare, Phone, CheckSquare, Database } from "lucide-react";
import { Link } from "react-router-dom";
import { useWidgetData } from "@/hooks/useWidgetData";
import { cn } from "@/lib/utils";

interface Suggestion {
  icon: React.ElementType;
  title: string;
  description: string;
  action: string;
  href: string;
  variant: "default" | "warning" | "info";
}

export function SuggestedFollowUps() {
  const widget = useWidgetData();

  if (widget.isLoading || widget.error) {
    return null;
  }

  const suggestions: Suggestion[] = [];

  if (widget.overdueTasksCount > 0) {
    suggestions.push({
      icon: CheckSquare,
      title: "Complete overdue tasks",
      description: `${widget.overdueTasksCount} task${widget.overdueTasksCount !== 1 ? "s are" : " is"} past ${widget.overdueTasksCount !== 1 ? "their" : "its"} due date`,
      action: "View tasks",
      href: "/tasks?tab=overdue",
      variant: "warning",
    });
  }

  if (widget.missedCallsCount > 0) {
    suggestions.push({
      icon: Phone,
      title: "Return missed calls",
      description: `${widget.missedCallsCount} missed call${widget.missedCallsCount !== 1 ? "s" : ""} ${widget.missedCallsCount !== 1 ? "are" : "is"} waiting`,
      action: "View calls",
      href: "/phone",
      variant: "warning",
    });
  }

  if (widget.unreadEmailsCount > 0) {
    suggestions.push({
      icon: Mail,
      title: "Review unread emails",
      description: `${widget.unreadEmailsCount} email${widget.unreadEmailsCount !== 1 ? "s" : ""} ${widget.unreadEmailsCount !== 1 ? "are" : "is"} unread`,
      action: "View emails",
      href: "/mail?filter=unread",
      variant: "default",
    });
  }

  if (widget.unreadMessagesCount > 0) {
    suggestions.push({
      icon: MessageSquare,
      title: "Catch up on messages",
      description: `${widget.unreadMessagesCount} unread message${widget.unreadMessagesCount !== 1 ? "s" : ""}`,
      action: "View messages",
      href: "/chat",
      variant: "info",
    });
  }

  const topSuggestions = suggestions.slice(0, 3);

  if (topSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Suggested follow-ups</h3>

      <div className="space-y-2">
        {topSuggestions.map((suggestion, idx) => {
          const Icon = suggestion.icon;
          return (
            <Link
              key={idx}
              to={suggestion.href}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50",
                suggestion.variant === "warning"
                  ? "border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20"
                  : suggestion.variant === "info"
                    ? "border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-950/20"
                    : "border-border hover:border-primary/50",
              )}
            >
              <Icon
                size={16}
                className={cn(
                  "mt-0.5 shrink-0",
                  suggestion.variant === "warning"
                    ? "text-amber-600 dark:text-amber-400"
                    : suggestion.variant === "info"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-primary",
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{suggestion.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {suggestion.description}
                </p>
                <span className="text-xs text-primary font-medium mt-1 inline-block hover:underline">
                  {suggestion.action} →
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <Database size={10} className="text-muted-foreground shrink-0" />
        <p className="text-[10px] text-muted-foreground">Based on your live data · Actions require your confirmation</p>
      </div>
    </div>
  );
}
