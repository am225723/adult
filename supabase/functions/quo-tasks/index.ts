import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (error || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!QUO_API_KEY) {
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // GET /tasks - List tasks
    if (req.method === "GET" && action === "list") {
      const cursor = url.searchParams.get("cursor");
      const limit = url.searchParams.get("limit") || "50";

      const params = new URLSearchParams({ limit });
      if (cursor) params.append("after", cursor);

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks?${params}`, {
        headers: quoHeaders(),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /tasks/{taskId} - Get specific task
    if (req.method === "GET" && action === "get") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) {
        return new Response(JSON.stringify({ error: "taskId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}`, {
        headers: quoHeaders(),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /tasks - Create task
    if (req.method === "POST" && action === "create") {
      const body = await req.json().catch(() => null);
      const { title, description, conversationId, dueDate, assigneeId } = body ?? {};

      if (!title) {
        return new Response(JSON.stringify({ error: "title is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const taskBody: Record<string, unknown> = { title };
      if (description) taskBody.description = description;
      if (conversationId) taskBody.conversationId = conversationId;
      if (dueDate) taskBody.dueDate = dueDate;
      if (assigneeId) taskBody.assigneeId = assigneeId;

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks`, {
        method: "POST",
        headers: quoHeaders(),
        body: JSON.stringify(taskBody),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT /tasks/{taskId} - Update task
    if (req.method === "PUT" && action === "update") {
      const body = await req.json().catch(() => null);
      const { taskId, title, description } = body ?? {};

      if (!taskId) {
        return new Response(JSON.stringify({ error: "taskId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateBody: Record<string, unknown> = {};
      if (title) updateBody.title = title;
      if (description) updateBody.description = description;

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}`, {
        method: "PUT",
        headers: quoHeaders(),
        body: JSON.stringify(updateBody),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /tasks/{taskId} - Delete task
    if (req.method === "DELETE" && action === "delete") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) {
        return new Response(JSON.stringify({ error: "taskId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}`, {
        method: "DELETE",
        headers: quoHeaders(),
      });

      return new Response(JSON.stringify({ success: res.ok }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /tasks/{taskId}/complete - Complete task
    if (req.method === "POST" && action === "complete") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) {
        return new Response(JSON.stringify({ error: "taskId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}/complete`, {
        method: "POST",
        headers: quoHeaders(),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /tasks/{taskId}/reopen - Reopen task
    if (req.method === "POST" && action === "reopen") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) {
        return new Response(JSON.stringify({ error: "taskId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}/reopen`, {
        method: "POST",
        headers: quoHeaders(),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /tasks/{taskId}/assign - Assign task
    if (req.method === "POST" && action === "assign") {
      const body = await req.json().catch(() => null);
      const { taskId, userId } = body ?? {};

      if (!taskId || !userId) {
        return new Response(JSON.stringify({ error: "taskId and userId are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}/assign`, {
        method: "POST",
        headers: quoHeaders(),
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /tasks/{taskId}/unassign - Unassign task
    if (req.method === "POST" && action === "unassign") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) {
        return new Response(JSON.stringify({ error: "taskId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}/unassign`, {
        method: "POST",
        headers: quoHeaders(),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /tasks/{taskId}/change-due-date - Set due date
    if (req.method === "POST" && action === "changeDueDate") {
      const body = await req.json().catch(() => null);
      const { taskId, dueDate } = body ?? {};

      if (!taskId || !dueDate) {
        return new Response(JSON.stringify({ error: "taskId and dueDate are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}/change-due-date`, {
        method: "POST",
        headers: quoHeaders(),
        body: JSON.stringify({ dueDate }),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /tasks/{taskId}/link-conversation - Link to conversation
    if (req.method === "POST" && action === "linkConversation") {
      const body = await req.json().catch(() => null);
      const { taskId, conversationId } = body ?? {};

      if (!taskId || !conversationId) {
        return new Response(JSON.stringify({ error: "taskId and conversationId are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}/link-conversation`, {
        method: "POST",
        headers: quoHeaders(),
        body: JSON.stringify({ conversationId }),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
