import { NextResponse } from 'next/server';
import { coalesce } from '@/lib/coalesce';
import { runGlobalRefresh } from '@/lib/market/price-sweep';

export const dynamic = 'force-dynamic';
// The sweep walks every held ticker at vendor-throttled pace; the
// dashboard-triggered route already needed ten minutes.
export const maxDuration = 600;

/**
 * GET /api/cron/prices — the global price sweep on a schedule.
 *
 * Scheduled in vercel.json for 16:05 and 19:00 ET on weekdays (20:05 and
 * 23:00 UTC while the US is on daylight time; Vercel crons are UTC, so the
 * ET times shift an hour in winter like every other cron here). The first
 * run lands the bar close minutes after the bell; the second re-reads it
 * once Finazon's subset-venue intraday bars have synced to consolidated
 * volume. Both stay before 20:00 ET, after which the sweep's UTC-based
 * snapshot date would roll to tomorrow.
 *
 * Same coalesce key as the user-triggered route, so a dashboard load at
 * 16:05 and this cron do not run two sweeps.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { status, body } = await coalesce('global-price-refresh', 30_000, runGlobalRefresh);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error('[cron/prices] sweep failed:', error);
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }
}
