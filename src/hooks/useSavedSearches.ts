import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { SearchCategory, QuickFilter } from "@/hooks/useGlobalSearch";

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  category: SearchCategory;
  filters: QuickFilter[];
  created_at: string;
}

export function useSavedSearches() {
  const { user } = useAuth();

  return useQuery<SavedSearch[]>({
    queryKey: ["saved-searches", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_saved_searches")
        .select("id, name, query, category, filters, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        query: row.query ?? "",
        category: (row.category ?? "all") as SearchCategory,
        filters: (Array.isArray(row.filters) ? row.filters : []) as QuickFilter[],
        created_at: row.created_at ?? "",
      }));
    },
    enabled: !!user,
  });
}

export function useCreateSavedSearch() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (search: {
      name: string;
      query: string;
      category: SearchCategory;
      filters: QuickFilter[];
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data: ws, error: wsError } = await supabase
        .from("admin_workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (wsError) throw wsError;
      if (!ws?.workspace_id) throw new Error("Workspace membership not found");

      const { data, error } = await supabase
        .from("admin_saved_searches")
        .insert({
          user_id: user.id,
          workspace_id: ws.workspace_id,
          name: search.name,
          query: search.query,
          category: search.category,
          filters: search.filters,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}

export function useDeleteSavedSearch() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_saved_searches")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-searches"] }),
  });
}
