import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { intakeqClient, type IntakeQClient, type IntakeQAppointment } from "@/lib/patientqClient";

export function useBookingSettings() {
  return useQuery({
    queryKey: ["intakeq", "booking-settings"],
    queryFn: () => intakeqClient.getBookingSettings(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export interface AppointmentCreationPayload {
  client: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    streetAddress?: string;
    city?: string;
    stateShort?: string;
    postalCode?: string;
    country?: string;
  };
  appointment: {
    serviceId: string;
    locationId: string;
    practitionerId: string;
    utcDateTime: number; // Unix ms
    status?: "Confirmed" | "WaitingConfirmation";
    reminderType?: "Sms" | "Email" | "Voice" | "OptOut";
    clientNote?: string;
  };
}

export interface AppointmentCreationResult {
  client: IntakeQClient;
  appointment: IntakeQAppointment;
  wasExistingClient: boolean;
}

export function useCreateIntakeQAppointment() {
  const [result, setResult] = useState<AppointmentCreationResult | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: AppointmentCreationPayload): Promise<AppointmentCreationResult> => {
      // 1. Search for existing client by email
      const existing = await intakeqClient.searchClient(payload.client.email);
      // Narrow to exact email match
      const matched = existing.filter(
        (c) => c.Email?.toLowerCase() === payload.client.email.toLowerCase(),
      );

      let client: IntakeQClient;
      let wasExistingClient = false;

      if (matched.length > 0) {
        // Update existing client with latest data (GET first, then POST back per API docs)
        client = await intakeqClient.createOrUpdateClient({
          clientId: matched[0].ClientId,
          ...payload.client,
        });
        wasExistingClient = true;
      } else {
        // Create new client
        client = await intakeqClient.createOrUpdateClient(payload.client);
      }

      // 2. Create appointment
      const appointment = await intakeqClient.createAppointment({
        clientId: client.ClientId,
        ...payload.appointment,
      });

      return { client, appointment, wasExistingClient };
    },
    onSuccess: (data) => setResult(data),
  });

  return { ...mutation, result };
}
