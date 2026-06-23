import { Bell, Check, CheckCheck, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
} from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

function notificationLink(n: Notification): string | null {
  if (n.related_type === "contact" && n.related_id) return `/contacts/${n.related_id}`;
  if (n.related_type === "task") return "/tasks";
  if (n.related_type === "calendar_event") return "/calendar";
  if (n.type === "sms" || n.type === "missed_call") return "/phone";
  if (n.type === "email") return "/mail";
  return null;
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NotificationRow({ n, onMarkRead }: { n: Notification; onMarkRead: (id: string) => void }) {
  const link = notificationLink(n);

  const inner = (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors",
        !n.is_read && "bg-primary/5",
      )}
    >
      <div
        className={cn(
          "mt-1.5 w-1.5 h-1.5 rounded-full shrink-0",
          n.is_read ? "bg-transparent" : "bg-primary",
        )}
      />
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-medium leading-snug", n.is_read ? "text-muted-foreground" : "text-foreground")}>
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1">{relativeTime(n.created_at)}</p>
      </div>
      {!n.is_read && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMarkRead(n.id);
          }}
          className="shrink-0 mt-0.5 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          title="Mark as read"
          aria-label="Mark as read"
        >
          <Check size={12} />
        </button>
      )}
    </div>
  );

  return link ? (
    <Link
      to={link}
      onClick={() => { if (!n.is_read) onMarkRead(n.id); }}
      className="block"
    >
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

export function NotificationCenter() {
  const { data: notifications = [], isLoading, isError } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title="Notifications"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <Bell size={16} strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-3.5 flex items-center justify-center text-[9px] font-bold leading-none bg-destructive text-destructive-foreground rounded-full px-0.5 pointer-events-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="end" className="w-80 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-medium">Notifications</p>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-10">Loading…</p>
          ) : isError ? (
            <div className="flex items-center gap-2 px-4 py-10 text-destructive">
              <AlertCircle size={14} className="shrink-0" />
              <p className="text-xs">Failed to load notifications</p>
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">No notifications yet</p>
          ) : (
            notifications.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onMarkRead={(id) => markRead.mutate(id)}
              />
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="border-t border-border px-4 py-2">
            <p className="text-[10px] text-muted-foreground text-center">
              Showing last {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
