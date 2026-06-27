import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export function useGmailAccounts() {
  const { user } = useAuth();
  return useQuery<GmailAccountRow[]>({
    queryKey: ["gmail-accounts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("admin_gmail_accounts")
        .select(
          "id, provider, external_account_email, sync_enabled, last_synced_at, available_labels, sync_labels, email_signature",
        )
        .eq("user_id", user.id)
        .eq("provider", "google")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as GmailAccountRow[];
    },
    enabled: !!user,
  });
}

export function useInvalidateGmailAccounts() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return () => {
    qc.invalidateQueries({ queryKey: ["gmail-account", user?.id] });
    qc.invalidateQueries({ queryKey: ["gmail-accounts", user?.id] });
  };
}

export interface LabelEntry {
  id: string;
  name: string;
  type: string;
}

export interface GmailAccountRow {
  id: string;
  provider: string;
  external_account_email: string | null;
  sync_enabled: boolean | null;
  last_synced_at: string | null;
  available_labels: LabelEntry[];
  sync_labels: string[];
  email_signature?: string | null;
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
          "id, provider, external_account_email, sync_enabled, last_synced_at, available_labels, sync_labels, email_signature",
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

export function useUpdateGmailAccountSignature() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ accountId, signature }: { accountId: string; signature: string | null }) => {
      const { error } = await supabase
        .from("admin_gmail_accounts")
        .update({ email_signature: signature })
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gmail-accounts", user?.id] });
      qc.invalidateQueries({ queryKey: ["gmail-account", user?.id] });
    },
  });
}
