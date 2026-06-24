import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface CalendarEntry {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string | null;
}

export interface CalendarAccountRow {
  id: string;
  provider: string;
  external_account_email: string | null;
  sync_enabled: boolean | null;
  last_synced_at: string | null;
  available_calendars: CalendarEntry[];
  selected_calendar_ids: string[];
}

export function useCalendarAccount() {
  const { user } = useAuth();
  return useQuery<CalendarAccountRow | null>({
    queryKey: ["calendar-account", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("admin_calendar_accounts")
        .select(
          "id, provider, external_account_email, sync_enabled, last_synced_at, available_calendars, selected_calendar_ids",
        )
        .eq("user_id", user.id)
        .eq("provider", "google")
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!user,
  });
}

export function useInvalidateCalendarAccount() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return () => qc.invalidateQueries({ queryKey: ["calendar-account", user?.id] });
}
