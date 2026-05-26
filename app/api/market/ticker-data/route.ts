import { NextRequest, NextResponse } from 'next/server';
import { getFullTickerData } from '@/lib/financial-data';
import { rateLimit, getClientIP } from '@/lib/rate-limit';

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

  const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase().replace(/[^A-Z]/g, '');

  if (!symbol || symbol.length > 5) {
    return NextResponse.json({ error: 'Invalid ticker symbol' }, { status: 400 });
  }

  const data = await getFullTickerData(symbol);

  if (!data.quote && !data.profile) {
    return NextResponse.json({ error: 'Ticker not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
