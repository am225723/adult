import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, X, Plus, ExternalLink, Users } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { usePhoneMessages, type PhoneMessage } from "@/hooks/usePhoneMessages";
import { useContacts } from "@/hooks/useContacts";
import { useContact } from "@/hooks/useContact";
import { useCreateTask } from "@/hooks/useTasks";
import { toast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { TeamChat } from "@/components/TeamChat";
import { HeadwayLinkCard } from "@/components/headway/HeadwayLinkCard";
import { HeadwayWorkflowPanel } from "@/components/headway/HeadwayWorkflowPanel";
import { useHeadwayWorkflow } from "@/hooks/useHeadwayWorkflow";
import { extractHeadwayLinks } from "@/lib/headwayDetector";
import { useQuoSync } from "@/hooks/useQuoSync";

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "unknown";
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
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dateSeparatorLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function groupMessagesByContact(messages: PhoneMessage[]) {
  const grouped = new Map<string, PhoneMessage[]>();
  for (const msg of messages) {
    const contactId = msg.contact_id || "unknown";
    if (!grouped.has(contactId)) {
      grouped.set(contactId, []);
    }
    grouped.get(contactId)!.push(msg);
  }
  return grouped;
}

interface Conversation {
  contactId: string;
  contactName: string;
  messages: PhoneMessage[];
  lastMessage?: PhoneMessage;
  unreadCount: number;
}

function ConversationRow({
  conversation,
  onSelect,
  selectedContactId,
}: {
  conversation: Conversation;
  onSelect: (contactId: string) => void;
  selectedContactId?: string;
}) {
  const isSelected = selectedContactId === conversation.contactId;
  const lastMsg = conversation.lastMessage;

  return (
    <button
      onClick={() => onSelect(conversation.contactId)}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 border-b border-border hover:bg-muted/50 transition-colors text-left",
        isSelected && "bg-muted",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className={cn(
            "text-sm font-medium truncate",
            conversation.unreadCount > 0 && "text-foreground font-semibold",
          )}>
            {conversation.contactName}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full shrink-0">
              {conversation.unreadCount}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {lastMsg?.body || "(empty message)"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {lastMsg ? relativeTime(lastMsg.occurred_at) : "unknown"}
        </p>
      </div>
    </button>
  );
}

function ConversationDetail({
  conversation,
  onClose,
  onStartIntake,
}: {
  conversation: Conversation;
  onClose: () => void;
  onStartIntake: (params: { headwayLink: string; senderName?: string; quoMessageId?: string }) => void;
}) {
  const createTask = useCreateTask();
  const [creatingTask, setCreatingTask] = useState(false);
  const { data: contact } = useContact(
    conversation.contactId !== "unknown" ? conversation.contactId : ""
  );

  async function handleCreateTask() {
    const lastMsg = conversation.lastMessage;
    if (!lastMsg) return;

    setCreatingTask(true);
    createTask.mutate(
      {
        title: `SMS from ${conversation.contactName}`,
        notes: lastMsg.body || "(no message content)",
        tags: ["sms"],
      },
      {
        onSuccess: () => {
          toast({ title: "Task created from message" });
          setCreatingTask(false);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to create task" });
          setCreatingTask(false);
        },
      },
    );
  }

  // Build chronological messages with date separators
  const chronological = conversation.messages.slice().reverse();
  type MessageItem =
    | { type: "separator"; label: string; key: string }
    | { type: "message"; msg: PhoneMessage };
  const items: MessageItem[] = [];
  let lastDateLabel = "";
  for (const msg of chronological) {
    const label = dateSeparatorLabel(msg.occurred_at);
    if (label && label !== lastDateLabel) {
      items.push({ type: "separator", label, key: `sep-${msg.id}` });
      lastDateLabel = label;
    }
    items.push({ type: "message", msg });
  }

  return (
    <div className="w-full md:w-96 shrink-0 md:border-l border-t md:border-t-0 border-border flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Conversation
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-sm font-medium text-foreground truncate">
              {conversation.contactName}
            </p>
            {conversation.contactId !== "unknown" && (
              <Link
                to={`/contacts/${conversation.contactId}`}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="View contact profile"
                aria-label="View contact profile"
              >
                <ExternalLink size={12} />
              </Link>
            )}
          </div>
        </div>
        <button
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={onClose}
          aria-label="Close conversation"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-1">
        {items.map((item) => {
          if (item.type === "separator") {
            return (
              <div key={item.key} className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                  {item.label}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            );
          }
          const msg = item.msg;
          return (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.direction === "incoming" ? "flex-row" : "flex-row-reverse",
              )}
            >
              <div className={cn(
                "max-w-xs rounded-lg px-3 py-2",
                msg.direction === "incoming"
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground",
              )}>
                <p className="text-sm break-words">{msg.body || "(empty message)"}</p>
                <p className={cn(
                  "text-xs mt-1",
                  msg.direction === "incoming"
                    ? "text-muted-foreground"
                    : "text-primary-foreground/70",
                )}>
                  {msg.occurred_at ? relativeTime(msg.occurred_at) : "unknown"}
                </p>
                {/* Headway link detection */}
                {msg.body && extractHeadwayLinks(msg.body).map((link) => (
                  <HeadwayLinkCard
                    key={link.url}
                    url={link.url}
                    senderName={conversation.contactName}
                    quoMessageId={msg.id}
                    onStartIntake={onStartIntake}
                    className="mt-2"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Contact info */}
      {contact && (
        <div className="border-t border-border p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Contact info</p>
            <Link
              to={`/contacts/${conversation.contactId}`}
              className="text-xs text-primary hover:underline"
            >
              View profile
            </Link>
          </div>
          {contact.primary_phone && (
            <a href={`tel:${contact.primary_phone}`} className="text-xs text-primary hover:underline block">
              {contact.primary_phone}
            </a>
          )}
          {contact.primary_email && (
            <a href={`mailto:${contact.primary_email}`} className="text-xs text-primary hover:underline block">
              {contact.primary_email}
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-border shrink-0 p-3">
        <button
          onClick={handleCreateTask}
          disabled={creatingTask}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus size={12} />
          Create task from message
        </button>
      </div>
    </div>
  );
}

type Tab = "sms" | "team";

export function ChatPage() {
  const [activeTab, setActiveTab] = useState<Tab>("sms");
  useQuoSync();
  const { data: messages = [], isLoading, error } = usePhoneMessages("all");
  const { data: contacts = [] } = useContacts();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const headwayWorkflow = useHeadwayWorkflow();

  // Build a lookup map for contact display names
  const contactNameMap = new Map(contacts.map((c) => [c.id, c.display_name]));

  const grouped = groupMessagesByContact(messages);
  const conversations: Conversation[] = Array.from(grouped.entries())
    .map(([contactId, msgs]) => ({
      contactId,
      contactName:
        contactId === "unknown"
          ? "Unknown"
          : contactNameMap.get(contactId) ?? "Unknown",
      messages: msgs,
      lastMessage: msgs[0],
      unreadCount: msgs.filter((m) => !m.is_read).length,
    }))
    .sort((a, b) => {
      const aTime = a.lastMessage?.occurred_at || "";
      const bTime = b.lastMessage?.occurred_at || "";
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

  const selectedConversation = selectedContactId
    ? conversations.find((c) => c.contactId === selectedContactId)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Headway workflow panel — z-[60] to sit above mobile conversation overlay (z-50) */}
      <HeadwayWorkflowPanel
        workflow={headwayWorkflow.workflow}
        isOpen={headwayWorkflow.isOpen}
        onClose={headwayWorkflow.closeWorkflow}
        saveWorkflow={headwayWorkflow.saveWorkflow}
        updateStatus={headwayWorkflow.updateStatus}
      />

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border px-4 shrink-0">
        <button
          onClick={() => setActiveTab("sms")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "sms"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <MessageSquare size={14} />
          SMS
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors -mb-px",
            activeTab === "team"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Users size={14} />
          Team
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "team" ? (
          <TeamChat />
        ) : (
          <SmsTab
            messages={messages}
            isLoading={isLoading}
            error={error}
            conversations={conversations}
            selectedContactId={selectedContactId}
            setSelectedContactId={setSelectedContactId}
            selectedConversation={selectedConversation}
            onStartIntake={headwayWorkflow.startWorkflow}
          />
        )}
      </div>
    </div>
  );
}

function SmsTab({
  messages,
  isLoading,
  error,
  conversations,
  selectedContactId,
  setSelectedContactId,
  selectedConversation,
  onStartIntake,
}: {
  messages: PhoneMessage[];
  isLoading: boolean;
  error: Error | null;
  conversations: Conversation[];
  selectedContactId: string | null;
  setSelectedContactId: (id: string | null) => void;
  selectedConversation: Conversation | null;
  onStartIntake: (params: { headwayLink: string; senderName?: string; quoMessageId?: string }) => void;
}) {
  if (isLoading) return <LoadingSpinner message="Loading messages…" />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
        <MessageSquare size={24} strokeWidth={1.25} />
        <p className="text-sm">Failed to load SMS messages.</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <MessageSquare size={24} strokeWidth={1.25} />
        <p className="text-sm">No SMS messages yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Conversation list */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border flex flex-col min-w-0">
        <div className="px-4 py-4 border-b border-border">
          <h1 className="text-lg font-semibold">SMS Messages</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex-1 overflow-auto">
          {conversations.map((conv) => (
            <ConversationRow
              key={conv.contactId}
              conversation={conv}
              onSelect={setSelectedContactId}
              selectedContactId={selectedContactId || undefined}
            />
          ))}
        </div>
      </div>

      {/* Detail panel (desktop) */}
      {selectedConversation && (
        <div className="hidden md:flex flex-1">
          <ConversationDetail
            conversation={selectedConversation}
            onClose={() => setSelectedContactId(null)}
            onStartIntake={onStartIntake}
          />
        </div>
      )}

      {/* Mobile detail modal */}
      {selectedConversation && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/80 flex animate-in fade-in slide-in-from-bottom">
          <ConversationDetail
            conversation={selectedConversation}
            onClose={() => setSelectedContactId(null)}
            onStartIntake={onStartIntake}
          />
        </div>
      )}
    </div>
  );
}
