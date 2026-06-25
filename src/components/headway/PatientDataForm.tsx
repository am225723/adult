import { useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientData } from "@/hooks/useHeadwayWorkflow";

interface PatientDataFormProps {
  initialData?: Partial<ClientData>;
  onSubmit: (data: Partial<ClientData>) => void;
}

const FIELDS: {
  key: keyof ClientData;
  label: string;
  type: string;
  placeholder: string;
  required?: boolean;
}[] = [
  { key: "fullName", label: "Client Full Name", type: "text", placeholder: "Jane Smith", required: true },
  { key: "phone", label: "Phone Number", type: "tel", placeholder: "+1 (555) 000-0000", required: true },
  { key: "email", label: "Email Address", type: "email", placeholder: "jane@example.com", required: true },
  { key: "address", label: "Address", type: "text", placeholder: "123 Main St, City, State ZIP" },
  { key: "appointmentDate", label: "Appointment Date", type: "date", placeholder: "" },
  { key: "appointmentTime", label: "Appointment Time", type: "time", placeholder: "" },
];

export function PatientDataForm({ initialData = {}, onSubmit }: PatientDataFormProps) {
  const [data, setData] = useState<Partial<ClientData>>(initialData);

  function handleChange(key: keyof ClientData, value: string) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(data);
  }

  const missingRequired = FIELDS.filter((f) => f.required && !data[f.key]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Enter Patient Information</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enter the patient details from the Headway profile. All information remains private and is only used to create the appointment record.
        </p>
      </div>

      <div className="rounded-xl border border-blue-200/50 bg-blue-50/40 dark:bg-blue-950/20 p-3 flex gap-2">
        <Info size={13} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          Copy the information from the Headway patient profile tab into the fields below. Only enter what is needed.
        </p>
      </div>

      <div className="space-y-4">
        {FIELDS.map(({ key, label, type, placeholder, required }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              {label}
              {required && <span className="text-destructive ml-0.5">*</span>}
            </label>
            <input
              type={type}
              value={(data[key] as string) ?? ""}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm bg-background placeholder:text-muted-foreground/50",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
                "border-border transition-colors",
              )}
            />
          </div>
        ))}
      </div>

      {missingRequired.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Required: {missingRequired.map((f) => f.label).join(", ")}
        </p>
      )}

      <button
        type="submit"
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Review Information
        <ChevronRight size={15} />
      </button>
    </form>
  );
}
