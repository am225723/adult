import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, openphone-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface QuoWebhookEvent {
  id: string;
  type: string;
  createdAt?: string;
  data?: { object?: Record<string, unknown>; resource?: Record<string, unknown> };
  resource?: Record<string, unknown>;
}

async function validateSignature(body: string, signatureHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = signatureHeader.split(";");
    if (parts.length !== 4 || parts[0] !== "hmac") return false;
    const timestamp = parts[2];
    const receivedSig = parts[3];
    const encoder = new TextEncoder();
    const keyData = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return computed === receivedSig;
  } catch (err) {
    console.error("validateSignature error:", err);
    return false;
  }
}

function resourceFromEvent(event: QuoWebhookEvent): Record<string, unknown> {
  return event.data?.resource ?? event.data?.object ?? event.resource ?? {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizePhone(phone: unknown): string | null {
  const value = asString(phone);
  return value && /^\+[1-9]\d{1,14}$/.test(value) ? value : null;
}

function textFromMessage(obj: Record<string, unknown>): string {
  return asString(obj.text) ?? asString(obj.body) ?? asString(obj.content) ?? "";
}

function externalFromParticipants(participants: unknown, ownPhone?: string | null): string | null {
  const own = normalizePhone(ownPhone);
  const list = Array.isArray(participants) ? participants.map(normalizePhone).filter((p): p is string => !!p) : [];
  return list.find((phone) => phone !== own) ?? list[0] ?? null;
}

function externalFromMessage(obj: Record<string, unknown>, ownPhone?: string | null): string | null {
  if (obj.direction === "incoming") return normalizePhone(obj.from);
  const recipients = Array.isArray(obj.to) ? obj.to : [];
  const own = normalizePhone(ownPhone);
  return recipients.map(normalizePhone).find((phone) => phone && phone !== own) ?? null;
}

function transcriptToText(dialogue: unknown): string | null {
  if (!Array.isArray(dialogue)) return null;
  const lines = dialogue
    .map((segment) => {
      if (!segment || typeof segment !== "object") return null;
      const item = segment as Record<string, unknown>;
      const content = asString(item.content);
      if (!content) return null;
      return `${asString(item.identifier) ?? asString(item.userId) ?? "Speaker"}: ${content}`;
    })
    .filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

function arrayText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const lines = value.map((item) => String(item ?? "").trim()).filter(Boolean);
    return lines.length ? lines.join("\n") : null;
  }
  return asString(value);
}

async function getPhoneAccountId(workspaceId: string, phoneNumberId: unknown, phoneNumber?: unknown): Promise<string | null> {
  const quoAccountId = asString(phoneNumberId);
  if (!quoAccountId) return null;
  const { data: existing } = await supabase
    .from("admin_phone_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("quo_account_id", quoAccountId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("admin_phone_accounts")
    .upsert({
      workspace_id: workspaceId,
      quo_account_id: quoAccountId,
      phone_number: normalizePhone(phoneNumber),
      last_synced_at: new Date().toISOString(),
    }, { onConflict: "quo_account_id" })
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Error resolving phone account:", error);
    return null;
  }
  return data?.id ?? null;
}

async function updateCallMetadata(externalId: string | null, workspaceId: string, patch: Record<string, unknown>) {
  if (!externalId) return;
  const { data: existing } = await supabase
    .from("admin_phone_calls")
    .select("metadata")
    .eq("external_id", externalId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  await supabase
    .from("admin_phone_calls")
    .update({ metadata: { ...(existing?.metadata ?? {}), ...patch } })
    .eq("external_id", externalId)
    .eq("workspace_id", workspaceId);
}

async function handleMessageReceived(obj: Record<string, unknown>, workspaceId: string) {
  const phoneAccountId = await getPhoneAccountId(workspaceId, obj.phoneNumberId, obj.phoneNumber);
  const externalPhone = externalFromMessage(obj, obj.phoneNumber) ?? externalFromParticipants(obj.participants, obj.phoneNumber);
  const { error } = await supabase.from("admin_phone_messages").upsert({
    workspace_id: workspaceId,
    external_id: asString(obj.id) ?? asString(obj.messageId),
    direction: asString(obj.direction) ?? "incoming",
    body: textFromMessage(obj),
    phone_account_id: phoneAccountId,
    occurred_at: asString(obj.createdAt) ?? new Date().toISOString(),
    conversation_id: asString(obj.conversationId),
    message_status: asString(obj.status) ?? (obj.direction === "outgoing" ? "sent" : "received"),
    external_phone: externalPhone,
    is_read: obj.direction === "outgoing",
    metadata: { from: obj.from ?? null, to: obj.to ?? [], phoneNumberId: obj.phoneNumberId ?? null, raw: obj },
  }, { onConflict: "external_id" });
  if (error) console.error("Error storing received message:", error);
}

async function handleMessageDelivered(obj: Record<string, unknown>, workspaceId: string) {
  const { error } = await supabase.from("admin_phone_messages")
    .update({ message_status: "delivered" })
    .eq("external_id", asString(obj.id) ?? asString(obj.messageId))
    .eq("workspace_id", workspaceId);
  if (error) console.error("Error updating message delivery:", error);
}

async function handleCallEvent(obj: Record<string, unknown>, workspaceId: string, fallbackStatus?: string) {
  const phoneAccountId = await getPhoneAccountId(workspaceId, obj.phoneNumberId, obj.phoneNumber);
  const externalPhone = externalFromParticipants(obj.participants, obj.phoneNumber);
  const { error } = await supabase.from("admin_phone_calls").upsert({
    workspace_id: workspaceId,
    external_id: asString(obj.id) ?? asString(obj.callId),
    direction: asString(obj.direction),
    status: asString(obj.status) ?? fallbackStatus,
    duration_seconds: typeof obj.duration === "number" ? obj.duration : null,
    occurred_at: asString(obj.createdAt) ?? asString(obj.completedAt) ?? new Date().toISOString(),
    phone_account_id: phoneAccountId,
    external_phone: externalPhone,
    metadata: { participants: obj.participants ?? [], phoneNumberId: obj.phoneNumberId ?? null, raw: obj },
  }, { onConflict: "external_id" });
  if (error) console.error("Error storing call event:", error);
}

async function handleRecording(obj: Record<string, unknown>, workspaceId: string) {
  const callId = asString(obj.callId) ?? asString(obj.id);
  if (!callId) return;
  const recordingUrl = asString(obj.recordingUrl) ?? asString(obj.url);
  const { error } = await supabase.from("admin_phone_calls")
    .update({ recording_url: recordingUrl, voicemail_url: obj.type === "voicemail" ? recordingUrl : undefined })
    .eq("external_id", callId)
    .eq("workspace_id", workspaceId);
  if (error) console.error("Error updating recording:", error);
  await updateCallMetadata(callId, workspaceId, { recording: obj });
}

async function handleVoicemailCompleted(obj: Record<string, unknown>, workspaceId: string) {
  const callId = asString(obj.callId) ?? asString(obj.id);
  if (!callId) return;
  const { error } = await supabase.from("admin_phone_calls")
    .update({ voicemail_transcript: asString(obj.transcript), voicemail_url: asString(obj.recordingUrl) ?? asString(obj.url) })
    .eq("external_id", callId)
    .eq("workspace_id", workspaceId);
  if (error) console.error("Error updating voicemail:", error);
  await updateCallMetadata(callId, workspaceId, { voicemail: obj });
}

async function handleCallTranscript(obj: Record<string, unknown>, workspaceId: string) {
  const callId = asString(obj.callId) ?? asString(obj.id);
  if (!callId) return;
  const transcriptText = asString(obj.transcript) ?? transcriptToText(obj.dialogue);
  const { error } = await supabase.from("admin_phone_calls")
    .update({ transcript_text: transcriptText })
    .eq("external_id", callId)
    .eq("workspace_id", workspaceId);
  if (error) console.error("Error updating call transcript:", error);
  await updateCallMetadata(callId, workspaceId, { transcript: obj });
}

async function handleCallSummary(obj: Record<string, unknown>, workspaceId: string) {
  const callId = asString(obj.callId) ?? asString(obj.id);
  if (!callId) return;
  const summary = [arrayText(obj.summary), arrayText(obj.nextSteps)].filter(Boolean).join("\n\nNext steps:\n") || null;
  const { error } = await supabase.from("admin_phone_calls")
    .update({ summary_text: summary })
    .eq("external_id", callId)
    .eq("workspace_id", workspaceId);
  if (error) console.error("Error updating call summary:", error);
  await updateCallMetadata(callId, workspaceId, { summary: obj });
}

async function handleContactUpdated(obj: Record<string, unknown>, workspaceId: string) {
  const defaultFields = obj.defaultFields as Record<string, unknown> | undefined;
  const { error } = await supabase.from("admin_quo_contacts").upsert({
    workspace_id: workspaceId,
    external_id: asString(obj.id),
    first_name: defaultFields?.firstName,
    last_name: defaultFields?.lastName,
    primary_phone: (defaultFields?.phoneNumbers as Array<Record<string, unknown>>)?.[0]?.value,
    emails: defaultFields?.emails,
    company: defaultFields?.company,
    role: defaultFields?.role,
    custom_fields: (obj.customFields as Record<string, unknown>) || {},
  }, { onConflict: "external_id" });
  if (error) console.error("Error storing updated contact:", error);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.text();
    const event = JSON.parse(body) as QuoWebhookEvent;
    const signatureHeader = req.headers.get("openphone-signature") ?? "";
    const { data: webhooks } = await supabase.from("admin_quo_webhooks").select("*").eq("is_active", true);
    if (!webhooks?.length) return new Response(JSON.stringify({ error: "no webhooks configured" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let validWebhook = null;
    for (const webhook of webhooks) {
      if (await validateSignature(body, signatureHeader, webhook.secret)) {
        validWebhook = webhook;
        break;
      }
    }
    if (!validWebhook) return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const obj = resourceFromEvent(event);
    await supabase.from("admin_quo_webhook_events").insert({ workspace_id: validWebhook.workspace_id, webhook_id: validWebhook.id, event_type: event.type, event_data: event });

    switch (event.type) {
      case "message.received":
      case "message.sent": await handleMessageReceived(obj, validWebhook.workspace_id); break;
      case "message.delivered": await handleMessageDelivered(obj, validWebhook.workspace_id); break;
      case "call.completed": await handleCallEvent(obj, validWebhook.workspace_id); break;
      case "call.ringing": await handleCallEvent(obj, validWebhook.workspace_id, "ringing"); break;
      case "call.recording.completed": await handleRecording(obj, validWebhook.workspace_id); break;
      case "call.voicemail.completed": await handleVoicemailCompleted(obj, validWebhook.workspace_id); break;
      case "call.transcript.completed": await handleCallTranscript(obj, validWebhook.workspace_id); break;
      case "call.summary.completed": await handleCallSummary(obj, validWebhook.workspace_id); break;
      case "contact.updated": await handleContactUpdated(obj, validWebhook.workspace_id); break;
      default: console.log(`Unhandled event type: ${event.type}`);
    }

    await supabase.from("admin_quo_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("webhook_id", validWebhook.id)
      .eq("event_data->>id", event.id);

    return new Response(JSON.stringify({ success: true, eventId: event.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
