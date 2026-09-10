import { GhostBlock, GhostShell, GhostTiles } from '@/components/dashboard/route-skeleton';

/** Overview: heading, the net worth band, the chart row, then five KPI tiles. */
export default function OverviewLoading() {
  return (
    <GhostShell label="Loading your overview" className="mx-auto px-4 pt-6 pb-16 sm:px-7 sm:pt-[26px]">
      <div style={{ maxWidth: 1600 }} className="mx-auto">
        <header className="helm-overview-heading">
          <div className="min-w-0">
            <GhostBlock className="h-2.5 w-40" />
            <GhostBlock className="h-[34px] w-72 mt-[11px]" />
            <GhostBlock dim className="h-3.5 w-[420px] max-w-full mt-[10px]" />
          </div>
          <div className="helm-overview-links hidden sm:flex">
            <GhostBlock dim className="h-3 w-24" />
            <GhostBlock dim className="h-3 w-20" />
          </div>
        </header>

        <div className="helm-overview-balance mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <GhostBlock className="h-3.5 w-28 mb-2" />
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <GhostBlock className="h-[34px] w-56 sm:h-[46px] sm:w-72" />
              <GhostBlock dim className="h-7 w-24 rounded-[5px]" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2.5">
            <div className="flex flex-wrap justify-end gap-1">
              {Array.from({ length: 7 }, (_, i) => <GhostBlock key={i} dim className="h-[26px] w-[42px]" />)}
            </div>
            <GhostBlock dim className="h-3 w-36" />
          </div>
        </div>

        <div className="mb-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1.62fr_1fr]">
          <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-[22px] pt-5 pb-3.5">
            <div className="mb-[18px] flex items-start justify-between gap-4">
              <GhostBlock className="h-3.5 w-40" />
              <GhostBlock dim className="h-3 w-20" />
            </div>
            <GhostBlock dim className="h-[232px] w-full" />
            <div className="mt-1.5 flex justify-between border-t border-[var(--color-border-subtle)] pt-2">
              {Array.from({ length: 5 }, (_, i) => <GhostBlock key={i} dim className="h-2.5 w-10" />)}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-[22px] pt-5 pb-3.5">
            <GhostBlock className="h-3.5 w-32 mb-[18px]" />
            <div className="space-y-3.5">
              {Array.from({ length: 5 }, (_, i) => <GhostBlock key={i} dim className="h-[42px] w-full" />)}
            </div>
          </div>
        </div>

        <GhostTiles count={5} className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-5" />
      </div>
    </GhostShell>
  );
}
