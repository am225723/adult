import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, Monitor, CheckCircle2, XCircle, LogOut, Bell, Smartphone, ChevronDown, ChevronUp, RefreshCw, KeyRound, Unplug, Pencil, Check, X, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/theme-provider";
import { toast } from "@/hooks/useToast";
import { useCalendarAccount, useInvalidateCalendarAccount } from "@/hooks/useCalendarAccount";
import { useGmailAccounts, useInvalidateGmailAccounts, type GmailAccountRow } from "@/hooks/useGmailAccount";
import { supabase } from "@/lib/supabase";
import {
  useNotificationPreferences,
  useUpsertNotificationPreference,
  NOTIFICATION_CATEGORIES,
} from "@/hooks/useNotificationPreferences";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  useRefreshCalendars,
  useUpdateCalendarSelection,
  useRefreshLabels,
  useUpdateLabelSelection,
} from "@/hooks/useGoogleSyncSettings";
import {
  useMyAdminUser,
  useUpdateMyProfile,
  useMyWorkspaceMemberProfile,
  useUpdateWorkspaceMemberProfile,
} from "@/hooks/useWorkspaceUsers";

const LABEL_INITIAL_LIMIT = 10;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function GmailAccountSection({
  account,
  onDisconnected,
}: {
  account: GmailAccountRow;
  onDisconnected: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [labelSearch, setLabelSearch] = useState("");
  const [showAllLabels, setShowAllLabels] = useState(false);
  const refreshLabels = useRefreshLabels();
  const updateLabelSelection = useUpdateLabelSelection();

  async function handleDisconnect() {
    setDisconnecting(true);
    const { error } = await supabase.from("admin_gmail_accounts").delete().eq("id", account.id);
    setDisconnecting(false);
    if (error) {
      toast({ variant: "destructive", title: "Disconnect failed", description: error.message });
    } else {
      onDisconnected();
      toast({ title: "Gmail disconnected", description: account.external_account_email ?? "" });
    }
  }

  function handleLabelToggle(labelId: string, checked: boolean) {
    const current = account.sync_labels ?? ["INBOX"];
    const next = checked ? [...current, labelId] : current.filter((id) => id !== labelId);
    if (next.length === 0) return;
    updateLabelSelection.mutate({ accountId: account.id, labelIds: next });
  }

  return (
    <>
      <SettingsRow>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {account.external_account_email ?? "Gmail account"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CheckCircle2 size={16} className="text-green-500" />
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            aria-label="Configure labels"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </SettingsRow>
      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Labels to sync</p>
            <button
              onClick={() => refreshLabels.mutate(account.id)}
              disabled={refreshLabels.isPending}
              className="flex items-center gap-1 text-xs text-primary disabled:opacity-50"
            >
              <RefreshCw size={11} className={refreshLabels.isPending ? "animate-spin" : ""} />
              {refreshLabels.isPending ? "Fetching…" : "Refresh list"}
            </button>
          </div>

          {(account.available_labels ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Click "Refresh list" to load your Gmail labels.
            </p>
          ) : (
            <div className="space-y-2">
              {account.available_labels.length > LABEL_INITIAL_LIMIT && (
                <div className="relative">
                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={labelSearch}
                    onChange={(e) => setLabelSearch(e.target.value)}
                    placeholder="Search labels…"
                    className="w-full pl-6 pr-2 py-1 text-xs bg-muted/50 border border-border rounded-lg outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                {(() => {
                  const allLabels = account.available_labels;
                  const filtered = labelSearch.trim()
                    ? allLabels.filter((l) =>
                        l.name.toLowerCase().includes(labelSearch.toLowerCase()),
                      )
                    : allLabels;
                  const displayed =
                    showAllLabels || labelSearch.trim()
                      ? filtered
                      : filtered.slice(0, LABEL_INITIAL_LIMIT);
                  return (
                    <>
                      {displayed.map((label) => {
                        const selected = (account.sync_labels ?? ["INBOX"]).includes(label.id);
                        return (
                          <label key={label.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => handleLabelToggle(label.id, e.target.checked)}
                              className="accent-primary"
                            />
                            <span className="text-xs text-foreground">{label.name}</span>
                          </label>
                        );
                      })}
                      {!labelSearch.trim() && filtered.length > LABEL_INITIAL_LIMIT && (
                        <button
                          onClick={() => setShowAllLabels((v) => !v)}
                          className="text-xs text-primary hover:underline mt-1"
                        >
                          {showAllLabels
                            ? "Show less"
                            : `Show ${filtered.length - LABEL_INITIAL_LIMIT} more…`}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-border">
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full justify-start"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              <Unplug size={13} className="mr-1.5" />
              {disconnecting ? "Disconnecting…" : "Disconnect this account"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h2>
      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-4 px-5 py-4">{children}</div>;
}

export function SettingsPage() {
  const { user, session } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const { data: adminUser } = useMyAdminUser();
  const updateMyProfile = useUpdateMyProfile();
  const { data: memberProfile } = useMyWorkspaceMemberProfile();
  const updateMemberProfile = useUpdateWorkspaceMemberProfile();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [signatureInput, setSignatureInput] = useState("");
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  const [signatureDirty, setSignatureDirty] = useState(false);

  const {
    data: calendarAccount,
    isLoading: calendarLoading,
    isError: calendarError,
  } = useCalendarAccount();
  const {
    data: gmailAccounts = [],
    isLoading: gmailLoading,
  } = useGmailAccounts();

  const { data: notifPrefs = [], isLoading: notifLoading } = useNotificationPreferences();
  const upsertPref = useUpsertNotificationPreference();
  const push = usePushNotifications();

  const [calendarExpanded, setCalendarExpanded] = useState(false);

  const refreshCalendars = useRefreshCalendars();
  const updateCalendarSelection = useUpdateCalendarSelection();

  const invalidateCalendar = useInvalidateCalendarAccount();
  const invalidateGmailAccounts = useInvalidateGmailAccounts();
  const [disconnectingCalendar, setDisconnectingCalendar] = useState(false);

  useEffect(() => {
    if (memberProfile && !signatureDirty) {
      const sig = memberProfile.email_signature ?? "";
      setSignatureInput(sig);
      setSignatureEnabled(sig.length > 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberProfile]);

  function startEditName() {
    setNameInput(adminUser?.display_name ?? displayName);
    setEditingName(true);
  }

  async function saveDisplayName() {
    const trimmed = nameInput.trim();
    if (!trimmed) { setEditingName(false); return; }
    try {
      await updateMyProfile.mutateAsync({ display_name: trimmed });
      toast({ title: "Display name updated" });
    } catch {
      toast({ variant: "destructive", title: "Failed to update name" });
    }
    setEditingName(false);
  }

  async function saveSignature() {
    const sig = signatureEnabled ? signatureInput : null;
    try {
      await updateMemberProfile.mutateAsync({ email_signature: sig });
      setSignatureDirty(false);
      toast({ title: "Signature saved" });
    } catch {
      toast({ variant: "destructive", title: "Failed to save signature" });
    }
  }

  async function handleDisconnectCalendar() {
    if (!calendarAccount) return;
    setDisconnectingCalendar(true);
    const { error } = await supabase
      .from("admin_calendar_accounts")
      .delete()
      .eq("id", calendarAccount.id);
    setDisconnectingCalendar(false);
    if (error) {
      toast({ variant: "destructive", title: "Disconnect failed", description: error.message });
    } else {
      setCalendarExpanded(false);
      invalidateCalendar();
      toast({ title: "Google Calendar disconnected" });
    }
  }

  async function handleConnectGmail() {
    if (!session) return;
    try {
      const res = await fetch(
        `${FN_BASE}/google-gmail-oauth?origin=${encodeURIComponent(window.location.origin)}`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (err) {
      toast({ variant: "destructive", title: "Could not connect", description: String(err) });
    }
  }

  function handleCalendarToggle(calId: string, checked: boolean) {
    if (!calendarAccount) return;
    const current = calendarAccount.selected_calendar_ids ?? ["primary"];
    const next = checked ? [...current, calId] : current.filter((id) => id !== calId);
    if (next.length === 0) return; // must keep at least one
    updateCalendarSelection.mutate({ accountId: calendarAccount.id, calendarIds: next });
  }

  const displayName =
    user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "User";
  const email = user?.email ?? "";

  function isPrefEnabled(category: string): boolean {
    const pref = notifPrefs.find((p) => p.category === category);
    return pref ? (pref.enabled ?? true) : true;
  }

  function quietHours(field: "quiet_hours_start" | "quiet_hours_end"): string {
    const pref = notifPrefs.find((p) => p.category === "global");
    return pref?.[field] ?? "";
  }

  const [passkeyLoading, setPasskeyLoading] = useState(false);

  async function handleRegisterPasskey() {
    setPasskeyLoading(true);
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) throw error;
      toast({ title: "Passkey registered", description: "You can now sign in with your passkey." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      if (msg !== "The operation either timed out or was not allowed.") {
        toast({ variant: "destructive", title: "Passkey registration failed", description: msg });
      }
    } finally {
      setPasskeyLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  const THEMES = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  function integrationStatus(loading: boolean, error: boolean, email?: string | null) {
    if (loading) return "Checking connection…";
    if (error) return "Connection status unavailable";
    return email ? `Connected as ${email}` : "Not connected";
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your account and integrations.
        </p>
      </div>

      {/* Profile */}
      <SettingsSection title="Profile">
        <SettingsRow>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shrink-0">
            {adminUser?.avatar_url ? (
              <img src={adminUser.avatar_url} alt={initials(displayName)} className="w-10 h-10 rounded-full object-cover" />
            ) : initials(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveDisplayName(); if (e.key === "Escape") setEditingName(false); }}
                  className="h-7 text-sm py-0 px-2"
                />
                <button onClick={saveDisplayName} className="h-6 w-6 flex items-center justify-center rounded text-green-500 hover:bg-muted">
                  <Check size={13} />
                </button>
                <button onClick={() => setEditingName(false)} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground truncate">{adminUser?.display_name ?? displayName}</p>
                <button onClick={startEditName} className="text-muted-foreground hover:text-foreground" title="Edit display name">
                  <Pencil size={12} />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </SettingsRow>

        {/* Email signature */}
        <div className="px-5 pb-4 pt-1 space-y-2 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Email signature</p>
            <button
              role="switch"
              aria-checked={signatureEnabled}
              onClick={() => { setSignatureEnabled((v) => !v); setSignatureDirty(true); }}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                signatureEnabled ? "bg-primary" : "bg-muted",
              )}
            >
              <span className={cn("pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform", signatureEnabled ? "translate-x-4" : "translate-x-0")} />
            </button>
          </div>
          {signatureEnabled && (
            <textarea
              value={signatureInput}
              onChange={(e) => { setSignatureInput(e.target.value); setSignatureDirty(true); }}
              rows={4}
              placeholder="Write your email signature…"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs resize-none outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
            />
          )}
          {signatureDirty && (
            <Button size="sm" className="h-7 text-xs" onClick={saveSignature} disabled={updateMemberProfile.isPending}>
              {updateMemberProfile.isPending ? "Saving…" : "Save signature"}
            </Button>
          )}
        </div>
      </SettingsSection>

      {/* Integrations */}
      <SettingsSection title="Integrations">
        {/* Google Calendar */}
        <SettingsRow>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Google Calendar</p>
            <p className="text-xs text-muted-foreground truncate">
              {integrationStatus(calendarLoading, calendarError, calendarAccount?.external_account_email)}
            </p>
          </div>
          {calendarAccount ? (
            <div className="flex items-center gap-2 shrink-0">
              <CheckCircle2 size={16} className="text-green-500" />
              <button
                onClick={() => setCalendarExpanded((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                aria-label="Configure calendars"
              >
                {calendarExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/calendar")}
              disabled={calendarLoading || calendarError}
            >
              Connect
            </Button>
          )}
        </SettingsRow>

        {calendarAccount && calendarExpanded && (
          <div className="px-5 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">Calendars to sync</p>
              <button
                onClick={() => refreshCalendars.mutate(calendarAccount.id)}
                disabled={refreshCalendars.isPending}
                className="flex items-center gap-1 text-xs text-primary disabled:opacity-50"
              >
                <RefreshCw size={11} className={refreshCalendars.isPending ? "animate-spin" : ""} />
                {refreshCalendars.isPending ? "Fetching…" : "Refresh list"}
              </button>
            </div>

            {(calendarAccount.available_calendars ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Click "Refresh list" to load your Google calendars.
              </p>
            ) : (
              <div className="space-y-1.5">
                {calendarAccount.available_calendars.map((cal) => {
                  const selected = (calendarAccount.selected_calendar_ids ?? ["primary"]).includes(cal.id);
                  return (
                    <label key={cal.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => handleCalendarToggle(cal.id, e.target.checked)}
                        className="accent-primary"
                      />
                      <span className="text-xs text-foreground">
                        {cal.summary}
                        {cal.primary && (
                          <span className="ml-1 text-muted-foreground">(primary)</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full justify-start"
                onClick={handleDisconnectCalendar}
                disabled={disconnectingCalendar}
              >
                <Unplug size={13} className="mr-1.5" />
                {disconnectingCalendar ? "Disconnecting…" : "Disconnect Google Calendar"}
              </Button>
            </div>
          </div>
        )}

        {/* Gmail */}
        {gmailLoading ? (
          <SettingsRow>
            <p className="text-sm text-muted-foreground">Checking Gmail connections…</p>
          </SettingsRow>
        ) : gmailAccounts.length === 0 ? (
          <SettingsRow>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Gmail</p>
              <p className="text-xs text-muted-foreground">Not connected</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleConnectGmail} disabled={gmailLoading}>
              Connect
            </Button>
          </SettingsRow>
        ) : (
          <>
            {gmailAccounts.map((acct) => (
              <GmailAccountSection
                key={acct.id}
                account={acct}
                onDisconnected={invalidateGmailAccounts}
              />
            ))}
            <SettingsRow>
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={handleConnectGmail} disabled={gmailLoading}>
                <Plus size={13} className="mr-1.5" />
                Add Gmail account
              </Button>
            </SettingsRow>
          </>
        )}

        <SettingsRow>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Quo (Phone & Chat)</p>
            <p className="text-xs text-muted-foreground">
              Set <code className="font-mono text-xs bg-muted px-1 rounded">QUO_API_KEY</code> in
              Supabase Edge Function secrets to enable
            </p>
          </div>
          <XCircle size={16} className="text-muted-foreground shrink-0" />
        </SettingsRow>
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection title="Appearance">
        <SettingsRow>
          <p className="flex-1 text-sm font-medium text-foreground">Theme</p>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                  theme === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="Notifications">
        {notifLoading ? (
          <SettingsRow>
            <p className="text-sm text-muted-foreground">Loading preferences…</p>
          </SettingsRow>
        ) : (
          <>
            {NOTIFICATION_CATEGORIES.map(({ id, label }) => {
              const enabled = isPrefEnabled(id);
              return (
                <SettingsRow key={id}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={enabled}
                    onClick={() =>
                      upsertPref.mutate({ category: id, enabled: !enabled })
                    }
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      enabled ? "bg-primary" : "bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform",
                        enabled ? "translate-x-4" : "translate-x-0",
                      )}
                    />
                  </button>
                </SettingsRow>
              );
            })}

            {/* Quiet hours (global) */}
            <SettingsRow>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Bell size={13} className="text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Quiet hours</p>
                </div>
                <p className="text-xs text-muted-foreground">Suppress notifications during this window</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={quietHours("quiet_hours_start")}
                  onChange={(e) =>
                    upsertPref.mutate({
                      category: "global",
                      quiet_hours_start: e.target.value || null,
                    })
                  }
                  className="text-xs bg-muted border border-border rounded px-2 py-1 text-foreground"
                  aria-label="Quiet hours start"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <input
                  type="time"
                  value={quietHours("quiet_hours_end")}
                  onChange={(e) =>
                    upsertPref.mutate({
                      category: "global",
                      quiet_hours_end: e.target.value || null,
                    })
                  }
                  className="text-xs bg-muted border border-border rounded px-2 py-1 text-foreground"
                  aria-label="Quiet hours end"
                />
              </div>
            </SettingsRow>

            {/* Browser push notifications */}
            <SettingsRow>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Smartphone size={13} className="text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Browser push notifications</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {!push.supported
                    ? "Not supported in this browser or VAPID key not configured"
                    : push.permission === "denied"
                    ? "Blocked by browser — allow notifications in browser settings"
                    : push.enabled
                    ? "Receive notifications even when the app is closed"
                    : "Get notified even when the app tab is closed"}
                </p>
              </div>
              {push.supported && push.permission !== "denied" && (
                <button
                  role="switch"
                  aria-checked={push.enabled}
                  disabled={push.loading}
                  onClick={() => (push.enabled ? push.disable() : push.enable())}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                    push.enabled ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform",
                      push.enabled ? "translate-x-4" : "translate-x-0",
                    )}
                  />
                </button>
              )}
            </SettingsRow>
          </>
        )}
      </SettingsSection>

      {/* Account */}
      <SettingsSection title="Security">
        <SettingsRow>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Passkey</p>
            <p className="text-xs text-muted-foreground">
              Register a passkey (Face ID, Touch ID, or hardware key) to sign in without a password.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegisterPasskey}
            disabled={passkeyLoading}
            className="shrink-0"
          >
            <KeyRound size={14} className="mr-1.5" />
            {passkeyLoading ? "Registering…" : "Register passkey"}
          </Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Account">
        <SettingsRow>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Sign out</p>
            <p className="text-xs text-muted-foreground">
              You'll be redirected to the login page.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
          >
            <LogOut size={14} className="mr-1.5" />
            Sign out
          </Button>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
