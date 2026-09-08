import { NextRequest, NextResponse } from 'next/server';
import { getFullTickerData } from '@/lib/financial-data';
import { rateLimit, getClientIP } from '@/lib/rate-limit';
import { parseResearchTicker } from '@/lib/research-ticker';

export async function GET(request: NextRequest) {
  // IP-based rate limit: 30 requests per hour
  const ip = getClientIP(request);
  const { allowed, retryAfterSeconds } = rateLimit(`ticker-data:${ip}`, 30, 3600);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    );
  }

  const parsed = parseResearchTicker(request.nextUrl.searchParams.get('symbol') || '');
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: 400 });
  const symbol = parsed.ticker;

  const data = await getFullTickerData(symbol);

  if (!data.quote && !data.profile) {
    return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
