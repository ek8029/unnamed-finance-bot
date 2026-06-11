/**
 * Shared live-quote fetching with in-memory caching.
 *
 * Last trade prices come from the Finazon /price endpoint (real-time,
 * 200 req/min budget) and previous close from hourly bars (cached per
 * ET day — it only changes once a day). Zero database writes.
 *
 * Module-level caches are shared across all requests on a warm Fluid
 * Compute instance, so both the authenticated and public quote routes
 * draw from the same pool.
 */

import { getBatchLastTradePrices, getIntradayQuote } from '@/lib/finazon';

export interface LiveQuote {
  ticker: string;
  price: number;
  prevClose: number | null;
  dayChangePct: number | null;
  asOf: number; // epoch ms
}

/** Last trade prices, shared across all users on a warm instance. */
const priceCache = new Map<string, { price: number; asOf: number }>();

/** Previous session close, keyed by ticker — valid for one ET day. */
const prevCloseCache = new Map<string, { prevClose: number; etDay: string }>();

const ET_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });

export async function getLiveQuotes(tickers: string[], ttlMs: number): Promise<LiveQuote[]> {
  const now = Date.now();
  const today = ET_DAY.format(new Date());

  // 1. Serve fresh prices from cache; collect misses.
  const misses = tickers.filter((t) => {
    const hit = priceCache.get(t);
    return !hit || now - hit.asOf > ttlMs;
  });

  // 2. Fetch missed last-trade prices in one throttled batch.
  if (misses.length > 0) {
    const fetched = await getBatchLastTradePrices(misses);
    for (const [ticker, price] of fetched) {
      priceCache.set(ticker, { price, asOf: now });
    }
  }

  // 3. Backfill previous close (one time_series call per ticker per day).
  const needPrevClose = tickers.filter((t) => {
    if (!priceCache.has(t)) return false;
    const hit = prevCloseCache.get(t);
    return !hit || hit.etDay !== today;
  });

  for (const ticker of needPrevClose) {
    const quote = await getIntradayQuote(ticker);
    if (quote && quote.prevClose > 0) {
      prevCloseCache.set(ticker, { prevClose: quote.prevClose, etDay: today });
    }
  }

  const quotes: LiveQuote[] = [];
  for (const ticker of tickers) {
    const hit = priceCache.get(ticker);
    if (!hit) continue; // crypto or fetch failure — client keeps last known value
    const pc = prevCloseCache.get(ticker)?.prevClose ?? null;
    quotes.push({
      ticker,
      price: hit.price,
      prevClose: pc,
      dayChangePct: pc ? ((hit.price - pc) / pc) * 100 : null,
      asOf: hit.asOf,
    });
  }

  return quotes;
}
