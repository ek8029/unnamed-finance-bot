// Thesis detail: back link, the ticker header with conviction on the right,
// then pillar cards (status chip + claim + a couple of evidence lines each).
// Wrapper matches app/dashboard/theses/[id]/page.tsx's outer shell.

import { GhostBlock, GhostShell } from '@/components/dashboard/route-skeleton';

export default function ThesisDetailLoading() {
  return (
    <GhostShell
      label="Loading this thesis"
      className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8 space-y-8"
    >
      <GhostBlock dim className="h-3 w-16" />

      <div className="flex items-center gap-4">
        <GhostBlock className="h-11 w-11 rounded-full shrink-0" />
        <GhostBlock className="h-7 w-24" />
        <div className="ml-auto flex items-baseline gap-2 shrink-0">
          <GhostBlock className="h-7 w-16" />
          <GhostBlock dim className="h-3 w-28" />
        </div>
      </div>

      <div className="space-y-3">
        <GhostBlock dim className="h-2.5 w-48" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-4 sm:p-5"
          >
            <div className="flex items-start gap-3">
              <GhostBlock dim className="h-5 w-20 rounded shrink-0" />
              <div className="min-w-0 flex-1">
                <GhostBlock className="h-4 w-3/4 mb-3" />
                <div className="space-y-2 border-l border-[var(--color-border-base)] pl-4">
                  <GhostBlock dim className="h-3.5 w-full" />
                  <GhostBlock dim className="h-3.5 w-2/3" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </GhostShell>
  );
}
