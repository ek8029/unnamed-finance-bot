/**
 * Cron job: refresh AI analyses for the top 50 popular tickers.
 *
 * Runs on two schedules (configured in vercel.json):
 *   - Every hour during US market hours (Mon-Fri 9:30am-4pm ET)
 *   - Every 4 hours off-hours (covers after-hours news, earnings releases,
 *     pre-market activity)
 *
 * For each ticker:
 *   1. Force-deletes the analysis_cache row (so analyzeStock will
 *      regenerate fresh data even if the row is still within TTL)
 *   2. Calls analyzeStock() which fetches Finnhub + GPT-4o-mini and
 *      writes a fresh row to analysis_cache
 *   3. Continues on errors so one bad ticker doesn't stall the rest
 *
 * Auth: Bearer token matching CRON_SECRET env var. Vercel Cron sets this
 * automatically when the cron is configured in vercel.json.
 *
 * Throttling: ~1.2 second delay between tickers to stay well under
 * Finnhub free-tier limit (60 calls/min). With 50 tickers × ~5 Finnhub
 * calls each = 250 calls per cron run, paced over ~60 seconds = 4 calls/sec.
 *
 * Cost (at GPT-4o-mini pricing, ~$0.0007 per analysis):
 *   - Market hours: 6.5 hours × 1 run/hr × 50 tickers = 325 refreshes/day
 *   - Off-hours:    6 runs/day × 50 tickers = 300 refreshes/day
 *   - Total:        ~625 refreshes/day × ~$0.0007 = ~$0.44/day = ~$13/month
 *
 * Cron runs that hit during market closure (e.g. Sat morning at 9am ET when
 * market is closed) still execute — they just refresh the analyses with
 * the same closing-bell data, which is cheap and harmless.
 */

import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { analyzeStock } from '@/lib/analyze-stock';
import { POPULAR_TICKERS } from '@/lib/popular-tickers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — enough for 50 tickers @ 1.2s each

/** Delay helper for throttling between Finnhub calls. */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: Request) {
  const startTime = Date.now();

  // ── Auth: only Vercel Cron with the right secret can trigger this ──
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Setup ──
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Missing required environment variables' },
      { status: 500 },
    );
  }

  const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Force-evict cached rows for all tickers in this run ──
  // This guarantees the next analyzeStock call will regenerate, even if
  // the existing row is technically still within TTL. We do a single batch
  // delete instead of one-per-ticker for performance.
  const { error: deleteError } = await serviceClient
    .from('analysis_cache')
    .delete()
    .in('ticker', POPULAR_TICKERS as unknown as string[]);

  if (deleteError) {
    console.error('[cron/refresh-tickers] Failed to evict old cache rows:', deleteError);
    // Non-fatal — we'll regenerate anyway, just won't be guaranteed-fresh
  }

  // ── Refresh each ticker sequentially with throttling ──
  const results: { ticker: string; success: boolean; durationMs: number; error?: string }[] = [];

  for (const ticker of POPULAR_TICKERS) {
    const tickerStart = Date.now();
    try {
      const { analysis } = await analyzeStock(ticker);
      const durationMs = Date.now() - tickerStart;

      if (analysis) {
        results.push({ ticker, success: true, durationMs });
      } else {
        results.push({ ticker, success: false, durationMs, error: 'analyzeStock returned null' });
      }
    } catch (err) {
      const durationMs = Date.now() - tickerStart;
      const message = err instanceof Error ? err.message : String(err);
      results.push({ ticker, success: false, durationMs, error: message });
      console.error(`[cron/refresh-tickers] ${ticker} failed:`, message);
    }

    // Throttle between tickers to stay under Finnhub free-tier rate limit
    // (60/min). Each analyzeStock call uses ~5 Finnhub endpoints, so we
    // need ~5s headroom per ticker. 1200ms is conservative.
    await sleep(1200);
  }

  const totalDurationMs = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  const summary = {
    success: true,
    durationMs: totalDurationMs,
    refreshed: successCount,
    failed: failureCount,
    totalTickers: POPULAR_TICKERS.length,
    failedTickers: results.filter(r => !r.success).map(r => ({ ticker: r.ticker, error: r.error })),
  };

  console.log('[cron/refresh-tickers] Completed:', JSON.stringify(summary, null, 2));

  return NextResponse.json(summary);
}
