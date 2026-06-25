import { ExternalLink, ClipboardList, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeadwayLinkCardProps {
  url: string;
  senderName?: string;
  quoMessageId?: string;
  onStartIntake: (params: { headwayLink: string; senderName?: string; quoMessageId?: string }) => void;
  className?: string;
}

export function HeadwayLinkCard({
  url,
  senderName,
  quoMessageId,
  onStartIntake,
  className,
}: HeadwayLinkCardProps) {
  function handleOpenHeadway() {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className={cn(
        "mt-2 rounded-xl border border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-slate-50/80",
        "dark:border-blue-800/40 dark:from-blue-950/40 dark:to-slate-900/40",
        "overflow-hidden shadow-sm",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100/60 dark:border-blue-800/30">
        <div className="h-5 w-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
          <ShieldCheck size={11} className="text-white" />
        </div>
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 tracking-wide uppercase">
          Headway
        </span>
        {senderName && (
          <span className="text-xs text-muted-foreground ml-auto truncate max-w-[120px]">
            from {senderName}
          </span>
        )}
      </div>

      {/* Link label */}
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground font-mono truncate">
          {url.replace(/^https?:\/\//, "")}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-3 pb-3">
        <button
          onClick={handleOpenHeadway}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-white dark:bg-slate-800 border border-blue-200/60 dark:border-blue-700/40",
            "text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30",
            "transition-colors",
          )}
        >
          <ExternalLink size={11} />
          Open Headway
        </button>
        <button
          onClick={() => onStartIntake({ headwayLink: url, senderName, quoMessageId })}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-blue-600 hover:bg-blue-700 text-white",
            "transition-colors shadow-sm",
          )}
        >
          <ClipboardList size={11} />
          Start Appointment Intake
        </button>
      </div>
    </div>
  );
}
