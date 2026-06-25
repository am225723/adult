import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Contact } from "@/hooks/useContacts";

export function useContact(contactId: string) {
  const { user } = useAuth();

  return useQuery<Contact>({
    queryKey: ["contact", user?.id, contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_contacts")
        .select("*")
        .eq("id", contactId)
        .single();

      if (error) throw error;
      return data as Contact;
    },
    enabled: !!user && !!contactId,
  });
}
