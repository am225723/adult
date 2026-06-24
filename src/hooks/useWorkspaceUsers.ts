import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface WorkspaceMemberProfile {
  email_signature: string | null;
}

export interface WorkspaceUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export function useWorkspaceUsers() {
  const { selectedWorkspaceId } = useWorkspace();
  return useQuery<WorkspaceUser[]>({
    queryKey: ["workspace-users", selectedWorkspaceId],
    queryFn: async () => {
      if (!selectedWorkspaceId) return [];
      const { data: members, error: mErr } = await supabase
        .from("admin_workspace_members")
        .select("user_id")
        .eq("workspace_id", selectedWorkspaceId);
      if (mErr || !members?.length) return [];

      const userIds = members.map((m) => m.user_id as string);
      const { data, error } = await supabase
        .from("admin_users")
        .select("id, email, display_name, avatar_url")
        .in("id", userIds);
      if (error) throw error;
      return (data ?? []) as WorkspaceUser[];
    },
    enabled: !!selectedWorkspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyAdminUser() {
  const { user } = useAuth();
  return useQuery<WorkspaceUser | null>({
    queryKey: ["my-admin-user", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("id, email, display_name, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as WorkspaceUser | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateMyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { display_name?: string; avatar_url?: string }) => {
      if (!user?.id) throw new Error("Must be signed in");
      const { error } = await supabase
        .from("admin_users")
        .upsert({ id: user.id, email: user.email ?? "", ...updates });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-admin-user", user?.id] });
    },
  });
}

export function useMyWorkspaceMemberProfile() {
  const { user } = useAuth();
  const { selectedWorkspaceId } = useWorkspace();
  return useQuery<WorkspaceMemberProfile | null>({
    queryKey: ["workspace-member-profile", user?.id, selectedWorkspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_workspace_members")
        .select("email_signature")
        .eq("user_id", user!.id)
        .eq("workspace_id", selectedWorkspaceId!)
        .maybeSingle();
      if (error) throw error;
      return data as WorkspaceMemberProfile | null;
    },
    enabled: !!user && !!selectedWorkspaceId,
  });
}

export function useUpdateWorkspaceMemberProfile() {
  const { user } = useAuth();
  const { selectedWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { email_signature?: string | null }) => {
      if (!user?.id || !selectedWorkspaceId) throw new Error("Must be signed in");
      const { error } = await supabase
        .from("admin_workspace_members")
        .update(updates)
        .eq("user_id", user.id)
        .eq("workspace_id", selectedWorkspaceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-member-profile"] });
    },
  });
}
