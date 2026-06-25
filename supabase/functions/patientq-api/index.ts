/**
 * PatientQ API Adapter - Supabase Edge Function
 *
 * This function acts as a secure server-side proxy to the PatientQ API.
 * API keys never leave the server.
 *
 * Required environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
 *   PATIENTQ_API_KEY   - Your PatientQ API key
 *   PATIENTQ_API_BASE  - PatientQ API base URL (e.g. https://api.patientq.com/v1)
 *
 * Actions supported via POST body:
 *   { action: "getAppointmentTypes" }
 *   { action: "searchPatient", email?, phone? }
 *   { action: "createPatient", name, email, phone, address? }
 *   { action: "createAppointment", patientId, appointmentTypeId, date, time, format, providerId?, notes? }
 */

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PATIENTQ_API_KEY = Deno.env.get("PATIENTQ_API_KEY") ?? "";
const PATIENTQ_API_BASE = Deno.env.get("PATIENTQ_API_BASE") ?? "https://api.patientq.com/v1";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function patientqFetch(path: string, options: RequestInit = {}) {
  if (!PATIENTQ_API_KEY) {
    throw new Error("PatientQ API key not configured. Set PATIENTQ_API_KEY in Supabase secrets.");
  }
  const url = `${PATIENTQ_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${PATIENTQ_API_KEY}`,
      ...(options.headers ?? {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`PatientQ API error ${res.status}: ${body}`);
  }
  return JSON.parse(body);
}

// ── PatientQ API methods ──────────────────────────────────────────────────────

async function getAppointmentTypes() {
  // TODO: Replace with actual PatientQ endpoint when available
  // return await patientqFetch("/appointment-types");
  //
  // Fallback: return centralized config if API not available
  return FALLBACK_APPOINTMENT_TYPES;
}

async function searchPatient({ email, phone }: { email?: string; phone?: string }) {
  // TODO: Replace with actual PatientQ search endpoint
  // Example: GET /patients?email=...&phone=...
  // const params = new URLSearchParams();
  // if (email) params.set("email", email);
  // if (phone) params.set("phone", phone);
  // return await patientqFetch(`/patients?${params}`);

  // Stub: return null (patient not found) for now
  return { patients: [] };
}

async function createPatient(payload: {
  name: string;
  email: string;
  phone: string;
  address?: string;
}) {
  // TODO: Replace with actual PatientQ create patient endpoint
  // return await patientqFetch("/patients", {
  //   method: "POST",
  //   body: JSON.stringify(payload),
  // });

  // Stub: return a mock patient ID
  return {
    id: `pq_patient_stub_${Date.now()}`,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    _stub: true,
  };
}

async function createAppointment(payload: {
  patientId: string;
  appointmentTypeId: string;
  date: string;
  time: string;
  format: string;
  providerId?: string;
  notes?: string;
}) {
  // TODO: Replace with actual PatientQ create appointment endpoint
  // return await patientqFetch("/appointments", {
  //   method: "POST",
  //   body: JSON.stringify(payload),
  // });

  // Stub: return a mock appointment ID
  return {
    id: `pq_appt_stub_${Date.now()}`,
    patientId: payload.patientId,
    appointmentTypeId: payload.appointmentTypeId,
    date: payload.date,
    time: payload.time,
    format: payload.format,
    status: "scheduled",
    _stub: true,
  };
}

// ── Fallback appointment types (used when PatientQ API is not yet configured) ─

const FALLBACK_APPOINTMENT_TYPES = [
  { id: "initial_eval", label: "Initial Evaluation", duration: 60, formats: ["in-person", "telehealth"] },
  { id: "follow_up_30", label: "Follow-Up (30 min)", duration: 30, formats: ["in-person", "telehealth", "phone"] },
  { id: "follow_up_60", label: "Follow-Up (60 min)", duration: 60, formats: ["in-person", "telehealth"] },
  { id: "med_mgmt", label: "Medication Management", duration: 20, formats: ["in-person", "telehealth", "phone"] },
  { id: "crisis", label: "Crisis Intervention", duration: 60, formats: ["in-person", "telehealth", "phone"] },
  { id: "group", label: "Group Session", duration: 90, formats: ["in-person", "telehealth"] },
  { id: "consult", label: "Consultation", duration: 30, formats: ["in-person", "telehealth", "phone"] },
];

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing Authorization header");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    await getAuthenticatedUser(req);

    const body = await req.json();
    const { action } = body;

    let result: unknown;

    switch (action) {
      case "getAppointmentTypes":
        result = await getAppointmentTypes();
        break;
      case "searchPatient":
        result = await searchPatient({ email: body.email, phone: body.phone });
        break;
      case "createPatient":
        result = await createPatient({
          name: body.name,
          email: body.email,
          phone: body.phone,
          address: body.address,
        });
        break;
      case "createAppointment":
        result = await createAppointment({
          patientId: body.patientId,
          appointmentTypeId: body.appointmentTypeId,
          date: body.date,
          time: body.time,
          format: body.format,
          providerId: body.providerId,
          notes: body.notes,
        });
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Never expose internal details in production
    const isAuthError = message.includes("Unauthorized") || message.includes("Authorization");
    return new Response(
      JSON.stringify({ error: isAuthError ? "Unauthorized" : "An error occurred. Please try again." }),
      {
        status: isAuthError ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
