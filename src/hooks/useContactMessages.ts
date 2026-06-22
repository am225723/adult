import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { PhoneMessage } from "@/hooks/usePhoneMessages";

export function useContactMessages(contactId: string) {
  const { user } = useAuth();

  return useQuery<PhoneMessage[]>({
    queryKey: ["contact-messages", user?.id, contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_phone_messages")
        .select("*")
        .eq("contact_id", contactId)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PhoneMessage[];
    },
    enabled: !!user && !!contactId,
  });
}
