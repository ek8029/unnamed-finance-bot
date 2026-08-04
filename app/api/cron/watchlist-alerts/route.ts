import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getQuote } from '@/lib/financial-data';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';
import { getWatchlistAlertTemplate, type WatchlistMover } from '@/lib/emails/templates';
import { alertThresholdFor } from '@/lib/watchlist-defaults';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;


/**
 * GET /api/cron/watchlist-alerts
 *
 * Called from daily cron. For each user, checks their watchlist
 * tickers for big moves (>=3%) and sends an email alert.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!resend) return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 });

  const serviceClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let sent = 0;
  let skipped = 0;
  const log: string[] = [];

  try {
    // listUsers caps at 1000 per page and silently returns only the first page,
    // so past 1000 signups the newest users would never be considered.
    const users: { id: string; email?: string; user_metadata?: { full_name?: string } }[] = [];
    for (let page = 1; page <= 50; page++) {
      const { data, error: usersError } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (usersError) throw usersError;
      const batch = data?.users ?? [];
      users.push(...batch);
      if (batch.length < 1000) break;
    }

    // Users who turned Market alerts off in Settings. This email already carries
    // a settings-link unsubscribe; now that link actually stops the send.
    //
    // This read MUST be complete. An unbounded select tops out at 1000 rows, and
    // a truncated opt-out set means people who explicitly turned these emails off
    // start receiving them again — the one failure mode that is not recoverable
    // by trying again tomorrow. Page it.
    const marketAlertsOff = new Set<string>();
    for (let page = 0; page < 200; page++) {
      const from = page * 1000;
      const { data: prefRows, error: prefError } = await serviceClient
        .from('user_preferences')
        .select('user_id, notification_market_alerts')
        .order('user_id', { ascending: true })
        .range(from, from + 999);
      if (prefError) {
        // Fail closed: without a verified opt-out list, send nothing.
        console.error('[watchlist-alerts] preference fetch failed, skipping run:', prefError.message);
        return NextResponse.json({ sent: 0, skipped: 0, error: 'preferences unavailable' });
      }
      const batch = prefRows ?? [];
      for (const p of batch) {
        if (p.notification_market_alerts === false) marketAlertsOff.add(p.user_id);
      }
      if (batch.length < 1000) break;
    }

    for (const user of users) {
      if (!user.email) continue;
      if (marketAlertsOff.has(user.id)) { skipped++; continue; }

      // Only users who actually built a watchlist. This used to fall back to
      // an implicit SPY/QQQ/VIXY/TLT default, which meant every signup who had
      // never opened the watchlist got market alerts about tickers they never
      // chose — unsolicited mail, and VIXY clears 3% often enough to make it a
      // near-daily send.
      const { data: watchlistRows } = await serviceClient
        .from('user_watchlist')
        .select('ticker')
        .eq('user_id', user.id);

      const tickers = (watchlistRows ?? []).map(r => r.ticker);
      if (tickers.length === 0) { skipped++; continue; }

      // Fetch quotes for watchlist
      const movers: WatchlistMover[] = [];
      for (const ticker of tickers) {
        try {
          const q = await getQuote(ticker);
          // Per-ticker threshold: a 3% day is noise on a volatility product.
          if (q && q.c > 0 && Math.abs(q.dp) >= alertThresholdFor(ticker)) {
            movers.push({ ticker, price: q.c, changePct: q.dp });
          }
        } catch {
          // Skip failed quotes
        }
      }

      if (movers.length === 0) { skipped++; continue; }

      // Sort by absolute move
      movers.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

      const fullName = user.user_metadata?.full_name;
      const firstName = fullName ? fullName.split(' ')[0] : undefined;
      const template = getWatchlistAlertTemplate(movers, firstName);
      if (!template) { skipped++; continue; }

      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
        sent++;
        log.push(`[watchlist] Sent to ${user.email.slice(0, 4)}... (${movers.length} movers)`);
      } catch (err) {
        log.push(`[watchlist] Failed ${user.email.slice(0, 4)}...: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }

    return NextResponse.json({ sent, skipped, log });
  } catch (err) {
    console.error('[watchlist-alerts] Error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
