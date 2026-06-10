export default function HoldingLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-pulse">
      {/* Back + Header skeleton */}
      <div>
        <div className="h-4 w-32 bg-white/[0.06] rounded mb-4" />
        <div className="h-8 w-64 bg-white/[0.06] rounded mb-2" />
        <div className="h-4 w-40 bg-white/[0.04] rounded" />
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        {[1,2,3,4,5,6,7].map(i => (
          <div key={i} className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-3.5">
            <div className="h-3 w-12 bg-white/[0.04] rounded mb-2" />
            <div className="h-6 w-20 bg-white/[0.06] rounded" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
          <div className="h-5 w-36 bg-white/[0.06] rounded mb-4" />
          <div className="h-64 bg-white/[0.04] rounded" />
        </div>
        <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
          <div className="h-5 w-28 bg-white/[0.06] rounded mb-4" />
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="h-12 bg-white/[0.04] rounded" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
