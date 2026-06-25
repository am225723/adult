/**
 * Quo Sync — Supabase Edge Function
 *
 * Fetches messages and calls from the OpenPhone API and upserts them into
 * admin_phone_messages / admin_phone_calls.  Idempotent via external_id.
 *
 * Required Supabase secret:
 *   QUO_API_KEY  — OpenPhone API key
 *
 * POST (no body required) — syncs all phone numbers for the authenticated user's workspace.
 * Returns { phoneNumbers: number, messages: number, calls: number }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const QUO_API_KEY = Deno.env.get("QUO_API_KEY") ?? "";
const QUO_BASE = Deno.env.get("QUO_API_BASE") ?? "https://api.openphone.com/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function quoFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${QUO_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  return fetch(url.toString(), {
    headers: { Authorization: QUO_API_KEY, "Content-Type": "application/json" },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

async function getWorkspaceId(userId: string): Promise<string | null> {
  const { data } = await db
    .from("admin_workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.workspace_id ?? null;
}

/** Resolve a batch of E.164 phone numbers to contact IDs within the workspace. */
async function resolveContacts(
  workspaceId: string,
  phones: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(phones.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await db
    .from("admin_contacts")
    .select("id, primary_phone")
    .eq("workspace_id", workspaceId)
    .in("primary_phone", unique);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.primary_phone) map.set(row.primary_phone, row.id);
  }
  return map;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: { user }, error: authErr } = await db.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!QUO_API_KEY) {
    return new Response(JSON.stringify({ error: "QUO_API_KEY not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) {
    return new Response(JSON.stringify({ error: "no workspace found" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Fetch phone numbers
    const pnRes = await quoFetch("/phone-numbers");
    if (!pnRes.ok) {
      const text = await pnRes.text();
      return new Response(JSON.stringify({ error: `OpenPhone error: ${text}` }), {
        status: pnRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const pnData = await pnRes.json();
    const phoneNumbers: Array<{ id: string; number: string; name?: string }> =
      pnData.data ?? [];

    let totalMessages = 0;
    let totalCalls = 0;

    for (const pn of phoneNumbers) {
      // 2. Security: skip phone accounts already claimed by a different workspace
      const { data: existingAcct } = await db
        .from("admin_phone_accounts")
        .select("id, workspace_id")
        .eq("quo_account_id", pn.id)
        .maybeSingle();

      if (existingAcct && existingAcct.workspace_id !== workspaceId) {
        // This OpenPhone number is registered to another workspace — do not overwrite.
        continue;
      }

      // 3. Upsert phone account and retrieve its internal ID in one shot
      const { data: acct, error: acctErr } = await db
        .from("admin_phone_accounts")
        .upsert(
          {
            workspace_id: workspaceId,
            quo_account_id: pn.id,
            phone_number: pn.number,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "quo_account_id" },
        )
        .select("id")
        .single();

      if (acctErr) throw acctErr;
      const phoneAccountId = acct.id as string;

      // 4. Fetch & upsert messages (most recent 50)
      const msgRes = await quoFetch("/messages", {
        phoneNumberId: pn.id,
        maxResults: "50",
      });
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        const messages: Array<{
          id: string;
          from: string;
          to: string[];
          body: string;
          direction: string;
          createdAt: string;
        }> = msgData.data ?? [];

        if (messages.length > 0) {
          // Resolve contact_id from the external party's phone number so ChatPage
          // can group conversations correctly (instead of everything → "Unknown").
          const externalPhones = messages.map((m) =>
            m.direction === "incoming" ? m.from : (m.to?.[0] ?? ""),
          );
          const contactMap = await resolveContacts(workspaceId, externalPhones);

          const rows = messages.map((m) => {
            const externalPhone =
              m.direction === "incoming" ? m.from : (m.to?.[0] ?? "");
            return {
              workspace_id: workspaceId,
              phone_account_id: phoneAccountId,
              external_id: m.id,
              direction: m.direction,
              body: m.body ?? "",
              // Only set is_read on new rows; ignoreDuplicates preserves existing read state.
              is_read: m.direction === "outgoing",
              occurred_at: m.createdAt,
              contact_id: contactMap.get(externalPhone) ?? null,
            };
          });

          // ignoreDuplicates: true — skip rows that already exist so their
          // is_read state (potentially marked read by the user) is preserved.
          const { error: upsertErr } = await db
            .from("admin_phone_messages")
            .upsert(rows, { onConflict: "external_id", ignoreDuplicates: true });

          if (upsertErr) throw upsertErr;
          totalMessages += messages.length;
        }
      }

      // 5. Fetch & upsert calls (most recent 50)
      const callRes = await quoFetch("/calls", {
        phoneNumberId: pn.id,
        maxResults: "50",
      });
      if (callRes.ok) {
        const callData = await callRes.json();
        const calls: Array<{
          id: string;
          from: string;
          to: string;
          direction: string;
          status: string;
          duration: number;
          createdAt: string;
          recording?: { transcript?: string; url?: string };
        }> = callData.data ?? [];

        if (calls.length > 0) {
          const externalPhones = calls.map((c) =>
            c.direction === "incoming" ? c.from : c.to,
          );
          const contactMap = await resolveContacts(workspaceId, externalPhones);

          const rows = calls.map((c) => {
            const externalPhone = c.direction === "incoming" ? c.from : c.to;
            return {
              workspace_id: workspaceId,
              phone_account_id: phoneAccountId,
              external_id: c.id,
              direction: c.direction,
              status: c.status,
              duration_seconds: c.duration ?? null,
              voicemail_transcript: c.recording?.transcript ?? null,
              voicemail_url: c.recording?.url ?? null,
              occurred_at: c.createdAt,
              contact_id: contactMap.get(externalPhone) ?? null,
            };
          });

          const { error: upsertErr } = await db
            .from("admin_phone_calls")
            .upsert(rows, { onConflict: "external_id", ignoreDuplicates: true });

          if (upsertErr) throw upsertErr;
          totalCalls += calls.length;
        }
      }
    }

    return new Response(
      JSON.stringify({ phoneNumbers: phoneNumbers.length, messages: totalMessages, calls: totalCalls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
