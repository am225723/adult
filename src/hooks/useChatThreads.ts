import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

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
  const queryClient = useQueryClient();

  const query = useQuery<ChatThread[]>({
    queryKey: ["chat-threads", user?.id],
    queryFn: async () => {
      const { data: my, error: myErr } = await supabase
        .from("admin_workspace_members")
        .select("workspace_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();
      if (myErr || !my) return [];

      const { data, error } = await supabase
        .from("admin_chat_threads")
        .select("*")
        .eq("workspace_id", my.workspace_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChatThread[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("chat-threads-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_chat_threads" },
        () => queryClient.invalidateQueries({ queryKey: ["chat-threads", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  return query;
}

export function useCreateChatThread() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string) => {
      const { data: my, error: myErr } = await supabase
        .from("admin_workspace_members")
        .select("workspace_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();
      if (myErr || !my) throw new Error("No workspace found");

      const { data, error } = await supabase
        .from("admin_chat_threads")
        .insert({
          title,
          workspace_id: my.workspace_id,
          created_by: user!.id,
          is_main_thread: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ChatThread;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-threads", user?.id] });
    },
  });
}
