import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUO_API_KEY = Deno.env.get("QUO_API_KEY") ?? "";
const QUO_BASE = Deno.env.get("QUO_API_BASE") ?? "https://api.openphone.com/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function quoFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${QUO_BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  return fetch(url.toString(), {
    headers: { Authorization: QUO_API_KEY, "Content-Type": "application/json" },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

async function getWorkspaceId(userId: string): Promise<string | null> {
  const { data } = await db.from("admin_workspace_members").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle();
  return data?.workspace_id ?? null;
}

async function resolveContacts(workspaceId: string, phones: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(phones.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await db.from("admin_contacts").select("id, primary_phone").eq("workspace_id", workspaceId).in("primary_phone", unique);
  const map = new Map<string, string>();
  for (const row of data ?? []) if (row.primary_phone) map.set(row.primary_phone, row.id);
  return map;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: { user }, error: authErr } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authErr || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!QUO_API_KEY) return new Response(JSON.stringify({ error: "QUO_API_KEY not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const workspaceId = await getWorkspaceId(user.id);
  if (!workspaceId) return new Response(JSON.stringify({ error: "no workspace found" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const pnRes = await quoFetch("/phone-numbers");
    if (!pnRes.ok) {
      const text = await pnRes.text();
      return new Response(JSON.stringify({ error: `OpenPhone error: ${text}` }), { status: pnRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const phoneNumbers: Array<{ id: string; number: string; name?: string }> = (await pnRes.json()).data ?? [];
    let totalMessages = 0, totalCalls = 0;
    const fetchErrors: string[] = [];

    // Fetch the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const pn of phoneNumbers) {
      const { data: existingAcct } = await db.from("admin_phone_accounts").select("id, workspace_id").eq("quo_account_id", pn.id).maybeSingle();
      if (existingAcct && existingAcct.workspace_id !== workspaceId) continue;

      const { data: acct, error: acctErr } = await db.from("admin_phone_accounts")
        .upsert({ workspace_id: workspaceId, quo_account_id: pn.id, phone_number: pn.number, last_synced_at: new Date().toISOString() }, { onConflict: "quo_account_id" })
        .select("id").single();
      if (acctErr) throw acctErr;
      const phoneAccountId = acct.id as string;

      // Messages
      const msgPayload = { phoneNumberId: pn.id, participants: [], maxResults: 100, createdAfter: sevenDaysAgo };
      const msgController = new AbortController();
      const msgTimer = setTimeout(() => msgController.abort(), 10_000);
      const msgRes = await fetch(`${QUO_BASE}/messages`, {
        method: "POST",
        headers: { Authorization: QUO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(msgPayload),
        signal: msgController.signal,
      }).finally(() => clearTimeout(msgTimer));
      if (!msgRes.ok) {
        const errText = await msgRes.text();
        const msg = `messages fetch failed for ${pn.number} (${pn.id}): ${msgRes.status} ${errText}`;
        console.error(`[quo-sync] ${msg}`);
        fetchErrors.push(msg);
      } else {
        const messages: Array<{ id: string; from: string; to: string[]; body: string; direction: string; createdAt: string }> = (await msgRes.json()).data ?? [];
        console.log(`[quo-sync] ${pn.number}: fetched ${messages.length} messages`);
        if (messages.length > 0) {
          const externalPhones = messages.map((m) => m.direction === "incoming" ? m.from : (m.to?.[0] ?? ""));
          const contactMap = await resolveContacts(workspaceId, externalPhones);
          const rows = messages.map((m) => { const ep = m.direction === "incoming" ? m.from : (m.to?.[0] ?? ""); return { workspace_id: workspaceId, phone_account_id: phoneAccountId, external_id: m.id, direction: m.direction, body: m.body ?? "", is_read: m.direction === "outgoing", occurred_at: m.createdAt, contact_id: contactMap.get(ep) ?? null }; });
          const { error: upsertErr } = await db.from("admin_phone_messages").upsert(rows, { onConflict: "external_id", ignoreDuplicates: true });
          if (upsertErr) { console.error(`[quo-sync] messages upsert error: ${JSON.stringify(upsertErr)}`); throw upsertErr; }
          totalMessages += messages.length;
        }
      }

      // Calls
      const callPayload = { phoneNumberId: pn.id, participants: [], maxResults: 100, createdAfter: sevenDaysAgo };
      const callController = new AbortController();
      const callTimer = setTimeout(() => callController.abort(), 10_000);
      const callRes = await fetch(`${QUO_BASE}/calls`, {
        method: "POST",
        headers: { Authorization: QUO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(callPayload),
        signal: callController.signal,
      }).finally(() => clearTimeout(callTimer));
      if (!callRes.ok) {
        const errText = await callRes.text();
        const msg = `calls fetch failed for ${pn.number} (${pn.id}): ${callRes.status} ${errText}`;
        console.error(`[quo-sync] ${msg}`);
        fetchErrors.push(msg);
      } else {
        const calls: Array<{ id: string; from: string; to: string; direction: string; status: string; duration: number; createdAt: string; recording?: { transcript?: string; url?: string } }> = (await callRes.json()).data ?? [];
        console.log(`[quo-sync] ${pn.number}: fetched ${calls.length} calls`);
        if (calls.length > 0) {
          const externalPhones = calls.map((c) => c.direction === "incoming" ? c.from : c.to);
          const contactMap = await resolveContacts(workspaceId, externalPhones);
          const rows = calls.map((c) => { const ep = c.direction === "incoming" ? c.from : c.to; return { workspace_id: workspaceId, phone_account_id: phoneAccountId, external_id: c.id, direction: c.direction, status: c.status, duration_seconds: c.duration ?? null, voicemail_transcript: c.recording?.transcript ?? null, voicemail_url: c.recording?.url ?? null, occurred_at: c.createdAt, contact_id: contactMap.get(ep) ?? null }; });
          const { error: upsertErr } = await db.from("admin_phone_calls").upsert(rows, { onConflict: "external_id", ignoreDuplicates: true });
          if (upsertErr) { console.error(`[quo-sync] calls upsert error: ${JSON.stringify(upsertErr)}`); throw upsertErr; }
          totalCalls += calls.length;
        }
      }
    }

    const body: Record<string, unknown> = { phoneNumbers: phoneNumbers.length, messages: totalMessages, calls: totalCalls };
    if (fetchErrors.length > 0) body.fetchErrors = fetchErrors;
    const status = fetchErrors.length > 0 ? 207 : 200;
    return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
