import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAccessToken } from "../_shared/google.ts";

const TOKEN_ENCRYPTION_KEY = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let gmailAccountId: string | null = null;

  if (req.method === "POST") {
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

async function syncAccount(account: any, retryCount = 0): Promise<number> {
  const accessToken = await getAccessToken(
    account,
    supabase,
    TOKEN_ENCRYPTION_KEY,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  );

  let syncedCount = 0;
  let pageToken: string | undefined;
  let historyId: string | undefined;

  // Get inbox messages (fetch last 50 for now; in production use historyId for incremental)
  const params = new URLSearchParams({
    q: "in:inbox",
    maxResults: "50",
  });

  if (account.sync_token) {
    params.set("pageToken", account.sync_token);
  }

  const listRes = await fetch(
    `https://www.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!listRes.ok) {
    if (listRes.status === 410 && retryCount < 1) {
      // Incremental token expired, do full sync
      await supabase
        .from("admin_gmail_accounts")
        .update({ sync_token: null })
        .eq("id", account.id);
      return syncAccount({ ...account, sync_token: null }, retryCount + 1);
    }
    throw new Error(`Gmail API error ${listRes.status}: ${await listRes.text()}`);
  }

  const listData = await listRes.json();
  pageToken = listData.nextPageToken;
  historyId = listData.resultSizeEstimate ? String(listData.resultSizeEstimate) : undefined;

  const messageIds: string[] = listData.messages?.map((m: any) => m.id) ?? [];

  // Fetch full message details
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
      from: getHeader("From"),
      to: getHeader("To"),
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

  // Save sync token
  await supabase
    .from("admin_gmail_accounts")
    .update({
      sync_token: pageToken ?? null,
      last_synced_at: new Date().toISOString(),
    })
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
