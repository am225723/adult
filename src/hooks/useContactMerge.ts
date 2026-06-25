import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Contact } from "@/hooks/useContacts";

export function useFindExistingContact(email?: string, phone?: string) {
  const { user } = useAuth();
  return useQuery<Contact | null>({
    queryKey: ["contact-merge", email, phone],
    queryFn: async () => {
      if (!email && !phone) return null;

      let query = supabase
        .from("admin_contacts")
        .select("id, workspace_id, display_name, primary_email, primary_phone, company, notes, created_at, updated_at");

      if (email && phone) {
        query = query.or(`primary_email.eq.${email.toLowerCase()},primary_phone.eq.${phone}`);
      } else if (email) {
        query = query.eq("primary_email", email.toLowerCase());
      } else if (phone) {
        query = query.eq("primary_phone", phone);
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!user && (!!email || !!phone),
  });
}
