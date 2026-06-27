import { supabase } from "@/lib/supabase";

export interface WebhookSubscription {
  id: string;
  workspaceId: string;
  eventTypes: string[];
  secret: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const QUO_WEBHOOK_EVENTS = {
  MESSAGE_RECEIVED: "message.received",
  MESSAGE_DELIVERED: "message.delivered",
  CALL_COMPLETED: "call.completed",
  CALL_VOICEMAIL_COMPLETED: "call.voicemail.completed",
  CONTACT_UPDATED: "contact.updated",
} as const;

export async function createWebhookSubscription(
  workspaceId: string,
  eventTypes: string[],
  secret: string
): Promise<WebhookSubscription> {
  const { data, error } = await supabase
    .from("admin_quo_webhooks")
    .insert({
      workspace_id: workspaceId,
      event_types: eventTypes,
      secret,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create webhook: ${error.message}`);
  return data as WebhookSubscription;
}

export async function getWebhookSubscriptions(
  workspaceId: string
): Promise<WebhookSubscription[]> {
  const { data, error } = await supabase
    .from("admin_quo_webhooks")
    .select("*")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(`Failed to fetch webhooks: ${error.message}`);
  return (data || []) as WebhookSubscription[];
}

export async function deactivateWebhook(webhookId: string): Promise<void> {
  const { error } = await supabase
    .from("admin_quo_webhooks")
    .update({ is_active: false })
    .eq("id", webhookId);

  if (error) throw new Error(`Failed to deactivate webhook: ${error.message}`);
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  const { error } = await supabase
    .from("admin_quo_webhooks")
    .delete()
    .eq("id", webhookId);

  if (error) throw new Error(`Failed to delete webhook: ${error.message}`);
}

export async function getWebhookEvents(
  webhookId: string,
  limit = 50,
  offset = 0
): Promise<{ events: Record<string, unknown>[]; total: number }> {
  const { data, error, count } = await supabase
    .from("admin_quo_webhook_events")
    .select("*", { count: "exact" })
    .eq("webhook_id", webhookId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to fetch webhook events: ${error.message}`);
  return { events: data || [], total: count || 0 };
}

export async function clearWebhookEvents(webhookId: string): Promise<void> {
  const { error } = await supabase
    .from("admin_quo_webhook_events")
    .delete()
    .eq("webhook_id", webhookId);

  if (error) throw new Error(`Failed to clear webhook events: ${error.message}`);
}

export function generateWebhookSecret(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function validateWebhookSignature(
  body: string,
  signature: string,
  secret: string
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
