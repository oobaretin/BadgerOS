export function SkeletonCard({ label }: { label?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 space-y-4 animate-shimmer">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-border" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-32 rounded bg-border" />
          {label && <p className="text-xs text-muted font-mono">{label}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-border" />
        <div className="h-3 w-5/6 rounded bg-border" />
        <div className="h-3 w-4/6 rounded bg-border" />
      </div>
    </div>
  );
}
