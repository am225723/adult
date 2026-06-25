import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FORMAT_LABELS, FALLBACK_APPOINTMENT_TYPES, type AppointmentType, type AppointmentFormat } from "@/config/appointmentTypes";
import type { PatientQAppointmentType } from "@/lib/patientqClient";

export interface AppointmentSelection {
  appointmentTypeId: string;
  format: AppointmentFormat;
  date?: string;
  time?: string;
  providerId?: string;
  notes?: string;
}

interface AppointmentTypeSelectorProps {
  appointmentTypes: PatientQAppointmentType[];
  isLoading: boolean;
  initialDate?: string;
  initialTime?: string;
  onSelect: (selection: AppointmentSelection) => void;
}

export function AppointmentTypeSelector({
  appointmentTypes,
  isLoading,
  initialDate = "",
  initialTime = "",
  onSelect,
}: AppointmentTypeSelectorProps) {
  const types: AppointmentType[] =
    appointmentTypes.length > 0 ? appointmentTypes : FALLBACK_APPOINTMENT_TYPES;

  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [format, setFormat] = useState<AppointmentFormat>("telehealth");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [notes, setNotes] = useState("");

  const selectedType = types.find((t) => t.id === selectedTypeId);
  const availableFormats = selectedType?.formats ?? (["in-person", "telehealth", "phone"] as AppointmentFormat[]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTypeId) return;
    onSelect({ appointmentTypeId: selectedTypeId, format, date, time, notes: notes || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Appointment Type</h3>
        <p className="text-xs text-muted-foreground">Select the type of appointment to schedule in PatientQ.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {types.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSelectedTypeId(t.id);
                if (!t.formats.includes(format)) setFormat(t.formats[0]);
              }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors",
                selectedTypeId === t.id
                  ? "border-primary bg-primary/5 dark:bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/40",
              )}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.duration} min</p>
              </div>
              <div className={cn(
                "h-4 w-4 rounded-full border-2 shrink-0 transition-colors",
                selectedTypeId === t.id ? "border-primary bg-primary" : "border-muted-foreground",
              )} />
            </button>
          ))}
        </div>
      )}

      {selectedTypeId && (
        <>
          {/* Format */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">Format</label>
            <div className="flex flex-wrap gap-2">
              {availableFormats.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    format === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Date / Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Internal notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any notes for this appointment…"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={!selectedTypeId}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Review & Confirm
        <ChevronRight size={15} />
      </button>
    </form>
  );
}
