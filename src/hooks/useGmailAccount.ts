import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface GmailAccountRow {
  id: string;
  provider: string;
  external_account_email: string | null;
  sync_enabled: boolean | null;
  last_synced_at: string | null;
}

export function useGmailAccount() {
  const { user } = useAuth();
  return useQuery<GmailAccountRow | null>({
    queryKey: ["gmail-account", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("admin_gmail_accounts")
        .select(
          "id, provider, external_account_email, sync_enabled, last_synced_at",
        )
        .eq("user_id", user.id)
        .eq("provider", "google")
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!user,
  });
}

export function useInvalidateGmailAccount() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return () => qc.invalidateQueries({ queryKey: ["gmail-account", user?.id] });
}
