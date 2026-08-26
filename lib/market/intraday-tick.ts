// The intraday price tick: last-trade prices onto every holding, every five
// minutes while the market is open.
//
// The full sweep (lib/market/price-sweep.ts) prices from hourly bars, lifts
// to the tape, recomputes allocations, performance and snapshots, and takes
// minutes at the time_series budget. During the session the database behind
// the tax center, the brief, holding pages and the mobile app only moved when
// a user happened to load a dashboard. This does one thing: /price for every
// held ticker, arithmetic, write. Bars, snapshots and allocations stay with
// the sweep and its 16:05 / 19:00 runs.

import { createServiceClient } from '@/lib/supabase/server';
import { getBatchLastTradePrices } from '@/lib/finazon';
import { isUsMarketHours } from '@/lib/live-quotes';
import { repriceHolding, toHoldingUpdate } from '@/lib/market/last-trade';

/** /price pace for the tick. The plan allows 200/min; 120 leaves 80 for the
 *  dashboard and mobile polls that share the budget. 291 held tickers at
 *  120/min is about two and a half minutes, inside a five-minute cadence. */
export const INTRADAY_TICK_RPM = 120;

export interface IntradayTickResult {
  status: number;
  body: Record<string, unknown>;
}

const ET_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });

export async function runIntradayTick(): Promise<IntradayTickResult> {
  if (!isUsMarketHours()) {
    return { status: 200, body: { success: true, skipped: 'market closed', updated: 0 } };
  }

  const db = await createServiceClient();
  const started = Date.now();

  const { data: holdings, error } = await db
    .from('holdings')
    .select('id, ticker, shares, total_cost_basis, security_id')
    .neq('ticker', 'UNKNOWN');
  if (error || !holdings || holdings.length === 0) {
    return { status: 200, body: { success: true, message: 'No holdings', updated: 0 } };
  }

  const tickers = [...new Set(holdings.map((h) => (h.ticker || '').toUpperCase()).filter(Boolean))];
  const prices = await getBatchLastTradePrices(tickers, INTRADAY_TICK_RPM);
  if (prices.size === 0) {
    return { status: 200, body: { success: true, message: 'No prices returned', updated: 0 } };
  }

  // Previous session close per ticker, from our own table: the newest row
  // dated before today's ET session. One read for the whole universe.
  // PostgREST caps a select at 1000 rows and 291 tickers fill that in about
  // three sessions, so page newest-first until every ticker has a close or
  // the history runs out. A ticker with no close on record keeps whatever
  // day_change_pct the last sweep wrote (see toHoldingUpdate).
  const today = ET_DAY.format(new Date());
  const prevClose = new Map<string, number>();
  const PAGE = 1000;
  for (let page = 0; page < 10 && prevClose.size < tickers.length; page++) {
    const { data: closes, error: closeErr } = await db
      .from('market_prices')
      .select('ticker, close, price_date')
      .in('ticker', tickers)
      .lt('price_date', today)
      .order('price_date', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (closeErr || !closes) break;
    for (const row of closes) {
      const t = (row.ticker as string).toUpperCase();
      if (!prevClose.has(t) && Number(row.close) > 0) prevClose.set(t, Number(row.close));
    }
    if (closes.length < PAGE) break;
  }

  const now = new Date().toISOString();
  const updates = holdings.flatMap((h) => {
    const t = (h.ticker || '').toUpperCase();
    const price = prices.get(t);
    if (!price || price <= 0) return [];
    const r = repriceHolding({ shares: Number(h.shares), total_cost_basis: h.total_cost_basis }, price, prevClose.get(t) ?? null);
    return [{ id: h.id as string, ...r }];
  });

  // Chunked so a large book does not open hundreds of connections at once.
  let updated = 0;
  const CHUNK = 50;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const settled = await Promise.allSettled(
      updates.slice(i, i + CHUNK).map((u) =>
        db.from('holdings').update(toHoldingUpdate(u, now)).eq('id', u.id),
      ),
    );
    updated += settled.filter((s) => s.status === 'fulfilled' && !s.value?.error).length;
  }

  // securities.current_price feeds the shared per-ticker surfaces.
  const securityByTicker = new Map<string, string>();
  for (const h of holdings) {
    if (h.security_id && h.ticker) securityByTicker.set((h.ticker as string).toUpperCase(), h.security_id as string);
  }
  await Promise.allSettled(
    [...prices.entries()]
      .filter(([t]) => securityByTicker.has(t))
      .map(([t, p]) => db.from('securities').update({ current_price: p, last_updated_at: now }).eq('id', securityByTicker.get(t)!)),
  );

  return {
    status: 200,
    body: {
      success: true,
      source: 'finazon-price',
      tickers: tickers.length,
      priced: prices.size,
      holdings_updated: updated,
      duration_ms: Date.now() - started,
    },
  };
}
