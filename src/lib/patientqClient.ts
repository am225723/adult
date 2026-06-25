import { supabase } from "@/lib/supabase";

async function callEdgeFunction(action: string, payload?: Record<string, unknown>) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL is not configured");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(
    new URL("/functions/v1/patientq-api", supabaseUrl).toString(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    },
  );

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? `IntakeQ API error (${res.status})`);
  return json;
}

// ── IntakeQ types (mirrors edge function) ────────────────────────────────────

export interface IntakeQService {
  Id: string;
  Name: string;
  Duration: number;
  Price?: number;
}

export interface IntakeQLocation {
  Id: string;
  Name: string;
  Address?: string;
}

export interface IntakeQPractitioner {
  Id: string;
  CompleteName: string;
  FirstName: string;
  LastName: string;
  Email: string;
}

export interface IntakeQClient {
  ClientId: number;
  Name: string;
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  Address?: string;
  StreetAddress?: string;
  City?: string;
  StateShort?: string;
  PostalCode?: string;
  Country?: string;
}

export interface IntakeQAppointment {
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
  StartDateLocalFormatted?: string;
}

export interface BookingSettings {
  Services: IntakeQService[];
  Locations: IntakeQLocation[];
  Practitioners: IntakeQPractitioner[];
}

// ── Client ────────────────────────────────────────────────────────────────────

export const intakeqClient = {
  getBookingSettings: (): Promise<BookingSettings> =>
    callEdgeFunction("getBookingSettings"),

  searchClient: (search: string): Promise<IntakeQClient[]> =>
    callEdgeFunction("searchClient", { search }),

  createOrUpdateClient: (payload: {
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
  }): Promise<IntakeQClient> =>
    callEdgeFunction("createOrUpdateClient", payload as Record<string, unknown>),

  getAppointments: (params: {
    client?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    practitionerEmail?: string;
  }): Promise<IntakeQAppointment[]> =>
    callEdgeFunction("getAppointments", params as Record<string, unknown>),

  createAppointment: (payload: {
    clientId: number;
    serviceId: string;
    locationId: string;
    practitionerId: string;
    utcDateTime: number;
    status?: "Confirmed" | "WaitingConfirmation";
    sendEmailNotification?: boolean;
    reminderType?: "Sms" | "Email" | "Voice" | "OptOut";
    clientNote?: string;
  }): Promise<IntakeQAppointment> =>
    callEdgeFunction("createAppointment", payload as Record<string, unknown>),

  cancelAppointment: (appointmentId: string, reason?: string): Promise<IntakeQAppointment> =>
    callEdgeFunction("cancelAppointment", { appointmentId, reason }),
};
