import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface ChatThread {
  id: string;
  workspace_id: string;
  title: string | null;
  is_main_thread: boolean | null;
  created_by: string | null;
  created_at: string | null;
}

export function useChatThreads() {
  const { user } = useAuth();
  const { selectedWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  const query = useQuery<ChatThread[]>({
    queryKey: ["chat-threads", selectedWorkspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_chat_threads")
        .select("*")
        .eq("workspace_id", selectedWorkspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChatThread[];
    },
    enabled: !!user && !!selectedWorkspaceId,
  });

  useEffect(() => {
    if (!user || !selectedWorkspaceId) return;
    const channel = supabase
      .channel(`chat-threads-rt-${selectedWorkspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_chat_threads" },
        () =>
          queryClient.invalidateQueries({
            queryKey: ["chat-threads", selectedWorkspaceId],
          }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedWorkspaceId, queryClient]);

  return query;
}

export function useCreateChatThread() {
  const { user } = useAuth();
  const { selectedWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string) => {
      if (!user?.id) throw new Error("Must be signed in to create a thread");
      if (!selectedWorkspaceId) throw new Error("No workspace selected");

      const { data, error } = await supabase
        .from("admin_chat_threads")
        .insert({
          title,
          workspace_id: selectedWorkspaceId,
          created_by: user.id,
          is_main_thread: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ChatThread;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["chat-threads", selectedWorkspaceId],
      });
    },
  });
}
