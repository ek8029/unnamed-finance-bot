/**
 * Public live quotes endpoint (no auth).
 *
 * GET /api/market/quotes/public?tickers=SPY,QQQ
 *
 * Powers live prices on unauthenticated surfaces: /brief and the
 * homepage ticker tape. Locked down to a whitelist of tickers those
 * pages actually show, IP rate limited, and served from a longer
 * 60s cache so anonymous traffic can't burn the Finazon budget.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLiveQuotes } from '@/lib/live-quotes';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Union of /brief TICKERS and the homepage tape's STAPLE_TICKERS.
const WHITELIST = new Set([
  'SPY', 'QQQ', 'NVDA', 'AAPL', 'MSFT', 'GOOGL',
  'META', 'AMZN', 'TSLA', 'AMD', 'AVGO', 'JPM',
]);

const PRICE_TTL_MS = 60_000;

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // 60s polling = 10 calls/10min per page; headroom for brief + homepage.
  const { allowed } = rateLimit(`market-quotes-public:${ip}`, 40, 600);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const raw = request.nextUrl.searchParams.get('tickers') || '';
  const tickers = [...new Set(
    raw.split(',').map((t) => t.trim().toUpperCase()).filter((t) => WHITELIST.has(t))
  )];

  if (tickers.length === 0) {
    return NextResponse.json({ quotes: [] });
  }

  const quotes = await getLiveQuotes(tickers, PRICE_TTL_MS);
  return NextResponse.json({ quotes });
}
