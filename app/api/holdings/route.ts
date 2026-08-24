import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isUsMarketHours } from '@/lib/live-quotes';
import { parseDateLocal, formatMonthLabel } from '@/lib/date-format';
import { resolveSector } from '@/lib/portfolio-analysis';
import { canonicalTicker } from '@/lib/ticker-alias';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Freshness: the iOS app has no client-side live-quote wire (the web
    // dashboard polls /api/market/quotes itself), so an app open must be able
    // to bring the database current on its own. When this user's newest price
    // is older than 10 minutes during market hours, fire the global coalesced
    // sweep in the background -- same unawaited pattern the overview route
    // uses for Plaid sync -- and serve this request from what we have. The
    // sweep's own coalescing and per-user rate limit absorb stampedes.
    void (async () => {
      if (!isUsMarketHours()) return;
      const { data: newest } = await supabase
        .from('holdings')
        .select('last_updated_at')
        .eq('user_id', user.id)
        .order('last_updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const at = newest?.last_updated_at ? new Date(newest.last_updated_at).getTime() : 0;
      if (Date.now() - at < 10 * 60 * 1000) return;
      const h = await headers();
      const host = h.get('host');
      if (!host) return;
      const proto = h.get('x-forwarded-proto') ?? 'https';
      const auth = h.get('authorization');
      const cookie = h.get('cookie');
      await fetch(`${proto}://${host}/api/market/prices/refresh`, {
        method: 'POST',
        headers: {
          ...(auth ? { authorization: auth } : {}),
          ...(cookie ? { cookie } : {}),
        },
      });
    })().catch((err) => console.error('[holdings] background price refresh failed:', err));

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
      /** True when ANY lot in this group has no cost basis at all. The group's
       *  gain is then unknowable, not zero — see basisMissing handling below. */
      basisMissing: boolean;
      current_price: number;
      day_change_pct: number | null;
      sector?: string;
      asset_class?: string;
    }>();

    for (const holding of holdings || []) {
      // Collapse broker symbol variants (SKHYV, description-as-ticker) onto the
      // canonical ticker so one economic position aggregates as one row.
      const ticker = canonicalTicker(holding.ticker);
      const existing = tickerMap.get(ticker);
      const shares = Number(holding.shares || 0);
      const value = Number(holding.total_value || 0);
      // total_cost_basis is TOTAL dollars and is the authoritative column;
      // average_cost_basis is PER SHARE. Prefer the total, fall back to the
      // per-share figure, and treat a lot with neither as UNKNOWN rather than
      // zero. Coercing a missing basis to 0 made those shares read as free, so
      // a ticker held in two accounts where one lot lacked basis reported a
      // gain overstated by that lot's entire cost.
      const rowBasis =
        holding.total_cost_basis != null
          ? Number(holding.total_cost_basis)
          : holding.average_cost_basis != null
            ? Number(holding.average_cost_basis) * shares
            : null;
      const costBasis = rowBasis ?? 0;
      const rowBasisMissing = rowBasis == null || !Number.isFinite(rowBasis);

      if (existing) {
        existing.ids.push(holding.id);
        existing.totalShares += shares;
        existing.totalValue += value;
        existing.totalCostBasis += rowBasisMissing ? 0 : costBasis;
        if (rowBasisMissing) existing.basisMissing = true;
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
          totalCostBasis: rowBasisMissing ? 0 : costBasis,
          basisMissing: rowBasisMissing,
          current_price: Number(holding.current_price || 0),
          day_change_pct: holding.day_change_pct != null ? Number(holding.day_change_pct) : null,
          // Look through leveraged/single-stock products to their underlying
          // (MSFL -> Technology, not "Other"). 'Unknown' maps to undefined so
          // the UI hides the sector chip instead of showing "Unknown".
          sector: (() => {
            const resolved = resolveSector(ticker, holding.security?.sector, holdings || []);
            return resolved === 'Unknown' ? undefined : resolved;
          })(),
          asset_class: holding.security?.asset_class,
        });
      }
    }

    // Transform aggregated data to match frontend expectations
    const transformedHoldings = [...tickerMap.values()].map(agg => {
      // A partial basis is worse than none: it silently overstates the gain by
      // whatever the unpriced lots cost. Report unknown instead.
      const basisKnown = !agg.basisMissing && agg.totalShares > 0 && agg.totalCostBasis > 0;
      const weightedAvgCost = basisKnown ? agg.totalCostBasis / agg.totalShares : null;
      const unrealisedGain = basisKnown ? agg.totalValue - agg.totalCostBasis : null;
      const unrealisedPct = basisKnown
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
        /** At least one lot in this position has no cost basis from the broker,
         *  so P/L cannot be computed for it. The UI shows a dash, not a zero. */
        basis_incomplete: agg.basisMissing,
      };
    }).sort((a, b) => b.total_value - a.total_value);

    const allocation = holdings?.reduce((acc, h) => {
      // Same look-through as above; keep "Other" as the bucket label the UI expects.
      const resolved = resolveSector(h.ticker, h.security?.sector, holdings || []);
      const sector = resolved === 'Unknown' ? 'Other' : resolved;
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

    // Whether this payload was priced before the background sweep above could
    // land. A client that caches responses can use it to schedule one silent
    // re-read instead of showing the pre-sweep numbers all session. Newest row
    // only: crypto lots price on their own cadence and must not pin the flag.
    const newestPriceAt = (holdings ?? []).reduce((max, h) => {
      const at = h.last_updated_at ? new Date(h.last_updated_at).getTime() : 0;
      return at > max ? at : max;
    }, 0);
    const pricesStale = isUsMarketHours() && newestPriceAt > 0 && Date.now() - newestPriceAt > 10 * 60 * 1000;

    return NextResponse.json({
      holdings: transformedHoldings,
      allocation: allocation ? Object.values(allocation) : [],
      totalValue,
      performanceMetrics,
      portfolioHistory,
      pricesStale,
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Error in holdings route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
