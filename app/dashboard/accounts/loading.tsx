import { GhostBlock, GhostShell } from '@/components/dashboard/route-skeleton';

/** Accounts: heading, the balance line, the composition card, then the account cards. */
export default function AccountsLoading() {
  return (
    <GhostShell label="Loading your accounts" className="px-4 sm:px-7 pt-7 pb-16 max-w-[1320px] mx-auto">
      <header className="helm-overview-heading">
        <div className="min-w-0">
          <GhostBlock className="h-2.5 w-36" />
          <GhostBlock className="h-[34px] w-64 mt-[11px]" />
          <GhostBlock dim className="h-3.5 w-[400px] max-w-full mt-[10px]" />
        </div>
        <GhostBlock dim className="h-3 w-28 shrink-0 hidden sm:block" />
      </header>

      <div className="flex flex-wrap items-end justify-between gap-4 mb-[22px]">
        <div className="min-w-0">
          <GhostBlock dim className="h-2.5 w-24 mb-2" />
          <div className="flex items-baseline gap-[14px] flex-wrap">
            <GhostBlock className="h-[34px] w-[180px]" />
            <GhostBlock dim className="h-3 w-28" />
          </div>
        </div>
        <GhostBlock dim className="h-10 w-[120px] rounded-md" />
      </div>

      <GhostBlock dim className="h-3 w-full max-w-[560px] mb-4" />

      <div className="flex flex-wrap gap-x-8 gap-y-3 mb-6">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            <GhostBlock dim className="h-3 w-20" />
            <GhostBlock className="h-4 w-24 mt-1" />
          </div>
        ))}
      </div>

      <div className="rounded-lg mb-[14px] px-[22px] py-5 border border-[var(--color-border-base)] bg-[var(--color-bg-surface)]">
        <div className="flex justify-between items-center mb-[14px] gap-3">
          <GhostBlock className="h-3.5 w-44" />
          <GhostBlock dim className="h-3 w-16" />
        </div>
        <GhostBlock dim className="h-3 w-full mb-4" />
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
          {Array.from({ length: 4 }, (_, i) => <GhostBlock key={i} dim className="h-8 w-full" />)}
        </div>
      </div>

      <div
        className="grid gap-[14px] mb-[14px]"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}
      >
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] px-5 pt-[18px] pb-4"
            style={{ minHeight: 160 }}
          >
            <div className="flex items-center gap-[11px] mb-4">
              <GhostBlock className="h-[34px] w-[34px] rounded-[7px] shrink-0" />
              <div className="min-w-0 flex-1">
                <GhostBlock className="h-4 w-32" />
                <GhostBlock dim className="h-2.5 w-20 mt-1.5" />
              </div>
            </div>
            <GhostBlock className="h-7 w-28 mb-3" />
            <GhostBlock dim className="h-3 w-full mb-2" />
            <GhostBlock dim className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </GhostShell>
  );
}
