import { GhostBlock, GhostShell } from '@/components/dashboard/route-skeleton';

/**
 * Ask Helm: a full-height column, not a scroll page. The header is pinned and
 * the opening state sits centred, so the ghost has to be centred too or the
 * suggestions jump up the screen when they arrive.
 */
export default function ChatLoading() {
  return (
    <GhostShell label="Loading Ask Helm" className="flex h-full w-full">
      <div className="flex flex-col h-full max-w-[860px] w-full mx-auto min-w-0">
        <div className="shrink-0 flex items-end justify-between gap-5 px-4 sm:px-7 pt-5 pb-3.5 border-b border-[var(--color-border-subtle)]">
          <div className="min-w-0">
            <GhostBlock className="h-2.5 w-20 mb-1.5" />
            <GhostBlock className="h-[22px] w-40" />
          </div>
          <div className="text-right shrink-0">
            <GhostBlock dim className="h-2.5 w-16 mb-1 ml-auto" />
            <GhostBlock dim className="h-4 w-12 ml-auto" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 min-h-0 py-10">
          <div className="max-w-xl mx-auto w-full">
            <GhostBlock className="h-9 w-[340px] max-w-full mb-2" />
            <GhostBlock dim className="h-4 w-full max-w-[440px] mb-7" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5"
                >
                  <GhostBlock dim className="h-3.5 w-full mb-2" />
                  <GhostBlock dim className="h-3.5 w-3/5" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GhostShell>
  );
}
