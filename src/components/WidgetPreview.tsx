import { useWidgetData } from "@/hooks/useWidgetData";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  CheckSquare,
  Mail,
  Phone,
  MessageSquare,
  AlertCircle,
} from "lucide-react";

export function WidgetPreview() {
  const widget = useWidgetData();

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Today's overview</h3>

      {widget.isLoading ? (
        <div className="flex items-center justify-center py-4">
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
      ) : widget.error ? (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10">
          <AlertCircle size={12} className="text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive">Connection error</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <CalendarDays size={14} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Events</p>
              <p className="text-lg font-semibold text-foreground">
                {widget.todayEventsCount}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <CheckSquare size={14} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Tasks</p>
              <p className="text-lg font-semibold text-foreground">
                {widget.dueTodayTasksCount + widget.overdueTasksCount}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Mail size={14} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Emails</p>
              <p className={cn("text-lg font-semibold", widget.unreadEmailsCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                {widget.unreadEmailsCount}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Phone size={14} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Missed</p>
              <p className={cn("text-lg font-semibold", widget.missedCallsCount > 0 ? "text-destructive" : "text-foreground")}>
                {widget.missedCallsCount}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <MessageSquare size={14} className="text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Messages</p>
              <p className={cn("text-lg font-semibold", widget.unreadMessagesCount > 0 ? "text-blue-600 dark:text-blue-400" : "text-foreground")}>
                {widget.unreadMessagesCount}
              </p>
            </div>
          </div>

          {widget.overdueTasksCount > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 col-span-2">
              <AlertCircle size={14} className="text-destructive shrink-0" />
              <p className="text-xs font-medium text-destructive">
                {widget.overdueTasksCount} overdue
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
