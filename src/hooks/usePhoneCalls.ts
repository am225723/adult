import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface PhoneCall {
  id: string;
  phone_account_id: string | null;
  direction: string | null;
  status: string | null;
  occurred_at: string | null;
  duration_seconds: number | null;
  voicemail_transcript: string | null;
  voicemail_url: string | null;
  contact_id: string | null;
}

type CallFilter = "missed" | "all" | "today";

export function usePhoneCalls(filter: CallFilter = "all") {
  const { user } = useAuth();

  return useQuery<PhoneCall[]>({
    queryKey: ["phone-calls", user?.id, filter],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = supabase
        .from("admin_phone_calls")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(100);

      switch (filter) {
        case "missed":
          query = query.in("status", ["missed", "no-answer", "abandoned"]);
          break;
        case "today":
          query = query.gte("occurred_at", today.toISOString());
          break;
        case "all":
        default:
          // no additional filter
          break;
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PhoneCall[];
    },
    enabled: !!user,
  });
}
