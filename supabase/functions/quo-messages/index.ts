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
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

function appendArrayParam(params: URLSearchParams, key: string, values: string[]) {
  values.map((v) => v.trim()).filter(Boolean).forEach((v) => params.append(key, v));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    const { data: { user }, error } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (error || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } else {
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
    if (req.method === "GET" && action === "phone-numbers") {
      const res = await fetchWithTimeout(`${QUO_BASE}/phone-numbers`, {
        headers: quoHeaders(),
      });
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && action === "conversations") {
      const params = new URLSearchParams({ maxResults: url.searchParams.get("maxResults") ?? "50" });
      const phoneNumbers = url.searchParams.getAll("phoneNumbers");
      const phoneNumber = url.searchParams.get("phoneNumber") || url.searchParams.get("phoneNumberId");
      if (phoneNumbers.length > 0) appendArrayParam(params, "phoneNumbers", phoneNumbers);
      if (phoneNumber) params.append("phoneNumbers", phoneNumber);
      for (const key of ["userId", "createdAfter", "createdBefore", "updatedAfter", "updatedBefore", "excludeInactive", "pageToken"]) {
        const value = url.searchParams.get(key);
        if (value) params.set(key, value);
      }

      const res = await fetchWithTimeout(`${QUO_BASE}/conversations?${params}`, {
        headers: quoHeaders(),
      });
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && action === "messages") {
      const phoneNumberId = url.searchParams.get("phoneNumberId");
      const participants = [
        ...url.searchParams.getAll("participants"),
        ...url.searchParams.getAll("participant"),
      ];
      const pageToken = url.searchParams.get("pageToken");

      if (!phoneNumberId) {
        return new Response(JSON.stringify({ error: "phoneNumberId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (participants.length === 0) {
        return new Response(JSON.stringify({ error: "at least one participant is required for Quo message history" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const params = new URLSearchParams({ phoneNumberId, maxResults: url.searchParams.get("maxResults") ?? "50" });
      appendArrayParam(params, "participants", participants);
      for (const key of ["userId", "createdAfter", "createdBefore"]) {
        const value = url.searchParams.get(key);
        if (value) params.set(key, value);
      }
      if (pageToken) params.set("pageToken", pageToken);

      const res = await fetchWithTimeout(`${QUO_BASE}/messages?${params}`, {
        headers: quoHeaders(),
      });
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const { from, to, content, userId, setInboxStatus } = body ?? {};

      if (!from || !to || !content) {
        return new Response(JSON.stringify({ error: "from, to, and content are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload: Record<string, unknown> = {
        from,
        to: Array.isArray(to) ? to : [to],
        content,
      };
      if (userId) payload.userId = userId;
      if (setInboxStatus) payload.setInboxStatus = setInboxStatus;

      const res = await fetchWithTimeout(`${QUO_BASE}/messages`, {
        method: "POST",
        headers: quoHeaders(),
        body: JSON.stringify(payload),
      });
      return new Response(await res.text(), {
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
