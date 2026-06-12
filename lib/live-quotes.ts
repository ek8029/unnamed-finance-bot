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
import { createServiceClient } from '@/lib/supabase/server';

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

/**
 * Regular US trading hours: 9:30–16:00 ET, Mon–Fri. Outside this window
 * the Finazon /price feed serves thin extended-hours odd-lot prints
 * (e.g. 183-share trades dollars away from the consolidated close), so
 * live quotes are suppressed and clients keep the official close from
 * the database / SSR snapshot.
 */
function isUsMarketHours(): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = get('weekday');
  if (day === 'Sat' || day === 'Sun') return false;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export async function getLiveQuotes(tickers: string[], ttlMs: number): Promise<LiveQuote[]> {
  if (!isUsMarketHours()) return [];

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

  // 3. Backfill previous close from our own market_prices table (one batched
  // DB read instead of one Finazon /time_series call per ticker per instance
  // per day — that burn rate-limited the shared budget and froze day %s).
  // Falls back to Finazon only for tickers with no DB history.
  const needPrevClose = tickers.filter((t) => {
    if (!priceCache.has(t)) return false;
    const hit = prevCloseCache.get(t);
    return !hit || hit.etDay !== today;
  });

  if (needPrevClose.length > 0) {
    try {
      const supabase = await createServiceClient();
      const { data } = await supabase
        .from('market_prices')
        .select('ticker, close, price_date')
        .in('ticker', needPrevClose)
        .lt('price_date', today)
        .order('price_date', { ascending: false });
      // Rows are newest-first; first row per ticker is the previous session close.
      for (const row of data ?? []) {
        const t = row.ticker as string;
        if (!prevCloseCache.has(t) || prevCloseCache.get(t)!.etDay !== today) {
          const close = Number(row.close);
          if (close > 0) prevCloseCache.set(t, { prevClose: close, etDay: today });
        }
      }
    } catch {
      // DB read failure is non-fatal — fall through to Finazon below
    }
  }

  for (const ticker of needPrevClose) {
    const hit = prevCloseCache.get(ticker);
    if (hit && hit.etDay === today) continue; // resolved from DB
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
