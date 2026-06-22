import { useState, useEffect } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  ChevronDown,
  ChevronRight,
  X,
  Plus,
} from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePhoneCalls, type PhoneCall } from "@/hooks/usePhoneCalls";
import { useContact } from "@/hooks/useContact";
import { useCreateTask } from "@/hooks/useTasks";
import { toast } from "@/hooks/useToast";

type CallFilter = "missed" | "all";

function relativeTime(iso: string): string {
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

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function CallIcon({ call }: { call: PhoneCall }) {
  const missed =
    call.status === "missed" ||
    call.status === "no-answer" ||
    call.status === "abandoned";

  if (missed) return <PhoneMissed size={14} className="text-destructive" />;
  if (call.direction === "inbound") return <PhoneIncoming size={14} className="text-green-500" />;
  return <PhoneOutgoing size={14} className="text-blue-400" />;
}

function CallRow({
  call,
  onSelect,
  selectedId,
}: {
  call: PhoneCall;
  onSelect: (call: PhoneCall) => void;
  selectedId?: string;
}) {
  const missed =
    call.status === "missed" ||
    call.status === "no-answer" ||
    call.status === "abandoned";
  const hasTranscript = !!call.voicemail_transcript;
  const isSelected = selectedId === call.id;

  return (
    <button
      onClick={() => onSelect(call)}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border",
        isSelected && "bg-muted",
      )}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
        <CallIcon call={call} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", missed && "text-destructive")}>
          {call.id || "Unknown"}
        </p>
        <p className="text-xs text-muted-foreground">
          {call.occurred_at ? relativeTime(call.occurred_at) : "Unknown time"}
          {call.duration_seconds ? ` · ${formatDuration(call.duration_seconds)}` : ""}
          {call.voicemail_transcript ? " · Voicemail" : ""}
        </p>
      </div>

      {hasTranscript && <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
    </button>
  );
}

function CallDetail({
  call,
  onClose,
}: {
  call: PhoneCall;
  onClose: () => void;
}) {
  const createTask = useCreateTask();
  const [creatingTask, setCreatingTask] = useState(false);
  const { data: contact } = useContact(call.contact_id || "");

  const missed =
    call.status === "missed" ||
    call.status === "no-answer" ||
    call.status === "abandoned";

  const displayDate = call.occurred_at
    ? new Date(call.occurred_at).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Unknown date";

  async function handleCreateTask() {
    let title = "Phone call";
    let notes = `Call from ${call.id || "Unknown"}`;

    if (call.voicemail_transcript) {
      title = "Voicemail";
      notes = call.voicemail_transcript;
    }

    setCreatingTask(true);
    createTask.mutate(
      {
        title,
        notes,
        tags: ["call"],
      },
      {
        onSuccess: () => {
          toast({ title: "Task created from call" });
          setCreatingTask(false);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to create task" });
          setCreatingTask(false);
        },
      },
    );
  }

  return (
    <div className="w-96 shrink-0 md:border-l border-t md:border-t-0 border-border flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Call detail
        </span>
        <button
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Type */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Type</p>
          <div className="flex items-center gap-2">
            <CallIcon call={call} />
            <span className="text-sm text-foreground">
              {missed ? "Missed" : call.direction === "inbound" ? "Incoming" : "Outgoing"}
            </span>
          </div>
        </div>

        {/* Number */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Number</p>
          <a href={`tel:${call.id}`} className="text-sm text-primary hover:underline">
            {call.id}
          </a>
        </div>

        {/* Date */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Date</p>
          <p className="text-sm text-foreground">{displayDate}</p>
        </div>

        {/* Duration */}
        {call.duration_seconds && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Duration</p>
            <p className="text-sm text-foreground">
              {formatDuration(call.duration_seconds)}
            </p>
          </div>
        )}

        {/* Voicemail transcript */}
        {call.voicemail_transcript && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Voicemail transcript</p>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {call.voicemail_transcript}
              </p>
            </div>
          </div>
        )}

        {/* Contact info */}
        {contact && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Contact</p>
            <p className="text-sm font-medium text-foreground">{contact.display_name}</p>
            {contact.primary_email && (
              <a href={`mailto:${contact.primary_email}`} className="text-xs text-primary hover:underline block mt-1">
                {contact.primary_email}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-border shrink-0 p-3">
        <button
          onClick={handleCreateTask}
          disabled={creatingTask}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus size={12} />
          Create task
        </button>
      </div>
    </div>
  );
}

function ConnectPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center px-8">
      <Phone size={40} strokeWidth={1.25} className="text-muted-foreground" />
      <div>
        <p className="text-base font-medium text-foreground">Connect Quo</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Set{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">QUO_API_KEY</code> in
          your Supabase Edge Function secrets, then deploy:
        </p>
      </div>
      <pre className="text-xs bg-muted rounded-lg px-4 py-3 text-left text-muted-foreground max-w-full overflow-x-auto">
        {`supabase functions deploy quo-messages quo-calls --no-verify-jwt`}
      </pre>
    </div>
  );
}

export function PhonePage() {
  const [filter, setFilter] = useState<CallFilter>("missed");
  const [selectedCall, setSelectedCall] = useState<PhoneCall | null>(null);
  const { data: calls = [], isLoading, error } = usePhoneCalls(filter);

  const TABS: { key: CallFilter; label: string }[] = [
    { key: "missed", label: "Missed" },
    { key: "all", label: "All Calls" },
  ];

  function handleSelectCall(call: PhoneCall) {
    setSelectedCall((prev) => (prev?.id === call.id ? null : call));
  }

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setFilter(tab.key);
                  setSelectedCall(null);
                }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <LoadingSpinner message="Loading calls…" />
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-destructive">
              <Phone size={24} strokeWidth={1.25} />
              <p className="text-sm">Failed to load calls.</p>
            </div>
          ) : calls.length === 0 ? (
            filter === "missed" ? (
              <ConnectPrompt />
            ) : (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <Phone size={24} strokeWidth={1.25} />
                <p className="text-sm">No calls found.</p>
              </div>
            )
          ) : (
            calls.map((call) => (
              <CallRow
                key={call.id}
                call={call}
                onSelect={handleSelectCall}
                selectedId={selectedCall?.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail panel (desktop) */}
      {selectedCall && (
        <div className="hidden md:flex">
          <CallDetail call={selectedCall} onClose={() => setSelectedCall(null)} />
        </div>
      )}

      {/* Mobile detail modal */}
      {selectedCall && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/80 flex animate-in fade-in slide-in-from-bottom">
          <CallDetail call={selectedCall} onClose={() => setSelectedCall(null)} />
        </div>
      )}
    </div>
  );
}
