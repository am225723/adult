import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Mail, RefreshCw, X, Flag, CheckCircle2, Plus, Reply, PenLine, UserPlus, Star, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useGmailAccounts, type GmailAccountRow } from "@/hooks/useGmailAccount";
import { useEmails, type EmailFilter, type Email } from "@/hooks/useEmails";
import { useCreateTask } from "@/hooks/useTasks";
import { useCreateContact } from "@/hooks/useContacts";
import type { Contact } from "@/hooks/useContacts";
import { useMyWorkspaceMemberProfile } from "@/hooks/useWorkspaceUsers";
import { toast } from "@/hooks/useToast";
import { supabase } from "@/lib/supabase";

function useContactsByEmails(emails: string[]) {
  const { user } = useAuth();
  const key = emails.slice().sort().join(",");
  return useQuery<Map<string, Contact>>({
    queryKey: ["contacts", "batch", key],
    queryFn: async () => {
      if (!emails.length) return new Map();
      const { data, error } = await supabase
        .from("admin_contacts")
        .select("id, workspace_id, display_name, primary_email, primary_phone, company, notes, created_at, updated_at")
        .in("primary_email", emails);
      if (error) throw error;
      const map = new Map<string, Contact>();
      for (const c of data ?? []) {
        if (c.primary_email) map.set(c.primary_email.toLowerCase(), c as Contact);
      }
      return map;
    },
    enabled: !!user && emails.length > 0,
    staleTime: 60_000,
  });
}

function parseSenderName(from: string | null): string {
  if (!from) return "Unknown sender";
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return from;
}

function parseSenderEmail(from: string | null): string | null {
  if (!from) return null;
  const match = from.match(/<([^>]+)>/);
  if (match) return match[1];
  if (from.includes("@")) return from;
  return null;
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function isHtml(content: string): boolean {
  return /<[a-z][\s\S]*>/i.test(content);
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

// ── Compose / Reply Dialogs ────────────────────────────────────────────────────

function ComposeDialog({
  open,
  onOpenChange,
  accounts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: GmailAccountRow[];
}) {
  const { session } = useAuth();
  const { data: memberProfile } = useMyWorkspaceMemberProfile();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [sending, setSending] = useState(false);

  const signature = memberProfile?.email_signature ?? null;

  useEffect(() => {
    if (open) {
      if (accounts.length > 0 && !selectedAccountId) setSelectedAccountId(accounts[0].id);
      setBody((prev) => prev || (signature ? `\n\n-- \n${signature}` : ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accounts, signature]);

  function reset() {
    setTo("");
    setSubject("");
    setBody("");
    setSelectedAccountId("");
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSending(true);
    try {
      const res = await fetch(`${FN_BASE}/google-gmail-write`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "send-new",
          to: to.trim(),
          subject: subject.trim(),
          body,
          gmail_account_id: selectedAccountId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      toast({ title: "Email sent" });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to send email", description: String(err) });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New email</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSend} className="space-y-3">
          {accounts.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="compose-from">From</Label>
              <select
                id="compose-from"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.external_account_email ?? a.id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="compose-to">To</Label>
            <Input
              id="compose-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="compose-subject">Subject</Label>
            <Input
              id="compose-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="compose-body">Message</Label>
            <Textarea
              id="compose-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message…"
              rows={6}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={sending || !to.trim() || !subject.trim() || !body.trim()}>
              {sending ? "Sending…" : "Send email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReplyDialog({
  email,
  open,
  onOpenChange,
  accounts,
}: {
  email: Email | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: GmailAccountRow[];
}) {
  const { session } = useAuth();
  const { data: memberProfile } = useMyWorkspaceMemberProfile();
  const [body, setBody] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [sending, setSending] = useState(false);

  const signature = memberProfile?.email_signature ?? null;

  useEffect(() => {
    if (open) {
      if (accounts.length > 0 && !selectedAccountId) setSelectedAccountId(accounts[0].id);
      setBody((prev) => prev || (signature ? `\n\n-- \n${signature}` : ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accounts, signature]);

  if (!email) return null;

  const senderEmail = parseSenderEmail(email.from_addr ?? email.from_address);
  const replyTo = senderEmail ?? email.from_addr ?? email.from_address ?? "";
  const replySubject = email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject ?? ""}`;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !email) return;
    setSending(true);
    try {
      const res = await fetch(`${FN_BASE}/google-gmail-write`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "send-reply",
          to: replyTo,
          subject: replySubject,
          body,
          gmail_message_id: email.gmail_message_id ?? email.external_message_id,
          gmail_account_id: selectedAccountId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      toast({ title: "Reply sent" });
      onOpenChange(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Failed to send reply", description: String(err) });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reply to email</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 text-sm">
          {accounts.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">From:</span>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="flex-1 h-7 rounded border border-input bg-background px-2 text-xs"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.external_account_email ?? a.id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">To:</span> {replyTo}
          </p>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Subject:</span> {replySubject}
          </p>
        </div>
        <form onSubmit={handleSend} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="reply-body">Message</Label>
            <Textarea
              id="reply-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your reply…"
              rows={6}
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={sending || !body.trim()}>
              {sending ? "Sending…" : "Send reply"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Connect Prompt ─────────────────────────────────────────────────────────────

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

function formatRelativeDate(date: string | null | undefined): string {
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
}

function EmailRow({
  email,
  onSelect,
  selectedId,
  contact,
}: {
  email: Email;
  onSelect: (email: Email) => void;
  selectedId?: string;
  contact?: Contact | null;
}) {
  const rawFrom = email.from_addr ?? email.from_address;
  const senderDisplay = contact?.display_name ?? parseSenderName(rawFrom);
  const isSelected = selectedId === email.id;
  const isStarred = email.is_starred || email.is_flagged;

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
            {senderDisplay}
          </p>
          {isStarred && (
            <Star size={12} className="text-amber-500 shrink-0 fill-amber-500" />
          )}
        </div>
        <p className={cn("text-sm truncate", email.is_read === false ? "text-foreground font-medium" : "text-muted-foreground")}>
          {email.subject || "(no subject)"}
        </p>
        <p className="text-xs text-muted-foreground truncate">{email.snippet || ""}</p>
      </div>
      <div className="text-xs text-muted-foreground shrink-0">
        {formatRelativeDate(email.received_at)}
      </div>
    </div>
  );
}

function EmailDetail({
  email,
  onClose,
  onReply,
  senderContact,
}: {
  email: Email;
  onClose: () => void;
  onReply: (email: Email) => void;
  senderContact?: Contact | null;
}) {
  const createTask = useCreateTask();
  const createContact = useCreateContact();
  const [creatingTask, setCreatingTask] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [quotedExpanded, setQuotedExpanded] = useState(false);
  const queryClient = useQueryClient();

  const rawFrom = email.from_addr ?? email.from_address;
  const senderEmail = parseSenderEmail(rawFrom);
  const senderName = parseSenderName(rawFrom);

  const rawBody = email.body || email.snippet || "";
  const bodyIsHtml = isHtml(rawBody);

  const processedBody = useCallback(() => {
    if (!bodyIsHtml) return rawBody;
    let html = sanitizeHtml(rawBody);
    if (!showImages) {
      html = html.replace(/<img[^>]*>/gi, '<span class="inline-block bg-muted text-muted-foreground text-[10px] px-1 py-0.5 rounded">[image]</span>');
    }
    return html;
  }, [rawBody, bodyIsHtml, showImages]);

  const quotedPattern = /(On .+wrote:|_{10,}|From:.*\nSent:)/s;
  const [mainBody, quotedBody] = (() => {
    if (bodyIsHtml) return [rawBody, null];
    const match = rawBody.match(quotedPattern);
    if (!match || match.index === undefined) return [rawBody, null];
    return [rawBody.slice(0, match.index).trim(), rawBody.slice(match.index).trim()];
  })();

  async function handleMarkRead(isRead: boolean) {
    try {
      const { error } = await supabase
        .from("admin_emails")
        .update({ is_read: isRead })
        .eq("id", email.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["emails"] });
      toast({ title: isRead ? "Marked as read" : "Marked as unread" });
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
      toast({ title: email.is_flagged ? "Unflagged" : "Flagged" });
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
        notes: `From: ${rawFrom ?? "Unknown"}\n\n${email.snippet || ""}`,
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

  function handleAddContact() {
    if (!senderEmail) return;
    createContact.mutate(
      { display_name: senderName !== senderEmail ? senderName : senderEmail, primary_email: senderEmail },
      {
        onSuccess: () => toast({ title: "Contact added", description: senderEmail }),
        onError: () => toast({ variant: "destructive", title: "Failed to add contact" }),
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

  const toDisplay = email.to_addr ?? (email.to_addresses?.join(", ") ?? null);

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
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {senderContact ? (
                <p className="text-sm font-medium text-foreground">{senderContact.display_name}</p>
              ) : (
                <p className="text-sm text-foreground">{senderName}</p>
              )}
              {senderEmail && senderEmail !== senderName && (
                <p className="text-xs text-muted-foreground">{senderEmail}</p>
              )}
            </div>
            {senderEmail && !senderContact && (
              <button
                onClick={handleAddContact}
                disabled={createContact.isPending}
                className="shrink-0 flex items-center gap-1 text-[11px] text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-colors"
                title="Add to contacts"
              >
                <UserPlus size={11} />
                Add contact
              </button>
            )}
          </div>
        </div>

        {/* To */}
        {toDisplay && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">To</p>
            <p className="text-sm text-foreground">{toDisplay}</p>
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
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Message</p>
            {bodyIsHtml && (
              <button
                onClick={() => setShowImages((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                title={showImages ? "Hide images" : "Show images"}
              >
                <ShieldAlert size={11} />
                {showImages ? "Hide images" : "Show images"}
              </button>
            )}
          </div>
          <div className="bg-muted/50 rounded-lg p-3 overflow-x-auto">
            {bodyIsHtml ? (
              <div
                className="text-sm text-foreground email-body"
                dangerouslySetInnerHTML={{ __html: processedBody() }}
                style={{ wordBreak: "break-word" }}
              />
            ) : (
              <>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {mainBody || "(no content)"}
                </p>
                {quotedBody && (
                  <div className="mt-2">
                    <button
                      onClick={() => setQuotedExpanded((v) => !v)}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {quotedExpanded ? "Hide quoted text" : "Show quoted text"}
                    </button>
                    {quotedExpanded && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1 border-l-2 border-border pl-2">
                        {quotedBody}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-border shrink-0 p-3 space-y-2">
        <button
          onClick={() => onReply(email)}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors font-medium"
        >
          <Reply size={12} />
          Reply
        </button>
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
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyEmail, setReplyEmail] = useState<Email | null>(null);

  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: accounts = [], isLoading: accountLoading, refetch: refetchAccounts } =
    useGmailAccounts();
  const {
    data: emails = [],
    isLoading: emailsLoading,
    refetch: refetchEmails,
  } = useEmails(filter);

  const senderEmails = useMemo(() => {
    const set = new Set<string>();
    for (const e of emails) {
      const addr = parseSenderEmail(e.from_addr ?? e.from_address);
      if (addr) set.add(addr.toLowerCase());
    }
    return Array.from(set);
  }, [emails]);
  const { data: contactMap = new Map() } = useContactsByEmails(senderEmails);

  // Parse initial filter from URL params
  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam && ["inbox", "unread", "starred", "all"].includes(filterParam)) {
      setFilter(filterParam as EmailFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      refetchAccounts();
      navigate("/mail", { replace: true });
    } else if (error) {
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: error.replace(/_/g, " "),
      });
      navigate("/mail", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!accounts.length || !session) return;
    setSyncing(true);
    try {
      await Promise.all(
        accounts.map((a) =>
          fetch(`${FN_BASE}/google-gmail-sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session!.access_token}`,
            },
            body: JSON.stringify({ gmail_account_id: a.id }),
          }),
        ),
      );
      await Promise.all([refetchAccounts(), refetchEmails()]);
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
    <div className="flex flex-col md:flex-row h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-6 border-b border-border/50 shrink-0">
          <h1 className="text-2xl font-bold font-display text-primary">Communication Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your emails and stay connected</p>
        </div>

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

          {accounts.length > 0 && (
            <>
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
              <Button size="sm" onClick={() => setComposeOpen(true)}>
                <PenLine size={14} className="mr-1" />
                Compose
              </Button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {accountLoading ? (
            <LoadingSpinner message="Checking Gmail connection…" />
          ) : accounts.length === 0 ? (
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
              {emails.map((email) => {
                const addr = parseSenderEmail(email.from_addr ?? email.from_address);
                const contact = addr ? contactMap.get(addr.toLowerCase()) : undefined;
                return (
                  <EmailRow
                    key={email.id}
                    email={email}
                    onSelect={(e) =>
                      setSelectedEmail((prev) => (prev?.id === e.id ? null : e))
                    }
                    selectedId={selectedEmail?.id}
                    contact={contact}
                  />
                );
              })}
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
            onReply={(e) => setReplyEmail(e)}
            senderContact={contactMap.get(parseSenderEmail(selectedEmail.from_addr ?? selectedEmail.from_address)?.toLowerCase() ?? "")}
          />
        </div>
      )}

      {/* Mobile detail modal */}
      {selectedEmail && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/80 flex animate-in fade-in slide-in-from-bottom">
          <EmailDetail
            email={selectedEmail}
            onClose={() => setSelectedEmail(null)}
            onReply={(e) => setReplyEmail(e)}
            senderContact={contactMap.get(parseSenderEmail(selectedEmail.from_addr ?? selectedEmail.from_address)?.toLowerCase() ?? "")}
          />
        </div>
      )}

      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} accounts={accounts} />
      <ReplyDialog
        email={replyEmail}
        open={!!replyEmail}
        onOpenChange={(v) => { if (!v) setReplyEmail(null); }}
        accounts={accounts}
      />
    </div>
  );
}
