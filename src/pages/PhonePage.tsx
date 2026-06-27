import { useState, useEffect } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  ChevronRight,
  X,
  Plus,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePhoneCalls, type PhoneCall } from "@/hooks/usePhoneCalls";
import { useContact } from "@/hooks/useContact";
import { useCreateTask } from "@/hooks/useTasks";
import { toast } from "@/hooks/useToast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

type CallFilter = "missed" | "all";

// ── SMS Reply Dialog ─────────────────────────────────────────────────────────────────────────────────

function SendSmsDialog({
  toNumber,
  open,
  onOpenChange,
}: {
  toNumber: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { session } = useAuth();
  const [body, setBody] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState<Array<{ id: string; phoneNumber: string; name?: string }>>([])
  const [fromId, setFromId] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !session) return;
    setBody("");
    fetch(`${FN_BASE}/quo-messages?action=phone-numbers`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const nums = data?.data ?? [];
        setPhoneNumbers(nums);
        if (nums.length > 0) setFromId(nums[0].id);
      })
      .catch(() => {});
  }, [open, session]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !fromId) return;
    setSending(true);
    try {
      const res = await fetch(`${FN_BASE}/quo-messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ from: fromId, to: toNumber, content: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send SMS");
      toast({ title: "SMS sent" });
      setBody("");
      onOpenChange(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to send SMS", description: String(err) });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send SMS</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground space-y-1">
          <p><span className="font-medium text-foreground">To:</span> {toNumber}</p>
          {phoneNumbers.length > 0 && (
            <div>
              <Label htmlFor="from-select" className="text-xs">From</Label>
              <select
                id="from-select"
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full mt-1 text-sm border rounded px-2 py-1 bg-background"
              >
                {phoneNumbers.map((pn) => (
                  <option key={pn.id} value={pn.id}>
                    {pn.phoneNumber}{pn.name ? ` (${pn.name})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <form onSubmit={handleSend} className="space-y-3">
          <div>
            <Label htmlFor="sms-body" className="text-xs">Message</Label>
            <Textarea
              id="sms-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message…"
              rows={3}
              className="mt-1 text-sm"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={sending || !body.trim() || !fromId}>
              {sending ? "Sending…" : "Send SMS"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Call detail panel ──────────────────────────────────────────────────────────────────────────

function CallIcon({ direction, status }: { direction: string | null; status: string | null }) {
  if (direction === "incoming" && ["missed", "no-answer", "abandoned"].includes(status ?? "")) {
    return <PhoneMissed size={14} className="text-destructive" />;
  }
  if (direction === "incoming") return <PhoneIncoming size={14} className="text-green-500" />;
  return <PhoneOutgoing size={14} className="text-blue-500" />;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function CallDetailPanel({
  call,
  onClose,
  onSmsReply,
}: {
  call: PhoneCall;
  onClose: () => void;
  onSmsReply: (number: string) => void;
}) {
  const createTask = useCreateTask();
  const [creatingTask, setCreatingTask] = useState(false);
  const { data: contact } = useContact(call.contact_id ?? "");

  const isMissed = ["missed", "no-answer", "abandoned"].includes(call.status ?? "");
  const voicemailUrl = safeHttpUrl(call.voicemail_url);

  async function handleCreateTask() {
    setCreatingTask(true);
    const title = isMissed
      ? `Return missed call${contact ? ` — ${contact.display_name}` : ""}`
      : `Follow up on call${contact ? ` — ${contact.display_name}` : ""}`;
    createTask.mutate(
      { title, tags: ["phone"] },
      {
        onSuccess: () => {
          toast({ title: "Task created" });
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
    <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-border bg-card flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="text-sm font-medium">Call details</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Contact */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Contact</p>
          <p className="text-sm font-medium">{contact?.display_name ?? "Unknown caller"}</p>
          {contact?.primary_phone && (
            <p className="text-xs text-muted-foreground">{contact.primary_phone}</p>
          )}
        </div>
        {/* Call info */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Details</p>
          <div className="flex items-center gap-2">
            <CallIcon direction={call.direction} status={call.status} />
            <span className="text-sm capitalize">{call.status ?? call.direction}</span>
          </div>
          {call.duration_seconds != null && (
            <p className="text-xs text-muted-foreground">
              Duration: {formatDuration(call.duration_seconds)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{relativeTime(call.occurred_at)}</p>
        </div>
        {/* Voicemail */}
        {call.voicemail_transcript && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Voicemail</p>
            <p className="text-xs text-foreground leading-relaxed">{call.voicemail_transcript}</p>
            {voicemailUrl && (
              <a
                href={voicemailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline mt-1 block"
              >
                Listen to recording ↗
              </a>
            )}
          </div>
        )}
      </div>
      {/* Actions */}
      <div className="border-t border-border p-3 space-y-2">
        {contact?.primary_phone && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onSmsReply(contact.primary_phone!)}
          >
            <MessageSquare size={13} className="mr-1.5" /> Send SMS
          </Button>
        )}
        <button
          onClick={handleCreateTask}
          disabled={creatingTask}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus size={12} />
          {isMissed ? "Create return-call task" : "Create follow-up task"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────────────────────────

export function PhonePage() {
  const [filter, setFilter] = useState<CallFilter>("missed");
  const [selectedCall, setSelectedCall] = useState<PhoneCall | null>(null);
  const [smsToNumber, setSmsToNumber] = useState<string | null>(null);
  const { data: calls = [], isLoading, error } = usePhoneCalls(filter);

  const TABS: { key: CallFilter; label: string }[] = [
    { key: "missed", label: "Missed" },
    { key: "all", label: "All Calls" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Phone</h1>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { if (tab.key !== filter) { setFilter(tab.key); setSelectedCall(null); } }}
              className={cn(
                "px-3 py-1 text-xs rounded-full transition-colors",
                filter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Call list */}
        <div className="flex-1 overflow-auto">
          {isLoading && <LoadingSpinner message="Loading calls…" />}
          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive p-8">
              <Phone size={24} strokeWidth={1.25} />
              <p className="text-sm text-center">Failed to load calls.</p>
            </div>
          )}
          {!isLoading && !error && calls.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-8">
              <Phone size={24} strokeWidth={1.25} />
              <p className="text-sm text-center">
                {filter === "missed" ? "No missed calls." : "No calls yet."}
              </p>
            </div>
          )}
          {calls.map((call) => (
            <CallRow
              key={call.id}
              call={call}
              isSelected={selectedCall?.id === call.id}
              onClick={() => setSelectedCall(call.id === selectedCall?.id ? null : call)}
            />
          ))}
        </div>

        {/* Detail panel (desktop) */}
        {selectedCall && (
          <div className="hidden md:block">
            <CallDetailPanel
              call={selectedCall}
              onClose={() => setSelectedCall(null)}
              onSmsReply={(num) => { setSmsToNumber(num); }}
            />
          </div>
        )}
      </div>

      {/* Mobile detail modal */}
      {selectedCall && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/80 flex items-end">
          <div className="w-full bg-card border-t border-border rounded-t-xl max-h-[80vh] overflow-auto">
            <CallDetailPanel
              call={selectedCall}
              onClose={() => setSelectedCall(null)}
              onSmsReply={(num) => { setSmsToNumber(num); }}
            />
          </div>
        </div>
      )}

      {/* SMS dialog */}
      {smsToNumber && (
        <SendSmsDialog
          toNumber={smsToNumber}
          open={!!smsToNumber}
          onOpenChange={(open) => { if (!open) setSmsToNumber(null); }}
        />
      )}
    </div>
  );
}

function CallRow({
  call,
  isSelected,
  onClick,
}: {
  call: PhoneCall;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { data: contact } = useContact(call.contact_id ?? "");
  const isMissed = ["missed", "no-answer", "abandoned"].includes(call.status ?? "");

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors text-left",
        isSelected && "bg-muted",
        isMissed && "border-l-2 border-l-destructive",
      )}
    >
      <div className="shrink-0">
        <CallIcon direction={call.direction} status={call.status} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", isMissed && "text-destructive")}>
          {contact?.display_name ?? "Unknown caller"}
        </p>
        <p className="text-xs text-muted-foreground">
          {call.status ? call.status.replace("-", " ") : call.direction} · {relativeTime(call.occurred_at)}
        </p>
        {call.voicemail_transcript && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            VM: {call.voicemail_transcript}
          </p>
        )}
      </div>
      <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
    </button>
  );
}
