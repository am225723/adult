export interface AppointmentType {
  id: string;
  label: string;
  duration: number;
  formats: AppointmentFormat[];
}

export type AppointmentFormat = "in-person" | "telehealth" | "phone";

export const FORMAT_LABELS: Record<AppointmentFormat, string> = {
  "in-person": "In-Person",
  telehealth: "Telehealth (Video)",
  phone: "Phone",
};

// Fallback appointment types used when PatientQ API types are unavailable.
// Keep in sync with supabase/functions/patientq-api/index.ts FALLBACK_APPOINTMENT_TYPES.
export const FALLBACK_APPOINTMENT_TYPES: AppointmentType[] = [
  { id: "initial_eval", label: "Initial Evaluation", duration: 60, formats: ["in-person", "telehealth"] },
  { id: "follow_up_30", label: "Follow-Up (30 min)", duration: 30, formats: ["in-person", "telehealth", "phone"] },
  { id: "follow_up_60", label: "Follow-Up (60 min)", duration: 60, formats: ["in-person", "telehealth"] },
  { id: "med_mgmt", label: "Medication Management", duration: 20, formats: ["in-person", "telehealth", "phone"] },
  { id: "crisis", label: "Crisis Intervention", duration: 60, formats: ["in-person", "telehealth", "phone"] },
  { id: "group", label: "Group Session", duration: 90, formats: ["in-person", "telehealth"] },
  { id: "consult", label: "Consultation", duration: 30, formats: ["in-person", "telehealth", "phone"] },
];
