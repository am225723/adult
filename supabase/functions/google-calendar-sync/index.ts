import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAccessToken, type CalendarAccount } from "../_shared/google.ts";

const TOKEN_ENCRYPTION_KEY = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PUSH_TTL_MS = 6 * 24 * 60 * 60 * 1000; // 6 days (Google max is 7 days)

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let calendarAccountId: string | null = null;

  // Called directly with account ID, or sync all accounts
  if (req.method === "POST") {
    try {
      const body = await req.json();
      calendarAccountId = body.calendar_account_id ?? null;
    } catch {
      // no body
    }
  }

  const accountQuery = supabase
    .from("admin_calendar_accounts")
    .select("*")
    .eq("provider", "google")
    .eq("sync_enabled", true);

  if (calendarAccountId) {
    accountQuery.eq("id", calendarAccountId);
  }

  const { data: accounts, error: fetchErr } = await accountQuery;
  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ id: string; synced?: number; error?: string }> = [];

  for (const account of (accounts ?? []) as CalendarAccount[]) {
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

async function syncAccount(account: CalendarAccount): Promise<number> {
  const accessToken = await getAccessToken(
    account,
    supabase,
    TOKEN_ENCRYPTION_KEY,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  );

  let syncedCount = 0;
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  const calId = encodeURIComponent(account.calendar_id ?? "primary");
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`;

  do {
    const params = new URLSearchParams({
      maxResults: "250",
      singleEvents: "true",
    });

    if (account.sync_token) {
      // Incremental sync
      params.set("syncToken", account.sync_token);
    } else {
      // Full sync: last 3 months + next 12 months
      const timeMin = new Date();
      timeMin.setMonth(timeMin.getMonth() - 3);
      const timeMax = new Date();
      timeMax.setFullYear(timeMax.getFullYear() + 1);
      params.set("timeMin", timeMin.toISOString());
      params.set("timeMax", timeMax.toISOString());
      params.set("orderBy", "startTime");
    }

    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${baseUrl}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // syncToken expired → do a full sync
    if (res.status === 410) {
      await supabase
        .from("admin_calendar_accounts")
        .update({ sync_token: null })
        .eq("id", account.id);
      return syncAccount({ ...account, sync_token: null });
    }

    if (!res.ok) {
      throw new Error(`Calendar API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    pageToken = data.nextPageToken;
    nextSyncToken = data.nextSyncToken;

    const items: GoogleEvent[] = data.items ?? [];
    syncedCount += await upsertEvents(items, account);
  } while (pageToken);

  // Save sync token
  await supabase
    .from("admin_calendar_accounts")
    .update({
      sync_token: nextSyncToken ?? null,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  // Ensure push channel is active
  await ensurePushChannel(account, accessToken);

  return syncedCount;
}

async function upsertEvents(
  items: GoogleEvent[],
  account: CalendarAccount,
): Promise<number> {
  if (items.length === 0) return 0;

  const toUpsert = [];
  const toDelete = [];

  for (const item of items) {
    if (item.status === "cancelled") {
      toDelete.push(item.id);
      continue;
    }

    const startRaw = item.start?.dateTime ?? item.start?.date;
    const endRaw = item.end?.dateTime ?? item.end?.date;
    if (!startRaw || !endRaw) continue;

    const allDay = !item.start?.dateTime;
    const startTime = allDay
      ? new Date(startRaw + "T00:00:00").toISOString()
      : startRaw;
    const endTime = allDay
      ? new Date(endRaw + "T00:00:00").toISOString()
      : endRaw;

    toUpsert.push({
      workspace_id: account.workspace_id,
      calendar_account_id: account.id,
      external_event_id: item.id,
      title: item.summary ?? "(No title)",
      description: item.description ?? null,
      location: item.location ?? null,
      start_time: startTime,
      end_time: endTime,
      all_day: allDay,
      recurrence_rule: item.recurrence?.join("\n") ?? null,
      source: "google",
      is_read_only: false,
      updated_at: new Date().toISOString(),
    });
  }

  let count = 0;

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("admin_calendar_events")
      .upsert(toUpsert, { onConflict: "calendar_account_id,external_event_id" });
    if (error) throw error;
    count += toUpsert.length;
  }

  if (toDelete.length > 0) {
    await supabase
      .from("admin_calendar_events")
      .delete()
      .eq("calendar_account_id", account.id)
      .in("external_event_id", toDelete);
  }

  return count;
}

async function ensurePushChannel(
  account: CalendarAccount,
  accessToken: string,
): Promise<void> {
  const now = Date.now();
  // Renew if no channel or expiring within 24h
  if (
    account.push_channel_id &&
    account.push_expiration &&
    account.push_expiration > now + 24 * 60 * 60 * 1000
  ) {
    return;
  }

  const channelId = crypto.randomUUID();
  const expiration = now + PUSH_TTL_MS;
  const calId = encodeURIComponent(account.calendar_id ?? "primary");

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: `${SUPABASE_URL}/functions/v1/google-calendar-push`,
        expiration: expiration.toString(),
      }),
    },
  );

  if (!res.ok) {
    console.error("Push channel setup failed:", await res.text());
    return;
  }

  const { resourceId } = await res.json();

  await supabase
    .from("admin_calendar_accounts")
    .update({
      push_channel_id: channelId,
      push_resource_id: resourceId,
      push_expiration: expiration,
    })
    .eq("id", account.id);
}

interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  recurrence?: string[];
}
