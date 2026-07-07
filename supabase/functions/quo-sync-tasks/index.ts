import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUO_API_KEY = Deno.env.get("QUO_API_KEY") ?? "";
const QUO_BASE = Deno.env.get("QUO_API_BASE") ?? "https://api.quo.com/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const quoHeaders = () => ({
  Authorization: QUO_API_KEY,
  "Content-Type": "application/json",
});

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function getFirstWorkspaceMemberId(workspaceId: string): Promise<string | null> {
  const { data } = await supabase
    .from("admin_workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}

function taskExternalId(task: Record<string, unknown>): string | null {
  const value = task.taskId ?? task.id;
  return typeof value === "string" && value.trim() ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function assigneeId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return asString(obj.id) ?? asString(obj.userId) ?? asString(obj.email);
  }
  return null;
}

function appStatus(task: Record<string, unknown>): "open" | "done" | "cancelled" {
  if (task.isDeleted === true || task.deleted === true) return "cancelled";
  return task.completed === true ? "done" : "open";
}

function quoStatus(task: Record<string, unknown>): "open" | "completed" {
  return task.completed === true ? "completed" : "open";
}

async function syncTasksForWorkspace(workspaceId: string) {
  const systemUserId = await getFirstWorkspaceMemberId(workspaceId);
  let pageToken: string | undefined;
  let synced = 0;
  let errors = 0;

  do {
    const params = new URLSearchParams({ maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetchWithTimeout(`${QUO_BASE}/tasks?${params}`, { headers: quoHeaders() });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to fetch tasks from Quo: ${res.status} ${text}`);
      errors++;
      break;
    }

    const payload = await res.json();
    const tasks = (payload.data || []) as Array<Record<string, unknown>>;

    for (const task of tasks) {
      const externalId = taskExternalId(task);
      if (!externalId) continue;

      try {
        const title = asString(task.title) ?? "Untitled Quo task";
        const description = asString(task.description);
        const dueDate = asString(task.dueDate);
        const assigned = assigneeId(task.assignedTo ?? task.assigneeId);
        const conversationId = asString(task.conversationId);
        const now = new Date().toISOString();

        const { error: quoErr } = await supabase.from("admin_quo_tasks").upsert({
          workspace_id: workspaceId,
          external_id: externalId,
          title,
          description,
          status: quoStatus(task),
          due_date: dueDate,
          assignee_id: assigned,
          conversation_id: conversationId,
          created_at: asString(task.createdAt) ?? now,
          updated_at: now,
          metadata: {
            taskId: externalId,
            phoneNumberId: task.phoneNumberId ?? null,
            conversationId: task.conversationId ?? null,
            activityId: task.activityId ?? null,
            assignedTo: task.assignedTo ?? null,
            assignedBy: task.assignedBy ?? null,
            createdBy: task.createdBy ?? null,
            completed: task.completed ?? false,
            isDeleted: task.isDeleted ?? false,
            revision: task.revision ?? null,
          },
        }, { onConflict: "external_id" });

        if (quoErr) {
          console.error(`Error upserting admin_quo_task ${externalId}:`, quoErr);
          errors++;
          continue;
        }

        const status = appStatus(task);
        const { error: taskErr } = await supabase.from("admin_tasks").upsert({
          workspace_id: workspaceId,
          title,
          notes: description,
          status,
          due_date: dueDate,
          source: "quo",
          external_id: externalId,
          created_by: systemUserId,
          completed_at: status === "done" ? now : null,
          tags: ["quo"],
          updated_at: now,
        }, { onConflict: "workspace_id,source,external_id" });

        if (taskErr) {
          console.error(`Error upserting admin_task ${externalId}:`, taskErr);
          errors++;
        } else {
          synced++;
        }
      } catch (err) {
        console.error(`Error processing task ${externalId}:`, err);
        errors++;
      }
    }

    pageToken = payload.nextPageToken ?? undefined;
  } while (pageToken);

  console.log(`Synced ${synced} tasks for workspace ${workspaceId}, ${errors} errors`);
  return { synced, errors };
}

async function getWorkspaceIds(): Promise<string[]> {
  const { data, error } = await supabase.from("admin_workspaces").select("id");
  if (error) {
    console.error("Error fetching workspaces:", error);
    return [];
  }
  return (data || []).map((w: Record<string, unknown>) => w.id as string).filter(Boolean);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!QUO_API_KEY) {
      return new Response(JSON.stringify({ error: "not_configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceIds = await getWorkspaceIds();
    const results = [];
    for (const workspaceId of workspaceIds) {
      results.push({ workspaceId, ...(await syncTasksForWorkspace(workspaceId)) });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
