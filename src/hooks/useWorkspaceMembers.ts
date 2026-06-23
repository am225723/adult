import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface WorkspaceMember {
  user_id: string;
  role: string | null;
  workspace_id: string;
}

export function useWorkspaceMembers() {
  const { selectedWorkspaceId } = useWorkspace();
  return useQuery<WorkspaceMember[]>({
    queryKey: ["workspace-members", selectedWorkspaceId],
    queryFn: async () => {
      if (!selectedWorkspaceId) return [];
      const { data, error } = await supabase
        .from("admin_workspace_members")
        .select("user_id, role, workspace_id")
        .eq("workspace_id", selectedWorkspaceId);
      if (error) throw error;
      return (data ?? []) as WorkspaceMember[];
    },
    enabled: !!selectedWorkspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyWorkspaceId() {
  const { user } = useAuth();
  return useQuery<string | null>({
    queryKey: ["my-workspace-id", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_workspace_members")
        .select("workspace_id")
        .eq("user_id", user!.id)
        .order("workspace_id", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data?.workspace_id ?? null;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
}
