import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePhoneCalls } from "@/hooks/usePhoneCalls";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  name?: string;
}

interface QuoCall {
  id: string;
  from: string;
  to: string;
  direction: "inbound" | "outbound";
  status: "completed" | "missed" | "no-answer" | "abandoned" | "busy";
  createdAt: string;
  duration?: number;
  voicemail?: {
    transcript?: string;
    recordingUrl?: string;
  } | null;
}

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

function CallIcon({ call }: { call: any }) {
  const missed =
    call.status === "missed" ||
    call.status === "no-answer" ||
    call.status === "abandoned";

  if (missed) return <PhoneMissed size={14} className="text-destructive" />;
  if (call.direction === "inbound") return <PhoneIncoming size={14} className="text-green-500" />;
  return <PhoneOutgoing size={14} className="text-blue-400" />;
}

function CallRow({ call }: { call: any }) {
  const [expanded, setExpanded] = useState(false);
  const missed =
    call.status === "missed" ||
    call.status === "no-answer" ||
    call.status === "abandoned";
  const hasTranscript = !!call.voicemail_transcript;

  return (
    <div className="border-b border-border">
      <button
        onClick={() => hasTranscript && setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
          !hasTranscript && "cursor-default",
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

        {hasTranscript && (
          expanded ? (
            <ChevronDown size={14} className="text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-muted-foreground shrink-0" />
          )
        )}
      </button>

      {expanded && call.voicemail_transcript && (
        <div className="px-4 pb-3 ml-12">
          <p className="text-xs text-muted-foreground font-medium mb-1">Voicemail transcript</p>
          <p className="text-sm text-foreground bg-muted rounded-lg px-3 py-2">
            {call.voicemail_transcript}
          </p>
        </div>
      )}
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
  const { data: calls = [], isLoading, error } = usePhoneCalls(filter);

  const TABS: { key: CallFilter; label: string }[] = [
    { key: "missed", label: "Missed" },
    { key: "all", label: "All Calls" },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
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
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <Phone size={24} strokeWidth={1.25} />
            <p className="text-sm">
              {filter === "missed" ? "No missed calls." : "No calls found."}
            </p>
          </div>
        ) : (
          calls.map((call) => <CallRow key={call.id} call={call} />)
        )}
      </div>
    </div>
  );
}
