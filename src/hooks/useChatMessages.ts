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
    enabled: !!threadId && !!user,
  });

  useEffect(() => {
    if (!threadId || !user) return;

    const channel = supabase
      .channel(`chat-messages-${threadId}-${Math.random().toString(36).slice(2)}`)
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
            (old) => {
              const existing = old ?? [];
              const incoming = payload.new as ChatMessage;
              if (existing.some((m) => m.id === incoming.id)) return existing;
              return [...existing, incoming];
            },
          );
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.error("Realtime subscription error:", err);
        }
        if (status !== "SUBSCRIBED") {
          console.warn("Realtime subscription status:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, user?.id, queryClient]);

  return query;
}

export function useSendChatMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      threadId,
      body,
      attachmentUrl,
    }: {
      threadId: string;
      body: string;
      attachmentUrl?: string | null;
    }) => {
      if (!user?.id) throw new Error("Must be signed in to send a message");
      const { data, error } = await supabase
        .from("admin_chat_messages")
        .insert({
          thread_id: threadId,
          sender_id: user.id,
          body: body.trim() || null,
          attachment_url: attachmentUrl ?? null,
        })
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
