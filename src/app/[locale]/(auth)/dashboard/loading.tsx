export default function Loading() {
  return (
    <div className="flex h-[600px] flex-col items-center justify-center rounded-md bg-card p-5">
      <div className="size-16 rounded-full bg-muted p-3">
        <div className="h-full w-full animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
      <div className="mt-3 text-center">
        <div className="text-xl font-semibold">Loading Dashboard...</div>
        <div className="mt-1 text-sm font-medium text-muted-foreground">
          Please wait while we prepare your workspace
        </div>
      </div>
    </div>
  );
}