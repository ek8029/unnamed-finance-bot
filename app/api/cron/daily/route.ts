import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncPlaidItem, computeSnapshots, type PlaidItemForSync, type SyncResult } from '@/lib/plaid-sync';
import { refreshMarketPrices, enrichMarketData, refreshMarketNews, refreshMarketNewsFinnhub, updatePortfolioPerformance } from '@/lib/market-sync';
import { generateInsights } from '@/lib/insights-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    // ── Email jobs FIRST — must run before dedup can early-return ──

    let dripResult = { sent: 0 };
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://helmterminal.dev';
      const dripRes = await fetch(`${baseUrl}/api/emails/drip`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      if (dripRes.ok) dripResult = await dripRes.json();
      log.push(`[drip] Sent ${dripResult.sent} emails`);
    } catch (err) {
      log.push(`[drip] Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // AI digest
    let digestResult = { generated: 0, skipped: 0 };
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://helmterminal.dev';
      const digestRes = await fetch(`${baseUrl}/api/cron/digest?force=true`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      if (digestRes.ok) digestResult = await digestRes.json();
      log.push(`[digest] Generated ${digestResult.generated}, skipped ${digestResult.skipped}`);
    } catch (err) {
      log.push(`[digest] Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // Watchlist price alerts
    let watchlistResult = { sent: 0 };
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://helmterminal.dev';
      const watchlistRes = await fetch(`${baseUrl}/api/cron/watchlist-alerts`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      if (watchlistRes.ok) watchlistResult = await watchlistRes.json();
      log.push(`[watchlist] Sent ${watchlistResult.sent} alerts`);
    } catch (err) {
      log.push(`[watchlist] Failed: ${err instanceof Error ? err.message : 'unknown'}`);
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

    if (process.env.POLYGON_API_KEY) {
      const marketResults = await Promise.allSettled([
        refreshMarketPrices(serviceClient, log),
        enrichMarketData(serviceClient, log),
        refreshMarketNews(serviceClient, log),
        refreshMarketNewsFinnhub(serviceClient, log),
      ]);

      const marketNames = ['prices', 'enrich', 'news', 'finnhub-news'] as const;
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
      log.push('[prices] POLYGON_API_KEY not set - skipping all market data');
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

          // Write a daily portfolio snapshot for the chart
          const { data: userHoldings } = await serviceClient
            .from('holdings')
            .select('total_value, unrealised_gain_loss')
            .eq('user_id', userId);

          if (userHoldings && userHoldings.length > 0) {
            const totalValue = userHoldings.reduce((s: number, h: { total_value: number }) => s + Number(h.total_value), 0);
            const totalGainLoss = userHoldings.reduce((s: number, h: { unrealised_gain_loss: number | null }) => s + Number(h.unrealised_gain_loss || 0), 0);
            const today = new Date().toISOString().split('T')[0];

            await serviceClient
              .from('portfolio_snapshots')
              .upsert({
                user_id: userId,
                snapshot_date: today,
                total_value: totalValue,
                total_gain_loss: totalGainLoss,
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


    const summary = {
      success: true,
      duration_ms: Date.now() - startTime,
      items_synced: syncResults.filter(r => r.success).length,
      items_failed: syncResults.filter(r => !r.success).length,
      users_processed: userItemMap.size,
      prices_refreshed: pricesRefreshed,
      insights_generated: insightsGenerated,
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
