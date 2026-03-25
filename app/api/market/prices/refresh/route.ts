import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getBatchPrices } from '@/lib/polygon';
import { updatePortfolioPerformance } from '@/lib/market-sync';
import { rateLimit } from '@/lib/rate-limit';

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed } = rateLimit(`prices-refresh:${user.id}`, 3, 300);
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // 1. Fetch all unique tickers from the user's holdings
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('id, ticker, security_id, shares, total_cost_basis, current_price')
      .eq('user_id', user.id);

    if (holdingsError) {
      console.error('Error fetching holdings:', holdingsError);
      return NextResponse.json(
        { error: 'Failed to fetch holdings' },
        { status: 500 }
      );
    }

    if (!holdings || holdings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No holdings to update',
        updated: 0,
      });
    }

    // Filter null/undefined tickers before passing to Polygon
    const uniqueTickers = [...new Set(
      holdings.map(h => h.ticker).filter((t): t is string => Boolean(t))
    )];

    if (uniqueTickers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No valid tickers found in holdings',
        updated: 0,
      });
    }

    // 2. Fetch latest prices from Polygon
    const priceMap = await getBatchPrices(uniqueTickers);

    if (priceMap.size === 0) {
      return NextResponse.json({
        success: true,
        message: 'No prices returned from Polygon - market may be closed or API key issue',
        updated: 0,
      });
    }

    // 3. Build ticker -> security_id map
    const tickerSecurityMap = new Map<string, string>();
    for (const h of holdings) {
      if (h.security_id && h.ticker) {
        tickerSecurityMap.set(h.ticker.toUpperCase(), h.security_id);
      }
    }

    // 3b. Fetch previous close prices for accurate day_change_pct
    // Batch-fetch recent market_prices for all relevant securities, then find prev close in-memory
    const prevCloseMap = new Map<string, number>();
    const relevantSecurityIds = uniqueTickers
      .map(t => tickerSecurityMap.get(t.toUpperCase()))
      .filter((id): id is string => Boolean(id));

    if (relevantSecurityIds.length > 0) {
      const { data: recentPrices } = await supabase
        .from('market_prices')
        .select('security_id, price_date, close')
        .in('security_id', relevantSecurityIds)
        .order('price_date', { ascending: false });

      // Group by security_id for efficient lookup
      const pricesBySecurity = new Map<string, { price_date: string; close: number }[]>();
      for (const p of recentPrices || []) {
        const existing = pricesBySecurity.get(p.security_id) || [];
        existing.push({ price_date: p.price_date, close: Number(p.close) });
        pricesBySecurity.set(p.security_id, existing);
      }

      for (const ticker of uniqueTickers) {
        const securityId = tickerSecurityMap.get(ticker.toUpperCase());
        if (!securityId) continue;

        const newPrice = priceMap.get(ticker.toUpperCase());
        if (!newPrice) continue;

        const prices = pricesBySecurity.get(securityId) || [];
        // Already sorted descending by price_date from the query
        const prevPrice = prices.find(p => p.price_date < newPrice.date);
        if (prevPrice?.close) {
          prevCloseMap.set(ticker.toUpperCase(), prevPrice.close);
        }
      }
    }

    const updatedTickers: string[] = [];
    const errors: string[] = [];

    // 4. Update each holding concurrently (holdings table has full CRUD RLS)
    const holdingUpdates = holdings
      .map(holding => {
        const ticker = holding.ticker?.toUpperCase();
        if (!ticker) return null;

        const price = priceMap.get(ticker);
        if (!price) return null;

        const currentPrice = price.close;
        const shares = Number(holding.shares);
        const hasCostBasis = holding.total_cost_basis != null;
        const totalCostBasis = hasCostBasis ? Number(holding.total_cost_basis) : 0;
        const totalValue = shares * currentPrice;
        const unrealisedGainLoss = hasCostBasis ? totalValue - totalCostBasis : null;
        const unrealisedGainLossPct =
          hasCostBasis && totalCostBasis > 0 ? (totalValue - totalCostBasis) / totalCostBasis : null;

        // Day change: compare to prior close from market_prices, fall back to intraday
        const prevClose = prevCloseMap.get(ticker);
        const dayChangePct = prevClose && prevClose > 0
          ? (price.close - prevClose) / prevClose
          : (price.open > 0 ? (price.close - price.open) / price.open : 0);

        return { holding, ticker, currentPrice, totalValue, unrealisedGainLoss, unrealisedGainLossPct, dayChangePct };
      })
      .filter(Boolean);

    const updateResults = await Promise.all(
      holdingUpdates.map(async (u) => {
        const { error: updateError } = await supabase
          .from('holdings')
          .update({
            current_price: u!.currentPrice,
            total_value: u!.totalValue,
            unrealised_gain_loss: u!.unrealisedGainLoss,
            unrealised_gain_loss_pct: u!.unrealisedGainLossPct,
            day_change_pct: u!.dayChangePct,
          })
          .eq('id', u!.holding.id);

        return { ticker: u!.ticker, holdingId: u!.holding.id, holdingTicker: u!.holding.ticker, error: updateError };
      })
    );

    for (const result of updateResults) {
      if (result.error) {
        console.error(`Error updating holding ${result.holdingId}:`, result.error);
        errors.push(`holding:${result.holdingTicker}`);
      } else {
        updatedTickers.push(result.ticker);
      }
    }

    // 5. Update securities table concurrently (needs RLS write policy)
    await Promise.all(
      Array.from(priceMap.entries())
        .filter(([ticker]) => tickerSecurityMap.has(ticker))
        .map(async ([ticker, price]) => {
          const { error: secError } = await supabase
            .from('securities')
            .update({ current_price: price.close })
            .eq('id', tickerSecurityMap.get(ticker)!);

          if (secError) {
            // Expected to fail if RLS policy not applied yet - non-fatal
            console.warn(`[prices] securities update skipped for ${ticker} (RLS)`);
          }
        })
    );

    // 6. Upsert into market_prices table (needs RLS write policy)
    const priceInserts = [];
    for (const [ticker, price] of priceMap.entries()) {
      const securityId = tickerSecurityMap.get(ticker);
      if (!securityId) continue;

      priceInserts.push({
        security_id: securityId,
        ticker,
        price_date: price.date,
        open: price.open,
        high: price.high,
        low: price.low,
        close: price.close,
        volume: price.volume,
      });
    }

    if (priceInserts.length > 0) {
      const { error: upsertError } = await supabase
        .from('market_prices')
        .upsert(priceInserts, {
          onConflict: 'security_id,price_date',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        // Expected to fail if RLS policy not applied yet - non-fatal
        console.warn('[prices] market_prices upsert skipped (RLS)');
      }
    }

    // 7. Recalculate portfolio_allocation_pct for all user holdings
    const { data: allHoldings } = await supabase
      .from('holdings')
      .select('id, total_value')
      .eq('user_id', user.id);

    if (allHoldings && allHoldings.length > 0) {
      const totalPortfolioValue = allHoldings.reduce(
        (sum: number, h: { total_value: number }) => sum + Number(h.total_value), 0
      );

      if (totalPortfolioValue > 0) {
        await Promise.all(allHoldings.map(h => {
          const allocationPct = (Number(h.total_value) / totalPortfolioValue) * 100;
          return supabase
            .from('holdings')
            .update({ portfolio_allocation_pct: Math.round(allocationPct * 100) / 100 })
            .eq('id', h.id);
        }));
      }
    }

    // 8. Update portfolio_performance metrics
    await updatePortfolioPerformance(supabase, user.id);

    return NextResponse.json({
      success: true,
      updated: updatedTickers.length,
      tickers: updatedTickers,
      pricesRecorded: priceInserts.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error refreshing market prices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

