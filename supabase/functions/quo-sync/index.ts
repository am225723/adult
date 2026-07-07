import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUO_API_KEY = Deno.env.get("QUO_API_KEY") ?? "";
const QUO_BASE = Deno.env.get("QUO_API_BASE") ?? "https://api.quo.com/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type PhoneNumber = {
  id: string;
  number: string;
  formattedNumber?: string | null;
  name?: string | null;
};

type Conversation = {
  id: string;
  phoneNumberId: string;
  participants?: string[];
  updatedAt?: string | null;
  lastActivityAt?: string | null;
};

type QuoMessage = {
  id: string;
  from?: string | null;
  to?: string[] | null;
  text?: string | null;
  body?: string | null;
  content?: string | null;
  phoneNumberId?: string | null;
  conversationId?: string | null;
  direction?: string | null;
  userId?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type QuoCall = {
  id: string;
  phoneNumberId?: string | null;
  participants?: string[] | null;
  direction?: string | null;
  status?: string | null;
  duration?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  answeredAt?: string | null;
  answeredBy?: string | null;
  initiatedBy?: string | null;
  callRoute?: string | null;
  forwardedFrom?: string | null;
  forwardedTo?: string | null;
  aiHandled?: string | null;
  userId?: string | null;
};

type FetchParams = Record<string, string | number | boolean | string[] | undefined | null>;

function buildUrl(path: string, params?: FetchParams) {
  const url = new URL(`${QUO_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const item of value.filter(Boolean)) url.searchParams.append(key, item);
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

async function quoJson<T>(path: string, params?: FetchParams, timeoutMs = 12_000): Promise<{ data: T; nextPageToken?: string | null; status: number; text?: string }> {
  const url = buildUrl(path, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(url.toString(), {
    headers: { Authorization: QUO_API_KEY, "Content-Type": "application/json" },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // keep json empty; caller can use text for diagnostics
  }

  if (!res.ok) {
    throw new Error(`${res.status} ${text || res.statusText}`);
  }

  return {
    data: (json.data ?? []) as T,
    nextPageToken: (json.nextPageToken as string | null | undefined) ?? null,
    status: res.status,
    text,
  };
}

async function quoJsonMaybe<T>(path: string, params?: FetchParams, timeoutMs = 10_000): Promise<{ data: T | null; error?: string }> {
  try {
    const result = await quoJson<T>(path, params, timeoutMs);
    return { data: result.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // These endpoints legitimately return absent/not found when no artifact exists yet.
    if (message.startsWith("404") || message.startsWith("403") || message.startsWith("400")) {
      return { data: null, error: message };
    }
    console.warn(`[quo-sync] optional fetch failed for ${path}: ${message}`);
    return { data: null, error: message };
  }
}

async function getWorkspaceId(userId: string): Promise<string | null> {
  const { data } = await db.from("admin_workspace_members").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle();
  return data?.workspace_id ?? null;
}

function normalizePhone(phone: unknown): string | null {
  if (typeof phone !== "string") return null;
  const trimmed = phone.trim();
  return /^\+[1-9]\d{1,14}$/.test(trimmed) ? trimmed : null;
}

function uniquePhones(phones: Array<unknown>): string[] {
  return [...new Set(phones.map(normalizePhone).filter((p): p is string => !!p))];
}

async function resolveContacts(workspaceId: string, phones: string[]): Promise<Map<string, string>> {
  const unique = uniquePhones(phones);
  if (unique.length === 0) return new Map();

  const map = new Map<string, string>();
  const { data: primaryRows } = await db
    .from("admin_contacts")
    .select("id, primary_phone")
    .eq("workspace_id", workspaceId)
    .in("primary_phone", unique);

  for (const row of primaryRows ?? []) {
    const phone = normalizePhone(row.primary_phone);
    if (phone) map.set(phone, row.id);
  }

  return map;
}

function externalFromParticipants(participants: unknown, ownNumber?: string | null): string | null {
  const list = Array.isArray(participants) ? participants.map(normalizePhone).filter((p): p is string => !!p) : [];
  if (list.length === 0) return null;
  const own = normalizePhone(ownNumber);
  return list.find((p) => p !== own) ?? list[0] ?? null;
}

function externalFromMessage(message: QuoMessage, ownNumber?: string | null, fallbackParticipants?: string[]): string | null {
  const own = normalizePhone(ownNumber);
  if (message.direction === "incoming") return normalizePhone(message.from) ?? externalFromParticipants(fallbackParticipants, own);
  const to = Array.isArray(message.to) ? message.to : [];
  return to.map(normalizePhone).find((p) => p && p !== own) ?? externalFromParticipants(fallbackParticipants, own);
}

function messageText(message: QuoMessage): string {
  return message.text ?? message.body ?? message.content ?? "";
}

function transcriptToText(dialogue: unknown): string | null {
  if (!Array.isArray(dialogue) || dialogue.length === 0) return null;
  const lines = dialogue
    .map((segment) => {
      if (!segment || typeof segment !== "object") return null;
      const item = segment as Record<string, unknown>;
      const speaker = String(item.identifier ?? item.userId ?? "Speaker");
      const content = typeof item.content === "string" ? item.content.trim() : "";
      return content ? `${speaker}: ${content}` : null;
    })
    .filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : null;
}

function arrayText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const lines = value.map((item) => String(item ?? "").trim()).filter(Boolean);
    return lines.length > 0 ? lines.join("\n") : null;
  }
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function fetchCallArtifacts(callId: string) {
  const [voicemailResult, transcriptResult, summaryResult, recordingsResult] = await Promise.all([
    quoJsonMaybe<Record<string, unknown>>(`/call-voicemails/${callId}`),
    quoJsonMaybe<Record<string, unknown>>(`/call-transcripts/${callId}`),
    quoJsonMaybe<Record<string, unknown>>(`/call-summaries/${callId}`),
    quoJsonMaybe<Array<Record<string, unknown>>>(`/call-recordings/${callId}`),
  ]);

  const voicemail = voicemailResult.data;
  const transcript = transcriptResult.data;
  const summary = summaryResult.data;
  const recordings = recordingsResult.data ?? [];

  const recordingUrl = recordings.find((recording) => typeof recording.url === "string" && recording.url)?.url as string | undefined;
  const transcriptText = transcript?.status === "completed" ? transcriptToText(transcript.dialogue) : null;
  const summaryText = summary?.status === "completed"
    ? [arrayText(summary.summary), arrayText(summary.nextSteps)].filter(Boolean).join("\n\nNext steps:\n") || null
    : null;

  return {
    voicemailTranscript: typeof voicemail?.transcript === "string" ? voicemail.transcript : null,
    voicemailUrl: typeof voicemail?.recordingUrl === "string" ? voicemail.recordingUrl : null,
    recordingUrl: recordingUrl ?? null,
    transcriptText,
    summaryText,
    metadata: {
      voicemail: voicemail ?? null,
      transcript: transcript ?? null,
      summary: summary ?? null,
      recordings,
    },
  };
}

async function fetchAllPages<T>(path: string, params: FetchParams): Promise<T[]> {
  let pageToken: string | undefined;
  const all: T[] = [];

  do {
    const result = await quoJson<T[]>(path, { ...params, pageToken });
    all.push(...(Array.isArray(result.data) ? result.data : []));
    pageToken = result.nextPageToken ?? undefined;
  } while (pageToken);

  return all;
}

async function fetchConversations(phoneNumberId: string, createdAfter: string): Promise<Conversation[]> {
  return await fetchAllPages<Conversation>("/conversations", {
    phoneNumbers: [phoneNumberId],
    createdAfter,
    maxResults: 100,
  });
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
    const phoneNumbers = await fetchAllPages<PhoneNumber>("/phone-numbers", {});
    let totalMessages = 0;
    let totalCalls = 0;
    let totalConversations = 0;
    const fetchErrors: string[] = [];

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const pn of phoneNumbers) {
      if (!pn.id) continue;
      const { data: existingAcct } = await db.from("admin_phone_accounts").select("id, workspace_id").eq("quo_account_id", pn.id).maybeSingle();
      if (existingAcct && existingAcct.workspace_id !== workspaceId) continue;

      const { data: acct, error: acctErr } = await db.from("admin_phone_accounts")
        .upsert({ workspace_id: workspaceId, quo_account_id: pn.id, phone_number: pn.number, last_synced_at: new Date().toISOString() }, { onConflict: "quo_account_id" })
        .select("id")
        .single();
      if (acctErr) throw acctErr;
      const phoneAccountId = acct.id as string;

      let conversations: Conversation[] = [];
      try {
        conversations = await fetchConversations(pn.id, sevenDaysAgo);
        totalConversations += conversations.length;
      } catch (err) {
        const msg = `conversation fetch failed for ${pn.number} (${pn.id}): ${err instanceof Error ? err.message : String(err)}`;
        console.error(`[quo-sync] ${msg}`);
        fetchErrors.push(msg);
        continue;
      }

      const messagesById = new Map<string, { message: QuoMessage; conversation: Conversation }>();
      const callsById = new Map<string, { call: QuoCall; conversation: Conversation }>();

      for (const conversation of conversations) {
        const participants = uniquePhones(conversation.participants ?? []);
        if (participants.length === 0) continue;

        try {
          const messages = await fetchAllPages<QuoMessage>("/messages", {
            phoneNumberId: pn.id,
            participants,
            createdAfter: sevenDaysAgo,
            maxResults: 100,
          });
          for (const message of messages) messagesById.set(message.id, { message, conversation });
        } catch (err) {
          const msg = `messages fetch failed for conversation ${conversation.id}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[quo-sync] ${msg}`);
          fetchErrors.push(msg);
        }

        for (const participant of participants) {
          try {
            const calls = await fetchAllPages<QuoCall>("/calls", {
              phoneNumberId: pn.id,
              participants: [participant],
              createdAfter: sevenDaysAgo,
              maxResults: 100,
            });
            for (const call of calls) callsById.set(call.id, { call, conversation });
          } catch (err) {
            const msg = `calls fetch failed for conversation ${conversation.id}/${participant}: ${err instanceof Error ? err.message : String(err)}`;
            console.error(`[quo-sync] ${msg}`);
            fetchErrors.push(msg);
          }
        }
      }

      const messages = [...messagesById.values()];
      if (messages.length > 0) {
        const externalPhones = messages.map(({ message, conversation }) => externalFromMessage(message, pn.number, conversation.participants));
        const contactMap = await resolveContacts(workspaceId, externalPhones.filter((p): p is string => !!p));
        const rows = messages.map(({ message, conversation }) => {
          const externalPhone = externalFromMessage(message, pn.number, conversation.participants);
          return {
            workspace_id: workspaceId,
            phone_account_id: phoneAccountId,
            external_id: message.id,
            direction: message.direction ?? null,
            body: messageText(message),
            is_read: message.direction === "outgoing",
            occurred_at: message.createdAt ?? conversation.lastActivityAt ?? new Date().toISOString(),
            contact_id: externalPhone ? contactMap.get(externalPhone) ?? null : null,
            conversation_id: message.conversationId ?? conversation.id,
            message_status: message.status ?? (message.direction === "incoming" ? "received" : "sent"),
            external_phone: externalPhone,
            metadata: {
              from: message.from ?? null,
              to: message.to ?? [],
              phoneNumberId: message.phoneNumberId ?? pn.id,
              conversationId: message.conversationId ?? conversation.id,
              userId: message.userId ?? null,
              status: message.status ?? null,
              updatedAt: message.updatedAt ?? null,
            },
          };
        });
        const { error: upsertErr } = await db.from("admin_phone_messages").upsert(rows, { onConflict: "external_id" });
        if (upsertErr) { console.error(`[quo-sync] messages upsert error: ${JSON.stringify(upsertErr)}`); throw upsertErr; }
        totalMessages += messages.length;
      }

      const calls = [...callsById.values()];
      if (calls.length > 0) {
        const externalPhones = calls.map(({ call, conversation }) => externalFromParticipants(call.participants ?? conversation.participants, pn.number));
        const contactMap = await resolveContacts(workspaceId, externalPhones.filter((p): p is string => !!p));
        const rows = [];

        for (const { call, conversation } of calls) {
          const externalPhone = externalFromParticipants(call.participants ?? conversation.participants, pn.number);
          const artifacts = await fetchCallArtifacts(call.id);
          rows.push({
            workspace_id: workspaceId,
            phone_account_id: phoneAccountId,
            external_id: call.id,
            direction: call.direction ?? null,
            status: call.status ?? null,
            duration_seconds: call.duration ?? null,
            voicemail_transcript: artifacts.voicemailTranscript,
            voicemail_url: artifacts.voicemailUrl,
            recording_url: artifacts.recordingUrl,
            transcript_text: artifacts.transcriptText,
            summary_text: artifacts.summaryText,
            occurred_at: call.createdAt ?? call.completedAt ?? conversation.lastActivityAt ?? new Date().toISOString(),
            contact_id: externalPhone ? contactMap.get(externalPhone) ?? null : null,
            external_phone: externalPhone,
            metadata: {
              participants: call.participants ?? conversation.participants ?? [],
              phoneNumberId: call.phoneNumberId ?? pn.id,
              conversationId: conversation.id,
              answeredAt: call.answeredAt ?? null,
              answeredBy: call.answeredBy ?? null,
              initiatedBy: call.initiatedBy ?? null,
              completedAt: call.completedAt ?? null,
              updatedAt: call.updatedAt ?? null,
              callRoute: call.callRoute ?? null,
              forwardedFrom: call.forwardedFrom ?? null,
              forwardedTo: call.forwardedTo ?? null,
              aiHandled: call.aiHandled ?? null,
              userId: call.userId ?? null,
              artifacts: artifacts.metadata,
            },
          });
        }

        const { error: upsertErr } = await db.from("admin_phone_calls").upsert(rows, { onConflict: "external_id" });
        if (upsertErr) { console.error(`[quo-sync] calls upsert error: ${JSON.stringify(upsertErr)}`); throw upsertErr; }
        totalCalls += calls.length;
      }
    }

    const body: Record<string, unknown> = { phoneNumbers: phoneNumbers.length, conversations: totalConversations, messages: totalMessages, calls: totalCalls };
    if (fetchErrors.length > 0) body.fetchErrors = fetchErrors;
    const status = fetchErrors.length > 0 ? 207 : 200;
    return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
