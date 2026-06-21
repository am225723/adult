import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean | null;
  recurrence_rule: string | null;
  source: string;
  is_read_only: boolean | null;
  external_event_id: string | null;
  calendar_account_id: string | null;
}

export function useCalendarEvents(start: Date, end: Date) {
  const { user } = useAuth();
  return useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", user?.id, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_calendar_events")
        .select(
          "id, title, description, location, start_time, end_time, all_day, recurrence_rule, source, is_read_only, external_event_id, calendar_account_id",
        )
        .lt("start_time", end.toISOString())
        .gt("end_time", start.toISOString())
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}
