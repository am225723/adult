import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import * as crypto from "https://deno.land/std@0.208.0/crypto/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface QuoWebhookEvent {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
  context?: Record<string, unknown>;
  resource?: Record<string, unknown>;
}

async function validateSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signatureData = encoder.encode(body);
    const computedSignature = await crypto.subtle.sign("HMAC", key, signatureData);
    const computedHex = Array.from(new Uint8Array(computedSignature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return computedHex === signature;
  } catch {
    return false;
  }
}

async function handleMessageReceived(event: QuoWebhookEvent, workspaceId: string) {
  const resource = event.resource as Record<string, unknown>;
  const context = event.context as Record<string, unknown>;

  const { error } = await supabase.from("admin_phone_messages").upsert({
    workspace_id: workspaceId,
    external_id: resource.id,
    direction: "incoming",
    body: resource.body,
    phone_account_id: context?.phoneNumberId,
    occurred_at: resource.createdAt,
    conversation_id: context?.conversationId,
    message_status: "received",
    metadata: { event_id: event.id },
  });

  if (error) console.error("Error storing received message:", error);
}

async function handleMessageDelivered(event: QuoWebhookEvent, workspaceId: string) {
  const resource = event.resource as Record<string, unknown>;

  const { error } = await supabase
    .from("admin_phone_messages")
    .update({
      message_status: "delivered",
      metadata: { delivered_at: new Date().toISOString() },
    })
    .eq("external_id", resource.id)
    .eq("workspace_id", workspaceId);

  if (error) console.error("Error updating message delivery:", error);
}

async function handleTaskCreated(event: QuoWebhookEvent, workspaceId: string) {
  const resource = event.resource as Record<string, unknown>;

  const { error } = await supabase.from("admin_quo_tasks").upsert({
    workspace_id: workspaceId,
    external_id: resource.id,
    title: resource.title,
    description: resource.description,
    status: resource.status || "open",
    due_date: resource.dueDate,
    created_at: resource.createdAt,
    updated_at: resource.updatedAt,
  });

  if (error) console.error("Error storing created task:", error);
}

async function handleContactUpdated(event: QuoWebhookEvent, workspaceId: string) {
  const resource = event.resource as Record<string, unknown>;
  const defaultFields = resource.defaultFields as Record<string, unknown>;

  const { error } = await supabase.from("admin_quo_contacts").upsert({
    workspace_id: workspaceId,
    external_id: resource.id,
    first_name: defaultFields?.firstName,
    last_name: defaultFields?.lastName,
    primary_phone: (defaultFields?.phoneNumbers as Array<Record<string, unknown>>)?.[0]?.value,
    emails: defaultFields?.emails,
    company: defaultFields?.company,
    role: defaultFields?.role,
    custom_fields: resource.customFields || {},
  });

  if (error) console.error("Error storing updated contact:", error);
}

async function handleCallCompleted(event: QuoWebhookEvent, workspaceId: string) {
  const resource = event.resource as Record<string, unknown>;
  const context = event.context as Record<string, unknown>;

  const { error } = await supabase.from("admin_phone_calls").upsert({
    workspace_id: workspaceId,
    external_id: resource.id,
    direction: resource.direction,
    status: resource.status,
    duration_seconds: resource.duration,
    occurred_at: resource.createdAt,
    phone_account_id: context?.phoneNumberId,
    metadata: { event_id: event.id },
  });

  if (error) console.error("Error storing completed call:", error);
}

async function handleVoicemailCompleted(event: QuoWebhookEvent, workspaceId: string) {
  const resource = event.resource as Record<string, unknown>;
  const context = event.context as Record<string, unknown>;

  // Voicemail events are linked to a call via callId in resource
  const { error } = await supabase.from("admin_phone_calls")
    .update({
      voicemail_transcript: resource.transcript,
      voicemail_url: resource.url,
    })
    .eq("external_id", resource.callId)
    .eq("workspace_id", workspaceId);

  if (error) console.error("Error updating voicemail:", error);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.text();
    const event = JSON.parse(body) as QuoWebhookEvent;

    // Find webhook subscription in database
    const { data: webhooks } = await supabase
      .from("admin_quo_webhooks")
      .select("*")
      .eq("is_active", true);

    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ error: "no webhooks configured" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate signature and find matching workspace
    let validWebhook = null;
    for (const webhook of webhooks) {
      const isValid = await validateSignature(body, req.headers.get("x-quo-signature") || "", webhook.secret);
      if (isValid && webhook.event_types.includes(event.type)) {
        validWebhook = webhook;
        break;
      }
    }

    if (!validWebhook) {
      console.warn(`Received webhook with invalid signature for event type: ${event.type}`);
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store event for debugging
    await supabase.from("admin_quo_webhook_events").insert({
      workspace_id: validWebhook.workspace_id,
      webhook_id: validWebhook.id,
      event_type: event.type,
      event_data: event,
    });

    // Process event based on type
    switch (event.type) {
      case "message.received":
        await handleMessageReceived(event, validWebhook.workspace_id);
        break;
      case "message.delivered":
        await handleMessageDelivered(event, validWebhook.workspace_id);
        break;
      case "call.completed":
        await handleCallCompleted(event, validWebhook.workspace_id);
        break;
      case "call.voicemail.completed":
        await handleVoicemailCompleted(event, validWebhook.workspace_id);
        break;
      case "contact.updated":
        await handleContactUpdated(event, validWebhook.workspace_id);
        break;
      default:
        console.log(`Received unhandled webhook event type: ${event.type}`);
    }

    // Mark event as processed
    await supabase
      .from("admin_quo_webhook_events")
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
