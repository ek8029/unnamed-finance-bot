/**
 * Real-time price refresh via Finnhub quotes.
 *
 * Replaces the previous Polygon-based refresh which only returned
 * end-of-day prices (previous close). Finnhub /quote returns real-time
 * data during US market hours at no cost (free tier, 60 calls/min).
 *
 * When ANY user triggers this (via dashboard load auto-sync), ALL users'
 * holdings get updated — the price of AAPL is the same for everyone.
 */

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getBatchQuotes, type FinnhubQuote } from '@/lib/financial-data';
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
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const serviceClient = await createServiceClient();

    // 1. Fetch ALL holdings across ALL users (global price update)
    const { data: allHoldings, error: holdingsError } = await serviceClient
      .from('holdings')
      .select('id, ticker, security_id, shares, total_cost_basis, user_id')
      .neq('ticker', 'UNKNOWN');

    if (holdingsError || !allHoldings || allHoldings.length === 0) {
      return NextResponse.json({ success: true, message: 'No holdings to update', updated: 0 });
    }

    const uniqueTickers = [...new Set(
      allHoldings.map(h => h.ticker).filter((t): t is string => Boolean(t))
    )];

    if (uniqueTickers.length === 0) {
      return NextResponse.json({ success: true, message: 'No valid tickers', updated: 0 });
    }

    // 2. Fetch real-time quotes from Finnhub (not Polygon end-of-day)
    const quoteMap = await getBatchQuotes(uniqueTickers);

    if (quoteMap.size === 0) {
      return NextResponse.json({
        success: true,
        message: 'No quotes returned from Finnhub — market may be closed',
        updated: 0,
      });
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

        // Day change from Finnhub: quote.pc = previous close, quote.c = current
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
        price_date: today,
        open: quote.o,
        high: quote.h,
        low: quote.l,
        close: quote.c,
        volume: 0, // Finnhub quote doesn't include volume
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
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json({
      success: true,
      source: 'finnhub',
      updated: [...new Set(updatedTickers)].length,
      tickers: [...new Set(updatedTickers)],
      usersUpdated: affectedUserIds.length,
    });
  } catch (error) {
    console.error('Error refreshing market prices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
