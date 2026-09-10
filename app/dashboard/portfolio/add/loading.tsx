import { GhostBlock, GhostShell } from '@/components/dashboard/route-skeleton';

/** Add a position: prose header, the note callout, the two entry tabs, then the form fields. */
export default function AddPositionLoading() {
  return (
    <GhostShell label="Loading manual entry" className="px-6 sm:px-7 py-7 pb-16 max-w-[1100px] mx-auto">
      <div className="mb-[22px]">
        <GhostBlock className="h-2.5 w-40 mb-2" />
        <GhostBlock className="h-8 w-[360px] max-w-full" />
        <GhostBlock dim className="h-4 w-[520px] max-w-full mt-1.5" />
        <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-[var(--color-bg-inset)] border border-[var(--color-border-subtle)]">
          <GhostBlock dim className="h-4 w-4 shrink-0" />
          <div className="flex-1 space-y-2">
            <GhostBlock dim className="h-3.5 w-full" />
            <GhostBlock dim className="h-3.5 w-[88%]" />
            <GhostBlock dim className="h-3.5 w-2/3" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }, (_, i) => <GhostBlock key={i} dim className="h-10 w-32 rounded-md" />)}
      </div>

      <div className="helm-entry-method flex gap-2">
        <div className="py-[14px] px-5"><GhostBlock dim className="h-3 w-28" /></div>
        <div className="py-[14px] px-5"><GhostBlock dim className="h-3 w-44" /></div>
      </div>

      <div className="space-y-5 max-w-[640px]">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <GhostBlock dim className="h-3.5 w-24" />
            <GhostBlock className="h-11 w-full rounded-md" />
          </div>
        ))}
        <GhostBlock className="h-11 w-40 rounded-md" />
      </div>
    </GhostShell>
  );
}
