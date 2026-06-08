import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { parseDateLocal, formatMonthLabel } from '@/lib/date-format';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch holdings, performance, and snapshots in parallel
    const [holdingsResult, performanceResult, snapshotsResult] = await Promise.all([
      supabase
        .from('holdings')
        .select(`
          *,
          security:securities(security_name, asset_class, sector, exchange)
        `)
        .eq('user_id', user.id)
        .order('total_value', { ascending: false }),
      supabase
        .from('portfolio_performance')
        .select('*')
        .eq('user_id', user.id)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .gte('snapshot_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('snapshot_date', { ascending: true }),
    ]);

    const holdings = holdingsResult.data;
    const holdingsError = holdingsResult.error;
    const performance = performanceResult.data;
    const snapshots = snapshotsResult.data;

    if (holdingsError) {
      console.error('Error fetching holdings:', holdingsError);
      return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
    }

    // Calculate total portfolio value first (needed for allocation)
    const totalValue = holdings?.reduce((sum, h) => sum + Number(h.total_value || 0), 0) || 0;

    // Aggregate lots by ticker — multiple rows for the same ticker collapse into one
    const tickerMap = new Map<string, {
      ids: string[];
      user_id: string;
      ticker: string;
      asset_name: string;
      totalShares: number;
      totalValue: number;
      totalCostBasis: number;
      current_price: number;
      day_change_pct: number | null;
      sector?: string;
      asset_class?: string;
    }>();

    for (const holding of holdings || []) {
      const ticker = holding.ticker;
      const existing = tickerMap.get(ticker);
      const shares = Number(holding.shares || 0);
      const value = Number(holding.total_value || 0);
      const costBasis = holding.average_cost_basis ? Number(holding.average_cost_basis) * shares : 0;

      if (existing) {
        existing.ids.push(holding.id);
        existing.totalShares += shares;
        existing.totalValue += value;
        existing.totalCostBasis += costBasis;
        // Use latest price
        if (Number(holding.current_price || 0) > 0) {
          existing.current_price = Number(holding.current_price);
        }
        // Use day change from any lot that has it
        if (holding.day_change_pct != null && existing.day_change_pct === null) {
          existing.day_change_pct = Number(holding.day_change_pct);
        }
      } else {
        tickerMap.set(ticker, {
          ids: [holding.id],
          user_id: holding.user_id,
          ticker,
          asset_name: holding.security?.security_name || ticker,
          totalShares: shares,
          totalValue: value,
          totalCostBasis: costBasis,
          current_price: Number(holding.current_price || 0),
          day_change_pct: holding.day_change_pct != null ? Number(holding.day_change_pct) : null,
          sector: holding.security?.sector,
          asset_class: holding.security?.asset_class,
        });
      }
    }

    // Transform aggregated data to match frontend expectations
    const transformedHoldings = [...tickerMap.values()].map(agg => {
      const weightedAvgCost = agg.totalShares > 0 && agg.totalCostBasis > 0
        ? agg.totalCostBasis / agg.totalShares
        : null;
      const unrealisedGain = weightedAvgCost
        ? agg.totalValue - agg.totalCostBasis
        : null;
      const unrealisedPct = agg.totalCostBasis > 0
        ? ((agg.totalValue - agg.totalCostBasis) / agg.totalCostBasis) * 100
        : null;

      return {
        id: agg.ids[0],
        user_id: agg.user_id,
        ticker: agg.ticker,
        asset_name: agg.asset_name,
        shares: agg.totalShares,
        current_price: agg.current_price,
        total_value: agg.totalValue,
        day_change_percentage: agg.day_change_pct != null ? agg.day_change_pct * 100 : null,
        portfolio_allocation: totalValue > 0 ? (agg.totalValue / totalValue) * 100 : 0,
        sector: agg.sector,
        asset_class: agg.asset_class,
        cost_basis: weightedAvgCost,
        unrealised_gain: unrealisedGain,
        unrealised_pct: unrealisedPct,
      };
    }).sort((a, b) => b.total_value - a.total_value);

    const allocation = holdings?.reduce((acc, h) => {
      const sector = h.security?.sector || 'Other';
      if (!acc[sector]) {
        acc[sector] = { name: sector, value: 0, percentage: 0 };
      }
      acc[sector].value += Number(h.total_value);
      return acc;
    }, {} as Record<string, { name: string; value: number; percentage: number }>);

    // Calculate percentages
    if (allocation) {
      for (const key of Object.keys(allocation)) {
        allocation[key].percentage = totalValue > 0 ? (allocation[key].value / totalValue) * 100 : 0;
      }
    }

    // Transform performance metrics
    const performanceMetrics = performance ? {
      return_1d: performance.return_1d_pct ? Number(performance.return_1d_pct) * 100 : null,
      return_1w: performance.return_1w_pct ? Number(performance.return_1w_pct) * 100 : null,
      return_1m: performance.return_1m_pct ? Number(performance.return_1m_pct) * 100 : null,
      return_3m: performance.return_3m_pct ? Number(performance.return_3m_pct) * 100 : null,
      return_6m: performance.return_6m_pct ? Number(performance.return_6m_pct) * 100 : null,
      return_ytd: performance.return_ytd_pct ? Number(performance.return_ytd_pct) * 100 : null,
      return_1y: performance.return_1y_pct ? Number(performance.return_1y_pct) * 100 : null,
      sharpe_ratio: performance.sharpe_ratio ? Number(performance.sharpe_ratio) : null,
      beta: performance.beta ? Number(performance.beta) : null,
      volatility: performance.volatility ? Number(performance.volatility) * 100 : null,
    } : null;

    // Transform portfolio history for charts.
    // Deduplicate by month label (same pattern as net worth chart) and
    // override the current month with live values so the chart endpoint
    // matches the displayed total portfolio value.
    const snapshotsByMonth = new Map<string, { label: string; value: number; gain_loss: number }>();
    for (const s of snapshots || []) {
      const date = parseDateLocal(s.snapshot_date);
      const label = formatMonthLabel(date);
      snapshotsByMonth.set(label, {
        label,
        value: Number(s.total_value),
        gain_loss: Number(s.total_gain_loss),
      });
    }

    // Override current month with live-computed values from holdings
    const totalGainLoss = holdings?.reduce((sum, h) => sum + Number(h.unrealised_gain_loss || 0), 0) || 0;
    const now = new Date();
    const todayLabel = formatMonthLabel(now);
    snapshotsByMonth.set(todayLabel, {
      label: todayLabel,
      value: totalValue,
      gain_loss: totalGainLoss,
    });

    const portfolioHistory = Array.from(snapshotsByMonth.values());

    return NextResponse.json({
      holdings: transformedHoldings,
      allocation: allocation ? Object.values(allocation) : [],
      totalValue,
      performanceMetrics,
      portfolioHistory,
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Error in holdings route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
