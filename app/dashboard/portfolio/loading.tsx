import { GhostBlock, GhostShell, GhostTableCard } from '@/components/dashboard/route-skeleton';

/** Portfolio: heading, the value strip, the two tabs, the summary cells, then the holdings table. */
export default function PortfolioLoading() {
  return (
    <GhostShell label="Loading your portfolio" className="container mx-auto px-4 py-4 sm:py-6 max-w-[1600px]">
      <header className="helm-overview-heading">
        <div className="min-w-0">
          <GhostBlock className="h-2.5 w-52" />
          <GhostBlock className="h-[34px] w-72 mt-[11px]" />
          <GhostBlock dim className="h-3.5 w-[420px] max-w-full mt-[10px]" />
        </div>
        <GhostBlock dim className="h-3 w-28 shrink-0 hidden sm:block" />
      </header>

      <div className="flex flex-wrap gap-6">
        <div className="min-w-0 flex-[3_1_720px] space-y-4 sm:space-y-6">
          <div className="hidden lg:flex items-end justify-between gap-6">
            <div className="min-w-0">
              <GhostBlock dim className="h-2.5 w-32 mb-2" />
              <div className="flex items-baseline gap-3.5">
                <GhostBlock className="h-8 w-48" />
                <GhostBlock dim className="h-4 w-28" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GhostBlock dim className="h-8 w-20 rounded-[5px]" />
              <GhostBlock dim className="h-8 w-24 rounded-[5px]" />
            </div>
          </div>

          <div className="helm-portfolio-tabs flex items-center gap-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-0.5 w-fit">
            <GhostBlock dim className="h-[26px] w-24 rounded-md" />
            <GhostBlock dim className="h-[26px] w-28 rounded-md" />
          </div>

          <div className="hidden lg:grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] border border-[var(--color-border-base)] rounded-md bg-[var(--color-bg-surface)] overflow-hidden">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="px-[18px] py-3.5"
                style={i < 4 ? { borderRight: '1px solid var(--color-border-subtle)' } : undefined}
              >
                <GhostBlock dim className="h-2.5 w-16 mb-2" />
                <GhostBlock className="h-[18px] w-20" />
              </div>
            ))}
          </div>

          <GhostTableCard cols={6} rows={9} />
        </div>
      </div>
    </GhostShell>
  );
}
