import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
  // Gmail sends a sync notification on channel creation — ignore it
  const resourceState = req.headers.get("X-Goog-Resource-State");
  if (resourceState === "sync") {
    return new Response(null, { status: 200 });
  }

  const channelId = req.headers.get("X-Goog-Channel-Id");
  if (!channelId) {
    return new Response("Missing channel ID", { status: 400 });
  }

  // Find the Gmail account for this push channel
  const { data: account } = await supabase
    .from("admin_gmail_accounts")
    .select("id")
    .eq("push_channel_id", channelId)
    .single();

  if (!account) {
    // Channel may belong to a stale registration — return 200 to stop retries
    return new Response(null, { status: 200 });
  }

  // Trigger incremental sync (fire-and-forget)
  fetch(`${SUPABASE_URL}/functions/v1/google-gmail-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ gmail_account_id: account.id }),
  }).catch(console.error);

  return new Response(null, { status: 200 });
});
