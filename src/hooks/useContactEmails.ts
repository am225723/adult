import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Email } from "@/hooks/useEmails";

export function useContactEmails(contactId: string) {
  const { user } = useAuth();

  return useQuery<Email[]>({
    queryKey: ["contact-emails", user?.id, contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_emails")
        .select(
          "id, gmail_message_id, from_address, to_addresses, subject, snippet, received_at, is_read, is_flagged, contact_id, folder",
        )
        .eq("contact_id", contactId)
        .order("received_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Email[];
    },
    enabled: !!user && !!contactId,
  });
}
