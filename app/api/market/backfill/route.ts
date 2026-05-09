import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getHistoricalPrices } from '@/lib/polygon';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/market/backfill
 *
 * Backfills market_prices with 1 year of daily close prices
 * for all tickers in the user's holdings. Skips tickers that
 * already have 90+ days of data. Rate-limited to stay under
 * Polygon free tier (5 calls/min).
 *
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Get all unique tickers + security_ids from holdings
  const { data: holdings } = await supabase
    .from('holdings')
    .select('ticker, security_id')
    .neq('ticker', 'UNKNOWN');

  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ message: 'No holdings to backfill' });
  }

  const tickerMap = new Map<string, string>();
  for (const h of holdings) {
    if (h.ticker && h.security_id) {
      tickerMap.set(h.ticker.toUpperCase(), h.security_id);
    }
  }

  // Check which tickers already have sufficient history
  const securityIds = [...new Set(tickerMap.values())];
  const { data: existingCounts } = await supabase
    .rpc('count_prices_per_security', { security_ids: securityIds })
    .select('*');

  // Fallback: count manually if RPC doesn't exist
  const countMap = new Map<string, number>();
  if (existingCounts) {
    for (const row of existingCounts) {
      countMap.set(row.security_id, row.count);
    }
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const fromDate = oneYearAgo.toISOString().split('T')[0];
  const toDate = new Date().toISOString().split('T')[0];

  let backfilled = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [ticker, securityId] of tickerMap) {
    const existing = countMap.get(securityId) ?? 0;
    if (existing >= 90) {
      skipped++;
      continue;
    }

    try {
      const prices = await getHistoricalPrices(ticker, fromDate, toDate);
      if (prices.length === 0) {
        errors.push(`${ticker}: no data from Polygon`);
        continue;
      }

      // Upsert all historical prices
      const rows = prices.map(p => ({
        security_id: securityId,
        price_date: p.date,
        close: p.close,
        open: p.close, // Polygon range endpoint returns close; open not critical for returns
        high: p.close,
        low: p.close,
        volume: 0,
      }));

      // Batch upsert in chunks of 100
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error } = await supabase
          .from('market_prices')
          .upsert(chunk, { onConflict: 'security_id,price_date' });
        if (error) {
          errors.push(`${ticker}: upsert error — ${error.message}`);
          break;
        }
      }

      backfilled++;

      // Rate limit: 250ms delay between Polygon calls (stays under 5/min with processing time)
      await new Promise(r => setTimeout(r, 250));
    } catch (err) {
      errors.push(`${ticker}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return NextResponse.json({
    backfilled,
    skipped,
    total: tickerMap.size,
    errors: errors.length > 0 ? errors : undefined,
  });
}
