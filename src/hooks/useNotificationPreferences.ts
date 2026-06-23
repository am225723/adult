import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface NotificationPreference {
  user_id: string;
  category: string;
  enabled: boolean | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export const NOTIFICATION_CATEGORIES = [
  { id: "task_reminder", label: "Task reminders" },
  { id: "task_overdue", label: "Overdue tasks" },
  { id: "calendar_event", label: "Calendar events" },
  { id: "sms", label: "SMS messages" },
  { id: "missed_call", label: "Missed calls" },
  { id: "email", label: "Email" },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["id"];

export function useNotificationPreferences() {
  const { user } = useAuth();

  return useQuery<NotificationPreference[]>({
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notification_preferences")
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as NotificationPreference[];
    },
    enabled: !!user,
  });
}

export function useUpsertNotificationPreference() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      category,
      enabled,
      quiet_hours_start,
      quiet_hours_end,
    }: {
      category: string;
      enabled?: boolean;
      quiet_hours_start?: string | null;
      quiet_hours_end?: string | null;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const payload: Record<string, unknown> = {
        user_id: user.id,
        category,
      };
      if (enabled !== undefined) payload.enabled = enabled;
      if (quiet_hours_start !== undefined) payload.quiet_hours_start = quiet_hours_start;
      if (quiet_hours_end !== undefined) payload.quiet_hours_end = quiet_hours_end;

      const { error } = await supabase
        .from("admin_notification_preferences")
        .upsert(payload, { onConflict: "user_id,category" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences", user?.id] });
    },
  });
}
