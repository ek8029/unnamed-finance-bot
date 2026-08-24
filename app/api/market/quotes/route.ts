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
import { getLiveQuotes } from '@/lib/live-quotes';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// 120, not 50: real books run 75+ rows (appreview is 75), and the silent
// slice left everything past the cap permanently un-patched by the live
// overlay -- fresh rows rendered beside hours-old ones on the same screen.
const MAX_TICKERS = 120;
const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;
const PRICE_TTL_MS = 6_000;

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
  return NextResponse.json({ quotes });
}
