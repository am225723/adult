import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string | null;
  attachment_url: string | null;
  pinned: boolean | null;
  created_at: string | null;
}

export function useChatMessages(threadId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<ChatMessage[]>({
    queryKey: ["chat-messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_chat_messages")
        .select("*")
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
    enabled: !!threadId,
  });

  useEffect(() => {
    if (!threadId || !user) return;
    const channel = supabase
      .channel(`chat-messages-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          queryClient.setQueryData<ChatMessage[]>(
            ["chat-messages", threadId],
            (old) => [...(old ?? []), payload.new as ChatMessage],
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId, user, queryClient]);

  return query;
}

export function useSendChatMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      const { data, error } = await supabase
        .from("admin_chat_messages")
        .insert({ thread_id: threadId, sender_id: user!.id, body: body.trim() })
        .select()
        .single();
      if (error) throw error;
      return data as ChatMessage;
    },
    onSuccess: (msg) => {
      queryClient.setQueryData<ChatMessage[]>(
        ["chat-messages", msg.thread_id],
        (old) => {
          const existing = old ?? [];
          if (existing.some((m) => m.id === msg.id)) return existing;
          return [...existing, msg];
        },
      );
    },
  });
}
