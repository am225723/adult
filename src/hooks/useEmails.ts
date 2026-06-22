import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface Email {
  id: string;
  gmail_message_id: string | null;
  from_address: string | null;
  to_addresses: string[] | null;
  subject: string | null;
  snippet: string | null;
  received_at: string | null;
  is_read: boolean | null;
  is_flagged: boolean | null;
  contact_id: string | null;
  folder: string | null;
}

export type EmailFilter = "inbox" | "unread" | "starred" | "all";

export function useEmails(filter: EmailFilter = "inbox") {
  const { user } = useAuth();

  return useQuery<Email[]>({
    queryKey: ["emails", user?.id, filter],
    queryFn: async () => {
      let query = supabase
        .from("admin_emails")
        .select(
          "id, gmail_message_id, from_address, to_addresses, subject, snippet, received_at, is_read, is_flagged, contact_id, folder",
        )
        .order("received_at", { ascending: false })
        .limit(50);

      if (filter === "unread") {
        query = query.eq("is_read", false);
      } else if (filter === "starred") {
        query = query.eq("is_flagged", true);
      }
      // "inbox" and "all" don't need filters (we only sync inbox anyway)

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}
