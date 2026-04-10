/**
 * Admin endpoint: force-refresh the AI analysis for one or more tickers.
 *
 * Use this when you spot stale data on /analyze/[ticker] and want an
 * immediate refresh without waiting for the next cron run.
 *
 * POST /api/admin/refresh-analysis
 * Headers: { Authorization: Bearer <CRON_SECRET> }
 * Body:    { tickers: string[] }   // up to 20 per request
 *
 * Example:
 *   curl -X POST https://helmterminal.dev/api/admin/refresh-analysis \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"tickers":["AAPL","NVDA","TSLA"]}'
 *
 * Or refresh a single ticker via query param:
 *   POST /api/admin/refresh-analysis?ticker=AAPL
 *
 * Behavior per ticker:
 *   1. Force-deletes the existing cache row
 *   2. Calls analyzeStock() which fetches fresh Finnhub + GPT-4o-mini data
 *   3. Returns success/failure with timing
 *
 * Auth uses the same CRON_SECRET as Vercel Cron and the daily job — no
 * separate admin token to manage. If you need to expose this to non-admin
 * users (e.g. a "refresh" button on the page), build a separate
 * rate-limited public endpoint instead.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { analyzeStock } from '@/lib/analyze-stock';

const MAX_TICKERS_PER_REQUEST = 20;

export async function POST(req: NextRequest) {
  // ── Auth ──
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse tickers from body OR query param ──
  let tickers: string[] = [];

  // Try query param first (single-ticker convenience)
  const queryTicker = req.nextUrl.searchParams.get('ticker');
  if (queryTicker) {
    tickers = [queryTicker];
  } else {
    // Fall back to JSON body
    try {
      const body = await req.json();
      if (Array.isArray(body.tickers)) {
        tickers = body.tickers;
      } else if (typeof body.ticker === 'string') {
        tickers = [body.ticker];
      }
    } catch {
      return NextResponse.json(
        { error: 'Body must be JSON: { tickers: string[] } or pass ?ticker=AAPL' },
        { status: 400 },
      );
    }
  }

  // Validate
  tickers = tickers
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .map(t => t.toUpperCase().replace(/[^A-Z.]/g, ''))
    .filter(t => t.length > 0 && t.length <= 5);

  if (tickers.length === 0) {
    return NextResponse.json({ error: 'No valid tickers provided' }, { status: 400 });
  }
  if (tickers.length > MAX_TICKERS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Maximum ${MAX_TICKERS_PER_REQUEST} tickers per request` },
      { status: 400 },
    );
  }

  // ── Setup ──
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 });
  }
  const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Force-evict the cache rows ──
  const { error: deleteError } = await serviceClient
    .from('analysis_cache')
    .delete()
    .in('ticker', tickers);

  if (deleteError) {
    console.error('[admin/refresh-analysis] Cache delete failed:', deleteError);
    // Non-fatal — analyzeStock will still regenerate, but new TTL
    // won't kick in until then
  }

  // ── Regenerate sequentially (don't burst Finnhub) ──
  const results: { ticker: string; success: boolean; durationMs: number; error?: string }[] = [];

  for (const ticker of tickers) {
    const start = Date.now();
    try {
      const { analysis } = await analyzeStock(ticker);
      const durationMs = Date.now() - start;
      results.push({
        ticker,
        success: !!analysis,
        durationMs,
        error: analysis ? undefined : 'analyzeStock returned null',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ ticker, success: false, durationMs: Date.now() - start, error: message });
    }
  }

  return NextResponse.json({
    success: true,
    refreshed: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  });
}
