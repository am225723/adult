import { useState } from "react";
import { supabase } from "@/lib/supabase";

export interface QuoTask {
  id?: string;
  taskId?: string;
  title: string;
  description?: string;
  completed?: boolean;
  status?: "open" | "completed" | string;
  dueDate?: string;
  assignedTo?: string;
  assigneeId?: string;
  conversationId?: string;
  activityId?: string;
  phoneNumberId?: string;
  createdAt?: string;
  updatedAt?: string;
  revision?: number;
}

async function getSessionToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.access_token;
}

async function parseResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error ?? `${fallbackError}: ${response.statusText}`);
  return (result?.data ?? result) as T;
}

export function useQuoTasks() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    try {
      setLoading(true);
      setError(null);
      return await fn(await getSessionToken());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getTasks = async (cursor?: string, limit: string = "50") => run(async (token) => {
    const params = new URLSearchParams({ action: "list", maxResults: limit });
    if (cursor) params.append("pageToken", cursor);
    const response = await fetch(`/functions/v1/quo-tasks?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error ?? `Failed to fetch tasks: ${response.statusText}`);
    return { tasks: result.data || [], nextCursor: result.nextPageToken } as { tasks: QuoTask[]; nextCursor?: string };
  });

  const getTask = async (taskId: string): Promise<QuoTask> => run(async (token) => {
    const response = await fetch(`/functions/v1/quo-tasks?action=get&taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return await parseResponse<QuoTask>(response, "Failed to fetch task");
  });

  const createTask = async (
    title: string,
    options?: {
      description?: string;
      phoneNumberId?: string;
      conversationId?: string;
      activityId?: string;
      dueDate?: string;
      assigneeId?: string;
      assignedTo?: string;
    }
  ): Promise<QuoTask> => run(async (token) => {
    const response = await fetch("/functions/v1/quo-tasks?action=create", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ title, ...options }),
    });
    return await parseResponse<QuoTask>(response, "Failed to create task");
  });

  const updateTask = async (taskId: string, updates: { title?: string; description?: string }): Promise<QuoTask> => run(async (token) => {
    const response = await fetch("/functions/v1/quo-tasks?action=update", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, ...updates }),
    });
    return await parseResponse<QuoTask>(response, "Failed to update task");
  });

  const deleteTask = async (taskId: string): Promise<boolean> => run(async (token) => {
    const response = await fetch(`/functions/v1/quo-tasks?action=delete&taskId=${encodeURIComponent(taskId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Failed to delete task: ${response.statusText}`);
    return true;
  });

  const postTaskAction = async (taskId: string, action: string, body?: Record<string, unknown>): Promise<QuoTask> => run(async (token) => {
    const response = await fetch(`/functions/v1/quo-tasks?action=${action}&taskId=${encodeURIComponent(taskId)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify({ taskId, ...body }) : undefined,
    });
    return await parseResponse<QuoTask>(response, `Failed to ${action} task`);
  });

  const completeTask = (taskId: string) => postTaskAction(taskId, "complete");
  const reopenTask = (taskId: string) => postTaskAction(taskId, "reopen");
  const assignTask = (taskId: string, userId: string) => postTaskAction(taskId, "assign", { userId });
  const changeDueDate = (taskId: string, dueDate: string) => postTaskAction(taskId, "changeDueDate", { dueDate });
  const linkConversation = (taskId: string, conversationId: string) => postTaskAction(taskId, "linkConversation", { conversationId });

  return {
    loading,
    error,
    getTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    reopenTask,
    assignTask,
    changeDueDate,
    linkConversation,
  };
}
