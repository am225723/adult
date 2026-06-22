import { useNavigate } from "react-router-dom";
import { Sun, Moon, Monitor, CheckCircle2, XCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/theme-provider";
import { useCalendarAccount } from "@/hooks/useCalendarAccount";
import { useGmailAccount } from "@/hooks/useGmailAccount";
import { supabase } from "@/lib/supabase";

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const { data: calendarAccount } = useCalendarAccount();
  const { data: gmailAccount } = useGmailAccount();

  const displayName =
    user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "User";
  const email = user?.email ?? "";

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  const THEMES = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

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
            {initials(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* Integrations */}
      <SettingsSection title="Integrations">
        <SettingsRow>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Google Calendar</p>
            <p className="text-xs text-muted-foreground truncate">
              {calendarAccount
                ? `Connected as ${calendarAccount.external_account_email}`
                : "Not connected"}
            </p>
          </div>
          {calendarAccount ? (
            <CheckCircle2 size={16} className="text-green-500 shrink-0" />
          ) : (
            <Button size="sm" variant="outline" onClick={() => navigate("/calendar")}>
              Connect
            </Button>
          )}
        </SettingsRow>

        <SettingsRow>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Gmail</p>
            <p className="text-xs text-muted-foreground truncate">
              {gmailAccount
                ? `Connected as ${gmailAccount.external_account_email}`
                : "Not connected"}
            </p>
          </div>
          {gmailAccount ? (
            <CheckCircle2 size={16} className="text-green-500 shrink-0" />
          ) : (
            <Button size="sm" variant="outline" onClick={() => navigate("/mail")}>
              Connect
            </Button>
          )}
        </SettingsRow>

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

      {/* Account */}
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
