import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateEarningsReport } from '@/lib/earnings-analysis';
import { getUserTier } from '@/lib/tier';

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
