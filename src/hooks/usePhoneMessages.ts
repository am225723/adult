import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface PhoneMessage {
  id: string;
  phone_account_id: string | null;
  body: string | null;
  direction: string | null;
  occurred_at: string | null;
  is_read: boolean | null;
  contact_id: string | null;
}

type MessageFilter = "unread" | "all" | "today";

export function usePhoneMessages(filter: MessageFilter = "all") {
  const { user } = useAuth();

  return useQuery<PhoneMessage[]>({
    queryKey: ["phone-messages", user?.id, filter],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = supabase
        .from("admin_phone_messages")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(100);

      switch (filter) {
        case "unread":
          query = query.eq("is_read", false);
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
      return (data ?? []) as PhoneMessage[];
    },
    enabled: !!user,
  });
}
