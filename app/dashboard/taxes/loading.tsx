// Tax Center: eyebrow/h1/subtitle with a year-selector strip on the right,
// then the 4-cell realized-summary strip, then the harvest table. Wrapper
// classes match app/dashboard/taxes/page.tsx's non-empty return exactly.

import { GhostBlock, GhostShell, GhostTableCard, GhostTiles } from '@/components/dashboard/route-skeleton';

export default function TaxesLoading() {
  return (
    <GhostShell
      label="Loading your tax center"
      className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8 max-w-6xl"
    >
      {/* header: eyebrow, headline, subtitle vs. the year selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2.5">
          <GhostBlock dim className="h-2.5 w-32" />
          <GhostBlock className="h-8 w-72" />
          <GhostBlock dim className="h-3.5 w-96 max-w-full" />
        </div>
        <div className="flex gap-[5px] shrink-0">
          <GhostBlock dim className="h-[30px] w-14 rounded-[5px]" />
          <GhostBlock dim className="h-[30px] w-14 rounded-[5px]" />
          <GhostBlock dim className="h-[30px] w-20 rounded-[5px]" />
        </div>
      </div>

      {/* realized summary strip */}
      <GhostTiles count={4} className="grid grid-cols-2 lg:grid-cols-4 gap-3" />

      {/* harvest table */}
      <GhostTableCard cols={6} rows={4} />
    </GhostShell>
  );
}
