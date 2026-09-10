// Wrapped: mirrors the page's own client-side WrappedLoading state (the hero
// summary card, a 4-tile row, then a 3-tile row) so the router paint and the
// data-fetch paint are the same shape. Wrapper matches app/dashboard/wrapped/page.tsx.

import { GhostBlock, GhostShell, GhostTiles } from '@/components/dashboard/route-skeleton';

export default function WrappedLoading() {
  return (
    <GhostShell label="Loading your Wrapped" className="px-6 py-7 md:px-8 max-w-[1100px] mx-auto">
      <div
        className="rounded-[10px] border p-8 md:p-10 mb-[14px]"
        style={{ borderColor: 'var(--color-border-base)', background: 'var(--color-bg-surface)' }}
      >
        <GhostBlock dim className="h-3 w-40 mb-5" />
        <GhostBlock className="h-9 w-3/4 mb-3" />
        <GhostBlock className="h-9 w-2/3" />
      </div>
      <GhostTiles count={4} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3" sub={false} />
      <GhostTiles count={3} className="grid grid-cols-1 md:grid-cols-3 gap-3" sub={false} />
    </GhostShell>
  );
}
