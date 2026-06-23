import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface WorkspaceMember {
  user_id: string;
  role: string | null;
  workspace_id: string;
}

export function useWorkspaceMembers() {
  const { user } = useAuth();
  return useQuery<WorkspaceMember[]>({
    queryKey: ["workspace-members", user?.id],
    queryFn: async () => {
      const { data: my, error: myErr } = await supabase
        .from("admin_workspace_members")
        .select("workspace_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();
      if (myErr || !my) return [];

      const { data, error } = await supabase
        .from("admin_workspace_members")
        .select("user_id, role, workspace_id")
        .eq("workspace_id", my.workspace_id);
      if (error) throw error;
      return (data ?? []) as WorkspaceMember[];
    },
    enabled: !!user,
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
        .limit(1)
        .single();
      if (error) return null;
      return data?.workspace_id ?? null;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });
}
