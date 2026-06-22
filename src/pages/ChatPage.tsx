import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/useToast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  name?: string;
}

interface QuoMessage {
  id: string;
  from: string;
  to: string[];
  body: string;
  direction: "incoming" | "outgoing";
  status: string;
  createdAt: string;
}

interface Conversation {
  participant: string;
  lastMessage: QuoMessage;
  messages: QuoMessage[];
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ConnectPrompt() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center px-8">
      <MessageSquare size={40} strokeWidth={1.25} className="text-muted-foreground" />
      <div>
        <p className="text-base font-medium text-foreground">Connect Quo</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Set{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">QUO_API_KEY</code> in
          your Supabase Edge Function secrets, then deploy:
        </p>
      </div>
      <pre className="text-xs bg-muted rounded-lg px-4 py-3 text-left text-muted-foreground max-w-full overflow-x-auto">
        {`supabase functions deploy quo-messages --no-verify-jwt`}
      </pre>
    </div>
  );
}

export function ChatPage() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch phone numbers
  const {
    data: phoneData,
    isLoading: phonesLoading,
    error: phonesError,
  } = useQuery({
    queryKey: ["quo-phones"],
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

  // Auto-select first phone number
  useEffect(() => {
    if (phoneData?.data.length && !selectedPhoneId) {
      setSelectedPhoneId(phoneData.data[0].id);
    }
  }, [phoneData, selectedPhoneId]);

  const selectedPhone = phoneData?.data.find((p) => p.id === selectedPhoneId);

  // Fetch messages for selected inbox
  const { data: messagesData, isLoading: messagesLoading, error: messagesError } = useQuery({
    queryKey: ["quo-messages", selectedPhoneId],
    queryFn: async () => {
      const params = new URLSearchParams({
        action: "messages",
        phoneNumberId: selectedPhoneId!,
      });
      const res = await fetch(`${FN_BASE}/quo-messages?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json() as Promise<{ data: QuoMessage[] }>;
    },
    enabled: !!session && !!selectedPhoneId,
    refetchInterval: 30_000,
  });

  // Group messages into conversations by participant
  const conversations = useMemo((): Conversation[] => {
    const msgs = messagesData?.data ?? [];
    const myNumber = selectedPhone?.phoneNumber ?? "";
    const groups = new Map<string, Conversation>();

    for (const msg of msgs) {
      const participant =
        msg.direction === "incoming" ? msg.from : (msg.to[0] ?? "");
      if (!participant || participant === myNumber) continue;

      if (!groups.has(participant)) {
        groups.set(participant, { participant, lastMessage: msg, messages: [] });
      }
      const g = groups.get(participant)!;
      g.messages.push(msg);
      if (new Date(msg.createdAt) >= new Date(g.lastMessage.createdAt)) {
        g.lastMessage = msg;
      }
    }

    return [...groups.values()].sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime(),
    );
  }, [messagesData, selectedPhone]);

  // Messages for the selected conversation thread
  const thread = useMemo((): QuoMessage[] => {
    if (!selectedParticipant || !messagesData) return [];
    return (messagesData.data ?? [])
      .filter((msg) => {
        const other =
          msg.direction === "incoming" ? msg.from : (msg.to[0] ?? "");
        return other === selectedParticipant;
      })
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }, [messagesData, selectedParticipant]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.length]);

  async function handleSend() {
    if (!messageInput.trim() || !selectedPhone || !selectedParticipant || !session) return;
    setSending(true);
    const content = messageInput.trim();
    setMessageInput("");
    try {
      const res = await fetch(`${FN_BASE}/quo-messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          from: selectedPhone.phoneNumber,
          to: selectedParticipant,
          content,
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      qc.invalidateQueries({ queryKey: ["quo-messages", selectedPhoneId] });
    } catch {
      toast({ variant: "destructive", title: "Failed to send message" });
      setMessageInput(content);
    } finally {
      setSending(false);
    }
  }

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
        Failed to load inboxes.
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Left: conversations list */}
      <div className="w-72 border-r border-border flex flex-col shrink-0">
        {/* Inbox selector */}
        {(phoneData?.data.length ?? 0) > 1 && (
          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <select
                value={selectedPhoneId ?? ""}
                onChange={(e) => {
                  setSelectedPhoneId(e.target.value);
                  setSelectedParticipant(null);
                }}
                className="w-full text-xs rounded-md border border-input bg-transparent px-3 py-2 pr-8 appearance-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {phoneData?.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name ?? p.phoneNumber}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
            </div>
          </div>
        )}

        {/* Conversations */}
        <div className="flex-1 overflow-auto">
          {messagesLoading ? (
            <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
          ) : messagesError ? (
            <p className="text-xs text-muted-foreground text-center py-8">Failed to load messages.</p>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No messages yet.</p>
          ) : (
            conversations.map((convo) => (
              <button
                key={convo.participant}
                onClick={() => setSelectedParticipant(convo.participant)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 text-left border-b border-border hover:bg-muted/50 transition-colors",
                  selectedParticipant === convo.participant && "bg-muted",
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                  {convo.participant.slice(-4)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {convo.participant}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {relativeTime(convo.lastMessage.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {convo.lastMessage.direction === "outgoing" ? "You: " : ""}
                    {convo.lastMessage.body}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: message thread */}
      <div className="flex-1 flex flex-col">
        {selectedParticipant ? (
          <>
            {/* Thread header */}
            <div className="px-5 py-3 border-b border-border shrink-0">
              <p className="text-sm font-medium text-foreground">{selectedParticipant}</p>
              <p className="text-xs text-muted-foreground">
                via {selectedPhone?.name ?? selectedPhone?.phoneNumber}
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
              {thread.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex",
                    msg.direction === "outgoing" ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.direction === "outgoing"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm",
                    )}
                  >
                    <p>{msg.body}</p>
                    <p
                      className={cn(
                        "text-xs mt-1",
                        msg.direction === "outgoing"
                          ? "text-primary-foreground/60"
                          : "text-muted-foreground",
                      )}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Compose */}
            <div className="px-4 py-3 border-t border-border shrink-0">
              <div className="flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={sending || !messageInput.trim()}
                  title="Send"
                >
                  <Send size={14} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <MessageSquare size={28} strokeWidth={1.25} />
            <p className="text-sm">Select a conversation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
