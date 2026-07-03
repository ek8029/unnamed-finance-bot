// GET /api/scan/first-look — the agent's instant read of a just-connected book.
// The DETERMINISTIC value moment: unlike event catches (rare, unschedulable),
// these scans fire on every portfolio the second holdings exist. Headline
// numbers are free; the full work-through lives behind the Pro/Max surfaces
// they link to. Cookie-scoped client: RLS keeps it to the caller's book.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateTaxReport } from '@/lib/tax-analysis';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: holdings } = await supabase
      .from('holdings')
      .select('ticker, total_value, portfolio_allocation_pct')
      .eq('user_id', user.id);
    if (!holdings || holdings.length === 0) return NextResponse.json({ ready: false });

    // Concentration: heaviest single position (aggregate multi-account lots).
    const byTicker = new Map<string, number>();
    let total = 0;
    for (const h of holdings) {
      const v = Number(h.total_value ?? 0);
      total += v;
      byTicker.set(h.ticker, (byTicker.get(h.ticker) ?? 0) + v);
    }
    let topTicker = '';
    let topValue = 0;
    for (const [t, v] of byTicker) if (v > topValue) { topValue = v; topTicker = t; }
    const topWeightPct = total > 0 ? (topValue / total) * 100 : 0;

    // TLH: the ONE capped formula (Schedule D netting) via the tax report.
    const report = await generateTaxReport(user.id);

    return NextResponse.json({
      ready: true,
      positions: byTicker.size,
      tlh: {
        savings: Math.round(report.totalEstimatedSavings),
        losses: Math.round(Math.abs(report.totalHarvestableLoss)),
        count: report.opportunityCount,
      },
      concentration: { ticker: topTicker, pct: Math.round(topWeightPct * 10) / 10 },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[first-look] error:', err);
    return NextResponse.json({ ready: false });
  }
}
