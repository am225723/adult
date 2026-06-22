import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface ContactNote {
  id: string;
  contact_id: string;
  created_by: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export function useContactNotes(contactId: string) {
  const { user } = useAuth();

  return useQuery<ContactNote[]>({
    queryKey: ["contact-notes", user?.id, contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_contact_notes")
        .select("id, contact_id, created_by, body, created_at, updated_at")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ContactNote[];
    },
    enabled: !!user && !!contactId,
  });
}

export function useCreateContactNote() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      contactId,
      body,
      workspaceId,
    }: {
      contactId: string;
      body: string;
      workspaceId: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("admin_contact_notes")
        .insert({
          contact_id: contactId,
          created_by: user.id,
          body,
          workspace_id: workspaceId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["contact-notes", user?.id, vars.contactId] });
    },
  });
}

export function useUpdateContactNote() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      body,
      contactId,
    }: {
      id: string;
      body: string;
      contactId: string;
    }) => {
      const { data, error } = await supabase
        .from("admin_contact_notes")
        .update({ body, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["contact-notes", user?.id, vars.contactId] });
    },
  });
}

export function useDeleteContactNote() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, contactId }: { id: string; contactId: string }) => {
      const { error } = await supabase
        .from("admin_contact_notes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["contact-notes", user?.id, vars.contactId] });
    },
  });
}
