import { useState, useRef, useEffect, useCallback } from "react";
import { Hash, Plus, Send, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useChatThreads, useCreateChatThread, type ChatThread } from "@/hooks/useChatThreads";
import { useChatMessages, useSendChatMessage } from "@/hooks/useChatMessages";
import { useWorkspaceUsers, type WorkspaceUser } from "@/hooks/useWorkspaceUsers";
import { toast } from "@/hooks/useToast";
import { LoadingSpinner } from "@/components/LoadingSpinner";

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function ThreadRow({
  thread,
  selected,
  onSelect,
}: {
  thread: ChatThread;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2 px-4 py-2.5 border-b border-border hover:bg-muted/50 transition-colors text-left",
        selected && "bg-muted",
      )}
    >
      <Hash size={13} className="text-muted-foreground shrink-0" />
      <span className="text-sm font-medium text-foreground truncate flex-1">
        {thread.title || "Untitled"}
      </span>
      {thread.created_at && (
        <span className="text-[10px] text-muted-foreground shrink-0">
          {relativeTime(thread.created_at)}
        </span>
      )}
    </button>
  );
}

function MessageBubble({
  body,
  createdAt,
  isMine,
  sender,
}: {
  body: string;
  createdAt: string | null;
  isMine: boolean;
  sender: WorkspaceUser | null;
}) {
  const senderName = sender?.display_name || sender?.email?.split("@")[0] || "Member";
  const senderInitials = initials(senderName);
  const avatarUrl = sender?.avatar_url ?? undefined;

  return (
    <div className={cn("flex gap-2 items-end", isMine ? "flex-row-reverse" : "flex-row")}>
      {!isMine && (
        <Avatar className="w-6 h-6 shrink-0 mb-0.5">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="text-[9px]">{senderInitials}</AvatarFallback>
        </Avatar>
      )}
      <div className="flex flex-col gap-0.5 max-w-xs md:max-w-sm">
        {!isMine && (
          <p className="text-[11px] text-muted-foreground px-1">{senderName}</p>
        )}
        <div
          className={cn(
            "rounded-xl px-3 py-2",
            isMine
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
          )}
        >
          <p className="text-sm break-words whitespace-pre-wrap">{body}</p>
          {createdAt && (
            <p
              className={cn(
                "text-[10px] mt-1",
                isMine ? "text-primary-foreground/70 text-right" : "text-muted-foreground",
              )}
            >
              {relativeTime(createdAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadMessages({
  thread,
  onClose,
  userMap,
}: {
  thread: ChatThread;
  onClose: () => void;
  userMap: Map<string, WorkspaceUser>;
}) {
  const { user } = useAuth();
  const { data: messages = [], isLoading, error: messagesError } = useChatMessages(thread.id);
  const sendMessage = useSendChatMessage();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    sendMessage.mutate(
      { threadId: thread.id, body },
      {
        onError: () => {
          toast({ variant: "destructive", title: "Failed to send message" });
          setDraft((current) => (current.trim().length === 0 ? body : current));
        },
      },
    );
    textareaRef.current?.focus();
  }, [draft, sendMessage, thread.id]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Hash size={14} className="text-muted-foreground shrink-0" />
          <p className="text-sm font-semibold text-foreground truncate">
            {thread.title || "Untitled"}
          </p>
        </div>
        <button
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          onClick={onClose}
          aria-label="Close thread"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner message="Loading messages…" />
          </div>
        ) : messagesError ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
            <MessageSquare size={20} strokeWidth={1.25} />
            <p className="text-sm">Failed to load messages.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <MessageSquare size={20} strokeWidth={1.25} />
            <p className="text-sm">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              body={msg.body ?? ""}
              createdAt={msg.created_at}
              isMine={msg.sender_id === user?.id}
              sender={msg.sender_id ? (userMap.get(msg.sender_id) ?? null) : null}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring max-h-32 overflow-auto"
            style={{ height: "auto", minHeight: "38px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
            }}
          />
          <Button
            size="sm"
            className="shrink-0 h-9 w-9 p-0"
            onClick={handleSend}
            disabled={!draft.trim() || sendMessage.isPending}
            aria-label="Send message"
          >
            <Send size={14} />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function NewThreadDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onCreate(t);
    setTitle("");
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) { setTitle(""); onClose(); }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New thread</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <Input
            autoFocus
            placeholder="Thread name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!title.trim()}>
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeamChat() {
  const { data: threads = [], isLoading, error } = useChatThreads();
  const createThread = useCreateChatThread();
  const { data: workspaceUsers = [] } = useWorkspaceUsers();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const userMap = new Map<string, WorkspaceUser>(
    workspaceUsers.map((u) => [u.id, u]),
  );

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  function handleCreate(title: string) {
    setDialogOpen(false);
    createThread.mutate(title, {
      onSuccess: (thread) => {
        setSelectedThreadId(thread.id);
      },
      onError: () => {
        toast({ variant: "destructive", title: "Failed to create thread" });
      },
    });
  }

  if (isLoading) return <LoadingSpinner message="Loading team chat…" />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
        <MessageSquare size={24} strokeWidth={1.25} />
        <p className="text-sm">Failed to load team chat.</p>
      </div>
    );
  }

  return (
    <>
      <NewThreadDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
      />

      <div className="flex flex-col md:flex-row h-full">
        {/* Thread list */}
        <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-border flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold">Team Chat</h2>
              <p className="text-xs text-muted-foreground">
                {threads.length} thread{threads.length !== 1 ? "s" : ""}
                {workspaceUsers.length > 0 && ` · ${workspaceUsers.length} member${workspaceUsers.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setDialogOpen(true)}
              disabled={createThread.isPending}
            >
              <Plus size={12} />
              New
            </Button>
          </div>

          <div className="flex-1 overflow-auto">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center">
                <Hash size={20} strokeWidth={1.25} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No threads yet. Create one to start collaborating.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1 mt-1"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus size={12} />
                  Create thread
                </Button>
              </div>
            ) : (
              threads.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  selected={selectedThreadId === thread.id}
                  onSelect={() => setSelectedThreadId(thread.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Thread content (desktop) */}
        {selectedThread ? (
          <div className="hidden md:flex flex-1 flex-col overflow-hidden">
            <ThreadMessages
              thread={selectedThread}
              onClose={() => setSelectedThreadId(null)}
              userMap={userMap}
            />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground flex-col gap-2">
            <Hash size={24} strokeWidth={1.25} />
            <p className="text-sm">Select a thread to view messages</p>
          </div>
        )}

        {/* Thread content (mobile overlay) */}
        {selectedThread && (
          <div className="md:hidden fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in slide-in-from-bottom">
            <ThreadMessages
              thread={selectedThread}
              onClose={() => setSelectedThreadId(null)}
              userMap={userMap}
            />
          </div>
        )}
      </div>
    </>
  );
}
