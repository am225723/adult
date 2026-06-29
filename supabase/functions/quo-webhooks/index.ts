import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface QuoWebhookEvent {
  id: string;
  type: string;
  createdAt: string;
  data: { object: Record<string, unknown> };
}

// Header: openphone-signature
// Format: hmac;1;<timestamp>;<base64_hmac_sha256>
// Signing input: <timestamp>.<body>
// Key: base64-decode the secret to get raw bytes
async function validateSignature(body: string, signatureHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = signatureHeader.split(";");
    if (parts.length !== 4 || parts[0] !== "hmac") return false;
    const timestamp = parts[2];
    const receivedSig = parts[3];
    const signingInput = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    const subtle = globalThis.crypto.subtle;

    const keyData = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
    const key = await subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await subtle.sign("HMAC", key, encoder.encode(signingInput));
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return computed === receivedSig;
  } catch (err) {
    console.error("validateSignature error:", err);
    return false;
  }
}

async function handleMessageReceived(obj: Record<string, unknown>, workspaceId: string) {
  const { error } = await supabase.from("admin_phone_messages").upsert({
    workspace_id: workspaceId,
    external_id: obj.id,
    direction: obj.direction || "incoming",
    body: obj.body,
    phone_account_id: obj.phoneNumberId,
    occurred_at: obj.createdAt,
    conversation_id: obj.conversationId,
    message_status: obj.status || "received",
    metadata: { from: obj.from, to: obj.to },
  }, { onConflict: "external_id" });
  if (error) console.error("Error storing received message:", error);
}

async function handleMessageDelivered(obj: Record<string, unknown>, workspaceId: string) {
  const { error } = await supabase.from("admin_phone_messages")
    .update({ message_status: "delivered", metadata: { delivered_at: new Date().toISOString() } })
    .eq("external_id", obj.id)
    .eq("workspace_id", workspaceId);
  if (error) console.error("Error updating message delivery:", error);
}

async function handleCallCompleted(obj: Record<string, unknown>, workspaceId: string) {
  const { error } = await supabase.from("admin_phone_calls").upsert({
    workspace_id: workspaceId,
    external_id: obj.id,
    direction: obj.direction,
    status: obj.status,
    duration_seconds: obj.duration,
    occurred_at: obj.createdAt,
    phone_account_id: obj.phoneNumberId,
    metadata: { from: obj.from, to: obj.to },
  }, { onConflict: "external_id" });
  if (error) console.error("Error storing completed call:", error);
}

async function handleVoicemailCompleted(obj: Record<string, unknown>, workspaceId: string) {
  const { error } = await supabase.from("admin_phone_calls")
    .update({ voicemail_transcript: obj.transcript, voicemail_url: obj.recordingUrl })
    .eq("external_id", obj.callId)
    .eq("workspace_id", workspaceId);
  if (error) console.error("Error updating voicemail:", error);
}

async function handleCallRinging(obj: Record<string, unknown>, workspaceId: string) {
  const { error } = await supabase.from("admin_phone_calls").upsert({
    workspace_id: workspaceId,
    external_id: obj.id,
    direction: obj.direction,
    status: "ringing",
    occurred_at: obj.createdAt,
    phone_account_id: obj.phoneNumberId,
    metadata: { from: obj.from, to: obj.to },
  }, { onConflict: "external_id" });
  if (error) console.error("Error storing ringing call:", error);
}

async function handleCallTranscript(obj: Record<string, unknown>, workspaceId: string) {
  // Fetch existing metadata and merge to avoid overwriting from/to and other fields
  const { data: existing } = await supabase.from("admin_phone_calls")
    .select("metadata").eq("external_id", obj.callId).eq("workspace_id", workspaceId).single();
  const merged = { ...(existing?.metadata ?? {}), transcript: obj.transcript, dialogue: obj.dialogue };
  const { error } = await supabase.from("admin_phone_calls")
    .update({ metadata: merged })
    .eq("external_id", obj.callId)
    .eq("workspace_id", workspaceId);
  if (error) console.error("Error updating call transcript:", error);
}

async function handleCallSummary(obj: Record<string, unknown>, workspaceId: string) {
  const { data: existing } = await supabase.from("admin_phone_calls")
    .select("metadata").eq("external_id", obj.callId).eq("workspace_id", workspaceId).single();
  const merged = { ...(existing?.metadata ?? {}), summary: obj.summary, keywords: obj.keywords };
  const { error } = await supabase.from("admin_phone_calls")
    .update({ metadata: merged })
    .eq("external_id", obj.callId)
    .eq("workspace_id", workspaceId);
  if (error) console.error("Error updating call summary:", error);
}

async function handleContactUpdated(obj: Record<string, unknown>, workspaceId: string) {
  const defaultFields = obj.defaultFields as Record<string, unknown> | undefined;
  const { error } = await supabase.from("admin_quo_contacts").upsert({
    workspace_id: workspaceId,
    external_id: obj.id,
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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.text();
    const event = JSON.parse(body) as QuoWebhookEvent;
    const signatureHeader = req.headers.get("openphone-signature") ?? "";

    const { data: webhooks } = await supabase.from("admin_quo_webhooks").select("*").eq("is_active", true);
    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ error: "no webhooks configured" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let validWebhook = null;
    for (const webhook of webhooks) {
      if (await validateSignature(body, signatureHeader, webhook.secret)) {
        validWebhook = webhook;
        break;
      }
    }

    if (!validWebhook) {
      console.warn(`Invalid signature for event: ${event.type}`);
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const obj = event.data?.object ?? {};

    await supabase.from("admin_quo_webhook_events").insert({
      workspace_id: validWebhook.workspace_id,
      webhook_id: validWebhook.id,
      event_type: event.type,
      event_data: event,
    });

    switch (event.type) {
      case "message.received": await handleMessageReceived(obj, validWebhook.workspace_id); break;
      case "message.delivered": await handleMessageDelivered(obj, validWebhook.workspace_id); break;
      case "call.completed": await handleCallCompleted(obj, validWebhook.workspace_id); break;
      case "call.ringing": await handleCallRinging(obj, validWebhook.workspace_id); break;
      case "call.recording.completed":
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

    return new Response(JSON.stringify({ success: true, eventId: event.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
