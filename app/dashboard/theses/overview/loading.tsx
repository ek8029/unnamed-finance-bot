// Theses · Overview: the two view links, "Theses" h1, then the synthesis
// view's 4-tile summary band and the trouble-first thesis rows. Wrapper
// matches app/dashboard/theses/overview/page.tsx's <main>.

import { GhostBlock, GhostShell, GhostTiles } from '@/components/dashboard/route-skeleton';

export default function ThesesOverviewLoading() {
  return (
    <GhostShell label="Loading your theses" className="mx-auto px-4 sm:px-7 py-[26px] pb-[60px] max-w-[1240px]">
      <div className="mb-3 flex items-center gap-4">
        <GhostBlock dim className="h-3 w-20" />
        <GhostBlock dim className="h-3 w-20" />
      </div>
      <GhostBlock className="h-8 w-32 mb-4" />

      <GhostTiles count={4} className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg overflow-hidden" sub />

      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <GhostBlock className="h-4 w-14" />
              <GhostBlock dim className="h-3 w-16" />
              <GhostBlock dim className="h-3 w-10" />
              <GhostBlock dim className="h-3 flex-1 max-w-xs" />
            </div>
          </div>
        ))}
      </div>
    </GhostShell>
  );
}
