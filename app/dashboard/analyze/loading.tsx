import { GhostBlock, GhostShell } from '@/components/dashboard/route-skeleton';

/** Analyze: the search hero, the popular tickers row, then the holdings tiles. */
export default function AnalyzeLoading() {
  return (
    <GhostShell label="Loading analysis" className="relative px-6 sm:px-8 lg:px-10 py-8 space-y-8">
      <div className="space-y-5">
        <div className="space-y-2">
          <GhostBlock className="h-2.5 w-32" />
          <GhostBlock className="h-8 w-[420px] max-w-full" />
          <GhostBlock dim className="h-4 w-[480px] max-w-full" />
        </div>
        <div className="max-w-2xl">
          <GhostBlock dim className="h-12 w-full rounded-lg" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GhostBlock dim className="h-2.5 w-16 mr-1" />
          {Array.from({ length: 6 }, (_, i) => <GhostBlock key={i} dim className="h-10 w-20 rounded-[5px]" />)}
        </div>
      </div>

      <div className="border-t border-[var(--color-border-subtle)] pt-7">
        <GhostBlock dim className="h-3.5 w-52 mb-4" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-20 rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-4 py-3.5"
            >
              <GhostBlock dim className="h-2.5 w-12 mb-2.5" />
              <GhostBlock className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    </GhostShell>
  );
}
