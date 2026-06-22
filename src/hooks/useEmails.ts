import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface Email {
  id: string;
  external_message_id: string;
  from_addr: string | null;
  to_addr: string | null;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  received_at: string | null;
  is_read: boolean;
  is_starred: boolean;
  labels: string[];
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
          "id, external_message_id, from_addr, to_addr, subject, snippet, received_at, is_read, is_starred, labels",
        )
        .order("received_at", { ascending: false })
        .limit(50);

      if (filter === "unread") {
        query = query.eq("is_read", false);
      } else if (filter === "starred") {
        query = query.eq("is_starred", true);
      }
      // "inbox" and "all" don't need filters (we only sync inbox anyway)

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}
