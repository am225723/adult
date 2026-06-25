import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { patientqClient, type PatientQPatient, type PatientQAppointment } from "@/lib/patientqClient";
import type { AppointmentFormat } from "@/config/appointmentTypes";

export function useAppointmentTypes() {
  return useQuery({
    queryKey: ["patientq", "appointment-types"],
    queryFn: () => patientqClient.getAppointmentTypes(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export interface AppointmentCreationPayload {
  patient: {
    name: string;
    email: string;
    phone: string;
    address?: string;
  };
  appointment: {
    appointmentTypeId: string;
    date: string;
    time: string;
    format: AppointmentFormat;
    providerId?: string;
    notes?: string;
  };
}

export interface AppointmentCreationResult {
  patient: PatientQPatient;
  appointment: PatientQAppointment;
  wasExistingPatient: boolean;
}

export function useCreatePatientQAppointment() {
  const [result, setResult] = useState<AppointmentCreationResult | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: AppointmentCreationPayload): Promise<AppointmentCreationResult> => {
      // 1. Search for existing patient
      const { patients } = await patientqClient.searchPatient({
        email: payload.patient.email,
        phone: payload.patient.phone,
      });

      let patient: PatientQPatient;
      let wasExistingPatient = false;

      if (patients && patients.length > 0) {
        patient = patients[0];
        wasExistingPatient = true;
      } else {
        patient = await patientqClient.createPatient(payload.patient);
      }

      // 2. Create appointment
      const appointment = await patientqClient.createAppointment({
        patientId: patient.id,
        ...payload.appointment,
      });

      return { patient, appointment, wasExistingPatient };
    },
    onSuccess: (data) => setResult(data),
  });

  return { ...mutation, result };
}
