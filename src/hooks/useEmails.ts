import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface Email {
  id: string;
  gmail_message_id: string | null;
  external_message_id: string | null;
  from_address: string | null;
  from_addr: string | null;
  to_addresses: string[] | null;
  to_addr: string | null;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  received_at: string | null;
  is_read: boolean | null;
  is_flagged: boolean | null;
  is_starred: boolean | null;
  contact_id: string | null;
  folder: string | null;
  labels: string[] | null;
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
          "id, gmail_message_id, external_message_id, from_address, from_addr, to_addresses, to_addr, subject, snippet, body, received_at, is_read, is_flagged, is_starred, contact_id, folder, labels",
        )
        .order("received_at", { ascending: false })
        .limit(50);

      if (filter === "unread") {
        query = query.eq("is_read", false);
      } else if (filter === "starred") {
        query = query.or("is_flagged.eq.true,is_starred.eq.true");
      }
      // "inbox" and "all" don't need filters (we only sync inbox anyway)

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}
