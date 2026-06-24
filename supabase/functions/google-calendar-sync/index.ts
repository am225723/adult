import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAccessToken, type CalendarAccount } from "../_shared/google.ts";

const TOKEN_ENCRYPTION_KEY = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PUSH_TTL_MS = 6 * 24 * 60 * 60 * 1000; // 6 days

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let calendarAccountId: string | null = null;

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

  const calendarIds = account.selected_calendar_ids?.length
    ? account.selected_calendar_ids
    : [account.calendar_id ?? "primary"];

  const syncTokenMap: Record<string, string | null> = { ...(account.sync_tokens ?? {}) };
  let totalSynced = 0;

  for (const calId of calendarIds) {
    try {
      const { synced, nextSyncToken } = await syncOneCalendar(
        account,
        calId,
        syncTokenMap[calId] ?? null,
        accessToken,
      );
      totalSynced += synced;
      if (nextSyncToken) {
        syncTokenMap[calId] = nextSyncToken;
      } else {
        delete syncTokenMap[calId];
      }
    } catch (err) {
      console.error(`Failed to sync calendar ${calId} for account ${account.id}:`, err);
    }
  }

  await supabase
    .from("admin_calendar_accounts")
    .update({
      sync_tokens: syncTokenMap,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  // Push channel watches the first selected calendar (or primary)
  await ensurePushChannel(account, calendarIds[0] ?? "primary", accessToken);

  return totalSynced;
}

async function syncOneCalendar(
  account: CalendarAccount,
  calendarId: string,
  syncToken: string | null,
  accessToken: string,
  retryCount = 0,
): Promise<{ synced: number; nextSyncToken: string | null }> {
  let syncedCount = 0;
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  const calId = encodeURIComponent(calendarId);
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`;

  do {
    const params = new URLSearchParams({
      maxResults: "250",
      singleEvents: "true",
    });

    if (syncToken) {
      params.set("syncToken", syncToken);
    } else {
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

    // syncToken expired — retry with a full sync (guard against infinite loop)
    if (res.status === 410) {
      if (retryCount >= 1) throw new Error("Full sync loop after 410");
      return syncOneCalendar(account, calendarId, null, accessToken, retryCount + 1);
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

  return { synced: syncedCount, nextSyncToken: nextSyncToken ?? null };
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
  watchCalendarId: string,
  accessToken: string,
): Promise<void> {
  const now = Date.now();
  if (
    account.push_channel_id &&
    account.push_expiration &&
    account.push_expiration > now + 24 * 60 * 60 * 1000
  ) {
    return;
  }

  const channelId = crypto.randomUUID();
  const expiration = now + PUSH_TTL_MS;
  const calId = encodeURIComponent(watchCalendarId);

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
