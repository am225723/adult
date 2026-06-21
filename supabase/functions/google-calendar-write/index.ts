import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAccessToken, type CalendarAccount } from "../_shared/google.ts";

const TOKEN_ENCRYPTION_KEY = Deno.env.get("TOKEN_ENCRYPTION_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface WritePayload {
  action: "create" | "update" | "delete";
  event_id?: string;        // local DB id (for update/delete)
  external_event_id?: string;
  title?: string;
  description?: string;
  location?: string;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify user JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userToken = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userErr } = await supabase.auth.getUser(
    userToken,
  );
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: WritePayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { action } = payload;
  if (!["create", "update", "delete"].includes(action)) {
    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action !== "delete") {
    if (!payload.start_time || !payload.end_time) {
      return new Response(
        JSON.stringify({ error: "start_time and end_time are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (new Date(payload.end_time) <= new Date(payload.start_time)) {
      return new Response(
        JSON.stringify({ error: "end_time must be after start_time" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  // Get user's Google calendar account
  const { data: account } = await supabase
    .from("admin_calendar_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .single();

  if (!account) {
    return new Response(
      JSON.stringify({ error: "No Google Calendar connected" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const accessToken = await getAccessToken(
    account as CalendarAccount,
    supabase,
    TOKEN_ENCRYPTION_KEY,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  );

  const calId = encodeURIComponent(
    (account as CalendarAccount).calendar_id ?? "primary",
  );
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`;

  try {
    if (action === "delete") {
      if (!payload.external_event_id) {
        return new Response(
          JSON.stringify({ error: "external_event_id required for delete" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const res = await fetch(
        `${baseUrl}/${encodeURIComponent(payload.external_event_id)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (res.status !== 204 && !res.ok) {
        throw new Error(`Google API ${res.status}: ${await res.text()}`);
      }
      if (payload.event_id) {
        await supabase
          .from("admin_calendar_events")
          .delete()
          .eq("id", payload.event_id);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Google event body
    const googleEvent = buildGoogleEvent(payload);

    let res: Response;
    if (action === "create") {
      res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleEvent),
      });
    } else {
      if (!payload.external_event_id) {
        return new Response(
          JSON.stringify({ error: "external_event_id required for update" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      res = await fetch(
        `${baseUrl}/${encodeURIComponent(payload.external_event_id)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(googleEvent),
        },
      );
    }

    if (!res.ok) {
      throw new Error(`Google API ${res.status}: ${await res.text()}`);
    }

    const created = await res.json();

    // Upsert into local DB
    const { data: member } = await supabase
      .from("admin_workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .single();

    if (!member?.workspace_id) {
      throw new Error("No workspace found for user");
    }

    const dbEvent = {
      workspace_id: member.workspace_id,
      calendar_account_id: account.id,
      external_event_id: created.id,
      title: payload.title ?? "(No title)",
      description: payload.description ?? null,
      location: payload.location ?? null,
      start_time: payload.start_time!,
      end_time: payload.end_time!,
      all_day: payload.all_day ?? false,
      source: "google",
      is_read_only: false,
      updated_at: new Date().toISOString(),
    };

    const upsertQuery = supabase.from("admin_calendar_events").upsert(dbEvent, {
      onConflict: "calendar_account_id,external_event_id",
    });

    if (action === "update" && payload.event_id) {
      await supabase
        .from("admin_calendar_events")
        .update(dbEvent)
        .eq("id", payload.event_id);
    } else {
      await upsertQuery;
    }

    return new Response(
      JSON.stringify({ ok: true, external_event_id: created.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Write error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildGoogleEvent(payload: WritePayload) {
  if (payload.all_day) {
    return {
      summary: payload.title,
      description: payload.description,
      location: payload.location,
      start: { date: payload.start_time?.slice(0, 10) },
      end: { date: payload.end_time?.slice(0, 10) },
    };
  }
  return {
    summary: payload.title,
    description: payload.description,
    location: payload.location,
    start: { dateTime: payload.start_time },
    end: { dateTime: payload.end_time },
  };
}
