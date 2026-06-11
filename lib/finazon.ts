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

import { FINAZON_TS_RPM } from '@/lib/financial-config';

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

async function finazonFetch<T>(
  endpoint: string,
  params: Record<string, string>,
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const url = new URL(`${FINAZON_BASE}${endpoint}`);
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
  const prevBars = dates.length > 1 ? sessions.get(dates[1]) : undefined;
  const prevClose = prevBars && prevBars[0].c > 0 ? prevBars[0].c : open;

  return { price, prevClose, open, high, low, date: dates[0] };
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
 * Fetch the most recent daily bar for a ticker.
 */
export async function getLatestPrice(ticker: string): Promise<LatestPrice | null> {
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
