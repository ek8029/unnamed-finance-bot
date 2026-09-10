import { GhostBlock, GhostDetailHeading, GhostShell, GhostTableCard } from '@/components/dashboard/route-skeleton';

/**
 * Earnings: heading, the three-tile metric band, then the upcoming table.
 * The page's own in-file PageSkeleton omits the .helm-detail-metrics band, so
 * this boundary paints it and the band's 40px bottom margin is settled once.
 */
export default function EarningsLoading() {
  return (
    <GhostShell label="Loading the earnings calendar" className="helm-detail-page helm-earnings space-y-[28px]">
      <GhostDetailHeading action subtitle="w-[600px]" />

      <div className="helm-detail-metrics">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            <GhostBlock dim className="h-2.5 w-24" />
            <GhostBlock className="h-8 w-28" />
            <GhostBlock dim className="h-3 w-20" />
          </div>
        ))}
      </div>

      <section>
        <div className="helm-detail-section-heading">
          <div>
            <GhostBlock className="h-6 w-52" />
            <GhostBlock dim className="h-3 w-64 mt-2" />
          </div>
          <GhostBlock dim className="h-2.5 w-20 shrink-0" />
        </div>
        <GhostTableCard cols={4} rows={10} />
      </section>
    </GhostShell>
  );
}
