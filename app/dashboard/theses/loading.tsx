// The route Evan reported: a click on Theses showed nothing for about three
// seconds, then the page appeared at once. This is the paint that fills that
// gap. The wrapper classes match app/dashboard/theses/page.tsx exactly, so the
// real table lands on the same geometry instead of shifting it.
//
// The page renders two small view links, then the shared-forces band, then the
// table. Structure only, no placeholder values.

import { GhostBlock, GhostShell, GhostTableCard } from '@/components/dashboard/route-skeleton';

export default function ThesesLoading() {
  return (
    <main className="mx-auto px-4 sm:px-7 py-[26px] pb-[60px] max-w-[1240px]">
      <GhostShell label="Loading your theses">
        {/* classic view / overview view */}
        <div className="mb-3 flex items-center gap-4">
          <GhostBlock dim className="h-3 w-20" />
          <GhostBlock dim className="h-3 w-24" />
        </div>

        {/* the band above the table: a heading line and a few shared-force chips */}
        <div className="mb-4 rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-5 py-4">
          <GhostBlock className="h-3 w-40 mb-3.5" />
          <div className="flex flex-wrap gap-2">
            {['w-28', 'w-24', 'w-32', 'w-20'].map((w) => (
              <GhostBlock key={w} dim className={`h-6 ${w}`} />
            ))}
          </div>
        </div>

        <GhostTableCard cols={6} rows={9} />
      </GhostShell>
    </main>
  );
}
