import { NextRequest, NextResponse } from 'next/server';
import { getReportedFinancials } from '@/lib/financial-data';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

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

  const symbol = (req.nextUrl.searchParams.get('symbol') || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!symbol || symbol.length > 5) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  const reports = await getReportedFinancials(symbol);
  return NextResponse.json(
    { symbol, reports },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } },
  );
}
