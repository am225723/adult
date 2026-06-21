import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export type TaskStatus = "open" | "done" | "cancelled";
export type TaskPriority = "none" | "low" | "medium" | "high";

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  color: string | null;
  archived: boolean | null;
}

type TaskFilter = "today" | "upcoming" | "overdue" | "completed" | "all";

export function useTasks(filter: TaskFilter = "all", projectId?: string) {
  const { user } = useAuth();

  return useQuery<Task[]>({
    queryKey: ["tasks", user?.id, filter, projectId],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let query = supabase
        .from("admin_tasks")
        .select("*")
        .is("parent_task_id", null)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (projectId) query = query.eq("project_id", projectId);

      switch (filter) {
        case "today":
          query = query
            .eq("status", "open")
            .gte("due_date", today.toISOString())
            .lt("due_date", tomorrow.toISOString());
          break;
        case "upcoming":
          query = query.eq("status", "open").gte("due_date", tomorrow.toISOString());
          break;
        case "overdue":
          query = query.eq("status", "open").lt("due_date", today.toISOString());
          break;
        case "completed":
          query = query.eq("status", "done").order("completed_at", { ascending: false, nullsFirst: false });
          break;
        default:
          query = query.neq("status", "done").neq("status", "cancelled");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    enabled: !!user,
  });
}

export function useSubtasks(parentId: string) {
  const { user } = useAuth();
  return useQuery<Task[]>({
    queryKey: ["subtasks", user?.id, parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_tasks")
        .select("*")
        .eq("parent_task_id", parentId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    enabled: !!user,
  });
}

export function useProjects() {
  const { user } = useAuth();
  return useQuery<Project[]>({
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_projects")
        .select("id, name, color, archived")
        .eq("archived", false)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Project[];
    },
    enabled: !!user,
  });
}

async function getWorkspaceId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("admin_workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("No workspace found");
  return data.workspace_id;
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (task: {
      title: string;
      notes?: string;
      due_date?: string;
      priority?: TaskPriority;
      project_id?: string;
      parent_task_id?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const wsId = await getWorkspaceId(user.id);
      const { data, error } = await supabase
        .from("admin_tasks")
        .insert({
          workspace_id: wsId,
          created_by: user.id,
          status: "open",
          priority: task.priority ?? "none",
          title: task.title,
          notes: task.notes ?? null,
          due_date: task.due_date ?? null,
          project_id: task.project_id ?? null,
          parent_task_id: task.parent_task_id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["subtasks"] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Omit<Task, "id">> & { id: string }) => {
      // If completing, set completed_at
      if (updates.status === "done" && !updates.completed_at) {
        updates.completed_at = new Date().toISOString();
      }
      const { data, error } = await supabase
        .from("admin_tasks")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["subtasks"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["subtasks"] });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (project: { name: string; color?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const wsId = await getWorkspaceId(user.id);
      const { data, error } = await supabase
        .from("admin_projects")
        .insert({ workspace_id: wsId, name: project.name, color: project.color ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
