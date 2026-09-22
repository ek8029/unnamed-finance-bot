import { NextRequest, NextResponse } from 'next/server';
import { runDigestCron } from '@/lib/digest-cron';
import { POST as runDripEmails } from '@/app/api/emails/drip/route';
import { GET as runWatchlistAlerts } from '@/app/api/cron/watchlist-alerts/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// This is the people run: briefs, drips, alerts, watch digests. Two things
// used to share its 300 seconds and each has since been given its own clock:
// the vendor-paced market refresh (/api/cron/market-morning, 12:45 UTC), and
// the Plaid sync with the scans and the Friday note (/api/cron/plaid-sync,
// 13:00 UTC). The digest ran first here and on 2026-09-22 took 3.8 minutes,
// which left the Plaid loop 66 seconds before Vercel killed the function with
// 11 of 24 items never reached. Nothing in this file now touches a book.
export const maxDuration = 300;

export async function GET(request: Request) {
  const startTime = Date.now();
  const log: string[] = [];

  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── AI digest FIRST — highest user-facing priority ──

    let digestResult = { generated: 0, skipped: 0, log: [] as string[], emailed: [] as string[] };
    try {
      digestResult = await runDigestCron({ force: true });
      log.push(...digestResult.log);
    } catch (err) {
      log.push(`[digest] Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // ── Email jobs ──
    //
    // Called in-process, never fetched. The self-fetch through
    // NEXT_PUBLIC_APP_URL went dead on 2026-05-21: the variable is http:// in
    // production, Vercel answers 308 -> https, Node treats the scheme change as
    // cross-origin and drops the Authorization header, the route says 401, and
    // this log read "Sent 0 emails" every morning for three months. Route
    // handlers are functions; there is nothing to fetch.
    const internal = (path: string, method: 'GET' | 'POST') =>
      new NextRequest(`http://cron.internal${path}`, {
        method,
        headers: { Authorization: `Bearer ${cronSecret}` },
      });

    let dripResult = { sent: 0 };
    try {
      const dripRes = await runDripEmails(internal('/api/emails/drip', 'POST'));
      if (dripRes.ok) dripResult = await dripRes.json();
      else log.push(`[drip] Route answered ${dripRes.status}`);
      log.push(`[drip] Sent ${dripResult.sent} emails`);
    } catch (err) {
      log.push(`[drip] Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // Watchlist price alerts
    let watchlistResult = { sent: 0 };
    try {
      const watchlistRes = await runWatchlistAlerts(internal('/api/cron/watchlist-alerts', 'GET'));
      if (watchlistRes.ok) watchlistResult = await watchlistRes.json();
      else log.push(`[watchlist] Route answered ${watchlistRes.status}`);
      log.push(`[watchlist] Sent ${watchlistResult.sent} alerts`);
    } catch (err) {
      log.push(`[watchlist] Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // Watch-my-tickers digests (no-account subscribers; send-only-if-news + Friday roundup)
    try {
      const { sendWatchDigests } = await import('@/lib/watch');
      const watchResult = await sendWatchDigests();
      log.push(`[watch] Sent ${watchResult.sent} digests (${watchResult.skipped} skipped, ${watchResult.errors} errors)`);
    } catch (err) {
      log.push(`[watch] Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    const summary = {
      success: true,
      duration_ms: Date.now() - startTime,
      briefs_emailed: digestResult.emailed.length,
      drip_emails_sent: dripResult.sent,
      watchlist_alerts_sent: watchlistResult.sent,
      digests_generated: digestResult.generated,
      log,
    };

    console.log('[cron/daily] Completed:', JSON.stringify(summary, null, 2));

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[cron/daily] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: 'Cron job failed',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 },
    );
  }
}
