import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export type WorkflowStatus =
  | "detected"
  | "opened"
  | "data_collected"
  | "needs_review"
  | "ready_to_create"
  | "contact_saved"
  | "appointment_created"
  | "failed"
  | "cancelled";

export interface ClientData {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  appointmentDate: string;
  appointmentTime: string;
}

export interface HeadwayWorkflow {
  id?: string;
  quoMessageId?: string;
  headwayLink: string;
  senderName?: string;
  status: WorkflowStatus;
  clientData?: Partial<ClientData>;
  appointmentData?: Record<string, unknown>;
  contactId?: string;
  patientqPatientId?: string;
  patientqAppointmentId?: string;
  errorMessage?: string;
}

async function getWorkspaceId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("admin_workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (error || !data) throw new Error("No workspace found");
  return data.workspace_id;
}

async function writeAuditLog(
  workspaceId: string,
  userId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
) {
  const { error } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata,
  });
  if (error) {
    console.error("[audit_log] Failed to write audit entry:", action, error.message);
  }
}

export function useHeadwayWorkflow() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [workflow, setWorkflow] = useState<HeadwayWorkflow | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const startWorkflow = useCallback((params: {
    headwayLink: string;
    senderName?: string;
    quoMessageId?: string;
  }) => {
    setWorkflow({
      headwayLink: params.headwayLink,
      senderName: params.senderName,
      quoMessageId: params.quoMessageId,
      status: "detected",
    });
    setIsOpen(true);
  }, []);

  const closeWorkflow = useCallback(() => {
    setIsOpen(false);
    setWorkflow(null);
  }, []);

  const saveWorkflow = useMutation({
    mutationFn: async (
      updates: Partial<HeadwayWorkflow> & { status: WorkflowStatus; _workflowSnapshot?: HeadwayWorkflow | null },
    ) => {
      if (!user) throw new Error("Not authenticated");
      // Capture snapshot at call-time to avoid race with concurrent saves
      const snap = updates._workflowSnapshot ?? workflow;
      const wsId = await getWorkspaceId(user.id);

      const payload = {
        workspace_id: wsId,
        created_by: user.id,
        quo_message_id: snap?.quoMessageId ?? updates.quoMessageId,
        headway_link: snap?.headwayLink ?? updates.headwayLink,
        sender_name: snap?.senderName ?? updates.senderName,
        status: updates.status,
        client_data: updates.clientData ?? snap?.clientData,
        appointment_data: updates.appointmentData ?? snap?.appointmentData,
        contact_id: updates.contactId ?? snap?.contactId,
        patientq_patient_id: updates.patientqPatientId ?? snap?.patientqPatientId,
        patientq_appointment_id: updates.patientqAppointmentId ?? snap?.patientqAppointmentId,
        error_message: updates.errorMessage,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (snap?.id) {
        const { data, error } = await supabase
          .from("headway_workflows")
          .update(payload)
          .eq("id", snap.id)
          .select("id")
          .single();
        if (error) throw error;
        result = data;
      } else {
        const { data, error } = await supabase
          .from("headway_workflows")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        result = data;
      }

      await writeAuditLog(wsId, user.id, `headway_workflow_${updates.status}`, "headway_workflow", result.id, {
        headway_link: payload.headway_link,
        status: updates.status,
      });

      return result.id as string;
    },
    onSuccess: (id, updates) => {
      setWorkflow((prev) => prev ? { ...prev, ...updates, id } : null);
      qc.invalidateQueries({ queryKey: ["headway-workflows"] });
    },
  });

  const updateStatus = useCallback((status: WorkflowStatus, extra?: Partial<HeadwayWorkflow>) => {
    setWorkflow((prev) => prev ? { ...prev, status, ...extra } : null);
  }, []);

  return {
    workflow,
    isOpen,
    startWorkflow,
    closeWorkflow,
    updateStatus,
    saveWorkflow,
  };
}
