import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getBatchPrices } from '@/lib/polygon';

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    // Uses .maybeSingle() - returns null (no error) when no rows found
    const prevCloseMap = new Map<string, number>();
    for (const ticker of uniqueTickers) {
      const securityId = tickerSecurityMap.get(ticker.toUpperCase());
      if (!securityId) continue;

      const newPrice = priceMap.get(ticker.toUpperCase());
      if (!newPrice) continue;

      const { data: prevPrice } = await supabase
        .from('market_prices')
        .select('close')
        .eq('security_id', securityId)
        .lt('price_date', newPrice.date)
        .order('price_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevPrice?.close) {
        prevCloseMap.set(ticker.toUpperCase(), Number(prevPrice.close));
      }
    }

    const updatedTickers: string[] = [];
    const errors: string[] = [];

    // 4. Update each holding (holdings table has full CRUD RLS)
    for (const holding of holdings) {
      const ticker = holding.ticker?.toUpperCase();
      if (!ticker) continue;

      const price = priceMap.get(ticker);
      if (!price) continue;

      const currentPrice = price.close;
      const shares = Number(holding.shares);
      const totalCostBasis = Number(holding.total_cost_basis);
      const totalValue = shares * currentPrice;
      const unrealisedGainLoss = totalValue - totalCostBasis;
      const unrealisedGainLossPct =
        totalCostBasis > 0 ? unrealisedGainLoss / totalCostBasis : 0;

      // Day change: compare to prior close from market_prices, fall back to intraday
      const prevClose = prevCloseMap.get(ticker);
      const dayChangePct = prevClose && prevClose > 0
        ? (price.close - prevClose) / prevClose
        : (price.open > 0 ? (price.close - price.open) / price.open : 0);

      const { error: updateError } = await supabase
        .from('holdings')
        .update({
          current_price: currentPrice,
          total_value: totalValue,
          unrealised_gain_loss: unrealisedGainLoss,
          unrealised_gain_loss_pct: unrealisedGainLossPct,
          day_change_pct: dayChangePct,
        })
        .eq('id', holding.id);

      if (updateError) {
        console.error(`Error updating holding ${holding.id}:`, updateError);
        errors.push(`holding:${holding.ticker}`);
        continue;
      }

      updatedTickers.push(ticker);
    }

    // 5. Update securities table (needs RLS write policy)
    for (const [ticker, price] of priceMap.entries()) {
      const securityId = tickerSecurityMap.get(ticker);
      if (!securityId) continue;

      const { error: secError } = await supabase
        .from('securities')
        .update({ current_price: price.close })
        .eq('id', securityId);

      if (secError) {
        // Expected to fail if RLS policy not applied yet - non-fatal
        console.warn(`[prices] securities update skipped for ${ticker} (RLS)`);
      }
    }

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
        for (const h of allHoldings) {
          const allocationPct = (Number(h.total_value) / totalPortfolioValue) * 100;
          await supabase
            .from('holdings')
            .update({ portfolio_allocation_pct: Math.round(allocationPct * 100) / 100 })
            .eq('id', h.id);
        }
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
      { error: 'Internal server error', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * Compute and insert portfolio_performance row with live metrics.
 * Stores returns as decimals (0.015 = 1.5%), matching seed data convention.
 */
async function updatePortfolioPerformance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  try {
    const { data: holdings } = await supabase
      .from('holdings')
      .select('id, ticker, security_id, total_value, day_change_pct, shares, current_price')
      .eq('user_id', userId);

    if (!holdings || holdings.length === 0) return;

    const totalPortfolioValue = holdings.reduce(
      (s: number, h: { total_value: number }) => s + Number(h.total_value), 0
    );
    if (totalPortfolioValue <= 0) return;

    // Weighted 1-day return (decimal)
    const return1d = holdings.reduce((s: number, h: { total_value: number; day_change_pct: number | null }) => {
      const weight = Number(h.total_value) / totalPortfolioValue;
      return s + weight * (Number(h.day_change_pct) || 0);
    }, 0);

    // Fetch historical market_prices for period returns
    const securityIds = [...new Set(
      holdings.map((h: { security_id: string }) => h.security_id).filter(Boolean)
    )];

    // Guard: skip historical queries if no security IDs
    let historicalPrices: { security_id: string; price_date: string; close: number }[] = [];
    if (securityIds.length > 0) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const { data } = await supabase
        .from('market_prices')
        .select('security_id, price_date, close')
        .in('security_id', securityIds)
        .gte('price_date', oneYearAgo.toISOString().split('T')[0])
        .order('price_date', { ascending: true });

      historicalPrices = data || [];
    }

    // Build security_id -> sorted price history
    const priceHistory = new Map<string, { date: string; close: number }[]>();
    for (const p of historicalPrices) {
      const existing = priceHistory.get(p.security_id) || [];
      existing.push({ date: p.price_date, close: Number(p.close) });
      priceHistory.set(p.security_id, existing);
    }

    // Compute portfolio return over N days (returns decimal)
    function computeReturn(days: number): number | null {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - days);
      const targetStr = targetDate.toISOString().split('T')[0];

      let pastValue = 0;
      let currentValue = 0;
      let matched = 0;

      for (const h of holdings!) {
        const history = priceHistory.get(h.security_id);
        if (!history || history.length === 0) continue;

        const pastEntry = [...history].reverse().find(p => p.date <= targetStr);
        if (!pastEntry) continue;

        pastValue += Number(h.shares) * pastEntry.close;
        currentValue += Number(h.total_value);
        matched++;
      }

      // Need at least half the holdings to have history for a meaningful calc
      if (matched < holdings!.length / 2 || pastValue <= 0) return null;
      return (currentValue - pastValue) / pastValue;
    }

    const return1w = computeReturn(7);
    const return1m = computeReturn(30);
    const return3m = computeReturn(90);
    const return6m = computeReturn(180);
    const return1y = computeReturn(365);

    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const daysSinceYearStart = Math.round(
      (Date.now() - yearStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const returnYtd = computeReturn(daysSinceYearStart);

    // Diversification score (1 - HHI, 0-1 scale)
    const hhi = holdings.reduce((s: number, h: { total_value: number }) => {
      const weight = Number(h.total_value) / totalPortfolioValue;
      return s + weight * weight;
    }, 0);
    const diversificationScore = Math.min(1, 1 - hhi);

    // Asset class allocation
    let assetClassAllocation: Record<string, number> = {};
    if (securityIds.length > 0) {
      const { data: securities } = await supabase
        .from('securities')
        .select('id, asset_class')
        .in('id', securityIds);

      const assetClassMap = new Map<string, string>();
      for (const s of securities || []) {
        assetClassMap.set(s.id, s.asset_class || 'other');
      }

      for (const h of holdings) {
        const assetClass = assetClassMap.get(h.security_id) || 'other';
        const pct = (Number(h.total_value) / totalPortfolioValue) * 100;
        assetClassAllocation[assetClass] = (assetClassAllocation[assetClass] || 0) + pct;
      }
    }

    // Volatility and Sharpe from daily portfolio returns
    let volatility: number | null = null;
    let sharpeRatio: number | null = null;

    const allDates = new Set<string>();
    for (const [, history] of priceHistory) {
      for (const p of history) allDates.add(p.date);
    }
    const sortedDates = [...allDates].sort();

    if (sortedDates.length >= 20) {
      const dailyValues: number[] = [];
      for (const date of sortedDates) {
        let pv = 0;
        let allFound = true;
        for (const h of holdings) {
          const history = priceHistory.get(h.security_id);
          if (!history) { allFound = false; break; }
          const entry = history.find(p => p.date === date);
          if (!entry) { allFound = false; break; }
          pv += Number(h.shares) * entry.close;
        }
        if (allFound && pv > 0) dailyValues.push(pv);
      }

      if (dailyValues.length >= 20) {
        const dailyReturns: number[] = [];
        for (let i = 1; i < dailyValues.length; i++) {
          dailyReturns.push((dailyValues[i] - dailyValues[i - 1]) / dailyValues[i - 1]);
        }

        const meanReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
        const variance =
          dailyReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (dailyReturns.length - 1);
        const dailyVol = Math.sqrt(variance);
        volatility = dailyVol * Math.sqrt(252); // annualized

        const riskFreeDaily = 0.05 / 252;
        const excessReturn = meanReturn - riskFreeDaily;
        sharpeRatio = dailyVol > 0 ? (excessReturn / dailyVol) * Math.sqrt(252) : null;
      }
    }

    // Insert new performance row (table accumulates history, latest is queried)
    const { error: perfError } = await supabase.from('portfolio_performance').insert({
      user_id: userId,
      return_1d_pct: return1d,
      return_1w_pct: return1w,
      return_1m_pct: return1m,
      return_3m_pct: return3m,
      return_6m_pct: return6m,
      return_ytd_pct: returnYtd,
      return_1y_pct: return1y,
      sharpe_ratio: sharpeRatio,
      beta: null,
      volatility,
      diversification_score: diversificationScore,
      asset_class_allocation: assetClassAllocation,
    });

    if (perfError) {
      console.warn('[prices] portfolio_performance insert failed:', perfError.message);
    }
  } catch (error) {
    console.error('Error updating portfolio performance:', error);
  }
}
