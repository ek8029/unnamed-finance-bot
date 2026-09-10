import { GhostBlock, GhostShell } from '@/components/dashboard/route-skeleton';

/** The Current: greeting, the editorial hero, the market strip, then the signal feed. */
export default function BriefLoading() {
  return (
    <GhostShell label="Loading today's brief" className="relative mx-auto">
      <div style={{ padding: '26px 28px 60px', maxWidth: 1600 }} className="mx-auto">
        <div className="helm-brief-heading mb-[22px] flex items-end justify-between gap-6">
          <div className="min-w-0">
            <GhostBlock className="h-2.5 w-28 mb-2" />
            <GhostBlock className="h-8 w-80 max-w-full" />
            <GhostBlock dim className="h-3.5 w-[460px] max-w-full mt-3" />
          </div>
          <div className="text-right space-y-1.5 shrink-0 hidden sm:block">
            <GhostBlock dim className="h-2.5 w-28 ml-auto" />
            <GhostBlock dim className="h-2.5 w-20 ml-auto" />
            <GhostBlock dim className="h-2.5 w-24 ml-auto mt-2" />
          </div>
        </div>

        <div className="mb-3.5 rounded-lg px-[26px] py-6 border border-[color-mix(in_srgb,var(--color-gold)_18%,transparent)]">
          <GhostBlock className="h-2.5 w-32 mb-2.5" />
          <div className="space-y-3">
            <GhostBlock dim className="h-4 w-full" />
            <GhostBlock dim className="h-4 w-[92%]" />
            <GhostBlock dim className="h-4 w-3/4" />
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="px-[20px] py-[16px]"
              style={i < 4 ? { borderRight: '1px solid var(--color-border-subtle)' } : undefined}
            >
              <GhostBlock dim className="h-2.5 w-14 mb-2" />
              <GhostBlock className="h-[18px] w-16" />
              <GhostBlock dim className="h-2.5 w-12 mt-1" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.55fr_1fr]">
          <div className="flex flex-col gap-3">
            <GhostBlock dim className="h-2.5 w-24 mb-0.5" />
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-5 py-[18px]"
              >
                <div className="flex items-center justify-between gap-4 mb-3">
                  <GhostBlock className="h-4 w-44" />
                  <GhostBlock dim className="h-2.5 w-14 shrink-0" />
                </div>
                <GhostBlock dim className="h-3.5 w-full mb-2" />
                <GhostBlock dim className="h-3.5 w-2/3" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }, (_, i) => (
              <div
                key={i}
                className="rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-5 py-[18px]"
              >
                <GhostBlock className="h-3.5 w-28 mb-3.5" />
                <div className="space-y-2.5">
                  {Array.from({ length: 4 }, (_, j) => <GhostBlock key={j} dim className="h-3 w-full" />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GhostShell>
  );
}
