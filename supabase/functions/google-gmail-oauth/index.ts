import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptToken } from "../_shared/crypto.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const TOKEN_ENCRYPTION_KEY = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("APP_ORIGINS") ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-gmail-oauth`;
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  // ── Start: return OAuth URL ──────────────────────────────────────────────
  if (req.method === "POST" || (!code && !oauthError)) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const origin =
      url.searchParams.get("origin") ?? "http://localhost:5173";

    // Quick JWT validation
    const { data: { user }, error: userErr } = await supabase.auth.getUser(
      token,
    );
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = btoa(JSON.stringify({ token, origin }));
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    return new Response(JSON.stringify({ url: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Callback from Google ─────────────────────────────────────────────────
  let appOrigin = "http://localhost:5173";
  let userToken = "";
  try {
    const parsed = JSON.parse(atob(stateParam ?? ""));
    userToken = parsed.token;
    appOrigin = parsed.origin ?? appOrigin;
  } catch {
    return new Response("Invalid state", { status: 400 });
  }

  // Validate origin against allowlist to prevent open redirect
  if (!ALLOWED_ORIGINS.has(appOrigin)) {
    return new Response("Invalid origin", { status: 400 });
  }

  if (oauthError) {
    return Response.redirect(
      `${appOrigin}/mail?error=${encodeURIComponent(oauthError)}`,
    );
  }

  // Verify user
  const { data: { user }, error: userErr } = await supabase.auth.getUser(
    userToken,
  );
  if (userErr || !user) {
    return Response.redirect(`${appOrigin}/mail?error=invalid_session`);
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: code!,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Token exchange failed:", await tokenRes.text());
    return Response.redirect(
      `${appOrigin}/mail?error=token_exchange_failed`,
    );
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json();

  // Get Google account email
  const infoRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  if (!infoRes.ok) {
    console.error("Userinfo fetch failed:", await infoRes.text());
    return Response.redirect(`${appOrigin}/mail?error=userinfo_failed`);
  }
  const { email: googleEmail } = await infoRes.json();

  // Encrypt tokens
  const encAccess = await encryptToken(access_token, TOKEN_ENCRYPTION_KEY);
  const encRefresh = refresh_token
    ? await encryptToken(refresh_token, TOKEN_ENCRYPTION_KEY)
    : null;

  // Get workspace_id
  const { data: member } = await supabase
    .from("admin_workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return Response.redirect(`${appOrigin}/mail?error=no_workspace`);
  }

  // Upsert Gmail account
  const { data: gmailAccount, error: dbErr } = await supabase
    .from("admin_gmail_accounts")
    .upsert(
      {
        workspace_id: member.workspace_id,
        user_id: user.id,
        provider: "google",
        external_account_email: googleEmail,
        access_token: encAccess,
        refresh_token: encRefresh,
        token_expires_at: new Date(
          Date.now() + expires_in * 1000,
        ).toISOString(),
        sync_enabled: true,
        sync_token: null, // reset to force full sync
      },
      { onConflict: "user_id,provider" },
    )
    .select("id")
    .single();

  if (dbErr || !gmailAccount) {
    console.error("DB upsert failed:", dbErr);
    return Response.redirect(`${appOrigin}/mail?error=db_error`);
  }

  // Kick off initial sync (fire-and-forget)
  fetch(`${SUPABASE_URL}/functions/v1/google-gmail-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ gmail_account_id: gmailAccount.id }),
  }).catch(console.error);

  return Response.redirect(`${appOrigin}/mail?connected=true`);
});
