import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface BriefingContext {
  date: string;
  userName: string;
  eventsToday: number;
  tasksDueToday: number;
  tasksOverdue: number;
  unreadEmails: number;
  missedCalls: number;
  unreadMessages: number;
}

interface BriefingResponse {
  briefing: string;
  sources: string[];
}

function buildPrompt(ctx: BriefingContext, priorBriefing: string | null): string {
  const items: string[] = [];
  if (ctx.tasksOverdue > 0)
    items.push(`${ctx.tasksOverdue} overdue task${ctx.tasksOverdue !== 1 ? "s" : ""}`);
  if (ctx.tasksDueToday > 0)
    items.push(`${ctx.tasksDueToday} task${ctx.tasksDueToday !== 1 ? "s" : ""} due today`);
  if (ctx.eventsToday > 0)
    items.push(`${ctx.eventsToday} calendar event${ctx.eventsToday !== 1 ? "s" : ""} today`);
  if (ctx.unreadEmails > 0)
    items.push(`${ctx.unreadEmails} unread email${ctx.unreadEmails !== 1 ? "s" : ""}`);
  if (ctx.missedCalls > 0)
    items.push(`${ctx.missedCalls} missed call${ctx.missedCalls !== 1 ? "s" : ""}`);
  if (ctx.unreadMessages > 0)
    items.push(`${ctx.unreadMessages} unread message${ctx.unreadMessages !== 1 ? "s" : ""}`);

  const hasUrgent = ctx.tasksOverdue > 0 || ctx.missedCalls > 0;
  const summary = items.length > 0 ? items.join(", ") : "nothing pending";

  const priorSection = priorBriefing
    ? `\nPrevious briefing for comparison: "${priorBriefing}"\n`
    : "";

  return `You are a concise personal productivity assistant. Write a 2–3 sentence daily briefing for ${ctx.userName || "the user"} on ${ctx.date}.

Status: ${summary}.${hasUrgent ? " There are urgent items." : ""}
${priorSection}
Rules:
- Be direct and motivating
- Prioritize urgent items first
- Do not use bullet points or headers
- Do not invent names, emails, subjects, or events not mentioned above
- Do not start with a greeting like "Good morning"
${priorBriefing ? "- If things have improved or worsened since the previous briefing, note it briefly\n" : ""}- Keep it under 75 words`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const userToken = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userErr } = await serviceClient.auth.getUser(userToken);
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let ctx: BriefingContext;
  try {
    ctx = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "AI service not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Fetch workspace_id and prior briefing in parallel
  const [workspaceResult, priorResult] = await Promise.all([
    serviceClient
      .from("admin_workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .single(),
    serviceClient
      .from("admin_ai_briefings")
      .select("briefing_text, briefing_date")
      .eq("user_id", user.id)
      .lt("briefing_date", today)
      .order("briefing_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const workspaceId = workspaceResult.data?.workspace_id ?? null;
  const priorBriefing = priorResult.data?.briefing_text ?? null;

  if (!workspaceId) {
    console.warn("No workspace membership found for user", user.id, "— briefing will not be persisted.");
  }

  let result: unknown;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 200,
        messages: [{ role: "user", content: buildPrompt(ctx, priorBriefing) }],
      }),
    }).finally(() => clearTimeout(timeout));

    if (!anthropicRes.ok) {
      console.error("Anthropic API error:", anthropicRes.status, await anthropicRes.text());
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    result = await anthropicRes.json();
  } catch (e) {
    console.error("Anthropic request failed:", e);
    return new Response(JSON.stringify({ error: "AI service unavailable" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const briefing = ((result as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? "").trim();

  const sources: string[] = [];
  if (ctx.eventsToday > 0) sources.push("Calendar");
  if (ctx.tasksDueToday > 0 || ctx.tasksOverdue > 0) sources.push("Tasks");
  if (ctx.unreadEmails > 0) sources.push("Email");
  if (ctx.missedCalls > 0) sources.push("Phone");
  if (ctx.unreadMessages > 0) sources.push("Messages");

  // Persist to DB (upsert — one per user per day)
  if (workspaceId && briefing) {
    const { error: upsertError } = await serviceClient.from("admin_ai_briefings").upsert(
      {
        workspace_id: workspaceId,
        user_id: user.id,
        briefing_date: today,
        briefing_text: briefing,
        sources,
        context_snapshot: ctx as unknown as Record<string, unknown>,
      },
      { onConflict: "user_id,briefing_date" },
    );
    if (upsertError) console.error("Failed to persist briefing:", upsertError);
  }

  const body: BriefingResponse = { briefing, sources };
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
