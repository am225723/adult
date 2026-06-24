import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getGmailAccessToken } from "../_shared/google.ts";

const TOKEN_ENCRYPTION_KEY = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Maps system label IDs to Gmail search operators
const SYSTEM_LABEL_QUERY: Record<string, string> = {
  INBOX: "in:inbox",
  SENT: "in:sent",
  STARRED: "is:starred",
  IMPORTANT: "is:important",
  TRASH: "in:trash",
  SPAM: "in:spam",
};

function buildGmailQuery(
  syncLabels: string[] | null,
  availableLabels: { id: string; name: string }[] | null,
): string {
  if (!syncLabels?.length) return "in:inbox";

  const nameById: Record<string, string> = {};
  for (const l of availableLabels ?? []) nameById[l.id] = l.name;

  const parts: string[] = [];
  for (const labelId of syncLabels) {
    if (SYSTEM_LABEL_QUERY[labelId]) {
      parts.push(SYSTEM_LABEL_QUERY[labelId]);
    } else {
      const name = nameById[labelId];
      if (name) parts.push(`label:${name.replace(/\s+/g, "-")}`);
    }
  }

  return parts.length ? parts.join(" OR ") : "in:inbox";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let gmailAccountId: string | null = null;
  let callerUserId: string | null = null;

  if (req.method === "POST") {
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      callerUserId = user?.id ?? null;
    }

    try {
      const body = await req.json();
      gmailAccountId = body.gmail_account_id ?? null;
    } catch {
      // no body
    }
  }

  const accountQuery = supabase
    .from("admin_gmail_accounts")
    .select("*")
    .eq("provider", "google")
    .eq("sync_enabled", true);

  if (gmailAccountId) {
    accountQuery.eq("id", gmailAccountId);
    if (callerUserId) {
      accountQuery.eq("user_id", callerUserId);
    }
  }

  const { data: accounts, error: fetchErr } = await accountQuery;
  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ id: string; synced?: number; error?: string }> = [];

  for (const account of (accounts ?? []) as any[]) {
    try {
      const count = await syncAccount(account);
      results.push({ id: account.id, synced: count });
    } catch (err) {
      console.error(`Sync failed for account ${account.id}:`, err);
      results.push({ id: account.id, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function syncAccount(account: any): Promise<number> {
  const accessToken = await getGmailAccessToken(
    account,
    supabase,
    TOKEN_ENCRYPTION_KEY,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  );

  const query = buildGmailQuery(account.sync_labels, account.available_labels);

  const params = new URLSearchParams({ q: query, maxResults: "50" });

  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!listRes.ok) {
    throw new Error(`Gmail API error ${listRes.status}: ${await listRes.text()}`);
  }

  const listData = await listRes.json();
  const messageIds: string[] = listData.messages?.map((m: any) => m.id) ?? [];

  let syncedCount = 0;

  for (const msgId of messageIds) {
    const msgRes = await fetch(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(msgId)}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!msgRes.ok) continue;

    const msg = await msgRes.json();
    const headers = msg.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name === name)?.value ?? null;

    const email = {
      workspace_id: account.workspace_id,
      gmail_account_id: account.id,
      external_message_id: msgId,
      from_addr: getHeader("From"),
      to_addr: getHeader("To"),
      subject: getHeader("Subject") ?? "(No subject)",
      snippet: msg.snippet ?? "",
      body: extractBody(msg.payload),
      received_at: new Date(parseInt(msg.internalDate || 0)).toISOString(),
      is_read: !msg.labelIds?.includes("UNREAD"),
      is_starred: msg.labelIds?.includes("STARRED") ?? false,
      labels: msg.labelIds ?? [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("admin_emails")
      .upsert(email, { onConflict: "gmail_account_id,external_message_id" });

    if (!error) syncedCount++;
  }

  await supabase
    .from("admin_gmail_accounts")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", account.id);

  return syncedCount;
}

function extractBody(payload: any): string {
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
      }
    }
  }
  if (payload.body?.data) {
    return atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
  }
  return "";
}
