import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { coalesce } from '@/lib/coalesce';
import { readJudgeConfig, runJudgeWorker } from '@/lib/agent/judge-queue';
import { checkPushReceipts } from '@/lib/push/send';
import { runJudgeJob } from '@/lib/agent/judge-run';
import { describeLedger } from '@/lib/ai/pricing';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/cron/judge-worker: drain the judge queue.
 *
 * Scheduled every minute (vercel.json). With JUDGE_ENABLED unset the call
 * returns before touching the database, so the schedule can ship ahead of the
 * switch. Coalesced on its own key for 55 seconds so a warm instance never
 * starts a second drain while one is running; across instances each job's
 * claim is atomic on the row, so the worst case is two workers on different
 * jobs, never two on one.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cfg = readJudgeConfig();
  try {
    const summary = await coalesce('judge-worker', 55_000, async () => {
      const log: string[] = [];
      const db = await createServiceClient();
      const s = await runJudgeWorker(db, cfg, (job, l) => runJudgeJob(db, job, l), log);
      // Push receipts ride the minute cron whether or not the judge is on.
      try { await checkPushReceipts(db, log); } catch (err) { log.push(`[push] receipts: ${err instanceof Error ? err.message : String(err)}`); }
      for (const line of log) console.log(`[cron/judge-worker] ${line}`);
      if (s.claimed > 0) console.log(`[cron/judge-worker] cost ${describeLedger(s.ledger)}`);
      return s;
    });
    const { ledger, ...body } = summary;
    return NextResponse.json({
      ok: true,
      ...body,
      byModel: ledger.byModel,
      caps: { daily: cfg.dailyCap, user: cfg.userCap, batch: cfg.batch },
    });
  } catch (error) {
    console.error('[cron/judge-worker] failed:', error);
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
  }
}
