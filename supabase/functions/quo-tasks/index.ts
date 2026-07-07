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

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function proxy(res: Response) {
  return new Response(await res.text(), {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getDefaultPhoneNumberId(): Promise<string | null> {
  const res = await fetchWithTimeout(`${QUO_BASE}/phone-numbers`, { headers: quoHeaders() });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return json?.data?.[0]?.id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (!QUO_API_KEY) {
    return new Response(JSON.stringify({ error: "not_configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (req.method === "GET" && action === "list") {
      const pageToken = url.searchParams.get("pageToken") ?? url.searchParams.get("cursor");
      const maxResults = url.searchParams.get("maxResults") ?? url.searchParams.get("limit") ?? "50";
      const params = new URLSearchParams({ maxResults });
      if (pageToken) params.set("pageToken", pageToken);
      return await proxy(await fetchWithTimeout(`${QUO_BASE}/tasks?${params}`, { headers: quoHeaders() }));
    }

    if (req.method === "GET" && action === "get") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) return new Response(JSON.stringify({ error: "taskId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return await proxy(await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}`, { headers: quoHeaders() }));
    }

    if (req.method === "POST" && action === "create") {
      const body = await req.json().catch(() => null);
      const { title, description, phoneNumberId, conversationId, activityId, dueDate, assigneeId, assignedTo } = body ?? {};
      if (!title) return new Response(JSON.stringify({ error: "title is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const fallbackPhoneNumberId = !phoneNumberId && !conversationId && !activityId ? await getDefaultPhoneNumberId() : null;
      const payload: Record<string, unknown> = { title, description: description ?? "" };
      if (dueDate) payload.dueDate = dueDate;
      if (assigneeId || assignedTo) payload.assignedTo = assigneeId ?? assignedTo;
      if (conversationId) payload.conversationId = conversationId;
      else if (activityId) payload.activityId = activityId;
      else if (phoneNumberId || fallbackPhoneNumberId) payload.phoneNumberId = phoneNumberId ?? fallbackPhoneNumberId;
      else return new Response(JSON.stringify({ error: "phoneNumberId, conversationId, or activityId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      return await proxy(await fetchWithTimeout(`${QUO_BASE}/tasks`, { method: "POST", headers: quoHeaders(), body: JSON.stringify(payload) }));
    }

    if (req.method === "PUT" && action === "update") {
      const body = await req.json().catch(() => null);
      const { taskId, title, description } = body ?? {};
      if (!taskId) return new Response(JSON.stringify({ error: "taskId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const payload: Record<string, unknown> = {};
      if (title !== undefined) payload.title = title;
      if (description !== undefined) payload.description = description;
      return await proxy(await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}`, { method: "PUT", headers: quoHeaders(), body: JSON.stringify(payload) }));
    }

    if (req.method === "DELETE" && action === "delete") {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) return new Response(JSON.stringify({ error: "taskId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return await proxy(await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}`, { method: "DELETE", headers: quoHeaders() }));
    }

    const taskActionPath: Record<string, string> = {
      complete: "complete",
      reopen: "reopen",
      unassign: "unassign",
      removeDueDate: "remove-due-date",
      unlinkConversation: "unlink-conversation",
    };

    if (req.method === "POST" && action && taskActionPath[action]) {
      const taskId = url.searchParams.get("taskId");
      if (!taskId) return new Response(JSON.stringify({ error: "taskId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return await proxy(await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}/${taskActionPath[action]}`, { method: "POST", headers: quoHeaders() }));
    }

    if (req.method === "POST" && action === "assign") {
      const body = await req.json().catch(() => null);
      const { taskId, userId } = body ?? {};
      if (!taskId || !userId) return new Response(JSON.stringify({ error: "taskId and userId are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return await proxy(await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}/assign`, { method: "POST", headers: quoHeaders(), body: JSON.stringify({ userId }) }));
    }

    if (req.method === "POST" && action === "changeDueDate") {
      const body = await req.json().catch(() => null);
      const { taskId, dueDate } = body ?? {};
      if (!taskId || !dueDate) return new Response(JSON.stringify({ error: "taskId and dueDate are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return await proxy(await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}/change-due-date`, { method: "POST", headers: quoHeaders(), body: JSON.stringify({ dueDate }) }));
    }

    if (req.method === "POST" && action === "linkConversation") {
      const body = await req.json().catch(() => null);
      const { taskId, conversationId } = body ?? {};
      if (!taskId || !conversationId) return new Response(JSON.stringify({ error: "taskId and conversationId are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return await proxy(await fetchWithTimeout(`${QUO_BASE}/tasks/${taskId}/link-conversation`, { method: "POST", headers: quoHeaders(), body: JSON.stringify({ conversationId }) }));
    }

    return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
