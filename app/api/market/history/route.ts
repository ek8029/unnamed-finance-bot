import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getHistoricalPrices } from '@/lib/finazon';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker')?.toUpperCase().replace(/[^A-Z]/g, '');
    if (!ticker || ticker.length > 5) {
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

    const serviceClient = await createServiceClient();
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

    try {
      const bars = await getHistoricalPrices(ticker, fromDate, toDate);

      if (bars.length === 0) {
        return NextResponse.json({ prices: dbPrices || [] });
      }

      const prices = bars.map(bar => ({
        price_date: bar.date,
        close: bar.close,
      }));

      return NextResponse.json({
        prices,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    } catch {
      return NextResponse.json({ prices: dbPrices || [] });
    }
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
