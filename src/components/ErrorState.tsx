import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Something went wrong",
  message = "Failed to load data. Please try again.",
  onRetry,
  icon: Icon = AlertCircle,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-32 gap-3">
      <Icon size={24} className="text-destructive" strokeWidth={1.5} />
      <div className="text-center">
        <p className="text-sm font-medium text-destructive">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="mt-1"
        >
          Try again
        </Button>
      )}
    </div>
  );
}
