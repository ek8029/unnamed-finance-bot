import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncPlaidItem, computeSnapshots, type PlaidItemForSync, type SyncResult } from '@/lib/plaid-sync';
import { refreshMarketPrices, enrichMarketData, refreshMarketNews, updatePortfolioPerformance } from '@/lib/market-sync';
import { generateInsights } from '@/lib/insights-engine';
import { runDigestCron } from '@/lib/digest-cron';
import { composeWeeklyNote, saveAnalystNote } from '@/lib/research/analyst-note';
import { commitStandingSnapshots } from '@/lib/research/standing-questions';
import { isOpenAccessWindow } from '@/lib/tier';
import { POST as runDripEmails } from '@/app/api/emails/drip/route';
import { GET as runWatchlistAlerts } from '@/app/api/cron/watchlist-alerts/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Headroom for the Friday analyst-note pass (an LLM call + standing-question
// re-runs per user) on top of sync/prices/digest. Vercel Pro allows 300.
export const maxDuration = 300;

interface CronSyncResult extends SyncResult {
  user_id: string;
}

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

    // ── AI digest FIRST — highest user-facing priority ──

    let digestResult = { generated: 0, skipped: 0, log: [] as string[], emailed: [] as string[] };
    try {
      digestResult = await runDigestCron({ force: true });
      log.push(...digestResult.log);
    } catch (err) {
      log.push(`[digest] Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // ── Email jobs — must run before dedup can early-return ──
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

    // ── Dedup — only gates Plaid sync + market data, never emails ──

    const { data: lastRun } = await serviceClient
      .from('portfolio_performance')
      .select('calculated_at')
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRun?.calculated_at) {
      const hoursSince = (Date.now() - new Date(lastRun.calculated_at).getTime()) / (1000 * 60 * 60);
      const forceRun = new URL(request.url).searchParams.get('force') === 'true';
      if (hoursSince < 20 && !forceRun) {
        return NextResponse.json({ message: 'Cron already ran recently', skipped: true, drip_emails_sent: dripResult.sent, watchlist_alerts_sent: watchlistResult.sent });
      }
    }

    const { data: plaidItems, error: itemsError } = await serviceClient
      .from('plaid_items')
      .select('*')
      .eq('status', 'active');

    if (itemsError) {
      console.error('[cron/daily] Error fetching plaid items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch plaid items', drip_emails_sent: dripResult.sent }, { status: 500 });
    }

    if (!plaidItems || plaidItems.length === 0) {
      log.push('No active Plaid items found - nothing to sync');
      return NextResponse.json({ success: true, log, drip_emails_sent: dripResult.sent, duration_ms: Date.now() - startTime });
    }

    log.push(`Found ${plaidItems.length} active Plaid item(s)`);

    const userItemMap = new Map<string, typeof plaidItems>();
    for (const item of plaidItems) {
      const existing = userItemMap.get(item.user_id) || [];
      existing.push(item);
      userItemMap.set(item.user_id, existing);
    }

    const syncResults: CronSyncResult[] = [];

    for (const item of plaidItems) {
      try {
        const syncItem: PlaidItemForSync = {
          id: item.id,
          plaid_access_token: item.plaid_access_token,
          transactions_cursor: item.transactions_cursor,
          institution_name: item.institution_name,
          available_products: item.available_products || [],
          billed_products: item.billed_products || [],
          consented_products: item.consented_products || [],
        };

        const result = await syncPlaidItem(serviceClient, item.user_id, syncItem);
        syncResults.push({ ...result, user_id: item.user_id });
        log.push(
          `[sync] ${item.institution_name || item.id}: ` +
          `+${result.transactions?.added ?? 0} txns, ` +
          `~${result.transactions?.modified ?? 0} modified, ` +
          `-${result.transactions?.removed ?? 0} removed, ` +
          `${result.holdings_synced ?? 0} holdings`,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.push(`[sync] ${item.institution_name || item.id}: FAILED - ${msg}`);
        syncResults.push({
          item_id: item.id,
          user_id: item.user_id,
          institution: item.institution_name,
          success: false,
          error: msg,
          transactions: { added: 0, modified: 0, removed: 0 },
          holdings_synced: 0,
        });

        await serviceClient
          .from('plaid_items')
          .update({ status: 'error', error_message: msg })
          .eq('id', item.id);
      }
    }

    let pricesRefreshed = 0;

    if (process.env.FINAZON_API_KEY) {
      const marketResults = await Promise.allSettled([
        refreshMarketPrices(serviceClient, log),
        enrichMarketData(serviceClient, log),
        refreshMarketNews(serviceClient, log, { classifyMacro: true, classifySubjects: true }),
      ]);

      const marketNames = ['prices', 'enrich', 'news'] as const;
      marketResults.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          if (i === 0 && typeof result.value === 'number') {
            pricesRefreshed = result.value;
          }
        } else {
          const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          log.push(`[${marketNames[i]}] Market ${marketNames[i]} failed: ${msg}`);
          console.error(`[cron/daily] Market ${marketNames[i]} failed:`, result.reason);
        }
      });
    } else {
      log.push('[prices] FINAZON_API_KEY not set - skipping all market data');
    }

    let insightsGenerated = 0;

    for (const userId of userItemMap.keys()) {
      try {
        const now = new Date().toISOString();
        await serviceClient
          .from('linked_accounts')
          .update({ last_synced_at: now, sync_status: 'healthy' })
          .eq('user_id', userId)
          .eq('is_active', true);

        await computeSnapshots(serviceClient, userId);
        log.push(`[snapshots] Computed for user ${userId.slice(0, 8)}...`);

        try {
          await updatePortfolioPerformance(serviceClient, userId);
          log.push(`[perf] Updated portfolio_performance for user ${userId.slice(0, 8)}...`);

          // Write a daily portfolio snapshot for the chart. Include the
          // per-holding detail (holdings_snapshot was always in the schema but
          // never populated): share counts are what let a return calc tell a
          // deposit from a gain, so an honest vs-benchmark series needs them.
          const { data: userHoldings } = await serviceClient
            .from('holdings')
            .select('ticker, shares, total_value, total_cost_basis, unrealised_gain_loss')
            .eq('user_id', userId);

          if (userHoldings && userHoldings.length > 0) {
            const totalValue = userHoldings.reduce((s: number, h: { total_value: number }) => s + Number(h.total_value), 0);
            const totalGainLoss = userHoldings.reduce((s: number, h: { unrealised_gain_loss: number | null }) => s + Number(h.unrealised_gain_loss || 0), 0);
            const totalCostBasis = userHoldings.reduce((s: number, h: { total_cost_basis: number | null }) => s + Number(h.total_cost_basis || 0), 0);
            const today = new Date().toISOString().split('T')[0];

            await serviceClient
              .from('portfolio_snapshots')
              .upsert({
                user_id: userId,
                snapshot_date: today,
                total_value: totalValue,
                total_gain_loss: totalGainLoss,
                total_cost_basis: totalCostBasis,
                holdings_snapshot: userHoldings.map((h: { ticker: string; shares: number | null; total_value: number }) => ({
                  ticker: h.ticker,
                  shares: h.shares != null ? Number(h.shares) : null,
                  value: Number(h.total_value),
                })),
              }, { onConflict: 'user_id,snapshot_date' });

            log.push(`[snapshots] Wrote portfolio_snapshots for user ${userId.slice(0, 8)}...`);
          }
        } catch (error) {
          console.error(`[cron/daily] Error computing portfolio performance for ${userId}:`, error);
        }

        const count = await generateInsights(serviceClient, userId);
        insightsGenerated += count;
        log.push(`[insights] Generated ${count} for user ${userId.slice(0, 8)}...`);

      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.push(`[post-sync] User ${userId.slice(0, 8)}... failed: ${msg}`);
      }
    }

    // ── Weekly analyst note (Fridays ET) — the agent writes each pro user a
    //    short memo from the week's findings. Capped and per-user tolerant so
    //    a bad book can't take the cron down. ──
    let analystNotesWritten = 0;
    const etWeekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date());
    if (etWeekday === 'Fri') {
      try {
        // Non-free subscriptions, minus expired never-paid trials (mirrors
        // getSubscriptionInfo, which is session-bound and unusable here).
        // During the open-access window everyone reads as Pro, so the note
        // goes to every user with a book instead (same cap).
        let eligible: { user_id: string }[];
        if (isOpenAccessWindow()) {
          const { data: hu } = await serviceClient.from('holdings').select('user_id');
          eligible = [...new Set((hu ?? []).map((h) => h.user_id as string))]
            .map((user_id) => ({ user_id }))
            .slice(0, 8);
        } else {
          const { data: subs } = await serviceClient
            .from('user_subscriptions')
            .select('user_id, tier, trial_ends_at, stripe_subscription_id')
            .neq('tier', 'free');
          eligible = (subs ?? [])
            .filter((s) => {
              if (s.trial_ends_at && !s.stripe_subscription_id) {
                return new Date(s.trial_ends_at).getTime() > Date.now();
              }
              return true;
            })
            .slice(0, 8);
        }

        for (const sub of eligible) {
          try {
            const draft = await composeWeeklyNote(serviceClient, sub.user_id);
            if (!draft) continue;
            const { error } = await saveAnalystNote(serviceClient, sub.user_id, draft);
            if (error) {
              log.push(`[note] Save failed for ${String(sub.user_id).slice(0, 8)}...: ${error.message}`);
              // Table not migrated yet — no point trying the rest.
              if (error.message.includes('analyst_notes')) break;
              continue;
            }
            // Only now is it safe to advance the watched-question snapshots:
            // the note that reports their new findings is durably stored. Any
            // earlier and a failure above would mark those findings seen
            // without ever telling the user about them.
            await commitStandingSnapshots(serviceClient, draft.pendingSnapshots);
            analystNotesWritten++;
            log.push(`[note] Wrote weekly note for ${String(sub.user_id).slice(0, 8)}... (${draft.citations.length} citations)`);
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            log.push(`[note] Compose failed for ${String(sub.user_id).slice(0, 8)}...: ${msg}`);
          }
        }
      } catch (error) {
        console.error('[cron/daily] Weekly note pass failed:', error);
      }
    }

    const summary = {
      success: true,
      duration_ms: Date.now() - startTime,
      items_synced: syncResults.filter(r => r.success).length,
      items_failed: syncResults.filter(r => !r.success).length,
      users_processed: userItemMap.size,
      prices_refreshed: pricesRefreshed,
      insights_generated: insightsGenerated,
      briefs_emailed: digestResult.emailed.length,
      analyst_notes_written: analystNotesWritten,
      drip_emails_sent: dripResult.sent,
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
