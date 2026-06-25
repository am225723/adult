/**
 * IntakeQ API Adapter — Supabase Edge Function
 *
 * Secure server-side proxy to the IntakeQ REST API (https://intakeq.com/api/v1/).
 * The INTAKEQ_API_KEY never reaches the browser.
 *
 * Required Supabase secret:
 *   INTAKEQ_API_KEY  — Found at More > Settings > Integrations > Developer API
 *
 * Rate limits: 10 req/min, 500/day on standard plan.
 *
 * Supported actions (POST body { action, ...params }):
 *   getBookingSettings
 *   searchClient      { search }
 *   createOrUpdateClient { firstName, lastName, email, phone, ... }
 *   getAppointments   { client?, startDate?, endDate?, status?, practitionerEmail? }
 *   createAppointment { clientId, serviceId, locationId, practitionerId, utcDateTime, ... }
 *   cancelAppointment { appointmentId, reason? }
 */

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const INTAKEQ_API_KEY = Deno.env.get("INTAKEQ_API_KEY") ?? "";
const INTAKEQ_BASE = "https://intakeq.com/api/v1";

// ── HTTP helper ───────────────────────────────────────────────────────────────

class IntakeQError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
    this.name = "IntakeQError";
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new IntakeQError(`Missing required field: ${field}`, 400);
  }
  return value.trim();
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !isFinite(value)) {
    throw new IntakeQError(`Missing or invalid numeric field: ${field}`, 400);
  }
  return value;
}

async function iq(
  path: string,
  options: RequestInit = {},
  opts: { allowNotFound?: boolean } = {},
) {
  if (!INTAKEQ_API_KEY) {
    throw new IntakeQError(
      "IntakeQ API key not configured. Set INTAKEQ_API_KEY in Supabase Edge Function secrets.",
      503,
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch(`${INTAKEQ_BASE}${path}`, {
      ...options,
      signal: options.signal ?? controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Key": INTAKEQ_API_KEY,
        ...(options.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new IntakeQError("IntakeQ request timed out.", 504);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  const text = await res.text();
  if (res.status === 401) throw new IntakeQError("IntakeQ API key is invalid or expired.", 401);
  if (res.status === 404) {
    if (opts.allowNotFound) return null;
    throw new IntakeQError(`IntakeQ resource not found: ${path}`, 404);
  }
  if (!res.ok) throw new IntakeQError(`IntakeQ error ${res.status}: ${text}`, res.status);
  return text ? JSON.parse(text) : null;
}

// ── IntakeQ types ─────────────────────────────────────────────────────────────

interface IntakeQClient {
  ClientId: number;
  Name: string;
  FirstName: string;
  LastName: string;
  MiddleName?: string;
  Email: string;
  Phone: string;
  MobilePhone?: string;
  Address?: string;
  StreetAddress?: string;
  City?: string;
  StateShort?: string;
  PostalCode?: string;
  Country?: string;
  DateOfBirth?: number;
  Tags?: string[];
  ExternalClientId?: string;
}

interface IntakeQService {
  Id: string;
  Name: string;
  Duration: number;
  Price?: number;
}

interface IntakeQLocation {
  Id: string;
  Name: string;
  Address?: string;
}

interface IntakeQPractitioner {
  Id: string;
  CompleteName: string;
  FirstName: string;
  LastName: string;
  Email: string;
}

interface IntakeQAppointment {
  Id: string;
  ClientId: number;
  ClientName: string;
  ClientEmail: string;
  ClientPhone: string;
  ServiceId: string;
  ServiceName: string;
  LocationId: string;
  LocationName: string;
  PractitionerId: string;
  PractitionerName: string;
  Status: string;
  StartDate: number;
  EndDate: number;
  Duration: number;
  StartDateIso?: string;
  EndDateIso?: string;
  StartDateLocalFormatted?: string;
  DateCreated: number;
}

// ── Action implementations ────────────────────────────────────────────────────

async function getBookingSettings(): Promise<{
  Services: IntakeQService[];
  Locations: IntakeQLocation[];
  Practitioners: IntakeQPractitioner[];
}> {
  const data = await iq("/appointments/settings", {}, { allowNotFound: true });
  return data ?? { Services: [], Locations: [], Practitioners: [] };
}

async function searchClient(search: string): Promise<IntakeQClient[]> {
  const normalizedSearch = requireString(search, "search");
  const qs = new URLSearchParams({ search: normalizedSearch, includeProfile: "true" });
  const data = await iq(`/clients?${qs}`, {}, { allowNotFound: true });
  return (data ?? []) as IntakeQClient[];
}

async function createOrUpdateClient(payload: {
  clientId?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress?: string;
  city?: string;
  stateShort?: string;
  postalCode?: string;
  country?: string;
}) {
  const firstName = requireString(payload.firstName, "firstName");
  const lastName = requireString(payload.lastName, "lastName");
  const email = requireString(payload.email, "email");
  const phone = requireString(payload.phone, "phone");

  const body: Record<string, unknown> = {
    FirstName: firstName,
    LastName: lastName,
    Email: email,
    Phone: phone,
  };
  if (payload.clientId != null) body.ClientId = payload.clientId;
  if (payload.streetAddress) body.StreetAddress = payload.streetAddress;
  if (payload.city) body.City = payload.city;
  if (payload.stateShort) body.StateShort = payload.stateShort;
  if (payload.postalCode) body.PostalCode = payload.postalCode;
  if (payload.country) body.Country = payload.country;

  const data = await iq("/clients", { method: "POST", body: JSON.stringify(body) });
  return data as IntakeQClient;
}

async function getAppointments(params: {
  client?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  practitionerEmail?: string;
}): Promise<IntakeQAppointment[]> {
  const qs = new URLSearchParams();
  if (params.client) qs.set("client", params.client);
  if (params.startDate) qs.set("startDate", params.startDate);
  if (params.endDate) qs.set("endDate", params.endDate);
  if (params.status) qs.set("status", params.status);
  if (params.practitionerEmail) qs.set("practitionerEmail", params.practitionerEmail);
  const data = await iq(`/appointments?${qs}`, {}, { allowNotFound: true });
  return (data ?? []) as IntakeQAppointment[];
}

async function createAppointment(payload: {
  clientId: number;
  serviceId: string;
  locationId: string;
  practitionerId: string;
  utcDateTime: number;
  status?: "Confirmed" | "WaitingConfirmation";
  sendEmailNotification?: boolean;
  reminderType?: "Sms" | "Email" | "Voice" | "OptOut";
  clientNote?: string;
}): Promise<IntakeQAppointment> {
  requireNumber(payload.clientId, "clientId");
  requireString(payload.serviceId, "serviceId");
  requireString(payload.locationId, "locationId");
  requireString(payload.practitionerId, "practitionerId");
  requireNumber(payload.utcDateTime, "utcDateTime");

  const status = payload.status ?? "Confirmed";
  const body = {
    ClientId: payload.clientId,
    ServiceId: payload.serviceId,
    LocationId: payload.locationId,
    PractitionerId: payload.practitionerId,
    UtcDateTime: payload.utcDateTime,
    Status: status,
    SendClientEmailNotification: status === "Confirmed" ? (payload.sendEmailNotification ?? true) : false,
    ReminderType: payload.reminderType ?? "Email",
    ...(payload.clientNote ? { ClientNote: payload.clientNote } : {}),
  };
  const data = await iq("/appointments", { method: "POST", body: JSON.stringify(body) });
  return data as IntakeQAppointment;
}

async function cancelAppointment(appointmentId: string, reason?: string): Promise<IntakeQAppointment> {
  requireString(appointmentId, "appointmentId");
  const body: Record<string, string> = { AppointmentId: appointmentId };
  if (reason) body.Reason = reason;
  const data = await iq("/appointments/cancellation", { method: "POST", body: JSON.stringify(body) });
  return data as IntakeQAppointment;
}

// ── Auth + workspace helper ───────────────────────────────────────────────────

async function requireAuthAndWorkspace(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new IntakeQError("Missing Authorization header", 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) throw new IntakeQError("Unauthorized", 401);

  // Verify the user belongs to at least one workspace
  const { data: membership, error: wsError } = await supabase
    .from("admin_workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (wsError || !membership) throw new IntakeQError("No workspace membership found", 403);

  return { user, supabase, workspaceId: membership.workspace_id as string };
}

async function writeAuditLog(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  userId: string,
  action: string,
  metadata?: Record<string, unknown>,
) {
  const { error } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    user_id: userId,
    action,
    resource_type: "intakeq_appointment",
    metadata,
  });
  if (error) {
    console.error("[audit_log] Failed to write entry:", action, error.message);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user, supabase, workspaceId } = await requireAuthAndWorkspace(req);
    const body = await req.json();
    const { action } = body;
    let result: unknown;

    switch (action) {
      case "getBookingSettings":
        result = await getBookingSettings();
        break;
      case "searchClient":
        result = await searchClient(body.search);
        break;
      case "createOrUpdateClient":
        result = await createOrUpdateClient({
          clientId: body.clientId,
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          phone: body.phone,
          streetAddress: body.streetAddress,
          city: body.city,
          stateShort: body.stateShort,
          postalCode: body.postalCode,
          country: body.country,
        });
        break;
      case "getAppointments":
        result = await getAppointments({
          client: body.client,
          startDate: body.startDate,
          endDate: body.endDate,
          status: body.status,
          practitionerEmail: body.practitionerEmail,
        });
        break;
      case "createAppointment": {
        result = await createAppointment({
          clientId: body.clientId,
          serviceId: body.serviceId,
          locationId: body.locationId,
          practitionerId: body.practitionerId,
          utcDateTime: body.utcDateTime,
          status: body.status,
          sendEmailNotification: body.sendEmailNotification,
          reminderType: body.reminderType,
          clientNote: body.clientNote,
        });
        const appt = result as IntakeQAppointment;
        await writeAuditLog(supabase, workspaceId, user.id, "intakeq_appointment_created", {
          appointmentId: appt.Id,
          clientId: appt.ClientId,
          serviceId: appt.ServiceId,
          startDate: appt.StartDate,
          status: appt.Status,
        });
        break;
      }
      case "cancelAppointment": {
        result = await cancelAppointment(body.appointmentId, body.reason);
        const appt = result as IntakeQAppointment;
        await writeAuditLog(supabase, workspaceId, user.id, "intakeq_appointment_cancelled", {
          appointmentId: appt.Id,
          reason: body.reason,
        });
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const e = err instanceof IntakeQError ? err : new IntakeQError("An error occurred", 500);
    const clientMessage =
      e.status === 400 ? e.message :
      e.status === 401 ? "Unauthorized" :
      e.status === 403 ? "Forbidden" :
      e.status === 503 ? "IntakeQ is not configured. Contact your administrator." :
      "An error occurred. Please try again.";
    return new Response(JSON.stringify({ error: clientMessage }), {
      status: e.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
