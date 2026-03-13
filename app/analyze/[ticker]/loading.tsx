export default function AnalysisLoading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
      {/* Nav */}
      <header className="border-b border-[var(--color-border-subtle)]">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 56 56" fill="none">
              <path d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94" stroke="#B8914A" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="28" y1="7" x2="28" y2="49" stroke="#E8ECF1" strokeWidth="5" strokeLinecap="round" />
              <line x1="7" y1="28" x2="49" y2="28" stroke="#E8ECF1" strokeWidth="5" strokeLinecap="round" />
              <circle cx="28" cy="28" r="10" fill="#B8914A" />
            </svg>
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">Helm Terminal</span>
          </a>
        </div>
      </header>

      {/* Loading content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        {/* Progress bar */}
        <div className="mb-10">
          <div className="h-0.5 w-full bg-[var(--color-border-subtle)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-gold)] rounded-full animate-analysis-progress"
              style={{ width: '0%' }}
            />
          </div>
          <p
            className="text-[12px] text-[var(--color-text-muted)] mt-3 text-center tracking-wider"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Pulling real-time data and generating analysis…
          </p>
        </div>

        {/* Skeleton card */}
        <div className="border border-[var(--color-border-base)] rounded-sm bg-[var(--color-bg-surface)] p-8 space-y-8">
          {/* Header skeleton */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-7 w-20 bg-[var(--color-bg-elevated)] rounded-sm animate-pulse" />
              <div className="h-5 w-40 bg-[var(--color-bg-elevated)] rounded-sm animate-pulse" />
            </div>
            <div className="h-4 w-64 bg-[var(--color-bg-elevated)] rounded-sm animate-pulse" />
          </div>

          {/* Price skeleton */}
          <div className="flex items-end gap-4">
            <div className="h-10 w-28 bg-[var(--color-bg-elevated)] rounded-sm animate-pulse" />
            <div className="h-5 w-20 bg-[var(--color-bg-elevated)] rounded-sm animate-pulse" />
          </div>

          {/* Metrics grid skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2 p-3 bg-[var(--color-bg-elevated)] rounded-sm">
                <div className="h-3 w-16 bg-[var(--color-border-base)] rounded-sm animate-pulse" />
                <div className="h-5 w-20 bg-[var(--color-border-base)] rounded-sm animate-pulse" />
              </div>
            ))}
          </div>

          {/* Summary skeleton */}
          <div className="space-y-3 pt-4 border-t border-[var(--color-border-subtle)]">
            <div className="h-4 w-32 bg-[var(--color-bg-elevated)] rounded-sm animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-[var(--color-bg-elevated)] rounded-sm animate-pulse" />
              <div className="h-3 w-full bg-[var(--color-bg-elevated)] rounded-sm animate-pulse" />
              <div className="h-3 w-3/4 bg-[var(--color-bg-elevated)] rounded-sm animate-pulse" />
            </div>
          </div>
        </div>
      </main>

      {/* Keyframes injected inline */}
      <style>{`
        @keyframes analysis-progress {
          0% { width: 0%; }
          15% { width: 25%; }
          40% { width: 50%; }
          65% { width: 70%; }
          85% { width: 85%; }
          100% { width: 95%; }
        }
        .animate-analysis-progress {
          animation: analysis-progress 8s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
