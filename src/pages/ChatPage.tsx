import { useState, useEffect } from "react";
import { MessageSquare, X, Plus } from "lucide-react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { usePhoneMessages, type PhoneMessage } from "@/hooks/usePhoneMessages";
import { useContact } from "@/hooks/useContact";
import { useCreateTask } from "@/hooks/useTasks";
import { toast } from "@/hooks/useToast";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
}: {
  conversation: Conversation;
  onClose: () => void;
}) {
  const createTask = useCreateTask();
  const [creatingTask, setCreatingTask] = useState(false);
  const { data: contact } = useContact(conversation.contactId);

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

  return (
    <div className="w-full md:w-96 shrink-0 md:border-l border-t md:border-t-0 border-border flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Conversation
          </p>
          <p className="text-sm font-medium text-foreground mt-0.5">
            {conversation.contactName}
          </p>
        </div>
        <button
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {conversation.messages.slice().reverse().map((msg, idx) => (
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
            </div>
          </div>
        ))}
      </div>

      {/* Contact info */}
      {contact && (
        <div className="border-t border-border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Contact info</p>
          {contact.primary_phone && (
            <a
              href={`tel:${contact.primary_phone}`}
              className="text-xs text-primary hover:underline"
            >
              {contact.primary_phone}
            </a>
          )}
          {contact.primary_email && (
            <a
              href={`mailto:${contact.primary_email}`}
              className="text-xs text-primary hover:underline block"
            >
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
          Create task
        </button>
      </div>
    </div>
  );
}

export function ChatPage() {
  const { data: messages = [], isLoading, error } = usePhoneMessages("all");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const grouped = groupMessagesByContact(messages);
  const conversations: Conversation[] = Array.from(grouped.entries())
    .map(([contactId, msgs]) => ({
      contactId,
      contactName: contactId === "unknown" ? "Unknown" : contactId,
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

  if (isLoading) {
    return <LoadingSpinner message="Loading messages…" />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-2 text-destructive">
        <MessageSquare size={24} strokeWidth={1.25} />
        <p className="text-sm">Failed to load SMS messages.</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-2 text-muted-foreground">
        <MessageSquare size={24} strokeWidth={1.25} />
        <p className="text-sm">No SMS messages yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen">
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

      {/* Detail panel */}
      {selectedConversation && (
        <ConversationDetail
          conversation={selectedConversation}
          onClose={() => setSelectedContactId(null)}
        />
      )}
    </div>
  );
}
