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
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

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

function CallIcon({ call }: { call: QuoCall }) {
  const missed =
    call.status === "missed" ||
    call.status === "no-answer" ||
    call.status === "abandoned";

  if (missed) return <PhoneMissed size={14} className="text-destructive" />;
  if (call.direction === "inbound") return <PhoneIncoming size={14} className="text-green-500" />;
  return <PhoneOutgoing size={14} className="text-blue-400" />;
}

function CallRow({ call }: { call: QuoCall }) {
  const [expanded, setExpanded] = useState(false);
  const missed =
    call.status === "missed" ||
    call.status === "no-answer" ||
    call.status === "abandoned";
  const other = call.direction === "inbound" ? call.from : call.to;
  const hasTranscript = !!call.voicemail?.transcript;

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
            {other}
          </p>
          <p className="text-xs text-muted-foreground">
            {relativeTime(call.createdAt)}
            {call.duration ? ` · ${formatDuration(call.duration)}` : ""}
            {call.voicemail?.transcript ? " · Voicemail" : ""}
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

      {expanded && call.voicemail?.transcript && (
        <div className="px-4 pb-3 ml-12">
          <p className="text-xs text-muted-foreground font-medium mb-1">Voicemail transcript</p>
          <p className="text-sm text-foreground bg-muted rounded-lg px-3 py-2">
            {call.voicemail.transcript}
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
  const { session } = useAuth();
  const [filter, setFilter] = useState<CallFilter>("missed");
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);

  // Fetch phone numbers
  const {
    data: phoneData,
    isLoading: phonesLoading,
    error: phonesError,
  } = useQuery({
    queryKey: ["quo-phones-calls"],
    queryFn: async () => {
      const res = await fetch(`${FN_BASE}/quo-messages?action=phone-numbers`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw json;
      return json as { data: PhoneNumber[] };
    },
    enabled: !!session,
    retry: false,
  });

  useEffect(() => {
    if (phoneData?.data.length && !selectedPhoneId) {
      setSelectedPhoneId(phoneData.data[0].id);
    }
  }, [phoneData, selectedPhoneId]);

  const selectedPhone = phoneData?.data.find((p) => p.id === selectedPhoneId);

  // Fetch calls
  const { data: callsData, isLoading: callsLoading, error: callsError } = useQuery({
    queryKey: ["quo-calls", selectedPhoneId, filter],
    queryFn: async () => {
      const params = new URLSearchParams({
        phoneNumberId: selectedPhoneId!,
        filter,
      });
      const res = await fetch(`${FN_BASE}/quo-calls?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch calls");
      return res.json() as Promise<{ data: QuoCall[] }>;
    },
    enabled: !!session && !!selectedPhoneId,
  });

  const TABS: { key: CallFilter; label: string }[] = [
    { key: "missed", label: "Missed" },
    { key: "all", label: "All Calls" },
  ];

  const notConfigured =
    phonesError && (phonesError as any)?.error === "not_configured";

  if (phonesLoading) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (notConfigured) {
    return <ConnectPrompt />;
  }

  if (phonesError && !notConfigured) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Failed to load phone numbers.
      </div>
    );
  }

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

        {(phoneData?.data.length ?? 0) > 1 && (
          <div className="relative ml-auto">
            <select
              value={selectedPhoneId ?? ""}
              onChange={(e) => setSelectedPhoneId(e.target.value)}
              className="text-xs rounded-md border border-input bg-transparent px-3 py-1.5 pr-7 appearance-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {phoneData?.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.phoneNumber}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {callsLoading ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Loading calls…
          </div>
        ) : callsError ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Failed to load calls.
          </div>
        ) : !callsData?.data.length ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <Phone size={24} strokeWidth={1.25} />
            <p className="text-sm">
              {filter === "missed" ? "No missed calls." : "No calls found."}
            </p>
          </div>
        ) : (
          callsData.data.map((call) => <CallRow key={call.id} call={call} />)
        )}
      </div>
    </div>
  );
}
