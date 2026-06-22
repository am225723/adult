import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const QUO_API_KEY = Deno.env.get("QUO_API_KEY") ?? "";
const QUO_BASE = Deno.env.get("QUO_API_BASE") ?? "https://api.openphone.com/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const quoHeaders = () => ({
  Authorization: QUO_API_KEY,
  "Content-Type": "application/json",
});

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
      const res = await fetch(`${QUO_BASE}/phone-numbers`, { headers: quoHeaders() });
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && action === "messages") {
      const phoneNumberId = url.searchParams.get("phoneNumberId");
      const participant = url.searchParams.get("participant");
      const pageToken = url.searchParams.get("pageToken");

      if (!phoneNumberId) {
        return new Response(JSON.stringify({ error: "phoneNumberId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const params = new URLSearchParams({ phoneNumberId, maxResults: "50" });
      if (participant) params.append("participants[]", participant);
      if (pageToken) params.set("pageToken", pageToken);

      const res = await fetch(`${QUO_BASE}/messages?${params}`, { headers: quoHeaders() });
      return new Response(await res.text(), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const { from, to, content } = await req.json();
      const res = await fetch(`${QUO_BASE}/messages`, {
        method: "POST",
        headers: quoHeaders(),
        body: JSON.stringify({ from, to, content }),
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
