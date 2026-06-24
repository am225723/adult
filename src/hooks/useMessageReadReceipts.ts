import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface ReadReceipt {
  message_id: string;
  user_id: string;
  read_at: string | null;
}

/** Fetch all read receipts for a list of message IDs, keyed by message_id. */
export function useThreadReadReceipts(messageIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<Map<string, string[]>>({
    queryKey: ["read-receipts", ...messageIds.slice(0, 5)],
    queryFn: async () => {
      if (!messageIds.length) return new Map();
      const { data, error } = await supabase
        .from("admin_message_read_receipts")
        .select("message_id, user_id")
        .in("message_id", messageIds);
      if (error) throw error;
      const map = new Map<string, string[]>();
      for (const row of data ?? []) {
        const list = map.get(row.message_id) ?? [];
        list.push(row.user_id);
        map.set(row.message_id, list);
      }
      return map;
    },
    enabled: !!user && messageIds.length > 0,
    staleTime: 30 * 1000,
  });

  // Realtime subscription for new read receipts — derive stable primitives so
  // the effect deps don't depend on the array reference (which changes every render).
  const receiptKey = messageIds.slice(0, 5).join("|");
  const firstMessageId = messageIds[0] ?? "none";
  const hasMessages = messageIds.length > 0;
  useEffect(() => {
    if (!user || !hasMessages) return;
    const queryKeyIds = receiptKey.split("|");
    const channel = supabase
      .channel(`read-receipts-${firstMessageId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_message_read_receipts" },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["read-receipts", ...queryKeyIds],
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, receiptKey, firstMessageId, hasMessages, queryClient]);

  return query;
}

/** Mark a message as read by the current user. */
export function useMarkMessageRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("admin_message_read_receipts")
        .upsert(
          { message_id: messageId, user_id: user.id },
          { onConflict: "message_id,user_id" },
        );
      if (error) throw error;
    },
    onSuccess: (_data, messageId) => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "read-receipts" &&
          (q.queryKey as string[]).includes(messageId),
      });
    },
  });
}
