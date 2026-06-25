import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getGmailAccessToken, type GmailAccount } from "../_shared/google.ts";

const TOKEN_ENCRYPTION_KEY = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface WritePayload {
  action: "send-new" | "send-reply";
  to: string;
  subject: string;
  body: string;
  gmail_message_id?: string; // external Gmail message ID, required for send-reply
  gmail_account_id?: string; // if omitted, uses the first connected account
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildRaw(
  from: string,
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string,
  references?: string,
): string {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);
  lines.push("", body);

  const message = lines.join("\r\n");
  const bytes = new TextEncoder().encode(message);
  const binary = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const { data: { user }, error: userErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (userErr || !user) return json({ error: "Invalid token" }, 401);

  let payload: WritePayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { action, to, subject, body } = payload;
  if (!["send-new", "send-reply"].includes(action)) {
    return json({ error: "Invalid action" }, 400);
  }
  if (!to?.trim() || !subject?.trim() || !body?.trim()) {
    return json({ error: "to, subject, and body are required" }, 400);
  }

  let accountQuery = supabase
    .from("admin_gmail_accounts")
    .select("id, access_token, refresh_token, token_expires_at, external_account_email")
    .eq("user_id", user.id);

  if (payload.gmail_account_id) {
    accountQuery = accountQuery.eq("id", payload.gmail_account_id);
  } else {
    accountQuery = accountQuery.eq("provider", "google").order("created_at").limit(1);
  }

  const { data: account } = await accountQuery.maybeSingle();

  if (!account) return json({ error: "No Gmail account connected" }, 400);

  let accessToken: string;
  try {
    accessToken = await getGmailAccessToken(
      account as GmailAccount,
      supabase,
      TOKEN_ENCRYPTION_KEY,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
    );
  } catch (err) {
    return json({ error: `Token error: ${String(err)}` }, 500);
  }

  const fromEmail = (account as any).external_account_email ?? "";

  try {
    if (action === "send-new") {
      const raw = buildRaw(fromEmail, to, subject, body);
      const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        },
      );
      if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
      return json({ ok: true });
    }

    if (action === "send-reply") {
      if (!payload.gmail_message_id) {
        return json({ error: "gmail_message_id required for send-reply" }, 400);
      }

      let threadId: string | undefined;
      let inReplyTo: string | undefined;
      let references: string | undefined;

      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(payload.gmail_message_id)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        threadId = msgData.threadId as string | undefined;
        const hdrs: Array<{ name: string; value: string }> =
          msgData.payload?.headers ?? [];
        inReplyTo = hdrs.find((h) => h.name === "Message-ID")?.value;
        const existingRefs = hdrs.find((h) => h.name === "References")?.value;
        references = existingRefs
          ? `${existingRefs} ${inReplyTo ?? ""}`.trim()
          : inReplyTo;
      }

      const raw = buildRaw(fromEmail, to, subject, body, inReplyTo, references);
      const reqBody: Record<string, string> = { raw };
      if (threadId) reqBody.threadId = threadId;

      const res = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reqBody),
        },
      );
      if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
      return json({ ok: true });
    }
  } catch (err) {
    console.error("Gmail write error:", err);
    return json({ error: String(err) }, 500);
  }

  return json({ error: "not_found" }, 404);
});
