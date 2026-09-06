import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { coalesce } from '@/lib/coalesce';
import { runEdgarWatch, WATCH_FORMS } from '@/lib/edgar-watch';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * GET /api/cron/edgar-watch: read EDGAR's latest-filings feeds, record what
 * landed on watched names, enqueue judge jobs.
 *
 * Scheduled every minute in market hours, every five minutes off hours on
 * weekdays, every thirty minutes at weekends (vercel.json). EDGAR accepts
 * filings 6am to 10pm ET on business days, so the overnight and weekend slots
 * are cheap no-ops that still prove the poller is alive.
 *
 * `?dry=1` records events as skipped and enqueues nothing (rollout step 4).
 * `?forms=8-K,10-Q` narrows the feeds for a hand check.
 *
 * A feed error is logged and returned in the body with status 200. Never a
 * 500: Vercel would retry, and the next minute is the retry.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const dry = url.searchParams.get('dry') === '1';
  const formsParam = url.searchParams.get('forms');
  const forms = formsParam
    ? formsParam.split(',').map((f) => f.trim()).filter((f) => (WATCH_FORMS as readonly string[]).includes(f))
    : undefined;

  try {
    const result = await coalesce(`edgar-watch:${dry ? 'dry' : 'live'}:${(forms ?? WATCH_FORMS).join(',')}`, 30_000, async () => {
      const log: string[] = [];
      const db = await createServiceClient();
      const r = await runEdgarWatch(db, { dry, forms, log });
      for (const line of log) console.log(`[cron/edgar-watch] ${line}`);
      console.log(
        `[cron/edgar-watch] ${dry ? 'DRY ' : ''}fetched=${r.fetched} pages=${r.pages} watched=${r.watched} new=${r.new} queued=${r.queued} ` +
          `skipped=${r.skipped} errors=${r.errors.length} universe=${r.universe.tickers}t/${r.universe.ciks}c ms=${r.ms}`,
      );
      for (const e of r.errors) console.error(`[cron/edgar-watch] ${e}`);
      return r;
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/edgar-watch] failed:', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'watch failed' }, { status: 200 });
  }
}
