import { useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntakeQService, IntakeQLocation, IntakeQPractitioner } from "@/lib/patientqClient";

export interface AppointmentSelection {
  serviceId: string;
  locationId: string;
  practitionerId: string;
  utcDateTime: number; // Unix ms — required by IntakeQ
  date: string;        // local ISO date for display
  time: string;        // local time for display
  reminderType: "Sms" | "Email" | "Voice" | "OptOut";
  clientNote?: string;
}

interface AppointmentTypeSelectorProps {
  services: IntakeQService[];
  locations: IntakeQLocation[];
  practitioners: IntakeQPractitioner[];
  isLoading: boolean;
  initialDate?: string;
  initialTime?: string;
  onSelect: (selection: AppointmentSelection) => void;
}

export function AppointmentTypeSelector({
  services,
  locations,
  practitioners,
  isLoading,
  initialDate = "",
  initialTime = "",
  onSelect,
}: AppointmentTypeSelectorProps) {
  const [serviceId, setServiceId] = useState("");
  const [locationId, setLocationId] = useState(locations[0]?.Id ?? "");
  const [practitionerId, setPractitionerId] = useState(practitioners[0]?.Id ?? "");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [reminderType, setReminderType] = useState<AppointmentSelection["reminderType"]>("Email");
  const [clientNote, setClientNote] = useState("");

  const selectedService = services.find((s) => s.Id === serviceId);

  function buildUtcDateTime(): number | null {
    if (!date || !time) return null;
    // Parse the local date+time the user entered as a local datetime, then convert to UTC ms
    const localIso = `${date}T${time}:00`;
    const ms = new Date(localIso).getTime();
    return isNaN(ms) ? null : ms;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceId || !locationId || !practitionerId) return;
    const utcDateTime = buildUtcDateTime();
    if (!utcDateTime) return;
    onSelect({
      serviceId,
      locationId,
      practitionerId,
      utcDateTime,
      date,
      time,
      reminderType,
      clientNote: clientNote || undefined,
    });
  }

  const canSubmit = !!serviceId && !!locationId && !!practitionerId && !!date && !!time;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Appointment Type</h3>
        <p className="text-xs text-muted-foreground">Select the service, location, and provider for this appointment in IntakeQ.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-xs text-muted-foreground">Loading from IntakeQ…</span>
        </div>
      ) : (
        <>
          {/* Service */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              Service <span className="text-destructive">*</span>
            </label>
            {services.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">No services found in IntakeQ. Check your API key and account setup.</p>
            ) : (
              <div className="space-y-2">
                {services.map((s) => (
                  <button
                    key={s.Id}
                    type="button"
                    onClick={() => setServiceId(s.Id)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors",
                      serviceId === s.Id
                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/40",
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.Name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {s.Duration} min{s.Price != null ? ` · $${s.Price}` : ""}
                      </p>
                    </div>
                    <div className={cn(
                      "h-4 w-4 rounded-full border-2 shrink-0",
                      serviceId === s.Id ? "border-primary bg-primary" : "border-muted-foreground",
                    )} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Location */}
          {locations.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Location <span className="text-destructive">*</span>
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select location…</option>
                {locations.map((l) => (
                  <option key={l.Id} value={l.Id}>{l.Name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Practitioner */}
          {practitioners.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Provider <span className="text-destructive">*</span>
              </label>
              <select
                value={practitionerId}
                onChange={(e) => setPractitionerId(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select provider…</option>
                {practitioners.map((p) => (
                  <option key={p.Id} value={p.Id}>{p.CompleteName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date / Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Time <span className="text-destructive">*</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Reminder type */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">Reminder</label>
            <div className="flex flex-wrap gap-2">
              {(["Email", "Sms", "Voice", "OptOut"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReminderType(r)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    reminderType === r
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {r === "OptOut" ? "No reminder" : r}
                </button>
              ))}
            </div>
          </div>

          {/* Client note */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Note for client (optional)
            </label>
            <textarea
              value={clientNote}
              onChange={(e) => setClientNote(e.target.value)}
              rows={2}
              placeholder="Any note to include with the appointment…"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={!canSubmit || isLoading}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Review & Confirm
        <ChevronRight size={15} />
      </button>
    </form>
  );
}
