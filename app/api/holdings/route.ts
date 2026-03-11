import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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
        .single(),
      supabase
        .from('portfolio_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })
        .limit(12),
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

    // Transform data to match frontend expectations
    const transformedHoldings = holdings?.map(holding => {
      const value = Number(holding.total_value || 0);
      return {
        id: holding.id,
        user_id: holding.user_id,
        ticker: holding.ticker,
        asset_name: holding.security?.security_name || holding.ticker,
        shares: holding.shares,
        current_price: Number(holding.current_price || 0),
        total_value: value,
        day_change_percentage: holding.day_change_pct != null ? Number(holding.day_change_pct) * 100 : 0,
        portfolio_allocation: holding.portfolio_allocation_pct != null
          ? Number(holding.portfolio_allocation_pct)
          : (totalValue > 0 ? (value / totalValue) * 100 : 0),
        sector: holding.security?.sector,
        asset_class: holding.security?.asset_class,
        cost_basis: holding.average_cost_basis,
        unrealised_gain: holding.unrealised_gain_loss,
      };
    });

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

    // Transform portfolio history for charts
    const portfolioHistory = snapshots?.map(s => {
      const date = new Date(s.snapshot_date);
      return {
        label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        value: Number(s.total_value),
        gain_loss: Number(s.total_gain_loss),
      };
    }) || [];

    return NextResponse.json({
      holdings: transformedHoldings,
      allocation: allocation ? Object.values(allocation) : [],
      totalValue,
      performanceMetrics,
      portfolioHistory,
    });
  } catch (error) {
    console.error('Error in holdings route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
