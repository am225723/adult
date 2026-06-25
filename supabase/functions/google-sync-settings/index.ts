import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAccessToken, getGmailAccessToken } from "../_shared/google.ts";

const TOKEN_ENCRYPTION_KEY = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) return json({ error: "Invalid token" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { action, account_id } = body as {
    action: string;
    account_id: string;
    calendar_ids?: string[];
    label_ids?: string[];
  };

  if (!account_id || typeof account_id !== "string") {
    return json({ error: "account_id required" }, 400);
  }

  switch (action) {
    case "list-calendars":
      return handleListCalendars(user.id, account_id);
    case "update-calendars":
      return handleUpdateCalendars(
        user.id,
        account_id,
        (body as { calendar_ids?: string[] }).calendar_ids ?? [],
      );
    case "list-labels":
      return handleListLabels(user.id, account_id);
    case "update-labels":
      return handleUpdateLabels(
        user.id,
        account_id,
        (body as { label_ids?: string[] }).label_ids ?? [],
      );
    default:
      return json({ error: `Unknown action: ${action}` }, 400);
  }
});

async function handleListCalendars(userId: string, accountId: string) {
  const { data: account, error } = await supabase
    .from("admin_calendar_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  if (error || !account) return json({ error: "Account not found" }, 404);

  const accessToken = await getAccessToken(
    account,
    supabase,
    TOKEN_ENCRYPTION_KEY,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  );

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    return json({ error: `Google Calendar API error: ${await res.text()}` }, 502);
  }

  const data = await res.json();
  const calendars = (data.items ?? []).map((item: {
    id: string;
    summary: string;
    primary?: boolean;
    backgroundColor?: string;
  }) => ({
    id: item.id,
    summary: item.summary,
    primary: item.primary ?? false,
    backgroundColor: item.backgroundColor ?? null,
  }));

  await supabase
    .from("admin_calendar_accounts")
    .update({ available_calendars: calendars })
    .eq("id", accountId);

  return json({ available_calendars: calendars });
}

async function handleUpdateCalendars(
  userId: string,
  accountId: string,
  calendarIds: string[],
) {
  if (!Array.isArray(calendarIds) || calendarIds.length === 0) {
    return json({ error: "calendar_ids must be a non-empty array" }, 400);
  }

  // Fetch current sync_tokens so we can drop tokens for deselected calendars
  const { data: account } = await supabase
    .from("admin_calendar_accounts")
    .select("sync_tokens")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  const currentTokens = (account?.sync_tokens ?? {}) as Record<string, string>;
  const pruned: Record<string, string> = {};
  for (const calId of calendarIds) {
    if (currentTokens[calId]) pruned[calId] = currentTokens[calId];
  }

  const { error } = await supabase
    .from("admin_calendar_accounts")
    .update({ selected_calendar_ids: calendarIds, sync_tokens: pruned })
    .eq("id", accountId)
    .eq("user_id", userId);

  if (error) return json({ error: error.message }, 500);

  return json({ selected_calendar_ids: calendarIds });
}

async function handleListLabels(userId: string, accountId: string) {
  const { data: account, error } = await supabase
    .from("admin_gmail_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();

  if (error || !account) return json({ error: "Account not found" }, 404);

  const accessToken = await getGmailAccessToken(
    account,
    supabase,
    TOKEN_ENCRYPTION_KEY,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  );

  const res = await fetch(
    "https://www.googleapis.com/gmail/v1/users/me/labels",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    return json({ error: `Gmail API error: ${await res.text()}` }, 502);
  }

  const data = await res.json();

  const SYSTEM_SHOWN = new Set(["INBOX", "SENT", "STARRED", "IMPORTANT", "TRASH", "SPAM"]);
  const labels = ((data.labels ?? []) as {
    id: string;
    name: string;
    type: string;
  }[])
    .filter((l) => l.type === "user" || SYSTEM_SHOWN.has(l.id))
    .map((l) => ({ id: l.id, name: l.name, type: l.type }))
    .sort((a, b) => {
      if (a.type === "system" && b.type !== "system") return -1;
      if (a.type !== "system" && b.type === "system") return 1;
      return a.name.localeCompare(b.name);
    });

  await supabase
    .from("admin_gmail_accounts")
    .update({ available_labels: labels })
    .eq("id", accountId);

  return json({ available_labels: labels });
}

async function handleUpdateLabels(
  userId: string,
  accountId: string,
  labelIds: string[],
) {
  if (!Array.isArray(labelIds) || labelIds.length === 0) {
    return json({ error: "label_ids must be a non-empty array" }, 400);
  }

  const { error } = await supabase
    .from("admin_gmail_accounts")
    .update({ sync_labels: labelIds })
    .eq("id", accountId)
    .eq("user_id", userId);

  if (error) return json({ error: error.message }, 500);

  return json({ sync_labels: labelIds });
}
