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
    // GET /contacts - List contacts
    if (req.method === "GET" && action === "list") {
      const limit = url.searchParams.get("limit") || "50";
      const cursor = url.searchParams.get("cursor");

      const params = new URLSearchParams({ limit });
      if (cursor) params.append("after", cursor);

      const res = await fetchWithTimeout(`${QUO_BASE}/contacts?${params}`, {
        headers: quoHeaders(),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /contact-custom-fields - Get custom field definitions
    if (req.method === "GET" && action === "customFields") {
      const res = await fetchWithTimeout(`${QUO_BASE}/contact-custom-fields`, {
        headers: quoHeaders(),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET /contacts/{contactId} - Get specific contact
    if (req.method === "GET" && action === "get") {
      const contactId = url.searchParams.get("contactId");
      if (!contactId) {
        return new Response(JSON.stringify({ error: "contactId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetchWithTimeout(`${QUO_BASE}/contacts/${contactId}`, {
        headers: quoHeaders(),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST /contacts - Create contact
    if (req.method === "POST" && action === "create") {
      const body = await req.json().catch(() => null);
      const { firstName, lastName, emails, phoneNumbers, company, role, customFields, externalId } = body ?? {};

      const contactBody: Record<string, unknown> = {
        defaultFields: {},
      };

      if (firstName) (contactBody.defaultFields as Record<string, unknown>).firstName = firstName;
      if (lastName) (contactBody.defaultFields as Record<string, unknown>).lastName = lastName;
      if (company) (contactBody.defaultFields as Record<string, unknown>).company = company;
      if (role) (contactBody.defaultFields as Record<string, unknown>).role = role;
      if (emails) (contactBody.defaultFields as Record<string, unknown>).emails = emails;
      if (phoneNumbers) (contactBody.defaultFields as Record<string, unknown>).phoneNumbers = phoneNumbers;
      if (externalId) (contactBody.defaultFields as Record<string, unknown>).externalId = externalId;
      if (customFields) contactBody.customFields = customFields;

      const res = await fetchWithTimeout(`${QUO_BASE}/contacts`, {
        method: "POST",
        headers: quoHeaders(),
        body: JSON.stringify(contactBody),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PATCH /contacts/{contactId} - Update contact
    if (req.method === "PATCH" && action === "update") {
      const body = await req.json().catch(() => null);
      const { contactId, firstName, lastName, emails, phoneNumbers, company, role, customFields } = body ?? {};

      if (!contactId) {
        return new Response(JSON.stringify({ error: "contactId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateBody: Record<string, unknown> = {
        defaultFields: {},
      };

      if (firstName) (updateBody.defaultFields as Record<string, unknown>).firstName = firstName;
      if (lastName) (updateBody.defaultFields as Record<string, unknown>).lastName = lastName;
      if (company) (updateBody.defaultFields as Record<string, unknown>).company = company;
      if (role) (updateBody.defaultFields as Record<string, unknown>).role = role;
      if (emails) (updateBody.defaultFields as Record<string, unknown>).emails = emails;
      if (phoneNumbers) (updateBody.defaultFields as Record<string, unknown>).phoneNumbers = phoneNumbers;
      if (customFields) updateBody.customFields = customFields;

      const res = await fetchWithTimeout(`${QUO_BASE}/contacts/${contactId}`, {
        method: "PATCH",
        headers: quoHeaders(),
        body: JSON.stringify(updateBody),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /contacts/{contactId} - Delete contact
    if (req.method === "DELETE" && action === "delete") {
      const contactId = url.searchParams.get("contactId");
      if (!contactId) {
        return new Response(JSON.stringify({ error: "contactId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetchWithTimeout(`${QUO_BASE}/contacts/${contactId}`, {
        method: "DELETE",
        headers: quoHeaders(),
      });

      return new Response(JSON.stringify({ success: res.ok }), {
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
