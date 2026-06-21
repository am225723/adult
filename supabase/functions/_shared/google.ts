import { decryptToken, encryptToken } from "./crypto.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface CalendarAccount {
  id: string;
  workspace_id: string;
  user_id: string;
  provider: string;
  calendar_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  sync_token: string | null;
  push_channel_id: string | null;
  push_resource_id: string | null;
  push_expiration: number | null;
}

export async function getAccessToken(
  account: CalendarAccount,
  supabase: SupabaseClient,
  encKey: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  if (!account.access_token) throw new Error("No access token stored");

  const expiresAt = account.token_expires_at
    ? new Date(account.token_expires_at).getTime()
    : 0;
  const needsRefresh = Date.now() >= expiresAt - 60_000; // refresh 1 min early

  if (!needsRefresh) {
    return decryptToken(account.access_token, encKey);
  }

  if (!account.refresh_token) throw new Error("No refresh token stored");

  const refreshToken = await decryptToken(account.refresh_token, encKey);
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const json = await res.json();
  const newAccess = json.access_token as string;
  const expiresIn = (json.expires_in as number) ?? 3600;

  const encryptedAccess = await encryptToken(newAccess, encKey);
  await supabase
    .from("admin_calendar_accounts")
    .update({
      access_token: encryptedAccess,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    })
    .eq("id", account.id);

  return newAccess;
}
