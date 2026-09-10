// Classic theses view: mirrors the client component's own LoadingSkeleton
// (components/thesis/classic-theses-page.tsx) — title, subtitle, the
// action bar, then a handful of thesis rows. Wrapper matches the div that
// component wraps LoadingSkeleton in.

import { GhostBlock, GhostShell } from '@/components/dashboard/route-skeleton';

export default function ClassicThesesLoading() {
  return (
    <GhostShell
      label="Loading your theses"
      className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8 space-y-6"
    >
      <GhostBlock className="h-8 w-48" />
      <GhostBlock dim className="h-4 w-full max-w-xs" />
      <GhostBlock dim className="h-14 rounded-lg" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <GhostBlock key={i} dim className="h-12 rounded-lg" />
        ))}
      </div>
    </GhostShell>
  );
}
