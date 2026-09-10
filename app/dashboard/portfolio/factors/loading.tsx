// Factor lens: the page already ships its own client-loading ghost
// (GhostFactorLens in components/ghost.tsx, shown pre-tier-resolution and
// again while the report refetches) — reused here verbatim so the router
// paint and the data-fetch paint are the same shape. Wrapper matches
// app/dashboard/portfolio/factors/page.tsx's container.

import { GhostFactorLens } from '@/components/ghost';
import { GhostBlock } from '@/components/dashboard/route-skeleton';

export default function FactorsLoading() {
  return (
    <div className="container mx-auto max-w-[1240px] px-4 py-6 sm:px-7 sm:py-[26px]">
      <div aria-hidden className="mb-[22px]">
        <GhostBlock dim className="h-2.5 w-48 mb-2" />
        <GhostBlock className="h-8 w-96 max-w-full mb-3" />
        <GhostBlock dim className="h-3.5 w-full max-w-2xl" />
      </div>
      <GhostFactorLens />
    </div>
  );
}
