import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface BriefingEntry {
  id: string;
  briefing_date: string;
  briefing_text: string;
  sources: string[];
  created_at: string;
}

export function useTodayBriefing() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  return useQuery<BriefingEntry | null>({
    queryKey: ["ai-briefing-today", user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_ai_briefings")
        .select("id, briefing_date, briefing_text, sources, created_at")
        .eq("briefing_date", today)
        .maybeSingle();
      if (error) throw error;
      return data as BriefingEntry | null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useAIBriefingHistory(limit = 14) {
  const { user } = useAuth();
  return useQuery<BriefingEntry[]>({
    queryKey: ["ai-briefing-history", user?.id, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_ai_briefings")
        .select("id, briefing_date, briefing_text, sources, created_at")
        .order("briefing_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as BriefingEntry[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useInvalidateBriefingCache() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  return () => {
    qc.invalidateQueries({ queryKey: ["ai-briefing-today", user?.id, today] });
    qc.invalidateQueries({ queryKey: ["ai-briefing-history", user?.id] });
  };
}
