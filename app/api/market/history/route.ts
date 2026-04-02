import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { toPolygonTicker } from '@/lib/polygon';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker')?.toUpperCase();
    if (!ticker) {
      return NextResponse.json({ error: 'Ticker required' }, { status: 400 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 45);
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
    const toDate = new Date().toISOString().split('T')[0];

    const { data: dbPrices } = await supabase
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
        headers: { 'Cache-Control': 'private, max-age=3600' },
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
        console.error(`[history] Polygon returned ${res.status} for ${ticker}`);
        return NextResponse.json({ prices: dbPrices || [] });
      }

      const json = await res.json();
      const results = json.results || [];

      if (results.length === 0) {
        console.error(`[history] Polygon returned 0 results for ${ticker}`);
        return NextResponse.json({ prices: dbPrices || [] });
      }

      const prices = results.map((bar: { t: number; c: number }) => ({
        price_date: new Date(bar.t).toISOString().split('T')[0],
        close: bar.c,
      }));

      return NextResponse.json({
        prices,
      }, {
        headers: { 'Cache-Control': 'private, max-age=3600' },
      });
    } catch (err) {
      clearTimeout(timeout);
      console.error(`[history] Polygon fetch failed for ${ticker}:`, err);
      return NextResponse.json({ prices: dbPrices || [] });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
