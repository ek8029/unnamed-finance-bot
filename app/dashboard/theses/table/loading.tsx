// Theses · Table: the two view links, "Your investment theses." h1 + intro,
// the 4-tile coverage band, then the terminal table (Ticker / Position·P&L /
// Status / For-Against / What matters / Earnings — 6 columns). Wrapper
// matches app/dashboard/theses/table/page.tsx's <main>.

import { GhostBlock, GhostShell, GhostTableCard, GhostTiles } from '@/components/dashboard/route-skeleton';

export default function ThesesTableLoading() {
  return (
    <GhostShell label="Loading your theses" className="mx-auto px-4 sm:px-7 py-[26px] pb-[60px] max-w-[1240px]">
      <div className="mb-3 flex items-center gap-4">
        <GhostBlock dim className="h-3 w-20" />
        <GhostBlock dim className="h-3 w-24" />
      </div>

      <GhostBlock className="h-8 w-72 mb-2.5" />
      <GhostBlock dim className="h-3.5 w-full max-w-xl mb-4" />

      <GhostTiles count={4} className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg overflow-hidden mb-4" sub />

      <GhostTableCard cols={6} rows={8} />
    </GhostShell>
  );
}
