import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  CheckSquare,
  Building,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorState } from "@/components/ErrorState";
import { useContact } from "@/hooks/useContact";
import { useContactEmails } from "@/hooks/useContactEmails";
import { useContactCalls } from "@/hooks/useContactCalls";
import { useContactMessages } from "@/hooks/useContactMessages";
import { useContactTasks } from "@/hooks/useContactTasks";
import { cn } from "@/lib/utils";

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return <ErrorState title="Contact not found" />;
  }

  const { data: contact, isLoading, error } = useContact(id);
  const { data: emails = [] } = useContactEmails(id);
  const { data: calls = [] } = useContactCalls(id);
  const { data: messages = [] } = useContactMessages(id);
  const { data: tasks = [] } = useContactTasks(id);

  if (isLoading) {
    return <LoadingSpinner message="Loading contact…" />;
  }

  if (error || !contact) {
    return <ErrorState title="Contact not found" onRetry={() => navigate("/contacts")} />;
  }

  const initials = contact.display_name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Combine and sort all activities by date
  interface Activity {
    id: string;
    type: "email" | "call" | "message" | "task";
    title: string;
    subtitle?: string;
    date: string;
    icon: React.ElementType;
  }

  const activities: Activity[] = [
    ...emails.map((e) => ({
      id: e.id,
      type: "email" as const,
      title: e.subject || "(no subject)",
      subtitle: e.from_address,
      date: e.received_at || "",
      icon: Mail,
    })),
    ...calls.map((c) => ({
      id: c.id,
      type: "call" as const,
      title: c.direction === "inbound" ? "Incoming call" : "Outgoing call",
      subtitle: c.voicemail_transcript ? "with voicemail" : `${c.duration_seconds || 0}s`,
      date: c.occurred_at || "",
      icon: Phone,
    })),
    ...messages.map((m) => ({
      id: m.id,
      type: "message" as const,
      title: m.body || "(empty message)",
      subtitle: m.direction === "incoming" ? "Received" : "Sent",
      date: m.occurred_at || "",
      icon: MessageSquare,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      subtitle: t.due_date
        ? new Date(t.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "No due date",
      date: t.created_at,
      icon: CheckSquare,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate("/contacts")}
          >
            <ArrowLeft size={16} />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{contact.display_name}</h1>
            {contact.company && (
              <p className="text-xs text-muted-foreground">{contact.company}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Contact card */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-lg">
                {initials}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{contact.display_name}</h2>
                {contact.company && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <Building size={14} />
                    {contact.company}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Contact details */}
          <div className="space-y-2 pt-4 border-t border-border">
            {contact.primary_email && (
              <a
                href={`mailto:${contact.primary_email}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group text-sm"
              >
                <Mail size={14} className="text-muted-foreground group-hover:text-foreground" />
                <span className="text-foreground group-hover:underline">{contact.primary_email}</span>
              </a>
            )}
            {contact.primary_phone && (
              <a
                href={`tel:${contact.primary_phone}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group text-sm"
              >
                <Phone size={14} className="text-muted-foreground group-hover:text-foreground" />
                <span className="text-foreground group-hover:underline">{contact.primary_phone}</span>
              </a>
            )}
          </div>

          {contact.notes && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-start gap-2">
                <FileText size={14} className="text-muted-foreground mt-0.5" />
                <p className="text-sm text-foreground whitespace-pre-wrap">{contact.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-2xl font-semibold text-foreground">{emails.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Emails</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-2xl font-semibold text-foreground">{calls.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Calls</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-2xl font-semibold text-foreground">{messages.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Messages</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-2xl font-semibold text-foreground">{tasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Tasks</p>
          </div>
        </div>

        {/* Timeline */}
        {activities.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Activity</h3>
            <div className="space-y-1">
              {activities.map((activity) => {
                const ActivityIcon = activity.icon;
                return (
                  <div
                    key={`${activity.type}-${activity.id}`}
                    className="flex items-start gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <ActivityIcon size={16} className="text-muted-foreground mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {activity.title}
                      </p>
                      {activity.subtitle && (
                        <p className="text-xs text-muted-foreground">{activity.subtitle}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0">
                      {relativeTime(activity.date)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
