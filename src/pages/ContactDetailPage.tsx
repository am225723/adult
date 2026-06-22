import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Phone,
  MessageSquare,
  CheckSquare,
  Building,
  FileText,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorState } from "@/components/ErrorState";
import { useContact } from "@/hooks/useContact";
import { useContactEmails } from "@/hooks/useContactEmails";
import { useContactCalls } from "@/hooks/useContactCalls";
import { useContactMessages } from "@/hooks/useContactMessages";
import { useContactTasks } from "@/hooks/useContactTasks";
import {
  useContactNotes,
  useCreateContactNote,
  useUpdateContactNote,
  useDeleteContactNote,
  type ContactNote,
} from "@/hooks/useContactNotes";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";

/* ---------- helpers ---------- */

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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: diffDays > 365 ? "numeric" : undefined });
}

function formatDuration(secs: number | null | undefined): string {
  if (!secs) return "0s";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function isoDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ---------- types ---------- */

type TimelineFilter = "all" | "emails" | "sms" | "calls" | "tasks" | "notes";
type DateRange = "all" | "7d" | "30d" | "90d";

type Activity =
  | { kind: "email"; id: string; date: string; subject: string | null; from_address: string | null; is_read: boolean | null }
  | { kind: "call"; id: string; date: string; direction: string | null; status: string | null; duration_seconds: number | null; voicemail_transcript: string | null }
  | { kind: "sms"; id: string; date: string; body: string | null; direction: string | null; is_read: boolean | null }
  | { kind: "task"; id: string; date: string; title: string; status: string | null; priority: string | null; due_date: string | null }
  | { kind: "note"; id: string; date: string; body: string; created_by: string | null };

/* ---------- card components ---------- */

function EmailCard({ item }: { item: Extract<Activity, { kind: "email" }> }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{item.subject || "(no subject)"}</p>
      {item.from_address && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">From {item.from_address}</p>
      )}
      {item.is_read === false && (
        <span className="mt-1 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          Unread
        </span>
      )}
    </div>
  );
}

function CallCard({ item }: { item: Extract<Activity, { kind: "call" }> }) {
  const [expanded, setExpanded] = useState(false);
  const isMissed = item.status === "missed" || item.status === "no-answer";

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">
          {item.direction === "inbound" ? "Incoming" : "Outgoing"} call
        </p>
        {isMissed && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
            Missed
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">
        {item.duration_seconds ? formatDuration(item.duration_seconds) : item.status ?? ""}
      </p>
      {item.voicemail_transcript && (
        <div className="mt-1">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            Voicemail transcript
          </button>
          {expanded && (
            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap border-l-2 border-border pl-2">
              {item.voicemail_transcript}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SmsCard({ item }: { item: Extract<Activity, { kind: "sms" }> }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-sm truncate">{item.body || "(empty message)"}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <p className="text-xs text-muted-foreground">
          {item.direction === "incoming" ? "Received" : "Sent"}
        </p>
        {item.is_read === false && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            Unread
          </span>
        )}
      </div>
    </div>
  );
}

function TaskCard({ item }: { item: Extract<Activity, { kind: "task" }> }) {
  const PRIORITY_COLORS: Record<string, string> = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    low: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  };
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium truncate">{item.title}</p>
        {item.priority && item.priority !== "none" && (
          <span className={cn("shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded", PRIORITY_COLORS[item.priority] ?? "bg-muted text-muted-foreground")}>
            {item.priority}
          </span>
        )}
      </div>
      {item.due_date && (
        <p className="text-xs text-muted-foreground mt-0.5">
          Due {new Date(item.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </p>
      )}
      {item.status && (
        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{item.status}</p>
      )}
    </div>
  );
}

function NoteCard({
  item,
  contactId,
}: {
  item: Extract<Activity, { kind: "note" }>;
  contactId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body);
  const updateNote = useUpdateContactNote();
  const deleteNote = useDeleteContactNote();

  function handleSave() {
    if (!draft.trim()) return;
    updateNote.mutate(
      { id: item.id, body: draft.trim(), contactId },
      {
        onSuccess: () => setEditing(false),
        onError: () => toast({ variant: "destructive", title: "Failed to update note" }),
      }
    );
  }

  function handleDelete() {
    deleteNote.mutate(
      { id: item.id, contactId },
      {
        onError: () => toast({ variant: "destructive", title: "Failed to delete note" }),
      }
    );
  }

  return (
    <div className="flex-1 min-w-0">
      {editing ? (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
              if (e.key === "Escape") { setDraft(item.body); setEditing(false); }
            }}
            className="w-full text-sm bg-muted rounded p-2 outline-none resize-none min-h-[60px]"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!draft.trim() || updateNote.isPending}
              className="text-xs text-primary font-medium disabled:opacity-40"
            >
              Save
            </button>
            <button
              onClick={() => { setDraft(item.body); setEditing(false); }}
              className="text-xs text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{item.body}</p>
      )}
    </div>
  );
}

function NoteCardActions({
  item,
  contactId,
  onEdit,
}: {
  item: Extract<Activity, { kind: "note" }>;
  contactId: string;
  onEdit: () => void;
}) {
  const deleteNote = useDeleteContactNote();

  return (
    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={onEdit}
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
        aria-label="Edit note"
      >
        <Pencil size={12} />
      </button>
      <button
        onClick={() =>
          deleteNote.mutate(
            { id: item.id, contactId },
            { onError: () => toast({ variant: "destructive", title: "Failed to delete note" }) }
          )
        }
        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted"
        aria-label="Delete note"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

/* ---------- timeline row ---------- */

const KIND_ICONS: Record<Activity["kind"], React.ElementType> = {
  email: Mail,
  call: Phone,
  sms: MessageSquare,
  task: CheckSquare,
  note: FileText,
};

function ActivityRow({ activity, contactId }: { activity: Activity; contactId: string }) {
  const [editingNote, setEditingNote] = useState(false);
  const Icon = KIND_ICONS[activity.kind];

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors group">
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        <Icon size={15} strokeWidth={1.75} />
      </span>

      {activity.kind === "email" && <EmailCard item={activity} />}
      {activity.kind === "call" && <CallCard item={activity} />}
      {activity.kind === "sms" && <SmsCard item={activity} />}
      {activity.kind === "task" && <TaskCard item={activity} />}
      {activity.kind === "note" && (
        <NoteCard item={activity} contactId={contactId} />
      )}

      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        {activity.kind === "note" && !editingNote && (
          <NoteCardActions
            item={activity}
            contactId={contactId}
            onEdit={() => setEditingNote(true)}
          />
        )}
        <span className="text-xs text-muted-foreground">{relativeTime(activity.date)}</span>
      </div>
    </div>
  );
}

/* ---------- add note form ---------- */

function AddNoteForm({
  contactId,
  workspaceId,
}: {
  contactId: string;
  workspaceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const createNote = useCreateContactNote();

  function handleSubmit() {
    if (!body.trim()) return;
    createNote.mutate(
      { contactId, body: body.trim(), workspaceId },
      {
        onSuccess: () => { setBody(""); setOpen(false); },
        onError: () => toast({ variant: "destructive", title: "Failed to save note" }),
      }
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus size={13} />
        Add note
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
      <textarea
        autoFocus
        placeholder="Write a note…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          if (e.key === "Escape") { setBody(""); setOpen(false); }
        }}
        className="w-full text-sm bg-transparent outline-none resize-none min-h-[64px] placeholder:text-muted-foreground"
        rows={3}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={!body.trim() || createNote.isPending}
          className="text-xs text-primary font-medium disabled:opacity-40 flex items-center gap-1"
        >
          {createNote.isPending && <Loader2 size={11} className="animate-spin" />}
          Save
        </button>
        <button
          onClick={() => { setBody(""); setOpen(false); }}
          className="text-xs text-muted-foreground"
        >
          Cancel
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground">⌘↵ to save</span>
      </div>
    </div>
  );
}

/* ---------- main view (all hooks here, after props are validated) ---------- */

const FILTER_LABELS: { value: TimelineFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "emails", label: "Emails" },
  { value: "sms", label: "SMS" },
  { value: "calls", label: "Calls" },
  { value: "tasks", label: "Tasks" },
  { value: "notes", label: "Notes" },
];

const DATE_RANGE_LABELS: { value: DateRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

function ContactDetailView({ id }: { id: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  const { data: contact, isLoading, error } = useContact(id);
  const { data: emails = [] } = useContactEmails(id);
  const { data: calls = [] } = useContactCalls(id);
  const { data: messages = [] } = useContactMessages(id);
  const { data: tasks = [] } = useContactTasks(id);
  const { data: notes = [] } = useContactNotes(id);

  // Workspace ID — needed to create notes
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  // Resolve workspace once user is known
  useState(() => {
    if (!user) return;
    supabase
      .from("admin_workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.workspace_id) setWorkspaceId(data.workspace_id);
      });
  });

  if (isLoading) return <LoadingSpinner message="Loading contact…" />;
  if (error || !contact) {
    return <ErrorState title="Contact not found" onRetry={() => navigate("/contacts")} />;
  }

  const initials = contact.display_name
    .split(" ")
    .map((n: string) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Build unified activity list
  const cutoff: Date | null = (() => {
    if (dateRange === "all") return null;
    const d = new Date();
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    d.setDate(d.getDate() - days);
    return d;
  })();

  function inRange(iso: string | null | undefined): boolean {
    if (!cutoff || !iso) return true;
    return new Date(iso) >= cutoff;
  }

  const allActivities: Activity[] = [
    ...emails
      .filter((e) => inRange(e.received_at))
      .map((e): Activity => ({
        kind: "email",
        id: e.id,
        date: e.received_at || "",
        subject: e.subject,
        from_address: e.from_address,
        is_read: e.is_read,
      })),
    ...calls
      .filter((c) => inRange(c.occurred_at))
      .map((c): Activity => ({
        kind: "call",
        id: c.id,
        date: c.occurred_at || "",
        direction: c.direction,
        status: c.status,
        duration_seconds: c.duration_seconds,
        voicemail_transcript: c.voicemail_transcript,
      })),
    ...messages
      .filter((m) => inRange(m.occurred_at))
      .map((m): Activity => ({
        kind: "sms",
        id: m.id,
        date: m.occurred_at || "",
        body: m.body,
        direction: m.direction,
        is_read: m.is_read,
      })),
    ...tasks
      .filter((t) => inRange(t.created_at))
      .map((t): Activity => ({
        kind: "task",
        id: t.id,
        date: t.created_at,
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
      })),
    ...notes
      .filter((n) => inRange(n.created_at))
      .map((n): Activity => ({
        kind: "note",
        id: n.id,
        date: n.created_at,
        body: n.body,
        created_by: n.created_by,
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered =
    filter === "all"
      ? allActivities
      : allActivities.filter((a) => {
          if (filter === "emails") return a.kind === "email";
          if (filter === "sms") return a.kind === "sms";
          if (filter === "calls") return a.kind === "call";
          if (filter === "tasks") return a.kind === "task";
          if (filter === "notes") return a.kind === "note";
          return true;
        });

  // Group by date for date separators
  const groupedByDate: { label: string; items: Activity[] }[] = [];
  for (const item of filtered) {
    const label = item.date ? isoDateLabel(item.date) : "Unknown date";
    const last = groupedByDate[groupedByDate.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groupedByDate.push({ label, items: [item] });
    }
  }

  const counts = {
    emails: emails.length,
    calls: calls.length,
    sms: messages.length,
    tasks: tasks.length,
    notes: notes.length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/contacts")}>
            <ArrowLeft size={16} />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold truncate">{contact.display_name}</h1>
            {contact.company && (
              <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Contact card */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold text-lg">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold">{contact.display_name}</h2>
              {contact.company && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Building size={13} />
                  {contact.company}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1 pt-3 border-t border-border">
            {contact.primary_email && (
              <a
                href={`mailto:${contact.primary_email}`}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors group text-sm"
              >
                <Mail size={14} className="text-muted-foreground shrink-0" />
                <span className="text-foreground group-hover:underline truncate">{contact.primary_email}</span>
              </a>
            )}
            {contact.primary_phone && (
              <a
                href={`tel:${contact.primary_phone}`}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors group text-sm"
              >
                <Phone size={14} className="text-muted-foreground shrink-0" />
                <span className="text-foreground group-hover:underline">{contact.primary_phone}</span>
              </a>
            )}
          </div>

          {contact.notes && (
            <div className="pt-3 border-t border-border">
              <div className="flex items-start gap-2">
                <FileText size={13} className="text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-foreground whitespace-pre-wrap">{contact.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {(
            [
              { label: "Emails", count: counts.emails },
              { label: "Calls", count: counts.calls },
              { label: "SMS", count: counts.sms },
              { label: "Tasks", count: counts.tasks },
              { label: "Notes", count: counts.notes },
            ] as const
          ).map(({ label, count }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-3 text-center">
              <p className="text-xl font-semibold">{count}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Timeline</h3>
            {workspaceId && (
              <AddNoteForm contactId={id} workspaceId={workspaceId} />
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {FILTER_LABELS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors shrink-0",
                  filter === f.value
                    ? "bg-foreground text-background font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {f.label}
              </button>
            ))}

            <div className="ml-auto pl-2 shrink-0">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="text-xs bg-background border border-border rounded-full px-2.5 py-1 text-muted-foreground outline-none"
              >
                {DATE_RANGE_LABELS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No activity{filter !== "all" ? ` in ${filter}` : ""}{dateRange !== "all" ? ` in the last ${dateRange}` : ""}.
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map((group) => (
                <div key={group.label} className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((activity) => (
                      <ActivityRow
                        key={`${activity.kind}-${activity.id}`}
                        activity={activity}
                        contactId={id}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- route entry point ---------- */

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <ErrorState title="Contact not found" />;
  }

  return <ContactDetailView id={id} />;
}
