// Adopt a house thesis: header (kicker/h1/p), then the grid of house-thesis
// cards (ticker, company, pillar bullets, a follow button). Wrapper matches
// app/dashboard/theses/adopt/page.tsx.

import { GhostBlock, GhostShell } from '@/components/dashboard/route-skeleton';

export default function AdoptThesisLoading() {
  return (
    <GhostShell label="Loading house theses" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <GhostBlock dim className="h-2.5 w-32 mb-2.5" />
        <GhostBlock className="h-7 w-full max-w-xl mb-2" />
        <GhostBlock dim className="h-3.5 w-full max-w-2xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-5 py-4"
          >
            <div className="flex items-center justify-between mb-1.5">
              <GhostBlock className="h-5 w-16" />
            </div>
            <GhostBlock dim className="h-3 w-28 mb-3" />
            <div className="space-y-1.5 mb-4">
              <GhostBlock dim className="h-3 w-full" />
              <GhostBlock dim className="h-3 w-full" />
              <GhostBlock dim className="h-3 w-2/3" />
            </div>
            <GhostBlock dim className="h-7 w-20 rounded" />
          </div>
        ))}
      </div>
    </GhostShell>
  );
}
