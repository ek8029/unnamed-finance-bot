import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { coalesce } from '@/lib/coalesce';
import { refreshMarketPrices, enrichMarketData } from '@/lib/market-sync';
import { beat } from '@/lib/agent/heartbeat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// The daily-bar refresh walks every held name at Finazon's time_series pace
// (60 a minute), so three hundred names is five minutes on its own. It used
// to share the 9:15 run's 300 seconds with the briefs, Plaid sync and the
// scans, and on a rate-limited morning it was the reason the run was killed
// before the scans ran. Vercel Pro allows 800.
export const maxDuration = 800;

/**
 * GET /api/cron/market-morning — the morning market refresh, on its own clock.
 *
 * Scheduled in vercel.json at 12:45 UTC on weekdays (8:45 ET in daylight
 * time), half an hour before the 9:15 people run, so the brief and the scans
 * open on refreshed daily bars and sector data instead of running after them.
 * Prices during the session come from the intraday tick; the close from the
 * prices cron. This run is the history and the metadata.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing required environment variables' }, { status: 500 });
  }
  if (!process.env.FINAZON_API_KEY) {
    return NextResponse.json({ success: false, error: 'FINAZON_API_KEY not set' }, { status: 200 });
  }

  const { status, body } = await coalesce('market-morning', 30_000, async () => {
    const startTime = Date.now();
    const log: string[] = [];
    const db = createSupabaseClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const [prices, enrich] = await Promise.allSettled([
      refreshMarketPrices(db, log),
      enrichMarketData(db, log),
    ]);
    const pricesRefreshed = prices.status === 'fulfilled' && typeof prices.value === 'number' ? prices.value : 0;
    const errors: string[] = [];
    if (prices.status === 'rejected') errors.push(`prices: ${prices.reason instanceof Error ? prices.reason.message : String(prices.reason)}`);
    if (enrich.status === 'rejected') errors.push(`enrich: ${enrich.reason instanceof Error ? enrich.reason.message : String(enrich.reason)}`);
    for (const e of errors) log.push(`[market-morning] ${e}`);

    const ms = Date.now() - startTime;
    await beat(db, 'market-morning', { pricesRefreshed, errors: errors.length, ms });
    console.log(`[cron/market-morning] prices=${pricesRefreshed} errors=${errors.length} ms=${ms}`);
    return { status: 200, body: { success: errors.length === 0, prices_refreshed: pricesRefreshed, errors, duration_ms: ms, log } };
  });
  return NextResponse.json(body, { status });
}
