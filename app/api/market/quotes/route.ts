/**
 * Lightweight live quotes endpoint (authenticated).
 *
 * GET /api/market/quotes?tickers=AAPL,MSFT
 *
 * Read-only price lookup for client-side polling. No database writes,
 * no portfolio recalcs — the heavy persistence cascade lives in
 * /api/market/prices/refresh and runs on page load, not on every poll
 * tick. Quote fetching + caching lives in lib/live-quotes.ts, shared
 * with the public endpoint.
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getLiveQuotes, type LiveQuote } from '@/lib/live-quotes';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// 120, not 50: real books run 75+ rows (appreview is 75), and the silent
// slice left everything past the cap permanently un-patched by the live
// overlay -- fresh rows rendered beside hours-old ones on the same screen.
const MAX_TICKERS = 120;
const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;
const PRICE_TTL_MS = 6_000;
// fill=close looks back this far for a last close; older rows read as no price.
const CLOSE_LOOKBACK_DAYS = 30;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 8s polling = 75 calls/10min per page; allow several open surfaces.
  const { allowed } = rateLimit(`market-quotes:${user.id}`, 240, 600);
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

  const quotes = await getLiveQuotes(tickers, PRICE_TTL_MS);
  // Opt-in: off hours the provider returns nothing, so a caller that passes
  // fill=close gets each missing ticker's newest market_prices close instead.
  // Without the param the response is byte-identical to before.
  if (request.nextUrl.searchParams.get('fill') !== 'close') {
    return NextResponse.json({ quotes });
  }
  const out: (LiveQuote & { source: 'live' | 'close' })[] = quotes.map((q) => ({ ...q, source: 'live' as const }));
  const live = new Set(quotes.map((q) => q.ticker));
  const missing = tickers.filter((t) => !live.has(t));
  if (missing.length > 0) {
    const since = new Date(Date.now() - CLOSE_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
    // market_prices: RLS on, SELECT open to authenticated (migration 012);
    // UNIQUE is on (security_id, price_date), not ticker, so the first row
    // per ticker in date-desc order wins.
    const { data } = await supabase
      .from('market_prices')
      .select('ticker, close, price_date')
      .in('ticker', missing)
      .gte('price_date', since)
      .order('price_date', { ascending: false });
    const seen = new Set<string>();
    for (const row of (data ?? []) as { ticker: string; close: number | string; price_date: string }[]) {
      if (seen.has(row.ticker)) continue;
      seen.add(row.ticker);
      out.push({ ticker: row.ticker, price: Number(row.close), prevClose: null, dayChangePct: null, asOf: Date.parse(row.price_date), source: 'close' });
    }
  }
  return NextResponse.json({ quotes: out });
}
