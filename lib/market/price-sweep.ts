// The global price sweep, shared by the dashboard-triggered route
// (app/api/market/prices/refresh) and the scheduled cron (app/api/cron/prices).
//
// Before the cron existed, prices landed only when someone loaded a dashboard
// (10-minute client throttle) or at the 9:15 ET pre-market cron. After the
// bell nothing wrote the official close unless a user happened to load the
// page, so every book showed the price from whoever last looked, sometimes
// hours old, until the next morning.

import { createServiceClient } from '@/lib/supabase/server';
import { getBatchQuotes, type StockQuote } from '@/lib/financial-data';
import { getBatchLastTradePrices } from '@/lib/finazon';
import { isUsMarketHours } from '@/lib/live-quotes';
import { updatePortfolioPerformance } from '@/lib/market-sync';

export interface RefreshResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * The global price sweep: fetch quotes for every held ticker and persist
 * prices, allocations, performance, and a portfolio snapshot for all
 * affected users. Runs at most once per coalesce window regardless of how
 * many callers fire it.
 */
export async function runGlobalRefresh(): Promise<RefreshResult> {
  const serviceClient = await createServiceClient();

  // 1. Fetch ALL holdings across ALL users (global price update)
  const { data: allHoldings, error: holdingsError } = await serviceClient
    .from('holdings')
    .select('id, ticker, security_id, shares, total_cost_basis, user_id')
    .neq('ticker', 'UNKNOWN');

  if (holdingsError || !allHoldings || allHoldings.length === 0) {
    return { status: 200, body: { success: true, message: 'No holdings to update', updated: 0 } };
  }

  const uniqueTickers = [...new Set(
    allHoldings.map(h => h.ticker).filter((t): t is string => Boolean(t))
  )];

  if (uniqueTickers.length === 0) {
    return { status: 200, body: { success: true, message: 'No valid tickers', updated: 0 } };
  }

  // 2. Fetch real-time quotes from Finazon (not Polygon end-of-day)
  const quoteMap = await getBatchQuotes(uniqueTickers);

  // 2b. Crypto never resolves through the equities time_series path, so those
  // holdings kept their Plaid sync-time price forever (two BTC lots read $82k
  // and $108k on the same screen, 79 days stale). The /price endpoint now
  // speaks crypto; day change stays null (pc: 0) because there is no
  // consolidated previous close to compare against -- an honest dash beats a
  // ten-week-old percentage.
  const cryptoMissing = uniqueTickers.filter(t => t.toUpperCase().includes('-USD') && !quoteMap.has(t.toUpperCase()));
  if (cryptoMissing.length > 0) {
    const prices = await getBatchLastTradePrices(cryptoMissing);
    const today = new Date().toISOString().split('T')[0];
    for (const [t, p] of prices) {
      quoteMap.set(t, { c: p, d: 0, dp: 0, h: p, l: p, o: p, pc: 0, t: Math.floor(Date.now() / 1000), date: today });
    }
  }

  // 2c. Intraday, lift every equity's price to the actual last trade. The
  // time_series path above prices from the last completed HOURLY bar, up to an
  // hour behind the tape -- and these rows feed the Tax Center: an hour-old
  // price mis-sizes every TLH figure and can flip a lot in or out of loss
  // territory entirely. pc (previous session close) stays from the bar path,
  // so the day % is the honest last-trade-vs-close. Off-hours the bar close IS
  // the official close and /price serves thin odd-lot prints, so skip it.
  // New objects, not mutation: getBatchQuotes hands back its module-cache
  // entries, and other callers must keep seeing the un-overridden quote.
  if (isUsMarketHours()) {
    const equities = uniqueTickers.filter(t => !t.toUpperCase().includes('-USD') && quoteMap.has(t.toUpperCase()));
    if (equities.length > 0) {
      const live = await getBatchLastTradePrices(equities);
      for (const [t, p] of live) {
        const q = quoteMap.get(t);
        if (q && p > 0) {
          quoteMap.set(t, {
            ...q,
            c: p,
            d: q.pc > 0 ? p - q.pc : q.d,
            dp: q.pc > 0 ? ((p - q.pc) / q.pc) * 100 : q.dp,
          });
        }
      }
    }
  }

  if (quoteMap.size === 0) {
    return {
      status: 200,
      body: {
        success: true,
        message: 'No quotes returned from Finazon — market may be closed',
        updated: 0,
      },
    };
  }

  // 3. Build ticker → security_id map for market_prices table
  const tickerSecurityMap = new Map<string, string>();
  for (const h of allHoldings) {
    if (h.security_id && h.ticker) {
      tickerSecurityMap.set(h.ticker.toUpperCase(), h.security_id);
    }
  }

  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const updatedTickers: string[] = [];

  // 4. Update each holding with real-time price
  const holdingUpdates = allHoldings
    .map(holding => {
      const ticker = holding.ticker?.toUpperCase();
      if (!ticker) return null;

      const quote = quoteMap.get(ticker);
      if (!quote) return null;

      const currentPrice = quote.c; // real-time current price
      const shares = Number(holding.shares);
      const hasCostBasis = holding.total_cost_basis != null;
      const totalCostBasis = hasCostBasis ? Number(holding.total_cost_basis) : 0;
      const totalValue = shares * currentPrice;
      const unrealisedGainLoss = hasCostBasis ? totalValue - totalCostBasis : null;
      const unrealisedGainLossPct =
        hasCostBasis && totalCostBasis > 0 ? (totalValue - totalCostBasis) / totalCostBasis : null;

      // Day change from Finazon: quote.pc = previous close, quote.c = current
      const dayChangePct = quote.pc > 0
        ? (quote.c - quote.pc) / quote.pc
        : null;

      return { holdingId: holding.id, ticker, currentPrice, totalValue, unrealisedGainLoss, unrealisedGainLossPct, dayChangePct, userId: holding.user_id };
    })
    .filter(Boolean) as { holdingId: string; ticker: string; currentPrice: number; totalValue: number; unrealisedGainLoss: number | null; unrealisedGainLossPct: number | null; dayChangePct: number | null; userId: string }[];

  // Batch update holdings
  const updateResults = await Promise.allSettled(
    holdingUpdates.map(u =>
      serviceClient
        .from('holdings')
        .update({
          current_price: u.currentPrice,
          total_value: u.totalValue,
          unrealised_gain_loss: u.unrealisedGainLoss,
          unrealised_gain_loss_pct: u.unrealisedGainLossPct,
          day_change_pct: u.dayChangePct,
          last_updated_at: now,
        })
        .eq('id', u.holdingId)
    )
  );

  for (const [i, result] of updateResults.entries()) {
    if (result.status === 'fulfilled' && !result.value?.error) {
      updatedTickers.push(holdingUpdates[i].ticker);
    }
  }

  // 5. Update securities table with current prices
  await Promise.allSettled(
    Array.from(quoteMap.entries())
      .filter(([ticker]) => tickerSecurityMap.has(ticker))
      .map(([ticker, quote]) =>
        serviceClient
          .from('securities')
          .update({ current_price: quote.c, last_updated_at: now })
          .eq('id', tickerSecurityMap.get(ticker)!)
      )
  );

  // 6. Upsert into market_prices for historical tracking
  const priceInserts = Array.from(quoteMap.entries())
    .filter(([ticker]) => tickerSecurityMap.has(ticker))
    .map(([ticker, quote]) => ({
      security_id: tickerSecurityMap.get(ticker)!,
      ticker,
      // Use the trading session date the quote describes, NOT the run date.
      // Writing the run date created phantom weekend rows and next-morning
      // duplicates of the prior session, poisoning prevClose baselines.
      price_date: quote.date || today,
      open: quote.o,
      high: quote.h,
      low: quote.l,
      close: quote.c,
      volume: 0, // Finazon quote doesn't include volume
    }));

  if (priceInserts.length > 0) {
    try {
      await serviceClient
        .from('market_prices')
        .upsert(priceInserts, { onConflict: 'security_id,price_date', ignoreDuplicates: false });
    } catch {
      // Non-fatal — historical price tracking can fail without affecting live prices
    }
  }

  // 7. Recalculate allocation + performance for all affected users
  const affectedUserIds = [...new Set(holdingUpdates.map(u => u.userId).filter(Boolean))];

  for (const uid of affectedUserIds) {
    const { data: userHoldings } = await serviceClient
      .from('holdings')
      .select('id, total_value')
      .eq('user_id', uid);

    if (userHoldings && userHoldings.length > 0) {
      const totalPortfolioValue = userHoldings.reduce(
        (sum: number, h: { total_value: number }) => sum + Number(h.total_value), 0
      );
      if (totalPortfolioValue > 0) {
        await Promise.allSettled(userHoldings.map(h =>
          serviceClient
            .from('holdings')
            .update({ portfolio_allocation_pct: Math.round((Number(h.total_value) / totalPortfolioValue) * 10000) / 100 })
            .eq('id', h.id)
        ));
      }
    }

    try {
      await updatePortfolioPerformance(serviceClient, uid);

      // Write a portfolio snapshot for the chart (so it updates on every price refresh, not just daily cron)
      const { data: snapHoldings } = await serviceClient
        .from('holdings')
        .select('total_value, unrealised_gain_loss')
        .eq('user_id', uid);

      if (snapHoldings && snapHoldings.length > 0) {
        const totalValue = snapHoldings.reduce((s: number, h: { total_value: number }) => s + Number(h.total_value), 0);
        const totalGainLoss = snapHoldings.reduce((s: number, h: { unrealised_gain_loss: number | null }) => s + Number(h.unrealised_gain_loss || 0), 0);
        const today = new Date().toISOString().split('T')[0];

        await serviceClient
          .from('portfolio_snapshots')
          .upsert({
            user_id: uid,
            snapshot_date: today,
            total_value: totalValue,
            total_gain_loss: totalGainLoss,
          }, { onConflict: 'user_id,snapshot_date' });
      }
    } catch {
      // Non-fatal
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      source: 'finazon',
      updated: [...new Set(updatedTickers)].length,
      tickers: [...new Set(updatedTickers)],
      usersUpdated: affectedUserIds.length,
    },
  };
}
