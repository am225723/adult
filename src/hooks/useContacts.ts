import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface Contact {
  id: string;
  workspace_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useContacts(search = "") {
  const { user } = useAuth();
  return useQuery<Contact[]>({
    queryKey: ["contacts", user?.id, search],
    queryFn: async () => {
      let query = supabase
        .from("admin_contacts")
        .select("*")
        .order("full_name");
      if (search.trim()) {
        query = query.ilike("full_name", `%${search.trim()}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

async function getWorkspaceId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("admin_workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("No workspace found");
  return data.workspace_id;
}

export function useCreateContact() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (contact: {
      full_name: string;
      email?: string | null;
      phone?: string | null;
      company?: string | null;
      notes?: string | null;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const wsId = await getWorkspaceId(user.id);
      const { data, error } = await supabase
        .from("admin_contacts")
        .insert({ workspace_id: wsId, ...contact })
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Omit<Contact, "id">> & { id: string }) => {
      const { data, error } = await supabase
        .from("admin_contacts")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}
