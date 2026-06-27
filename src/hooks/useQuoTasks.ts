import { useState } from "react";
import { supabase } from "@/lib/supabase";

export interface QuoTask {
  id: string;
  title: string;
  description?: string;
  status: "open" | "completed";
  dueDate?: string;
  assigneeId?: string;
  conversationId?: string;
  createdAt: string;
  updatedAt: string;
}

export function useQuoTasks() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getTasks = async (cursor?: string, limit: string = "50"): Promise<{
    tasks: QuoTask[];
    nextCursor?: string;
  }> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const params = new URLSearchParams({
        action: "list",
        limit,
      });
      if (cursor) params.append("cursor", cursor);

      const response = await fetch(
        `/functions/v1/quo-tasks?${params}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        tasks: result.data || [],
        nextCursor: result.pageInfo?.endCursor,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getTask = async (taskId: string): Promise<QuoTask> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/functions/v1/quo-tasks?action=get&taskId=${taskId}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch task: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (
    title: string,
    options?: {
      description?: string;
      conversationId?: string;
      dueDate?: string;
      assigneeId?: string;
    }
  ): Promise<QuoTask> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        "/functions/v1/quo-tasks?action=create",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            ...options,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create task: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTask = async (
    taskId: string,
    updates: {
      title?: string;
      description?: string;
    }
  ): Promise<QuoTask> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        "/functions/v1/quo-tasks?action=update",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskId,
            ...updates,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update task: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (taskId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/functions/v1/quo-tasks?action=delete&taskId=${taskId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete task: ${response.statusText}`);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const completeTask = async (taskId: string): Promise<QuoTask> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/functions/v1/quo-tasks?action=complete&taskId=${taskId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to complete task: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reopenTask = async (taskId: string): Promise<QuoTask> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `/functions/v1/quo-tasks?action=reopen&taskId=${taskId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to reopen task: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const assignTask = async (taskId: string, userId: string): Promise<QuoTask> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        "/functions/v1/quo-tasks?action=assign",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ taskId, userId }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to assign task: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const changeDueDate = async (taskId: string, dueDate: string): Promise<QuoTask> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        "/functions/v1/quo-tasks?action=changeDueDate",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ taskId, dueDate }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to change due date: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const linkConversation = async (
    taskId: string,
    conversationId: string
  ): Promise<QuoTask> => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        "/functions/v1/quo-tasks?action=linkConversation",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ taskId, conversationId }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to link conversation: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

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
