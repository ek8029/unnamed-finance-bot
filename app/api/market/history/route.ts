import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { toPolygonTicker } from '@/lib/polygon';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker')?.toUpperCase();
    if (!ticker || ticker.length > 10) {
      return NextResponse.json({ error: 'Valid ticker required' }, { status: 400 });
    }

    const limited = rateLimit(`history:${ticker}`, 10, 60);
    if (!limited.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 45);
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
    const toDate = new Date().toISOString().split('T')[0];

    const serviceClient = createServiceClient();
    const { data: dbPrices } = await serviceClient
      .from('market_prices')
      .select('price_date, close')
      .eq('ticker', ticker)
      .gte('price_date', fromDate)
      .order('price_date', { ascending: true })
      .limit(45);

    if (dbPrices && dbPrices.length >= 5) {
      return NextResponse.json({
        prices: dbPrices,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    }

    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ prices: dbPrices || [] });
    }

    const polyTicker = toPolygonTicker(ticker);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${polyTicker}/range/1/day/${fromDate}/${toDate}?adjusted=true&sort=asc&apiKey=${apiKey}`,
        { signal: controller.signal, cache: 'no-store' }
      );
      clearTimeout(timeout);

      if (!res.ok) {
        return NextResponse.json({ prices: dbPrices || [] });
      }

      const json = await res.json();
      const results = json.results || [];

      if (results.length === 0) {
        return NextResponse.json({ prices: dbPrices || [] });
      }

      const prices = results.map((bar: { t: number; c: number }) => ({
        price_date: new Date(bar.t).toISOString().split('T')[0],
        close: bar.c,
      }));

      return NextResponse.json({
        prices,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    } catch {
      clearTimeout(timeout);
      return NextResponse.json({ prices: dbPrices || [] });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
