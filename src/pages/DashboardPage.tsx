import { useAuth } from "@/hooks/useAuth";
import { CalendarDays, CheckSquare, Mail, Phone, MessageSquare } from "lucide-react";

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

export function DashboardPage() {
  const { user } = useAuth();
  const fullNameFirst = user?.user_metadata?.full_name?.split(" ")[0]?.trim();
  const emailFirst = user?.email?.split("@")[0]?.trim();
  const name = fullNameFirst || emailFirst || "there";

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
        <SummaryCard
          icon={CalendarDays}
          label="Events today"
          value="—"
          sublabel="Calendar not connected"
        />
        <SummaryCard
          icon={CheckSquare}
          label="Tasks due"
          value="—"
          sublabel="No tasks yet"
        />
        <SummaryCard
          icon={Mail}
          label="Unread emails"
          value="—"
          sublabel="Gmail not connected"
        />
        <SummaryCard
          icon={Phone}
          label="Missed calls"
          value="—"
          sublabel="Quo not connected"
        />
      </div>

      {/* Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        <Section
          icon={CalendarDays}
          title="Up next"
          emptyMessage="No upcoming events. Connect Google Calendar to get started."
        />
        <Section
          icon={CheckSquare}
          title="Focus tasks"
          emptyMessage="No tasks yet. Add your first task to see it here."
        />
        <Section
          icon={MessageSquare}
          title="Recent messages"
          emptyMessage="No messages yet."
        />
        <Section
          icon={Mail}
          title="Priority inbox"
          emptyMessage="No emails yet. Connect Gmail to see your inbox here."
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
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={14} strokeWidth={1.75} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-foreground leading-none">
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  emptyMessage,
}: {
  icon: React.ElementType;
  title: string;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={14} strokeWidth={1.75} className="text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
    </div>
  );
}
