import { NextRequest, NextResponse } from 'next/server';
import { getReportedFinancialsEdgar } from '@/lib/edgar';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { parseResearchTicker } from '@/lib/research-ticker';

/**
 * GET /api/market/financials?symbol=AAPL
 * Returns the latest 3 annual (10-K) financial statements as reported.
 * Public endpoint backing the Income/Balance/Cash Flow tabs on /analyze.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIP(req);
  const limited = rateLimit(`financials:${ip}`, 20, 60);
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const parsed = parseResearchTicker(req.nextUrl.searchParams.get('symbol') || '');
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });
  const symbol = parsed.ticker;

  const reports = await getReportedFinancialsEdgar(symbol);
  return NextResponse.json(
    { symbol, reports },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } },
  );
}
