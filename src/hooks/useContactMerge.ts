import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Contact } from "@/hooks/useContacts";

export type ContactMatchResult =
  | { status: "none" }
  | { status: "match"; contact: Contact }
  | { status: "ambiguous"; contacts: Contact[] };

export function useFindExistingContact(email?: string, phone?: string) {
  const { user } = useAuth();
  return useQuery<ContactMatchResult>({
    queryKey: ["contact-merge", email, phone],
    queryFn: async (): Promise<ContactMatchResult> => {
      if (!email && !phone) return { status: "none" };

      // Fetch candidates matching email OR phone separately to detect ambiguity
      const byEmail = email
        ? await supabase
            .from("admin_contacts")
            .select("id, workspace_id, display_name, primary_email, primary_phone, company, notes, created_at, updated_at")
            .eq("primary_email", email.toLowerCase())
            .limit(5)
        : { data: [] as Contact[], error: null };
      const byPhone = phone
        ? await supabase
            .from("admin_contacts")
            .select("id, workspace_id, display_name, primary_email, primary_phone, company, notes, created_at, updated_at")
            .eq("primary_phone", phone)
            .limit(5)
        : { data: [] as Contact[], error: null };

      if (byEmail.error) throw byEmail.error;
      if (byPhone.error) throw byPhone.error;

      const emailMatches = byEmail.data ?? [];
      const phoneMatches = byPhone.data ?? [];

      const emailIds = new Set(emailMatches.map((c) => c.id));
      const phoneIds = new Set(phoneMatches.map((c) => c.id));

      // Contacts matching on both criteria
      const both = emailMatches.filter((c) => phoneIds.has(c.id));
      if (both.length > 0) return { status: "match", contact: both[0] };

      // Contacts matching on email only
      const emailOnly = emailMatches.filter((c) => !phoneIds.has(c.id));
      // Contacts matching on phone only
      const phoneOnly = phoneMatches.filter((c) => !emailIds.has(c.id));

      const allCandidates = [...emailOnly, ...phoneOnly];

      if (allCandidates.length === 0) return { status: "none" };
      if (allCandidates.length === 1) return { status: "match", contact: allCandidates[0] };

      // Multiple different contacts matched on different fields — ambiguous
      return { status: "ambiguous", contacts: allCandidates };
    },
    enabled: !!user && (!!email || !!phone),
  });
}
