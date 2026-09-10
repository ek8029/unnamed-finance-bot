// Thesis Builder: back link, header (kicker/h1/p), then the ticker-input
// form row. Wrapper matches app/dashboard/theses/builder/page.tsx.

import { GhostBlock, GhostShell } from '@/components/dashboard/route-skeleton';

export default function ThesisBuilderLoading() {
  return (
    <GhostShell
      label="Loading Thesis Builder"
      className="max-w-[1280px] 2xl:max-w-[1760px] mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10"
    >
      <div>
        <GhostBlock dim className="h-3.5 w-20 mb-5" />
        <GhostBlock dim className="h-2.5 w-32 mb-3" />
        <GhostBlock className="h-9 w-full max-w-lg mb-3.5" />
        <GhostBlock dim className="h-3.5 w-full max-w-2xl" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 max-w-[560px]">
        <GhostBlock dim className="h-[52px] flex-1 rounded-md" />
        <GhostBlock dim className="h-[52px] w-full sm:w-56 rounded-md" />
      </div>
    </GhostShell>
  );
}
