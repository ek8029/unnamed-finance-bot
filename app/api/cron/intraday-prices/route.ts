import { NextResponse } from 'next/server';
import { coalesce } from '@/lib/coalesce';
import { runIntradayTick } from '@/lib/market/intraday-tick';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/intraday-prices — last-trade prices onto every holding.
 *
 * Scheduled every five minutes, 13:00-21:55 UTC on weekdays (vercel.json).
 * That brackets 9:30-16:00 ET in both daylight and standard time; the tick
 * itself returns early outside market hours, so the off-session slots cost
 * one cheap function call and no vendor traffic.
 *
 * Coalesced on its own key with a four-minute window: if a run overlaps the
 * next slot, the second caller gets the first run's result instead of
 * starting a parallel sweep against the same /price budget.
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
    const { status, body } = await coalesce('intraday-tick', 240_000, runIntradayTick);
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error('[cron/intraday-prices] tick failed:', error);
    return NextResponse.json({ error: 'Tick failed' }, { status: 500 });
  }
}
