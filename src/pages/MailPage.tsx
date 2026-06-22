import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useGmailAccount } from "@/hooks/useGmailAccount";
import { useEmails, type EmailFilter } from "@/hooks/useEmails";
import { toast } from "@/hooks/useToast";

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

function EmailRow({ email }: { email: any }) {
  const dateFormatter = (date: string) => {
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

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors",
        !email.is_read && "bg-muted/20",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm truncate", !email.is_read && "font-semibold")}>
            {email.from_addr || "Unknown sender"}
          </p>
        </div>
        <p className={cn("text-sm truncate", !email.is_read ? "text-foreground font-medium" : "text-muted-foreground")}>
          {email.subject}
        </p>
        <p className="text-xs text-muted-foreground truncate">{email.snippet}</p>
      </div>
      <div className="text-xs text-muted-foreground shrink-0">
        {dateFormatter(email.received_at)}
      </div>
    </div>
  );
}

export function MailPage() {
  const [filter, setFilter] = useState<EmailFilter>("inbox");
  const [syncing, setSyncing] = useState(false);

  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { data: account, isLoading: accountLoading, refetch: refetchAccount } =
    useGmailAccount();
  const { data: emails = [], isLoading: emailsLoading } = useEmails(filter);

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
      toast({ title: "Gmail synced" });
      refetchAccount();
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
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
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
        {accountLoading ? null : !account ? (
          <ConnectPrompt onConnect={handleConnect} />
        ) : emailsLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Loading emails…
          </div>
        ) : emails.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No emails found.
          </div>
        ) : (
          <div>
            {emails.map((email) => (
              <EmailRow key={email.id} email={email} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
