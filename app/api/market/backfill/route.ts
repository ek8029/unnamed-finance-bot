import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getHistoricalPrices } from '@/lib/polygon';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/market/backfill
 *
 * Backfills market_prices with 1 year of daily close prices.
 * Processes 4 tickers per call (4 × 13s = 52s, under 120s limit).
 * Tracks progress via ?offset=N query param. Upsert handles dupes.
 *
 * Usage: POST /api/market/backfill?offset=0 (then ?offset=4, ?offset=8, etc.)
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const offset = parseInt(new URL(request.url).searchParams.get('offset') ?? '0', 10);
  const BATCH_SIZE = 2;

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: holdings } = await supabase
    .from('holdings')
    .select('ticker, security_id')
    .neq('ticker', 'UNKNOWN');

  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ message: 'No holdings to backfill' });
  }

  // Deduplicate by ticker
  const tickerList: [string, string][] = [];
  const seen = new Set<string>();
  for (const h of holdings) {
    const t = h.ticker?.toUpperCase();
    if (!t || !h.security_id || seen.has(t)) continue;
    // Skip crypto (no Polygon data for X: tickers)
    if (t.includes('-USD') || t.includes('CUR:')) continue;
    seen.add(t);
    tickerList.push([t, h.security_id]);
  }

  const batch = tickerList.slice(offset, offset + BATCH_SIZE);
  if (batch.length === 0) {
    return NextResponse.json({ done: true, message: 'All tickers processed', total: tickerList.length });
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const fromDate = oneYearAgo.toISOString().split('T')[0];
  const toDate = new Date().toISOString().split('T')[0];

  let backfilled = 0;
  const errors: string[] = [];

  for (const [ticker, securityId] of batch) {
    try {
      const prices = await getHistoricalPrices(ticker, fromDate, toDate);
      if (prices.length === 0) {
        errors.push(`${ticker}: no data`);
        continue;
      }

      const rows = prices.map(p => ({
        security_id: securityId,
        ticker,
        price_date: p.date,
        close: p.close,
        open: p.close,
        high: p.close,
        low: p.close,
        volume: 0,
      }));

      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase
          .from('market_prices')
          .upsert(rows.slice(i, i + 100), { onConflict: 'security_id,price_date' });
        if (error) {
          errors.push(`${ticker}: ${error.message}`);
          break;
        }
      }

      backfilled++;
    } catch (err) {
      errors.push(`${ticker}: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // 13s delay between Polygon calls (free tier = 5/min)
    if (batch.indexOf([ticker, securityId]) < batch.length - 1) {
      await new Promise(r => setTimeout(r, 13000));
    }
  }

  const nextOffset = offset + BATCH_SIZE;
  const remaining = Math.max(0, tickerList.length - nextOffset);

  return NextResponse.json({
    backfilled,
    offset,
    nextOffset: remaining > 0 ? nextOffset : null,
    remaining,
    total: tickerList.length,
    errors: errors.length > 0 ? errors : undefined,
    ...(remaining > 0 ? { next: `/api/market/backfill?offset=${nextOffset}` } : { done: true }),
  });
}
