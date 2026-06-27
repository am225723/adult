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
  ChevronRight,
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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 animate-fade-in">
        {/* Command Center Dashboard Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <img src="/whitelogo.png" alt="Command Center" className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-primary font-display">
                Command Center<br />Dashboard
              </h1>
            </div>
          </div>
          <p className="text-base text-muted-foreground">
            {greeting()}, Dr. {name}. Here's what's on your plate today.
          </p>
        </div>

        {/* Overdue Alert Banner */}
        {overdueCount > 0 && !overdueDismissed && (
          <div className="flex items-center gap-4 px-4 sm:px-6 py-4 rounded-lg bg-warning/15 border border-warning/30 text-warning">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-sm sm:text-base flex-1 font-medium">
              You have{" "}
              <Link to="/tasks" className="underline underline-offset-2 font-bold hover:opacity-80">
                {overdueCount} overdue task{overdueCount !== 1 ? "s" : ""}
              </Link>{" "}
              — review them now to stay on track.
            </p>
            <button
              onClick={() => setOverdueDismissed(true)}
              className="shrink-0 hover:opacity-70 transition-opacity"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Quick Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Link to="/tasks">
            <Button size="sm" className="gap-2">
              <Plus size={14} />
              Tasks Due
            </Button>
          </Link>
          <Link to="/calendar">
            <Button size="sm" variant="outline" className="gap-2">
              <CalendarDays size={14} />
              Events Today
            </Button>
          </Link>
        </div>

        {/* Stats Grid - 2x2 Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/calendar" className="block">
            <StatCard
              number={todayEvents.length}
              label="Events scheduled"
            />
          </Link>
          <Link to="/tasks" className="block">
            <StatCard
              number={openTasksCount + overdueCount}
              label="Tasks due"
              highlight={overdueCount > 0}
            />
          </Link>
          <Link to="/mail" className="block">
            <StatCard
              number={emailsError ? 0 : emails.length}
              label={emailsError ? "Gmail error" : "Unread emails"}
              highlight={!emailsError && emails.length > 0}
            />
          </Link>
          <Link to="/phone" className="block">
            <StatCard
              number={callsError ? 0 : missedCalls.length}
              label={callsError ? "Quo error" : "Missed calls"}
              highlight={!callsError && missedCalls.length > 0}
            />
          </Link>
        </div>

      {/* Up Next Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Up next</h2>
          <Link
            to="/calendar"
            className="text-sm font-medium text-primary hover:opacity-80 flex items-center gap-1"
          >
            View all <ChevronRight size={14} />
          </Link>
        </div>

        {allDayEvents.length === 0 && upcomingEvents.length === 0 ? (
          <div className="rounded-lg bg-card border border-border/30 p-6 text-center">
            <p className="text-muted-foreground">No events today</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allDayEvents.slice(0, 2).map((e) => (
              <Link
                key={e.id}
                to={`/calendar?event=${e.id}`}
                className="block rounded-lg bg-card border border-border/30 p-4 hover:shadow-md transition-all"
              >
                <p className="font-medium text-foreground">{e.title}</p>
                <p className="text-sm text-muted-foreground">All day</p>
              </Link>
            ))}
            {upcomingEvents.slice(0, 3).map((e) => {
              const start = new Date(e.start_time);
              const end = new Date(e.end_time);
              return (
                <Link
                  key={e.id}
                  to={`/calendar?event=${e.id}`}
                  className="block rounded-lg bg-card border border-border/30 p-4 hover:shadow-md transition-all"
                >
                  <p className="font-medium text-foreground">{e.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {fmt12(start)} – {fmt12(end)}
                    {e.location && ` · ${e.location}`}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

        {/* Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Focus Tasks */}
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

            {/* Recent Messages */}
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

            {/* Priority Inbox */}
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Voicemails */}
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

            {/* Widgets */}
            <WidgetPreview />
            <DailyBriefing />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  number,
  label,
  highlight = false,
}: {
  number: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border p-6 transition-all",
      highlight
        ? "bg-card border-destructive/30 shadow-sm hover:shadow-md"
        : "bg-card border-border/30 shadow-sm hover:shadow-md"
    )}>
      <p className={cn(
        "text-4xl sm:text-5xl font-bold font-display",
        highlight ? "text-destructive" : "text-primary"
      )}>
        {number}
      </p>
      <p className="text-sm text-muted-foreground mt-2">{label}</p>
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
