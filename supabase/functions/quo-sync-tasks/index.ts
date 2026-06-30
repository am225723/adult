import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const QUO_API_KEY = Deno.env.get("QUO_API_KEY") ?? "";
const QUO_BASE = Deno.env.get("QUO_API_BASE") ?? "https://api.quo.com/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const quoHeaders = () => ({
  Authorization: QUO_API_KEY,
  "Content-Type": "application/json",
});

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

async function getFirstWorkspaceMemberId(workspaceId: string): Promise<string | null> {
  const { data } = await supabase.from("admin_workspace_members").select("user_id").eq("workspace_id", workspaceId).limit(1).maybeSingle();
  return data?.user_id ?? null;
}

async function syncTasksForWorkspace(workspaceId: string) {
  try {
    const systemUserId = await getFirstWorkspaceMemberId(workspaceId);
    let after: string | undefined;
    let hasMore = true;
    let synced = 0;
    let errors = 0;

    while (hasMore) {
      const params = new URLSearchParams({ limit: "100" });
      if (after) params.append("after", after);

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks?${params}`, {
        headers: quoHeaders(),
      });

      if (!res.ok) {
        console.error(`Failed to fetch tasks from Quo: ${res.statusText}`);
        errors++;
        break;
      }

      const data = await res.json();
      const tasks = (data.data || []) as Array<Record<string, unknown>>;

      for (const task of tasks) {
        try {
          const { error } = await supabase.from("admin_quo_tasks").upsert({
            workspace_id: workspaceId,
            external_id: task.id,
            title: task.title,
            description: task.description,
            status: task.status || "open",
            due_date: task.dueDate,
            assignee_id: task.assigneeId,
            conversation_id: task.conversationId,
            created_at: task.createdAt,
            updated_at: task.updatedAt,
            metadata: { external_task_id: task.id },
          });

          if (error) {
            console.error(`Error upserting quo_task ${task.id}:`, error);
            errors++;
          } else {
            // Also sync into admin_tasks so they appear in the app task list
            const appStatus = task.status === "done" ? "done" : (task.status === "cancelled" ? "cancelled" : "todo");
            const { error: taskErr } = await supabase.from("admin_tasks").upsert({
              workspace_id: workspaceId,
              title: task.title as string,
              notes: task.description as string ?? null,
              status: appStatus,
              due_date: task.dueDate ?? null,
              source: "quo",
              external_id: task.id as string,
              created_by: systemUserId,
              tags: ["quo"],
              updated_at: new Date().toISOString(),
            }, { onConflict: "workspace_id,source,external_id" });
            if (taskErr) console.error(`Error upserting admin_task ${task.id}:`, taskErr);
            synced++;
          }
        } catch (err) {
          console.error(`Error processing task ${task.id}:`, err);
          errors++;
        }
      }

      after = data.pageInfo?.endCursor;
      hasMore = !!after && tasks.length > 0;
    }

    console.log(`Synced ${synced} tasks for workspace ${workspaceId}, ${errors} errors`);
    return { synced, errors };
  } catch (err) {
    console.error(`Error syncing tasks for workspace ${workspaceId}:`, err);
    throw err;
  }
}

async function getWorkspaceIds(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("admin_workspaces")
      .select("id")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching workspaces:", error);
      return [];
    }

    return (data || []).map((w: Record<string, unknown>) => w.id as string);
  } catch (err) {
    console.error("Error getting workspace IDs:", err);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (!QUO_API_KEY) {
      return new Response(JSON.stringify({ error: "not_configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const workspaceIds = await getWorkspaceIds();
    const results = [];

    for (const workspaceId of workspaceIds) {
      const result = await syncTasksForWorkspace(workspaceId);
      results.push({ workspaceId, ...result });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
