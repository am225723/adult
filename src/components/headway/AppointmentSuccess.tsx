import { CheckCircle2, Calendar, User, ClipboardCheck } from "lucide-react";
import type { ClientData } from "@/hooks/useHeadwayWorkflow";
import type { AppointmentSelection } from "./AppointmentTypeSelector";
import type { AppointmentCreationResult } from "@/hooks/usePatientQAppointment";

interface AppointmentSuccessProps {
  clientData: Partial<ClientData>;
  apptSelection: AppointmentSelection | null;
  result: AppointmentCreationResult | null;
  onClose: () => void;
}

export function AppointmentSuccess({ clientData, apptSelection, result, onClose }: AppointmentSuccessProps) {
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
        <CheckCircle2 size={32} className="text-emerald-600 dark:text-emerald-400" />
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground">Appointment Created</h3>
        <p className="text-xs text-muted-foreground mt-1">
          The appointment has been scheduled in IntakeQ and the contact has been saved.
        </p>
      </div>

      <div className="w-full space-y-3 text-left">
        {/* Patient summary */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <User size={13} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Patient</span>
          </div>
          <Row label="Name" value={result?.client.Name ?? clientData.fullName} />
          <Row label="Email" value={result?.client.Email ?? clientData.email} />
          <Row label="Phone" value={result?.client.Phone ?? clientData.phone} />
          {result?.wasExistingClient && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">Matched existing IntakeQ client</p>
          )}
          {result?.client.ClientId != null && (
            <Row label="IntakeQ ID" value={String(result.client.ClientId)} mono />
          )}
        </div>

        {/* Appointment summary */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={13} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Appointment</span>
          </div>
          <Row label="Service" value={result?.appointment.ServiceName} />
          <Row label="Provider" value={result?.appointment.PractitionerName} />
          <Row label="Date" value={result?.appointment.StartDateLocalFormatted ?? apptSelection?.date} />
          <Row label="Time" value={apptSelection?.time} />
          <Row label="Status" value={result?.appointment.Status} />
          {result?.appointment.Id && (
            <Row label="Appt ID" value={result.appointment.Id} mono />
          )}
        </div>

        {/* Audit note */}
        <div className="rounded-xl border border-border bg-muted/20 p-3 flex gap-2">
          <ClipboardCheck size={12} className="text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            This action has been recorded in the audit log with timestamps and user attribution.
          </p>
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Done
      </button>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-[10px] text-foreground break-all" : "text-foreground"}>
        {value || "—"}
      </span>
    </div>
  );
}
