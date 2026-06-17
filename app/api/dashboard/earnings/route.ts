import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEarningsReport } from '@/lib/earnings-analysis';
import { getUserTier } from '@/lib/tier';
import { hasThesisAccess } from '@/lib/thesis-access-server';
import { getThesisEarningsContext } from '@/lib/thesis-conviction';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tier = await getUserTier(user.id);
    const report = await generateEarningsReport(user.id);

    // Thesis test: stamp each upcoming event for a held, tracked-thesis ticker with
    // its conviction + the at-risk pillar claim, so the UI can frame the report as
    // the next read on that thesis. Gated to thesis users; nobody else gets fields.
    if (await hasThesisAccess(user.id, user.email)) {
      const tctx = await getThesisEarningsContext(supabase, user.id);
      if (tctx.size > 0) {
        for (const e of report.upcoming) {
          const c = tctx.get(e.ticker.toUpperCase());
          if (c) { e.thesisStatus = c.status; e.testPillar = c.testPillar; }
        }
      }
    }

    // Free users: return observation data only (dates, tickers, exposure, EPS)
    // Strip impact/scenario fields that constitute Pro recommendations
    if (tier !== 'pro') {
      return NextResponse.json({
        ...report,
        isPro: false,
        upcoming: report.upcoming.map((e) => ({
          ...e,
          beatImpact5pct: null,
          missImpact5pct: null,
        })),
        recent: report.recent.map((r) => ({
          ...r,
          estimatedImpact: null,
          actualPostEarningsMove: null,
          actualDollarImpact: null,
        })),
        recentNetImpact: null,
      });
    }

    return NextResponse.json({ ...report, isPro: true });
  } catch (error) {
    console.error('Earnings report failed:', error);
    return NextResponse.json({ error: 'Failed to generate earnings report' }, { status: 500 });
  }
}
