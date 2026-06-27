import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useTasks } from "@/hooks/useTasks";
import { useEmails } from "@/hooks/useEmails";
import { usePhoneCalls } from "@/hooks/usePhoneCalls";
import { usePhoneMessages } from "@/hooks/usePhoneMessages";
import {
  CalendarDays,
  CheckSquare,
  Mail,
  Phone,
  MessageSquare,
  AlertCircle,
  Plus,
  MessageCircle,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WidgetPreview } from "@/components/WidgetPreview";
import { DailyBriefing } from "@/components/DailyBriefing";
import { SuggestedFollowUps } from "@/components/SuggestedFollowUps";
import { cn } from "@/lib/utils";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function fmt12(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function DashboardPage() {
  const { user } = useAuth();
  const fullNameFirst = user?.user_metadata?.full_name?.split(" ")[0]?.trim();
  const emailFirst = user?.email?.split("@")[0]?.trim();
  const name = fullNameFirst || emailFirst || "there";

  // Today's date range
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayEnd = useMemo(() => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() + 1);
    return d;
  }, [todayStart]);

  const [overdueDismissed, setOverdueDismissed] = useState(false);

  const { data: todayEvents = [] } = useCalendarEvents(todayStart, todayEnd);
  const { data: todayTasks = [] } = useTasks("today");
  const { data: overdueTasks = [] } = useTasks("overdue");
  const { data: emails = [], isError: emailsError } = useEmails("unread");
  const { data: allCalls = [], isError: callsError } = usePhoneCalls("all");
  const { data: recentMessages = [], isError: messagesError } = usePhoneMessages("all");

  const missedCalls = useMemo(
    () => allCalls.filter((c) => ["missed", "no-answer", "abandoned"].includes(c.status || "")),
    [allCalls],
  );

  const voicemails = useMemo(
    () => allCalls.filter((c) => !!c.voicemail_transcript).slice(0, 3),
    [allCalls],
  );

  const upcomingEvents = todayEvents
    .filter((e) => !e.all_day)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const allDayEvents = todayEvents.filter((e) => e.all_day);

  const openTasksCount = todayTasks.length;
  const overdueCount = overdueTasks.length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
      {/* Command Center Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <img src="/whitelogo.png" alt="Command Center" className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-primary font-display">Command Center</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {greeting()}, {name}. Here's what's on your plate today.
        </p>
      </div>

      {/* Overdue tasks alert */}
      {overdueCount > 0 && !overdueDismissed && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertCircle size={14} className="shrink-0" />
          <p className="text-sm flex-1">
            You have{" "}
            <Link to="/tasks" className="font-medium underline underline-offset-2 hover:opacity-80">
              {overdueCount} overdue task{overdueCount !== 1 ? "s" : ""}
            </Link>{" "}
            — review them now to stay on track.
          </p>
          <button
            onClick={() => setOverdueDismissed(true)}
            className="shrink-0 hover:opacity-70 transition-opacity"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        <Link to="/tasks">
          <Button size="sm" variant="outline" className="gap-2">
            <Plus size={14} />
            New task
          </Button>
        </Link>
        <Link to="/calendar">
          <Button size="sm" variant="outline" className="gap-2">
            <CalendarDays size={14} />
            New event
          </Button>
        </Link>
        <Link to="/mail">
          <Button size="sm" variant="outline" className="gap-2">
            <Mail size={14} />
            Compose
          </Button>
        </Link>
        <Link to="/chat">
          <Button size="sm" variant="outline" className="gap-2">
            <MessageCircle size={14} />
            Send SMS
          </Button>
        </Link>
      </div>

      {/* Summary cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/calendar">
          <SummaryCard
            icon={CalendarDays}
            label="Events today"
            value={todayEvents.length > 0 ? String(todayEvents.length) : "—"}
            sublabel={
              todayEvents.length === 0
                ? "No events"
                : todayEvents.length === 1
                ? "1 event scheduled"
                : `${todayEvents.length} events scheduled`
            }
          />
        </Link>
        <Link to="/tasks">
          <SummaryCard
            icon={CheckSquare}
            label="Tasks due"
            value={
              openTasksCount + overdueCount > 0
                ? String(openTasksCount + overdueCount)
                : "—"
            }
            sublabel={
              overdueCount > 0
                ? `${overdueCount} overdue`
                : openTasksCount === 0
                ? "Nothing due today"
                : `${openTasksCount} due today`
            }
            urgent={overdueCount > 0}
          />
        </Link>
        <Link to="/mail">
          <SummaryCard
            icon={Mail}
            label="Unread emails"
            value={emailsError ? "—" : String(emails.length)}
            sublabel={
              emailsError
                ? "Gmail connection error"
                : emails.length === 0
                  ? "All caught up"
                  : `${emails.length} unread`
            }
            urgent={!emailsError && emails.length > 0}
          />
        </Link>
        <Link to="/phone">
          <SummaryCard
            icon={Phone}
            label="Missed calls"
            value={callsError ? "—" : String(missedCalls.length)}
            sublabel={
              callsError
                ? "Quo connection error"
                : missedCalls.length === 0
                  ? "No missed calls"
                  : `${missedCalls.length} missed`
            }
            urgent={!callsError && missedCalls.length > 0}
          />
        </Link>
      </div>

      {/* Sections */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Up next */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3 hover:border-border/80 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
                <CalendarDays
                  size={13}
                  strokeWidth={2}
                  className="text-primary"
                />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Up next</h2>
            </div>
            <Link
              to="/calendar"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View all
            </Link>
          </div>

          {allDayEvents.length === 0 && upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events today. Connect Google Calendar to see your schedule.
            </p>
          ) : (
            <div className="space-y-2">
              {allDayEvents.map((e) => (
                <div key={e.id} className="flex items-start gap-2">
                  <div className="mt-0.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground">All day</p>
                  </div>
                </div>
              ))}
              {upcomingEvents.slice(0, 4).map((e) => {
                const start = new Date(e.start_time);
                const end = new Date(e.end_time);
                const isPast = end < new Date();
                return (
                  <div
                    key={e.id}
                    className={cn("flex items-start gap-2", isPast && "opacity-50")}
                  >
                    <div className="mt-0.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmt12(start)} – {fmt12(end)}
                        {e.location && ` · ${e.location}`}
                      </p>
                    </div>
                  </div>
                );
              })}
              {upcomingEvents.length > 4 && (
                <Link
                  to="/calendar"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  +{upcomingEvents.length - 4} more
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Focus tasks */}
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3 hover:border-border/80 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
                <CheckSquare
                  size={13}
                  strokeWidth={2}
                  className="text-primary"
                />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Focus tasks</h2>
            </div>
            <Link
              to="/tasks"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View all
            </Link>
          </div>

          {todayTasks.length === 0 && overdueTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks due today. Add your first task to see it here.
            </p>
          ) : (
            <div className="space-y-1.5">
              {overdueTasks.slice(0, 2).map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm border border-destructive/50 shrink-0" />
                  <span className="text-sm truncate text-destructive">{t.title}</span>
                  <span className="text-xs text-destructive ml-auto shrink-0">
                    overdue
                  </span>
                </div>
              ))}
              {todayTasks.slice(0, 4 - Math.min(overdueTasks.length, 2)).map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm border border-border shrink-0" />
                  <span className="text-sm truncate">{t.title}</span>
                </div>
              ))}
              {(() => {
                const shownOverdue = Math.min(overdueTasks.length, 2);
                const shownToday = Math.min(todayTasks.length, 4 - shownOverdue);
                const hidden = overdueTasks.length + todayTasks.length - shownOverdue - shownToday;
                return hidden > 0 ? (
                  <Link
                    to="/tasks"
                    className="text-xs text-muted-foreground hover:text-foreground block"
                  >
                    +{hidden} more
                  </Link>
                ) : null;
              })()}
            </div>
          )}
        </div>

        <Section
          icon={MessageSquare}
          title="Recent messages"
          viewAllTo="/chat"
          items={recentMessages.slice(0, 3).map((msg) => ({
            id: msg.id,
            title: msg.body?.substring(0, 60) || "(empty message)",
            subtitle: new Date(msg.occurred_at || "").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          }))}
          emptyMessage={messagesError ? "SMS connection error" : "No recent messages."}
          error={messagesError}
        />
        <Section
          icon={Mail}
          title="Priority inbox"
          viewAllTo="/mail"
          items={emails.slice(0, 3).map((email) => ({
            id: email.id,
            title: email.subject || "(no subject)",
            subtitle: email.from_address || "Unknown",
          }))}
          emptyMessage={emailsError ? "Gmail connection error" : "No unread emails."}
          error={emailsError}
        />

        <Section
          icon={Phone}
          title="Voicemails"
          viewAllTo="/phone"
          items={voicemails.map((vm) => ({
            id: vm.id,
            title: vm.voicemail_transcript?.substring(0, 60) || "(empty)",
            subtitle: new Date(vm.occurred_at || "").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
          }))}
          emptyMessage={callsError ? "Quo connection error" : "No voicemails."}
          error={callsError}
        />
      </div>

      {/* AI-ready widgets section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <WidgetPreview />
        <DailyBriefing />
        <SuggestedFollowUps />
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sublabel,
  urgent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sublabel?: string;
  urgent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3 hover:border-border/80 transition-all hover:shadow-md">
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className={cn("w-5 h-5 rounded-md flex items-center justify-center", urgent ? "bg-destructive/20" : "bg-primary/20")}>
          <Icon size={13} strokeWidth={2} className={urgent ? "text-destructive" : "text-primary"} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p
        className={cn(
          "text-3xl font-bold leading-none font-display",
          urgent ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sublabel && (
        <p
          className={cn(
            "text-xs font-medium",
            urgent ? "text-destructive/70" : "text-muted-foreground",
          )}
        >
          {sublabel}
        </p>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  emptyMessage,
  items = [],
  error = false,
  viewAllTo,
}: {
  icon: React.ElementType;
  title: string;
  emptyMessage: string;
  items?: Array<{ id: string; title: string; subtitle?: string }>;
  error?: boolean;
  viewAllTo?: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3 hover:border-border/80 transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
            <Icon size={13} strokeWidth={2} className="text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {viewAllTo && items.length > 0 && (
          <Link
            to={viewAllTo}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            View all
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-start gap-2">
          {error && <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />}
          <p className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}>
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              <div className="mt-0.5 w-1 h-1 rounded-full bg-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
