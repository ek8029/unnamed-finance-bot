import { GhostBlock, GhostShell } from '@/components/dashboard/route-skeleton';

/** Transactions: heading and actions, five metric tiles, the filter strip, then the ledger. */
export default function TransactionsLoading() {
  return (
    <GhostShell label="Loading your transactions" className="helm-detail-page helm-transactions space-y-7">
      <header className="helm-transactions-heading space-y-4">
        <GhostBlock className="h-2.5 w-44" />
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <GhostBlock className="h-[34px] w-64" />
            <GhostBlock dim className="h-4 w-48" />
          </div>
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <GhostBlock dim className="h-10 w-10 rounded-md" />
            <GhostBlock dim className="h-10 w-32 rounded-md" />
            <GhostBlock dim className="h-10 w-24 rounded-md" />
          </div>
        </div>
      </header>

      <main className="space-y-6">
        <div className="helm-transaction-metrics">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="sovereign-card rounded-lg px-5 py-4">
              <GhostBlock dim className="h-2.5 w-20 mb-3" />
              <GhostBlock className={`h-7 mb-1.5 ${i === 0 ? 'w-24' : i < 3 ? 'w-20' : 'w-16'}`} />
              <GhostBlock dim className="h-3.5 w-16" />
            </div>
          ))}
        </div>

        <div className="helm-transaction-filters flex flex-wrap items-center gap-2">
          {Array.from({ length: 4 }, (_, i) => <GhostBlock key={i} dim className="h-9 w-20 rounded-full" />)}
          <div className="w-px h-5 bg-[var(--color-border-base)] mx-1" />
          {Array.from({ length: 3 }, (_, i) => <GhostBlock key={i} dim className="h-9 w-24 rounded-full" />)}
        </div>

        <div className="space-y-7">
          {Array.from({ length: 3 }, (_, g) => (
            <div key={g}>
              <GhostBlock dim className="h-3.5 w-32 mb-3" />
              <div className="sovereign-card rounded-lg overflow-hidden">
                {Array.from({ length: 3 }, (_, r) => (
                  <div
                    key={r}
                    className="flex items-center gap-3.5 px-4 sm:px-5 py-3.5 border-b border-[var(--color-border-subtle)] last:border-b-0"
                  >
                    <GhostBlock className="w-[30px] h-[30px] rounded-[7px] shrink-0" />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <GhostBlock className="h-4 w-44 max-w-full" />
                      <GhostBlock dim className="h-3 w-28" />
                    </div>
                    <GhostBlock dim className="h-4 w-20 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </GhostShell>
  );
}
