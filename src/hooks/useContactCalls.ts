import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { PhoneCall } from "@/hooks/usePhoneCalls";

export function useContactCalls(contactId: string) {
  const { user } = useAuth();

  return useQuery<PhoneCall[]>({
    queryKey: ["contact-calls", user?.id, contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_phone_calls")
        .select("*")
        .eq("contact_id", contactId)
        .order("occurred_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as PhoneCall[];
    },
    enabled: !!user && !!contactId,
  });
}
