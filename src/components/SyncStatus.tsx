import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SyncStatusProps {
  status: "connected" | "disconnected" | "error" | "syncing";
  lastSyncedAt?: string | null;
  error?: string | null;
  compact?: boolean;
}

export function SyncStatus({
  status,
  lastSyncedAt,
  error,
  compact = false,
}: SyncStatusProps) {
  const relativeTime = (isoString?: string | null) => {
    if (!isoString) return "never";
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {status === "connected" && (
          <CheckCircle2 size={12} className="text-green-500" />
        )}
        {status === "disconnected" && (
          <AlertCircle size={12} className="text-muted-foreground" />
        )}
        {status === "error" && (
          <AlertCircle size={12} className="text-destructive" />
        )}
        {status === "syncing" && (
          <Clock size={12} className="text-blue-500 animate-spin" />
        )}
        <span
          className={cn(
            "text-[11px]",
            status === "error"
              ? "text-destructive"
              : status === "syncing"
                ? "text-blue-500"
                : "text-muted-foreground",
          )}
        >
          {status === "syncing" && "Syncing…"}
          {status === "connected" && `Synced ${relativeTime(lastSyncedAt)}`}
          {status === "disconnected" && "Not connected"}
          {status === "error" && "Sync failed"}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {status === "connected" && (
          <CheckCircle2 size={14} className="text-green-500" />
        )}
        {status === "disconnected" && (
          <AlertCircle size={14} className="text-muted-foreground" />
        )}
        {status === "error" && (
          <AlertCircle size={14} className="text-destructive" />
        )}
        {status === "syncing" && (
          <Clock size={14} className="text-blue-500 animate-spin" />
        )}
        <span
          className={cn(
            "text-sm font-medium",
            status === "error"
              ? "text-destructive"
              : status === "syncing"
                ? "text-blue-600 dark:text-blue-400"
                : status === "disconnected"
                  ? "text-muted-foreground"
                  : "text-green-600 dark:text-green-400",
          )}
        >
          {status === "syncing" && "Syncing…"}
          {status === "connected" && "Connected"}
          {status === "disconnected" && "Not connected"}
          {status === "error" && "Sync error"}
        </span>
      </div>
      {lastSyncedAt && status === "connected" && (
        <p className="text-xs text-muted-foreground">
          Last synced {relativeTime(lastSyncedAt)}
        </p>
      )}
      {error && status === "error" && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
