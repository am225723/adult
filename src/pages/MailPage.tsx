import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, RefreshCw, X, Flag, CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorState } from "@/components/ErrorState";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGmailAccount } from "@/hooks/useGmailAccount";
import { useEmails, type EmailFilter, type Email } from "@/hooks/useEmails";
import { useCreateTask } from "@/hooks/useTasks";
import { toast } from "@/hooks/useToast";
import { supabase } from "@/lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <Mail size={40} strokeWidth={1.25} className="text-muted-foreground" />
      <div>
        <p className="text-base font-medium text-foreground">
          Connect Gmail
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Your emails will sync automatically and stay up to date.
        </p>
      </div>
      <Button onClick={onConnect} size="sm">
        Connect Gmail
      </Button>
    </div>
  );
}

function EmailRow({
  email,
  onSelect,
  selectedId,
}: {
  email: Email;
  onSelect: (email: Email) => void;
  selectedId?: string;
}) {
  const dateFormatter = (date: string | null | undefined) => {
    if (!date) return "—";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isSelected = selectedId === email.id;

  return (
    <div
      onClick={() => onSelect(email)}
      className={cn(
        "flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors",
        !email.is_read && "bg-muted/20",
        isSelected && "bg-muted",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm truncate", email.is_read === false && "font-semibold")}>
            {email.from_address || "Unknown sender"}
          </p>
          {email.is_flagged && (
            <Flag size={12} className="text-amber-500 shrink-0" />
          )}
        </div>
        <p className={cn("text-sm truncate", email.is_read === false ? "text-foreground font-medium" : "text-muted-foreground")}>
          {email.subject || "(no subject)"}
        </p>
        <p className="text-xs text-muted-foreground truncate">{email.snippet || ""}</p>
      </div>
      <div className="text-xs text-muted-foreground shrink-0">
        {dateFormatter(email.received_at)}
      </div>
    </div>
  );
}

function EmailDetail({
  email,
  onClose,
}: {
  email: Email;
  onClose: () => void;
}) {
  const createTask = useCreateTask();
  const [creatingTask, setCreatingTask] = useState(false);
  const queryClient = useQueryClient();

  async function handleMarkRead(isRead: boolean) {
    try {
      const { error } = await supabase
        .from("admin_emails")
        .update({ is_read: isRead })
        .eq("id", email.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["emails"] });
      toast({
        title: isRead ? "Marked as read" : "Marked as unread",
      });
    } catch {
      toast({ variant: "destructive", title: "Failed to update email" });
    }
  }

  async function handleToggleFlag() {
    try {
      const { error } = await supabase
        .from("admin_emails")
        .update({ is_flagged: !email.is_flagged })
        .eq("id", email.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["emails"] });
      toast({
        title: email.is_flagged ? "Unflagged" : "Flagged",
      });
    } catch {
      toast({ variant: "destructive", title: "Failed to update email" });
    }
  }

  function handleCreateTask() {
    if (!email.subject) return;
    setCreatingTask(true);
    createTask.mutate(
      {
        title: email.subject,
        notes: `From: ${email.from_address}\n\n${email.snippet || ""}`,
        tags: ["email"],
      },
      {
        onSuccess: () => {
          toast({ title: "Task created from email" });
          setCreatingTask(false);
        },
        onError: () => {
          toast({ variant: "destructive", title: "Failed to create task" });
          setCreatingTask(false);
        },
      },
    );
  }

  const displayDate = email.received_at
    ? new Date(email.received_at).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Unknown date";

  return (
    <div className="w-96 shrink-0 md:border-l border-t md:border-t-0 border-border flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Email detail
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
        {/* From */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">From</p>
          <p className="text-sm text-foreground">{email.from_address || "Unknown"}</p>
        </div>

        {/* To */}
        {email.to_addresses && email.to_addresses.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">To</p>
            <p className="text-sm text-foreground">
              {email.to_addresses.join(", ")}
            </p>
          </div>
        )}

        {/* Subject */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
          <p className="text-sm font-medium text-foreground">
            {email.subject || "(no subject)"}
          </p>
        </div>

        {/* Date */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Date</p>
          <p className="text-sm text-foreground">{displayDate}</p>
        </div>

        {/* Content */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Message</p>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {email.snippet || "(no content)"}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-border shrink-0 p-3 space-y-2">
        <button
          onClick={() => handleMarkRead(!email.is_read)}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs hover:bg-muted rounded-lg transition-colors"
        >
          <CheckCircle2 size={12} />
          {email.is_read ? "Mark as unread" : "Mark as read"}
        </button>
        <button
          onClick={handleToggleFlag}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs hover:bg-muted rounded-lg transition-colors"
        >
          <Flag size={12} />
          {email.is_flagged ? "Remove flag" : "Flag"}
        </button>
        <button
          onClick={handleCreateTask}
          disabled={creatingTask || !email.subject}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus size={12} />
          Create task
        </button>
      </div>
    </div>
  );
}

export function MailPage() {
  const [filter, setFilter] = useState<EmailFilter>("inbox");
  const [syncing, setSyncing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: account, isLoading: accountLoading, refetch: refetchAccount } =
    useGmailAccount();
  const {
    data: emails = [],
    isLoading: emailsLoading,
    refetch: refetchEmails,
  } = useEmails(filter);

  // Parse initial filter from URL params
  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam && ["inbox", "unread", "starred", "all"].includes(filterParam)) {
      setFilter(filterParam as EmailFilter);
    }
  }, []);

  // Update selected email when emails list changes
  useEffect(() => {
    if (selectedEmail) {
      const updated = emails.find((e) => e.id === selectedEmail.id);
      if (updated) {
        setSelectedEmail(updated);
      }
    }
  }, [emails, selectedEmail]);

  // Handle OAuth redirect back
  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "true") {
      toast({ title: "Gmail connected", description: "Your emails are syncing now." });
      refetchAccount();
      navigate("/mail", { replace: true });
    } else if (error) {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error.replace(/_/g, " "),
      });
      navigate("/mail", { replace: true });
    }
  }, [searchParams]);

  async function handleConnect() {
    if (!session) return;
    try {
      const res = await fetch(
        `${FN_BASE}/google-gmail-oauth?origin=${encodeURIComponent(window.location.origin)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (err) {
      toast({ variant: "destructive", title: "Could not connect", description: String(err) });
    }
  }

  async function handleSync() {
    if (!account || !session) return;
    setSyncing(true);
    try {
      const res = await fetch(`${FN_BASE}/google-gmail-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ gmail_account_id: account.id }),
      });
      if (!res.ok) throw new Error(`Sync returned ${res.status}`);
      await Promise.all([refetchAccount(), refetchEmails()]);
      toast({ title: "Gmail synced" });
    } catch {
      toast({ variant: "destructive", title: "Sync failed" });
    } finally {
      setSyncing(false);
    }
  }

  const TABS: Array<{ key: EmailFilter; label: string }> = [
    { key: "inbox", label: "Inbox" },
    { key: "unread", label: "Unread" },
    { key: "starred", label: "Starred" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setFilter(tab.key);
                  setSelectedEmail(null);
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

          <div className="flex-1" />

          {account && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSync}
              disabled={syncing}
              title="Sync Gmail"
            >
              <RefreshCw size={14} className={cn(syncing && "animate-spin")} />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {accountLoading ? (
            <LoadingSpinner message="Checking Gmail connection…" />
          ) : !account ? (
            <ConnectPrompt onConnect={handleConnect} />
          ) : emailsLoading ? (
            <LoadingSpinner message="Loading emails…" />
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <Mail size={24} strokeWidth={1.25} className="text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm text-foreground">No emails found</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filter === "unread"
                    ? "Your inbox is all caught up!"
                    : filter === "starred"
                      ? "No starred emails yet"
                      : "Check back soon"}
                </p>
              </div>
            </div>
          ) : (
            <div>
              {emails.map((email) => (
                <EmailRow
                  key={email.id}
                  email={email}
                  onSelect={(e) =>
                    setSelectedEmail((prev) => (prev?.id === e.id ? null : e))
                  }
                  selectedId={selectedEmail?.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel (desktop) */}
      {selectedEmail && (
        <div className="hidden md:flex">
          <EmailDetail
            email={selectedEmail}
            onClose={() => setSelectedEmail(null)}
          />
        </div>
      )}

      {/* Mobile detail modal */}
      {selectedEmail && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/80 flex animate-in fade-in slide-in-from-bottom">
          <EmailDetail
            email={selectedEmail}
            onClose={() => setSelectedEmail(null)}
          />
        </div>
      )}
    </div>
  );
}
