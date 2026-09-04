/**
 * Finazon Market Data Client
 *
 * Dataset: us_stocks_essential ("US Equities Basic") — licensed for
 * commercial display and redistribution to end users, no exchange
 * agreements required. Intraday trades cover a subset of venues
 * (IEX, NYSE National, Chicago); after market close data syncs to
 * 100% of consolidated US volume.
 *
 * Plan limits (configurable in the Finazon dashboard):
 *   - time_series: FINAZON_TS_RPM requests/min (default 60)
 *   - price:       FINAZON_PRICE_RPM requests/min (default 50)
 */

import { FINAZON_TS_RPM, FINAZON_PRICE_RPM } from '@/lib/financial-config';

const FINAZON_BASE = 'https://api.finazon.io/latest/finazon/us_stocks_essential';

function getApiKey(): string {
  const key = process.env.FINAZON_API_KEY;
  if (!key) throw new Error('FINAZON_API_KEY environment variable is not set');
  return key;
}

/** Crypto tickers (BTC-USD etc.) are not covered by the US equities dataset. */
function isCrypto(ticker: string): boolean {
  return ticker.toUpperCase().includes('-USD');
}

// ── Types ──

export interface DailyBar {
  ticker: string;
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface RawBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// ── Core fetch ──

/**
 * When the vendor last refused a request with a 429.
 *
 * A null from this module means "no data", and the caller cannot otherwise
 * tell a symbol that does not exist from a symbol we were not allowed to ask
 * about this minute. That difference is invisible for a ticker Helm already
 * tracks, because `market_prices` answers instead, but a ticker nobody holds
 * has no such fallback: the quote comes back empty and the user is told their
 * real, listed ticker "could not be found". A user wrote in about exactly
 * that, for CAVA and PSX, both of which price fine.
 *
 * Not cleared on success: within one save, an earlier ticker can be refused and
 * a later one served from the daily-bar fallback, and a success in between must
 * not make the refusal look like a bad symbol. The time window is the only
 * thing that clears it.
 */
let lastRateLimitedAt = 0;

/** True if the vendor refused a request in the last few seconds. */
export function recentlyRateLimited(withinMs = 30_000): boolean {
  return lastRateLimitedAt > 0 && Date.now() - lastRateLimitedAt < withinMs;
}

async function finazonFetch<T>(
  endpoint: string,
  params: Record<string, string>,
  // The dataset lives in the URL PATH, not the query string -- a `dataset`
  // query param is silently ignored by Finazon. Callers that need a dataset
  // other than US stocks must override the base.
  base: string = FINAZON_BASE,
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = new URL(`${base}${endpoint}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        Authorization: `apikey ${getApiKey()}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 429) {
      // Deliberately does NOT retry. The daily-bar fallback in getQuote uses
      // this same /time_series budget, so sleeping and asking again spends the
      // allowance the fallback needs. Measured: a retry turned a CAVA quote
      // that resolved in 316ms into a 7.9s call that failed outright. Fail
      // fast, let the caller fall back, and record that it happened.
      lastRateLimitedAt = Date.now();
      console.warn(`[finazon] Rate limited on ${endpoint}`);
      return null;
    }
    if (!res.ok) {
      console.error(`[finazon] ${endpoint} error: ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(timeout);
    // Next.js throws this to mark a route as dynamic during prerender —
    // swallowing it would bake null data into a static page.
    if (err && typeof err === 'object' && 'digest' in err && (err as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE') {
      throw err;
    }
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[finazon] Request timed out: ${endpoint}`);
    } else {
      console.error(`[finazon] ${endpoint} failed:`, err);
    }
    return null;
  }
}

function toDateString(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().split('T')[0];
}

// ── Daily bars ──

/**
 * Fetch recent daily OHLCV bars for a ticker, newest first.
 */
export async function getDailyBars(
  ticker: string,
  count: number,
): Promise<DailyBar[]> {
  if (isCrypto(ticker)) return [];
  const data = await finazonFetch<{ data: RawBar[] }>('/time_series', {
    dataset: 'us_stocks_essential',
    ticker: ticker.toUpperCase(),
    interval: '1d',
    order: 'desc',
    page_size: String(Math.min(count, 1000)),
  });
  if (!data?.data) return [];
  return data.data.map((r) => ({
    ticker: ticker.toUpperCase(),
    date: toDateString(r.t),
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: r.v,
  }));
}

// ── Intraday quote (from hourly bars) ──
//
// The us_stocks_essential 1d bars are rounded to whole dollars, which
// destroys day-change precision (a 0.35% move on a $290 stock rounds
// to 0%). Hourly bars keep full decimals, so quotes are derived from
// them instead.

export interface IntradayQuote {
  price: number; // latest regular-session bar close
  prevClose: number; // prior trading day's session close
  open: number;
  high: number;
  low: number;
  volume: number; // sum of the latest session's hourly bar volumes
  date: string; // YYYY-MM-DD (ET) of the latest session
}

const ET_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const ET_HOUR = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  hour12: false,
});

export async function getIntradayQuote(ticker: string): Promise<IntradayQuote | null> {
  if (isCrypto(ticker)) return null;
  const data = await finazonFetch<{ data: RawBar[] }>('/time_series', {
    dataset: 'us_stocks_essential',
    ticker: ticker.toUpperCase(),
    interval: '1h',
    order: 'desc',
    page_size: '60',
  });
  if (!data?.data || data.data.length === 0) return null;

  // Group regular-session bars (bar start 9:00–15:59 ET) by ET date,
  // preserving newest-first order. Pre/post-market bars are thin and
  // noisy, so they're excluded.
  const sessions = new Map<string, RawBar[]>();
  for (const bar of data.data) {
    const d = new Date(bar.t * 1000);
    const hour = Number(ET_HOUR.format(d));
    if (hour < 9 || hour > 15) continue;
    const date = ET_DATE.format(d);
    const list = sessions.get(date);
    if (list) list.push(bar);
    else sessions.set(date, [bar]);
  }

  const dates = [...sessions.keys()]; // newest first
  if (dates.length === 0) return null;

  const todayBars = sessions.get(dates[0])!; // desc within the day
  const price = todayBars[0].c;
  if (!price || price <= 0) return null;

  const open = todayBars[todayBars.length - 1].o;
  const high = Math.max(...todayBars.map((b) => b.h));
  const low = Math.min(...todayBars.map((b) => b.l));
  const volume = todayBars.reduce((sum, b) => sum + (b.v || 0), 0);
  const prevBars = dates.length > 1 ? sessions.get(dates[1]) : undefined;
  const prevClose = prevBars && prevBars[0].c > 0 ? prevBars[0].c : open;

  return { price, prevClose, open, high, low, volume, date: dates[0] };
}

/**
 * Fetch daily close prices for a ticker over a date range (ascending).
 * Drop-in replacement for the old Polygon getHistoricalPrices.
 */
export async function getHistoricalPrices(
  ticker: string,
  from: string,
  to: string,
): Promise<{ date: string; close: number }[]> {
  if (isCrypto(ticker)) return [];
  const startAt = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
  const endAt = Math.floor(new Date(`${to}T23:59:59Z`).getTime() / 1000);

  const data = await finazonFetch<{ data: RawBar[] }>('/time_series', {
    dataset: 'us_stocks_essential',
    ticker: ticker.toUpperCase(),
    interval: '1d',
    start_at: String(startAt),
    end_at: String(endAt),
    order: 'asc',
    page_size: '1000',
  });
  if (!data?.data) return [];
  return data.data.map((r) => ({ date: toDateString(r.t), close: r.c }));
}

// ── Latest price (PolygonPrice-compatible shape) ──

export interface LatestPrice {
  ticker: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  date: string; // YYYY-MM-DD
}

/**
 * Fetch the most recent price for a ticker. Derived from hourly bars
 * (full decimal precision) — us_stocks_essential 1d bars are rounded
 * to whole dollars, which destroys day-change math downstream. Falls
 * back to the daily bar only if no hourly data is available.
 */
export async function getLatestPrice(ticker: string): Promise<LatestPrice | null> {
  const quote = await getIntradayQuote(ticker);
  if (quote) {
    return {
      ticker: ticker.toUpperCase(),
      close: quote.price,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      volume: quote.volume,
      date: quote.date,
    };
  }

  const bars = await getDailyBars(ticker, 1);
  if (bars.length === 0) return null;
  const b = bars[0];
  return {
    ticker: b.ticker,
    close: b.close,
    open: b.open,
    high: b.high,
    low: b.low,
    volume: b.volume,
    date: b.date,
  };
}

/**
 * Fetch latest prices for multiple tickers, throttled to the
 * time_series requests-per-minute budget.
 */
export async function getBatchPrices(tickers: string[]): Promise<Map<string, LatestPrice>> {
  const results = new Map<string, LatestPrice>();
  const unique = [...new Set(tickers.filter(Boolean).map((t) => t.toUpperCase()))];

  const BATCH_SIZE = 5;
  // Pace batches so total throughput stays under the per-minute budget.
  const batchDelayMs = Math.ceil((BATCH_SIZE * 60_000) / FINAZON_TS_RPM);

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((t) => getLatestPrice(t)));
    for (let j = 0; j < batch.length; j++) {
      const r = settled[j];
      if (r.status === 'fulfilled' && r.value) results.set(batch[j], r.value);
    }
    if (i + BATCH_SIZE < unique.length) {
      await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
    }
  }

  return results;
}

// ── Last trade price (/price endpoint) ──

/**
 * Fetch the real-time last trade price for a ticker via the /price
 * endpoint. Unlike time_series bars (hourly at best), this returns the
 * actual last trade — seconds old during market hours. Metered
 * separately from time_series (FINAZON_PRICE_RPM, plan: 200/min).
 */
export async function getLastTradePrice(ticker: string): Promise<number | null> {
  // Crypto rides the crypto dataset as BTC/USDT (the /USD pairs are locked on
  // this plan; the tether pair tracks within ~0.1%). Before this branch crypto
  // was excluded entirely, so BTC-USD holdings kept their Plaid sync-time
  // price forever -- two lots were showing $82k and $108k on the same screen.
  const upper = ticker.toUpperCase();
  if (isCrypto(upper)) {
    // Coinbase public spot, not Finazon: Finazon's crypto dataset trial-locks
    // every symbol except BTC/USDT (ETH 403s in ALL pairs), and Coinbase is
    // keyless, uniform across the majors, and quotes the real USD pair rather
    // than a tether proxy. Tickers are already in Coinbase's BTC-USD shape.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`https://api.coinbase.com/v2/prices/${upper}/spot`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: { amount?: string } };
      const p = Number(json.data?.amount);
      return p > 0 ? p : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
  const data = await finazonFetch<{ p: number }>('/price', {
    dataset: 'us_stocks_essential',
    ticker: upper,
  });
  if (!data || typeof data.p !== 'number' || data.p <= 0) return null;
  return data.p;
}

/**
 * Fetch last trade prices for multiple tickers, throttled to the
 * /price requests-per-minute budget.
 */
export async function getBatchLastTradePrices(
  tickers: string[],
  // Requests per minute to pace at. The default leaves the plan's 200/min
  // /price budget mostly free for live polling; a scheduled sweep that owns
  // the minute can pass a higher figure.
  rpm: number = FINAZON_PRICE_RPM,
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const unique = [...new Set(tickers.filter(Boolean).map((t) => t.toUpperCase()))];

  const BATCH_SIZE = 10;
  const batchDelayMs = Math.ceil((BATCH_SIZE * 60_000) / Math.max(1, rpm));

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((t) => getLastTradePrice(t)));
    for (let j = 0; j < batch.length; j++) {
      const r = settled[j];
      if (r.status === 'fulfilled' && r.value !== null) results.set(batch[j], r.value);
    }
    if (i + BATCH_SIZE < unique.length) {
      await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
    }
  }

  return results;
}
