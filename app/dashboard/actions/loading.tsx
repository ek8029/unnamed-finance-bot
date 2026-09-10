import { GhostBlock, GhostDetailHeading, GhostShell } from '@/components/dashboard/route-skeleton';

/** Actions: heading, the four-tab toolbar, then the review queue rows. */
export default function ActionsLoading() {
  return (
    <GhostShell label="Loading your review queue" className="helm-detail-page helm-actions">
      <header className="helm-actions-header">
        <GhostDetailHeading action subtitle="w-[560px]" />
        <div className="helm-actions-toolbar">
          <div className="helm-detail-tabs">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="py-[17px]">
                <GhostBlock dim className="h-3 w-14" />
              </div>
            ))}
          </div>
          <GhostBlock dim className="h-2.5 w-28 hidden sm:block" />
        </div>
      </header>

      <div className="helm-action-queue">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="helm-action-card">
            <div className="space-y-2.5">
              <GhostBlock dim className="h-2.5 w-16" />
              <GhostBlock className="h-4 w-20" />
            </div>
            <div className="min-w-0 space-y-2.5">
              <GhostBlock className="h-4 w-3/5" />
              <GhostBlock dim className="h-3.5 w-full" />
              <GhostBlock dim className="h-3.5 w-4/5" />
            </div>
            <GhostBlock dim className="h-8 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </GhostShell>
  );
}
