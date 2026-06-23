import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface BriefingContext {
  date: string;
  userName: string;
  eventsToday: number;
  tasksDueToday: number;
  tasksOverdue: number;
  unreadEmails: number;
  missedCalls: number;
  unreadMessages: number;
}

export interface BriefingResult {
  briefing: string;
  sources: string[];
}

export function useAIBriefing() {
  return useMutation<BriefingResult, Error, BriefingContext>({
    mutationFn: async (ctx: BriefingContext) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-daily-briefing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify(ctx),
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "AI service unavailable");
      }

      return res.json() as Promise<BriefingResult>;
    },
  });
}
