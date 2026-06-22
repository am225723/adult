export function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-32 gap-3">
      <div className="w-4 h-4 rounded-full bg-primary/40 animate-pulse" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
