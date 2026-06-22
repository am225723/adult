import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useTasks } from "@/hooks/useTasks";
import { useEmails } from "@/hooks/useEmails";
import { usePhoneCalls } from "@/hooks/usePhoneCalls";
import { usePhoneMessages } from "@/hooks/usePhoneMessages";
import { CalendarDays, CheckSquare, Mail, Phone, MessageSquare, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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

  const { data: todayEvents = [] } = useCalendarEvents(todayStart, todayEnd);
  const { data: todayTasks = [] } = useTasks("today");
  const { data: overdueTasks = [] } = useTasks("overdue");
  const { data: emails = [], isError: emailsError } = useEmails("unread");
  const { data: missedCalls = [], isError: callsError } = usePhoneCalls("missed");
  const { data: recentMessages = [], isError: messagesError } = usePhoneMessages("all");

  const upcomingEvents = todayEvents
    .filter((e) => !e.all_day)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const allDayEvents = todayEvents.filter((e) => e.all_day);

  const openTasksCount = todayTasks.length;
  const overdueCount = overdueTasks.length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10 animate-fade-in">
      {/* Header */}
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
          {todayLabel()}
        </p>
        <h1 className="text-2xl font-semibold text-foreground">
          {greeting()}, {name}.
        </h1>
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
      <div className="grid gap-6 md:grid-cols-2">
        {/* Up next */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays
                size={14}
                strokeWidth={1.75}
                className="text-muted-foreground"
              />
              <h2 className="text-sm font-medium text-foreground">Up next</h2>
            </div>
            <Link
              to="/calendar"
              className="text-xs text-muted-foreground hover:text-foreground"
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
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare
                size={14}
                strokeWidth={1.75}
                className="text-muted-foreground"
              />
              <h2 className="text-sm font-medium text-foreground">Focus tasks</h2>
            </div>
            <Link
              to="/tasks"
              className="text-xs text-muted-foreground hover:text-foreground"
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
          items={emails.slice(0, 3).map((email) => ({
            id: email.id,
            title: email.subject || "(no subject)",
            subtitle: email.from_address || "Unknown",
          }))}
          emptyMessage={emailsError ? "Gmail connection error" : "No unread emails."}
          error={emailsError}
        />
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
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} strokeWidth={1.75} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p
        className={cn(
          "text-2xl font-semibold leading-none",
          urgent ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
      {sublabel && (
        <p
          className={cn(
            "text-xs",
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
}: {
  icon: React.ElementType;
  title: string;
  emptyMessage: string;
  items?: Array<{ id: string; title: string; subtitle?: string }>;
  error?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={14} strokeWidth={1.75} className="text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
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
