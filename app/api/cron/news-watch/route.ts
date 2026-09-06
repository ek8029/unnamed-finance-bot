import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { coalesce } from '@/lib/coalesce';
import { runNewsWatch } from '@/lib/news-watch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/news-watch: ingest and classify news for one slice of the
 * watched names, enqueue judge jobs for what the classifier calls ABOUT a
 * thesis name. Every five minutes, all day (vercel.json); the slice rotates
 * with the clock so every name is read about every 40 minutes.
 *
 * Coalesced for four minutes so a slow tick can never overlap the next slot.
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
    const result = await coalesce('news-watch', 240_000, async () => {
      const log: string[] = [];
      const db = await createServiceClient();
      const r = await runNewsWatch(db, { log });
      for (const line of log) console.log(`[cron/news-watch] ${line}`);
      console.log(
        `[cron/news-watch] slot=${r.slot} slice=${r.slice.length}/${r.tickers} inserted=${r.inserted} about=${r.about} queued=${r.queued} ` +
          `classifier=${r.classifierCalls} calls $${r.classifierCostUsd.toFixed(4)} errors=${r.errors.length} ms=${r.ms}`,
      );
      for (const e of r.errors) console.error(`[cron/news-watch] ${e}`);
      return r;
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/news-watch] failed:', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'watch failed' }, { status: 200 });
  }
}
