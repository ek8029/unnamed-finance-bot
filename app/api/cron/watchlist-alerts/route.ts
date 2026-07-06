import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getQuote } from '@/lib/financial-data';
import { resend, FROM_EMAIL } from '@/lib/emails/resend';
import { getWatchlistAlertTemplate, type WatchlistMover } from '@/lib/emails/templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MOVE_THRESHOLD = 3; // alert on >=3% daily move
const DEFAULT_TICKERS = ['SPY', 'QQQ', 'VIXY', 'TLT'];

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
    const { data: { users }, error: usersError } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    // Users who turned Market alerts off in Settings. This email already carries
    // a settings-link unsubscribe; now that link actually stops the send.
    const { data: prefRows } = await serviceClient
      .from('user_preferences')
      .select('user_id, notification_market_alerts');
    const marketAlertsOff = new Set(
      (prefRows ?? []).filter(p => p.notification_market_alerts === false).map(p => p.user_id),
    );

    for (const user of users) {
      if (!user.email) continue;
      if (marketAlertsOff.has(user.id)) { skipped++; continue; }

      // Get user's watchlist
      const { data: watchlistRows } = await serviceClient
        .from('user_watchlist')
        .select('ticker')
        .eq('user_id', user.id);

      const tickers = (watchlistRows && watchlistRows.length > 0)
        ? watchlistRows.map(r => r.ticker)
        : DEFAULT_TICKERS;

      // Fetch quotes for watchlist
      const movers: WatchlistMover[] = [];
      for (const ticker of tickers) {
        try {
          const q = await getQuote(ticker);
          if (q && q.c > 0 && Math.abs(q.dp) >= MOVE_THRESHOLD) {
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
