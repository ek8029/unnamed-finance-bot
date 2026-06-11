/**
 * Lightweight live quotes endpoint.
 *
 * GET /api/market/quotes?tickers=AAPL,MSFT
 *
 * Read-only price lookup for client-side polling. Last trade price comes
 * from the Finazon /price endpoint (real-time, 200 req/min budget) and
 * previous close from hourly bars (cached per ET day — it only changes
 * once a day). No database writes, no portfolio recalcs — the heavy
 * persistence cascade lives in /api/market/prices/refresh and runs on
 * page load, not on every poll tick.
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getBatchLastTradePrices, getIntradayQuote } from '@/lib/finazon';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_TICKERS = 50;
const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

/** Last trade prices, shared across all users on a warm instance. */
const priceCache = new Map<string, { price: number; asOf: number }>();
const PRICE_TTL_MS = 25_000;

/** Previous session close, keyed by ticker — valid for one ET day. */
const prevCloseCache = new Map<string, { prevClose: number; etDay: string }>();

const ET_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });

export interface LiveQuote {
  ticker: string;
  price: number;
  prevClose: number | null;
  dayChangePct: number | null;
  asOf: number; // epoch ms
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 30s polling = 20 calls/10min per page; allow several open surfaces.
  const { allowed } = rateLimit(`market-quotes:${user.id}`, 80, 600);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const raw = request.nextUrl.searchParams.get('tickers') || '';
  const tickers = [...new Set(
    raw.split(',').map((t) => t.trim().toUpperCase()).filter((t) => TICKER_RE.test(t))
  )].slice(0, MAX_TICKERS);

  if (tickers.length === 0) {
    return NextResponse.json({ quotes: [] });
  }

  const now = Date.now();
  const today = ET_DAY.format(new Date());

  // 1. Serve fresh prices from cache; collect misses.
  const misses = tickers.filter((t) => {
    const hit = priceCache.get(t);
    return !hit || now - hit.asOf > PRICE_TTL_MS;
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

  return NextResponse.json({ quotes });
}
