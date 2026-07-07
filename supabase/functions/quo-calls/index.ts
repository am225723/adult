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
  const callId = url.searchParams.get("callId");

  try {
    if (req.method === "GET" && action === "recordings") {
      if (!callId) {
        return new Response(JSON.stringify({ error: "callId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetchWithTimeout(`${QUO_BASE}/call-recordings/${callId}`, { headers: quoHeaders() });
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && action === "transcript") {
      if (!callId) {
        return new Response(JSON.stringify({ error: "callId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetchWithTimeout(`${QUO_BASE}/call-transcripts/${callId}`, { headers: quoHeaders() });
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && action === "summary") {
      if (!callId) {
        return new Response(JSON.stringify({ error: "callId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetchWithTimeout(`${QUO_BASE}/call-summaries/${callId}`, { headers: quoHeaders() });
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && action === "voicemail") {
      if (!callId) {
        return new Response(JSON.stringify({ error: "callId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetchWithTimeout(`${QUO_BASE}/call-voicemails/${callId}`, { headers: quoHeaders() });
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneNumberId = url.searchParams.get("phoneNumberId");
    const participants = [
      ...url.searchParams.getAll("participants"),
      ...url.searchParams.getAll("participant"),
    ];
    const filter = url.searchParams.get("filter");

    if (!phoneNumberId) {
      return new Response(JSON.stringify({ error: "phoneNumberId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (participants.length === 0) {
      return new Response(JSON.stringify({ error: "at least one participant is required for Quo call history" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({ phoneNumberId, maxResults: url.searchParams.get("maxResults") ?? "50" });
    // Quo list calls is currently 1:1 only, so use the first provided participant.
    appendArrayParam(params, "participants", [participants[0]]);
    for (const key of ["userId", "createdAfter", "createdBefore", "pageToken"]) {
      const value = url.searchParams.get(key);
      if (value) params.set(key, value);
    }

    const res = await fetchWithTimeout(`${QUO_BASE}/calls?${params}`, {
      headers: quoHeaders(),
    });

    if (!res.ok) {
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    let calls: any[] = data.data ?? [];

    if (filter === "missed") {
      calls = calls.filter(
        (c: any) => c.status === "missed" || c.status === "no-answer" || c.status === "abandoned",
      );
    }

    return new Response(JSON.stringify({ data: calls, nextPageToken: data.nextPageToken }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
