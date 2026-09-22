import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncPlaidItem, computeSnapshots, type PlaidItemForSync, type SyncResult } from '@/lib/plaid-sync';
import { extractPlaidError } from '@/lib/plaid-errors';
import { nudgeReconnects } from '@/lib/plaid/nudge-reconnect';
import { updatePortfolioPerformance } from '@/lib/market-sync';
import { generateInsights } from '@/lib/insights-engine';
import { composeWeeklyNote, saveAnalystNote } from '@/lib/research/analyst-note';
import { commitStandingSnapshots } from '@/lib/research/standing-questions';
import { isOpenAccessWindow } from '@/lib/tier';
import { isTrialRow } from '@/lib/tier-shared';
import { beat } from '@/lib/agent/heartbeat';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// The book run: every active Plaid item, then the per-user snapshots, the
// performance series, the scans, and on Fridays the analyst note. It used to
// share the 9:15 people run's 300 seconds with the briefs, and the briefs ran
// first: on 2026-09-22 the digest took 3.8 minutes, the Plaid loop started at
// 13:19:34, and Vercel killed the function at 13:20:44 with 11 of 24 items
// never reached and no snapshots written for anyone. Vercel Pro allows 800.
export const maxDuration = 800;

interface CronSyncResult extends SyncResult {
  user_id: string;
}

/**
 * GET /api/cron/plaid-sync — the Plaid sync and the scans, on their own clock.
 *
 * Scheduled in vercel.json at 13:00 UTC daily, before the 13:15 people run, so
 * the brief reads a book that was refreshed this morning rather than one that
 * would have been refreshed after it. The ?force=true the schedule carries
 * bypasses the once-per-20-hours gate below, which exists so a manual call
 * cannot double-run the day.
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const log: string[] = [];

  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }
    if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Missing required environment variables' }, { status: 500 });
    }

    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Dedup — once per day unless forced ──

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
        return NextResponse.json({ message: 'Plaid sync already ran recently', skipped: true });
      }
    }

    const { data: plaidItems, error: itemsError } = await serviceClient
      .from('plaid_items')
      .select('*')
      .eq('status', 'active');

    if (itemsError) {
      console.error('[cron/plaid-sync] Error fetching plaid items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch plaid items' }, { status: 500 });
    }

    if (!plaidItems || plaidItems.length === 0) {
      log.push('No active Plaid items found - nothing to sync');
      return NextResponse.json({ success: true, log, duration_ms: Date.now() - startTime });
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
        // Store what Plaid said, not axios's "Request failed with status code
        // 400": the code is what tells a reader whether the item needs a
        // reconnect or just a retry.
        const pe = extractPlaidError(error);
        const msg = pe?.errorMessage || (error instanceof Error ? error.message : String(error));
        log.push(`[sync] ${item.institution_name || item.id}: FAILED - ${pe?.errorCode ?? 'UNKNOWN'} ${msg}`);
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
          .update({
            status: pe?.errorCode === 'ITEM_LOGIN_REQUIRED' ? 'login_required' : 'error',
            error_code: pe?.errorCode ?? null,
            error_message: msg,
          })
          .eq('id', item.id);
      }
    }

    // A connection only its owner can fix: one push a week to their phone while it stays broken.
    let reconnectPushes = 0;
    try {
      reconnectPushes = await nudgeReconnects(serviceClient, log);
    } catch (error) {
      log.push(`[reconnect] pass failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    let insightsGenerated = 0;

    for (const userId of userItemMap.keys()) {
      try {
        // Only syncPlaidItem's successful balance import marks accounts fresh.
        // Snapshot generation says nothing about failed or manual accounts.
        const snapshotsSaved = await computeSnapshots(serviceClient, userId);
        log.push(snapshotsSaved
          ? `[snapshots] Computed for user ${userId.slice(0, 8)}...`
          : `[snapshots] Failed for user ${userId.slice(0, 8)}...; retaining any previously saved history`);

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
          console.error(`[cron/plaid-sync] Error computing portfolio performance for ${userId}:`, error);
        }

        const count = await generateInsights(serviceClient, userId);
        insightsGenerated += count;
        log.push(`[insights] Generated ${count} for user ${userId.slice(0, 8)}...`);

      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.push(`[post-sync] User ${userId.slice(0, 8)}... failed: ${msg}`);
      }
    }

    // The scans ran: stamp it, so a surface can say so only when it is true.
    // The heartbeat keeps its name; the worklog and presence readers key on it.
    await beat(serviceClient, 'daily-scans', { users: userItemMap.size, insights: insightsGenerated, reconnectPushes, ms: Date.now() - startTime });

    // ── Weekly analyst note (Fridays ET) — the agent writes each pro user a
    //    short memo from the week's findings. Lives here because it reads the
    //    scans that just ran. Capped and per-user tolerant so a bad book can't
    //    take the run down. ──
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
            .select('user_id, tier, trial_ends_at, stripe_subscription_id, source, permanent_access')
            .neq('tier', 'free');
          eligible = (subs ?? [])
            .filter((s) => {
              if (s.trial_ends_at && isTrialRow(s)) {
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
        console.error('[cron/plaid-sync] Weekly note pass failed:', error);
      }
    }

    const summary = {
      success: true,
      duration_ms: Date.now() - startTime,
      items_synced: syncResults.filter(r => r.success).length,
      items_failed: syncResults.filter(r => !r.success).length,
      users_processed: userItemMap.size,
      insights_generated: insightsGenerated,
      analyst_notes_written: analystNotesWritten,
      log,
    };

    console.log('[cron/plaid-sync] Completed:', JSON.stringify(summary, null, 2));

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[cron/plaid-sync] Fatal error:', error);
    return NextResponse.json(
      { error: 'Cron job failed', message: 'Cron job failed', duration_ms: Date.now() - startTime },
      { status: 500 },
    );
  }
}
