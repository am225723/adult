import { useState } from "react";
import {
  X, ChevronRight, ExternalLink, AlertCircle, CheckCircle2,
  User, Calendar, ClipboardList, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/useToast";
import { useHeadwayWorkflow, type ClientData } from "@/hooks/useHeadwayWorkflow";
import { useCreateContact, useUpdateContact } from "@/hooks/useContacts";
import { useFindExistingContact } from "@/hooks/useContactMerge";
import { useCreatePatientQAppointment, useAppointmentTypes } from "@/hooks/usePatientQAppointment";
import { supabase } from "@/lib/supabase";
import { PatientDataForm } from "./PatientDataForm";
import { AppointmentTypeSelector, type AppointmentSelection } from "./AppointmentTypeSelector";
import { AppointmentSuccess } from "./AppointmentSuccess";

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEPS = [
  { num: 1, label: "Detected" },
  { num: 2, label: "Open Headway" },
  { num: 3, label: "Collect Data" },
  { num: 4, label: "Review" },
  { num: 5, label: "Appointment" },
  { num: 6, label: "Confirm" },
  { num: 7, label: "Done" },
] as const;

interface HeadwayWorkflowPanelProps {
  workflow: ReturnType<typeof useHeadwayWorkflow>["workflow"];
  isOpen: boolean;
  onClose: () => void;
  saveWorkflow: ReturnType<typeof useHeadwayWorkflow>["saveWorkflow"];
  updateStatus: ReturnType<typeof useHeadwayWorkflow>["updateStatus"];
}

export function HeadwayWorkflowPanel({
  workflow,
  isOpen,
  onClose,
  saveWorkflow,
  updateStatus,
}: HeadwayWorkflowPanelProps) {
  const [step, setStep] = useState<Step>(1);
  const [clientData, setClientData] = useState<Partial<ClientData>>({});
  const [apptSelection, setApptSelection] = useState<AppointmentSelection | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [mergeChoice, setMergeChoice] = useState<"update" | "new" | null>(null);

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const createAppt = useCreatePatientQAppointment();
  const { data: apptTypes, isLoading: loadingTypes } = useAppointmentTypes();

  const existing = useFindExistingContact(
    clientData.email,
    clientData.phone,
  );

  if (!isOpen || !workflow) return null;

  function advance() {
    setStep((s) => Math.min(s + 1, 7) as Step);
  }

  function handleOpenHeadway() {
    window.open(workflow!.headwayLink, "_blank", "noopener,noreferrer");
    updateStatus("opened");
    saveWorkflow.mutate({ status: "opened" });
    advance();
  }

  function handleDataCollected(data: Partial<ClientData>) {
    setClientData(data);
    updateStatus("data_collected", { clientData: data });
    advance();
  }

  function handleReviewContinue() {
    if (!clientData.fullName) {
      toast({ variant: "destructive", title: "Client name is required before continuing." });
      return;
    }
    updateStatus("needs_review");
    advance();
  }

  function handleApptSelected(sel: AppointmentSelection) {
    setApptSelection(sel);
    updateStatus("ready_to_create", { appointmentData: sel as Record<string, unknown> });
    advance();
  }

  async function handleConfirmCreate() {
    if (!confirmed) {
      toast({ variant: "destructive", title: "Please check the confirmation box to proceed." });
      return;
    }
    if (!clientData.fullName || !clientData.email || !clientData.phone) {
      toast({ variant: "destructive", title: "Name, email, and phone are required." });
      return;
    }
    if (!apptSelection) return;

    try {
      // 1. Create or update contact in app
      let contactId = existing.data?.id;

      const contactPayload = {
        display_name: clientData.fullName,
        primary_email: clientData.email || null,
        primary_phone: clientData.phone || null,
        notes: [
          existing.data?.notes,
          `Source: Headway | Intake: ${new Date().toLocaleDateString()}`,
          clientData.address ? `Address: ${clientData.address}` : null,
        ].filter(Boolean).join("\n"),
      };

      if (contactId && mergeChoice === "update") {
        await updateContact.mutateAsync({ id: contactId, ...contactPayload });
      } else {
        const newContact = await createContact.mutateAsync(contactPayload);
        contactId = newContact.id;
      }

      // 2. Create PatientQ appointment
      const apptResult = await createAppt.mutateAsync({
        patient: {
          name: clientData.fullName,
          email: clientData.email!,
          phone: clientData.phone!,
          address: clientData.address,
        },
        appointment: {
          appointmentTypeId: apptSelection.appointmentTypeId,
          date: clientData.appointmentDate || apptSelection.date || "",
          time: clientData.appointmentTime || apptSelection.time || "",
          format: apptSelection.format,
          providerId: apptSelection.providerId,
          notes: apptSelection.notes,
        },
      });

      // 3. Save external ref
      const { data: { session } } = await supabase.auth.getSession();
      if (session && contactId) {
        const { data: wsData } = await supabase
          .from("admin_workspace_members")
          .select("workspace_id")
          .eq("user_id", session.user.id)
          .limit(1)
          .single();

        if (wsData) {
          await supabase.from("contact_external_refs").insert([
            {
              workspace_id: wsData.workspace_id,
              contact_id: contactId,
              source: "patientq",
              external_id: apptResult.patient.id,
              metadata: { appointment_id: apptResult.appointment.id },
            },
            {
              workspace_id: wsData.workspace_id,
              contact_id: contactId,
              source: "headway",
              external_id: workflow.headwayLink,
              metadata: { headway_link: workflow.headwayLink },
            },
          ]);
        }
      }

      // 4. Finalize workflow
      await saveWorkflow.mutateAsync({
        status: "appointment_created",
        contactId,
        patientqPatientId: apptResult.patient.id,
        patientqAppointmentId: apptResult.appointment.id,
        clientData,
        appointmentData: apptSelection as Record<string, unknown>,
      });

      updateStatus("appointment_created", {
        contactId,
        patientqPatientId: apptResult.patient.id,
        patientqAppointmentId: apptResult.appointment.id,
      });

      advance();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast({ variant: "destructive", title: "Failed to create appointment", description: msg });
      await saveWorkflow.mutateAsync({ status: "failed", errorMessage: msg });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />

      {/* Panel */}
      <div
        className={cn(
          "relative z-10 w-full max-w-xl flex flex-col h-full",
          "bg-background border-l border-border shadow-2xl",
          "overflow-hidden",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-0.5">
              Clinical Intake
            </p>
            <h2 className="text-base font-semibold text-foreground">Headway → PatientQ</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-5 py-3 border-b border-border shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            {STEPS.map((s, i) => {
              const done = step > s.num;
              const active = step === s.num;
              return (
                <div key={s.num} className="flex items-center gap-1">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={cn(
                      "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors",
                      done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}>
                      {done ? <CheckCircle2 size={11} /> : s.num}
                    </div>
                    <span className={cn(
                      "text-[9px] whitespace-nowrap",
                      active ? "text-foreground font-medium" : "text-muted-foreground",
                    )}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn(
                      "w-4 h-px mt-[-12px]",
                      done ? "bg-emerald-400" : "bg-border",
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-auto p-5">
          {step === 1 && <StepDetected workflow={workflow} onNext={advance} />}
          {step === 2 && <StepOpenHeadway workflow={workflow} onOpen={handleOpenHeadway} onSkip={advance} />}
          {step === 3 && (
            <PatientDataForm
              initialData={clientData}
              onSubmit={handleDataCollected}
            />
          )}
          {step === 4 && (
            <StepReview
              clientData={clientData}
              existingContact={existing.data ?? null}
              mergeChoice={mergeChoice}
              setMergeChoice={setMergeChoice}
              onChange={setClientData}
              onContinue={handleReviewContinue}
            />
          )}
          {step === 5 && (
            <AppointmentTypeSelector
              appointmentTypes={apptTypes ?? []}
              isLoading={loadingTypes}
              initialDate={clientData.appointmentDate}
              initialTime={clientData.appointmentTime}
              onSelect={handleApptSelected}
            />
          )}
          {step === 6 && (
            <StepConfirm
              clientData={clientData}
              apptSelection={apptSelection}
              apptTypes={apptTypes ?? []}
              confirmed={confirmed}
              setConfirmed={setConfirmed}
              onConfirm={handleConfirmCreate}
              isLoading={createAppt.isPending || saveWorkflow.isPending}
            />
          )}
          {step === 7 && (
            <AppointmentSuccess
              clientData={clientData}
              apptSelection={apptSelection}
              result={createAppt.result}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Detected ──────────────────────────────────────────────────────────

function StepDetected({
  workflow,
  onNext,
}: {
  workflow: NonNullable<ReturnType<typeof useHeadwayWorkflow>["workflow"]>;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-200/60 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-800/40 p-4">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <ClipboardList size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Headway link detected</p>
            {workflow.senderName && (
              <p className="text-xs text-muted-foreground mt-0.5">From: {workflow.senderName}</p>
            )}
            <p className="text-xs text-blue-700 dark:text-blue-300 font-mono mt-2 break-all bg-blue-100/50 dark:bg-blue-900/30 rounded p-2">
              {workflow.headwayLink}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-800/40 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            No data has been collected. Patient information will only be saved after you review and confirm each step.
          </p>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Start Intake Workflow
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

// ── Step 2: Open Headway ──────────────────────────────────────────────────────

function StepOpenHeadway({
  workflow,
  onOpen,
  onSkip,
}: {
  workflow: NonNullable<ReturnType<typeof useHeadwayWorkflow>["workflow"]>;
  onOpen: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Open Headway Patient Profile</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Open Headway in a new tab to view the patient profile. Sign in if prompted. Do not share your Headway credentials with this app.
        </p>
      </div>

      <button
        onClick={onOpen}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
      >
        <ExternalLink size={14} />
        Open Headway in New Tab
      </button>

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-semibold text-foreground">Instructions</p>
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Click "Open Headway in New Tab" above</li>
          <li>Sign in to Headway if prompted</li>
          <li>Navigate to the patient's profile page</li>
          <li>Return here and click Continue</li>
        </ol>
      </div>

      <button
        onClick={onSkip}
        className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        I've reviewed Headway — Continue to data entry
      </button>
    </div>
  );
}

// ── Step 4: Review ────────────────────────────────────────────────────────────

function StepReview({
  clientData,
  existingContact,
  mergeChoice,
  setMergeChoice,
  onChange,
  onContinue,
}: {
  clientData: Partial<ClientData>;
  existingContact: import("@/hooks/useContacts").Contact | null;
  mergeChoice: "update" | "new" | null;
  setMergeChoice: (c: "update" | "new") => void;
  onChange: (d: Partial<ClientData>) => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Review Patient Information</h3>
        <p className="text-xs text-muted-foreground">Verify all fields before proceeding. You can edit any field.</p>
      </div>

      {existingContact && (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 dark:bg-amber-950/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-600 shrink-0" />
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Existing contact found</p>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>{existingContact.display_name}</strong> already exists with matching email or phone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setMergeChoice("update")}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                mergeChoice === "update"
                  ? "bg-amber-600 text-white border-amber-600"
                  : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20",
              )}
            >
              Update existing
            </button>
            <button
              onClick={() => setMergeChoice("new")}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                mergeChoice === "new"
                  ? "bg-slate-700 text-white border-slate-700"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              Create new
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {(
          [
            { key: "fullName", label: "Full Name", type: "text", required: true },
            { key: "email", label: "Email", type: "email", required: true },
            { key: "phone", label: "Phone", type: "tel", required: true },
            { key: "address", label: "Address", type: "text" },
            { key: "appointmentDate", label: "Appointment Date", type: "date" },
            { key: "appointmentTime", label: "Appointment Time", type: "time" },
          ] as const
        ).map(({ key, label, type, required }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-foreground mb-1">
              {label}
              {required && <span className="text-destructive ml-0.5">*</span>}
              {!clientData[key] && (
                <span className="ml-2 text-[10px] text-amber-600 font-normal">missing</span>
              )}
            </label>
            <input
              type={type}
              value={(clientData[key] as string) ?? ""}
              onChange={(e) => onChange({ ...clientData, [key]: e.target.value })}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm bg-background",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
                !clientData[key] && required ? "border-amber-400" : "border-border",
              )}
            />
          </div>
        ))}
      </div>

      <button
        onClick={onContinue}
        disabled={!clientData.fullName || (!!existingContact && !mergeChoice)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue to Appointment Type
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

// ── Step 6: Confirm ───────────────────────────────────────────────────────────

function StepConfirm({
  clientData,
  apptSelection,
  apptTypes,
  confirmed,
  setConfirmed,
  onConfirm,
  isLoading,
}: {
  clientData: Partial<ClientData>;
  apptSelection: AppointmentSelection | null;
  apptTypes: { id: string; label: string }[];
  confirmed: boolean;
  setConfirmed: (b: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  const apptTypeLabel = apptTypes.find((t) => t.id === apptSelection?.appointmentTypeId)?.label ?? apptSelection?.appointmentTypeId ?? "—";

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Confirm Appointment Creation</h3>
        <p className="text-xs text-muted-foreground">Review the summary below. Once confirmed, the appointment will be created in PatientQ.</p>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <User size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Patient</span>
        </div>
        <SummaryRow label="Name" value={clientData.fullName} />
        <SummaryRow label="Email" value={clientData.email} />
        <SummaryRow label="Phone" value={clientData.phone} />
        <SummaryRow label="Address" value={clientData.address} />

        <div className="h-px bg-border my-1" />

        <div className="flex items-center gap-2 mb-1">
          <Calendar size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">Appointment</span>
        </div>
        <SummaryRow label="Type" value={apptTypeLabel} />
        <SummaryRow label="Date" value={clientData.appointmentDate || apptSelection?.date} />
        <SummaryRow label="Time" value={clientData.appointmentTime || apptSelection?.time} />
        <SummaryRow label="Format" value={apptSelection?.format} />
        {apptSelection?.notes && <SummaryRow label="Notes" value={apptSelection.notes} />}
      </div>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
        />
        <span className="text-xs text-foreground leading-relaxed">
          I confirm that the above patient and appointment information is accurate and I authorize creating this appointment in PatientQ.
        </span>
      </label>

      <button
        onClick={onConfirm}
        disabled={!confirmed || isLoading}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <><Loader2 size={14} className="animate-spin" /> Creating…</>
        ) : (
          <><CheckCircle2 size={14} /> Create Appointment</>
        )}
      </button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className={value ? "text-foreground" : "text-muted-foreground italic"}>{value || "—"}</span>
    </div>
  );
}
