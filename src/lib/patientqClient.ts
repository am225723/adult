import { supabase } from "@/lib/supabase";
import type { AppointmentFormat } from "@/config/appointmentTypes";

async function callEdgeFunction(action: string, payload?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/patientq-api`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    },
  );

  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "PatientQ API error");
  return json;
}

export interface PatientQAppointmentType {
  id: string;
  label: string;
  duration: number;
  formats: AppointmentFormat[];
}

export interface PatientQPatient {
  id: string;
  name: string;
  email: string;
  phone: string;
  _stub?: boolean;
}

export interface PatientQAppointment {
  id: string;
  patientId: string;
  appointmentTypeId: string;
  date: string;
  time: string;
  format: string;
  status: string;
  _stub?: boolean;
}

export const patientqClient = {
  getAppointmentTypes: (): Promise<PatientQAppointmentType[]> =>
    callEdgeFunction("getAppointmentTypes"),

  searchPatient: (params: { email?: string; phone?: string }): Promise<{ patients: PatientQPatient[] }> =>
    callEdgeFunction("searchPatient", params),

  createPatient: (payload: {
    name: string;
    email: string;
    phone: string;
    address?: string;
  }): Promise<PatientQPatient> => callEdgeFunction("createPatient", payload),

  createAppointment: (payload: {
    patientId: string;
    appointmentTypeId: string;
    date: string;
    time: string;
    format: AppointmentFormat;
    providerId?: string;
    notes?: string;
  }): Promise<PatientQAppointment> => callEdgeFunction("createAppointment", payload),
};
