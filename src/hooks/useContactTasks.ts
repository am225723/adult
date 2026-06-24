import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Task } from "@/hooks/useTasks";

export function useContactTasks(contactId: string) {
  const { user } = useAuth();

  return useQuery<Task[]>({
    queryKey: ["contact-tasks", user?.id, contactId],
    queryFn: async () => {
      // Get task IDs linked to this contact
      const { data: links, error: linksError } = await supabase
        .from("admin_task_links")
        .select("task_id")
        .eq("linked_id", contactId)
        .eq("linked_type", "contact");

      if (linksError) throw linksError;

      if (!links || links.length === 0) return [];

      const taskIds = links.map((l: { task_id: string }) => l.task_id);

      // Get the actual tasks
      const { data, error } = await supabase
        .from("admin_tasks")
        .select("*")
        .in("id", taskIds)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;
      return (data ?? []) as Task[];
    },
    enabled: !!user && !!contactId,
  });
}
