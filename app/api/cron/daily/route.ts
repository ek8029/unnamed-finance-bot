import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { plaidClient, mapPlaidAccountType } from '@/lib/plaid';
import { RemovedTransaction, Transaction } from 'plaid';

// Vercel Cron uses GET requests
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for Pro plan

export async function GET(request: Request) {
  const startTime = Date.now();
  const log: string[] = [];

  try {
    // ---------------------------------------------------------------
    // 1. Auth check - verify CRON_SECRET
    // ---------------------------------------------------------------
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      log.push('CRON_SECRET not set - running in development mode (no auth)');
    }

    // ---------------------------------------------------------------
    // 2. Create service-role Supabase client (bypasses RLS)
    // ---------------------------------------------------------------
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 },
      );
    }

    const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ---------------------------------------------------------------
    // 3. Fetch all active Plaid items
    // ---------------------------------------------------------------
    const { data: plaidItems, error: itemsError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('status', 'active');

    if (itemsError) {
      console.error('[cron/daily] Error fetching plaid items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch plaid items' }, { status: 500 });
    }

    if (!plaidItems || plaidItems.length === 0) {
      log.push('No active Plaid items found - nothing to sync');
      return NextResponse.json({ success: true, log, duration_ms: Date.now() - startTime });
    }

    log.push(`Found ${plaidItems.length} active Plaid item(s)`);

    // Group items by user for post-sync work
    const userItemMap = new Map<string, typeof plaidItems>();
    for (const item of plaidItems) {
      const existing = userItemMap.get(item.user_id) || [];
      existing.push(item);
      userItemMap.set(item.user_id, existing);
    }

    // ---------------------------------------------------------------
    // 4. Sync each Plaid item (balances, transactions, holdings)
    // ---------------------------------------------------------------
    const syncResults: SyncResult[] = [];

    for (const item of plaidItems) {
      try {
        const result = await syncPlaidItem(supabase, item);
        syncResults.push(result);
        log.push(
          `[sync] ${item.institution_name || item.id}: ` +
          `+${result.transactions.added} txns, ` +
          `~${result.transactions.modified} modified, ` +
          `-${result.transactions.removed} removed, ` +
          `${result.holdings_synced} holdings`,
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

        // Mark the item as errored so we don't keep retrying indefinitely
        await supabase
          .from('plaid_items')
          .update({ status: 'error', error_message: msg })
          .eq('id', item.id);
      }
    }

    // ---------------------------------------------------------------
    // 5. Refresh market prices for all holdings via Polygon
    // ---------------------------------------------------------------
    let pricesRefreshed = 0;
    const polygonApiKey = process.env.POLYGON_API_KEY;

    if (polygonApiKey) {
      try {
        pricesRefreshed = await refreshMarketPrices(supabase, polygonApiKey, log);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.push(`[prices] Market price refresh failed: ${msg}`);
      }

      // Enrich securities metadata + fetch dividends/splits
      try {
        await enrichMarketData(supabase, log);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.push(`[enrich] Market enrichment failed: ${msg}`);
      }

      // Refresh news with sentiment scoring
      try {
        await refreshMarketNews(supabase, log);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.push(`[news] News refresh failed: ${msg}`);
      }
    } else {
      log.push('[prices] POLYGON_API_KEY not set - skipping all market data');
    }

    // ---------------------------------------------------------------
    // 6. Compute snapshots & generate insights per user
    // ---------------------------------------------------------------
    let insightsGenerated = 0;

    for (const userId of userItemMap.keys()) {
      try {
        // Update last_synced_at for user accounts
        const now = new Date().toISOString();
        await supabase
          .from('linked_accounts')
          .update({ last_synced_at: now, sync_status: 'healthy' })
          .eq('user_id', userId)
          .eq('is_active', true);

        // Compute net worth, cash flow, and health snapshots
        await computeSnapshots(supabase, userId);
        log.push(`[snapshots] Computed for user ${userId.slice(0, 8)}...`);

        // Update portfolio performance metrics
        await updatePortfolioPerformance(supabase, userId, log);

        // Generate insights
        const count = await generateInsights(supabase, userId);
        insightsGenerated += count;
        log.push(`[insights] Generated ${count} for user ${userId.slice(0, 8)}...`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.push(`[post-sync] User ${userId.slice(0, 8)}... failed: ${msg}`);
      }
    }

    // ---------------------------------------------------------------
    // 7. Summary
    // ---------------------------------------------------------------
    const summary = {
      success: true,
      duration_ms: Date.now() - startTime,
      items_synced: syncResults.filter(r => r.success).length,
      items_failed: syncResults.filter(r => !r.success).length,
      users_processed: userItemMap.size,
      prices_refreshed: pricesRefreshed,
      insights_generated: insightsGenerated,
      log,
    };

    console.log('[cron/daily] Completed:', JSON.stringify(summary, null, 2));

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[cron/daily] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime,
        log,
      },
      { status: 500 },
    );
  }
}

// ===================================================================
// Types
// ===================================================================

interface SyncResult {
  item_id: string;
  user_id: string;
  institution: string | null;
  success: boolean;
  error?: string;
  transactions: { added: number; modified: number; removed: number };
  holdings_synced: number;
}

// Service role client has different generic types than the session-based client.
// We use `any` here intentionally since the service client bypasses RLS and type inference.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = any;

// ===================================================================
// Plaid Sync - mirrors /api/plaid/sync logic but with service client
// ===================================================================

async function syncPlaidItem(
  supabase: ServiceClient,
  item: {
    id: string;
    user_id: string;
    plaid_access_token: string;
    transactions_cursor: string | null;
    institution_name: string | null;
    available_products: string[];
    billed_products: string[];
    consented_products: string[];
  },
): Promise<SyncResult> {
  const accessToken = item.plaid_access_token;
  const userId = item.user_id;
  let transactionsAdded = 0;
  let transactionsModified = 0;
  let transactionsRemoved = 0;

  // --- Sync balances ---
  const accountsResponse = await plaidClient.accountsGet({
    access_token: accessToken,
  });

  for (const account of accountsResponse.data.accounts) {
    await supabase
      .from('linked_accounts')
      .update({
        current_balance: account.balances.current ?? 0,
        available_balance: account.balances.available ?? null,
        credit_limit: account.balances.limit ?? null,
        sync_status: 'healthy',
        sync_error: null,
      })
      .eq('plaid_account_id', account.account_id)
      .eq('user_id', userId);
  }

  // --- Sync transactions (incremental) ---
  let cursor = item.transactions_cursor || undefined;
  let hasMore = true;
  const allAdded: Transaction[] = [];
  const allModified: Transaction[] = [];
  const allRemoved: RemovedTransaction[] = [];

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
      count: 500,
    });

    allAdded.push(...response.data.added);
    allModified.push(...response.data.modified);
    allRemoved.push(...response.data.removed);

    hasMore = response.data.has_more;
    cursor = response.data.next_cursor;
  }

  // Process added transactions
  if (allAdded.length > 0) {
    const { data: linkedAccounts } = await supabase
      .from('linked_accounts')
      .select('id, plaid_account_id')
      .eq('user_id', userId);

    const accountMap = new Map(
      (linkedAccounts || []).map((a: { plaid_account_id: string; id: string }) => [
        a.plaid_account_id,
        a.id,
      ]),
    );

    const { data: categories } = await supabase
      .from('transaction_categories')
      .select('id, name');

    const categoryMap = new Map<string, string>(
      (categories || []).map((c: { name: string; id: string }) => [c.name.toLowerCase(), c.id]),
    );

    const transactionInserts = allAdded
      .filter(t => accountMap.has(t.account_id))
      .map(t => ({
        account_id: accountMap.get(t.account_id)!,
        user_id: userId,
        plaid_transaction_id: t.transaction_id,
        amount: t.amount * -1, // Plaid: positive = debit; we: positive = credit
        transaction_date: t.date,
        posted_date: t.authorized_date || null,
        description: t.name,
        merchant_name: t.merchant_name || null,
        category_id: findCategoryId(t.personal_finance_category?.primary || '', categoryMap),
        category_name: t.personal_finance_category?.primary || null,
        is_pending: t.pending,
      }));

    if (transactionInserts.length > 0) {
      const { error: txError } = await supabase
        .from('transactions')
        .upsert(transactionInserts, {
          onConflict: 'plaid_transaction_id',
          ignoreDuplicates: false,
        });

      if (txError) {
        console.error('[cron/daily] Error inserting transactions:', txError);
      } else {
        transactionsAdded = transactionInserts.length;
      }
    }
  }

  // Process modified transactions
  for (const t of allModified) {
    await supabase
      .from('transactions')
      .update({
        amount: t.amount * -1,
        description: t.name,
        merchant_name: t.merchant_name || null,
        pending: t.pending,
      })
      .eq('plaid_transaction_id', t.transaction_id)
      .eq('user_id', userId);
    transactionsModified++;
  }

  // Process removed transactions
  for (const t of allRemoved) {
    if (t.transaction_id) {
      await supabase
        .from('transactions')
        .delete()
        .eq('plaid_transaction_id', t.transaction_id)
        .eq('user_id', userId);
      transactionsRemoved++;
    }
  }

  // Save the new cursor
  await supabase
    .from('plaid_items')
    .update({
      transactions_cursor: cursor,
      last_transactions_sync: new Date().toISOString(),
      last_balances_sync: new Date().toISOString(),
    })
    .eq('id', item.id);

  // --- Sync holdings (if investments product is available) ---
  let holdingsSynced = 0;
  const allProducts = [
    ...(item.available_products || []),
    ...(item.billed_products || []),
    ...(item.consented_products || []),
  ];

  if (allProducts.includes('investments')) {
    try {
      const holdingsResponse = await plaidClient.investmentsHoldingsGet({
        access_token: accessToken,
      });

      const plaidSecurities = holdingsResponse.data.securities;
      const plaidHoldings = holdingsResponse.data.holdings;

      const securityMap = new Map(plaidSecurities.map(s => [s.security_id, s]));

      for (const holding of plaidHoldings) {
        const security = securityMap.get(holding.security_id);
        if (!security) continue;

        const ticker = security.ticker_symbol || security.name || 'UNKNOWN';

        const { data: dbSecurity } = await supabase
          .from('securities')
          .upsert(
            {
              ticker,
              security_name: security.name || ticker,
              asset_class: mapSecurityType(security.type || ''),
              exchange: security.market_identifier_code || null,
              cusip: security.cusip || null,
              isin: security.isin || null,
              current_price: security.close_price ?? null,
            },
            { onConflict: 'ticker', ignoreDuplicates: false },
          )
          .select('id')
          .single();

        if (!dbSecurity) continue;

        const { data: linkedAccount } = await supabase
          .from('linked_accounts')
          .select('id')
          .eq('plaid_account_id', holding.account_id)
          .eq('user_id', userId)
          .single();

        if (!linkedAccount) continue;

        const currentPrice = security.close_price ?? 0;
        const totalValue = holding.institution_value ?? holding.quantity * currentPrice;
        const totalCostBasis = holding.cost_basis ?? null;

        await supabase.from('holdings').upsert(
          {
            user_id: userId,
            account_id: linkedAccount.id,
            security_id: dbSecurity.id,
            ticker,
            shares: holding.quantity,
            average_cost_basis:
              totalCostBasis && holding.quantity
                ? Number(totalCostBasis) / holding.quantity
                : null,
            total_cost_basis: totalCostBasis,
            current_price: currentPrice,
            total_value: totalValue,
            unrealised_gain_loss: totalCostBasis ? totalValue - Number(totalCostBasis) : null,
            unrealised_gain_loss_pct:
              totalCostBasis && Number(totalCostBasis) > 0
                ? (totalValue - Number(totalCostBasis)) / Number(totalCostBasis)
                : null,
          },
          { onConflict: 'user_id,security_id,account_id' },
        );

        holdingsSynced++;
      }

      await supabase
        .from('plaid_items')
        .update({ last_holdings_sync: new Date().toISOString() })
        .eq('id', item.id);
    } catch (error) {
      console.log(
        '[cron/daily] Holdings sync skipped or failed:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    item_id: item.id,
    user_id: userId,
    institution: item.institution_name,
    success: true,
    transactions: {
      added: transactionsAdded,
      modified: transactionsModified,
      removed: transactionsRemoved,
    },
    holdings_synced: holdingsSynced,
  };
}

// ===================================================================
// Market price refresh via Polygon.io
// ===================================================================

async function refreshMarketPrices(
  supabase: ServiceClient,
  apiKey: string,
  log: string[],
): Promise<number> {
  // Get all unique tickers from holdings
  const { data: holdingTickers, error } = await supabase
    .from('holdings')
    .select('ticker, security_id')
    .neq('ticker', 'UNKNOWN');

  if (error || !holdingTickers) {
    log.push('[prices] Failed to fetch tickers from holdings');
    return 0;
  }

  const tickerStrings = holdingTickers.map((h: { ticker: string }) => String(h.ticker));
  const uniqueTickers = [...new Set(tickerStrings)] as string[];

  if (uniqueTickers.length === 0) {
    log.push('[prices] No tickers to refresh');
    return 0;
  }

  // Build ticker -> security_id map for market_prices lookups
  const tickerSecurityMap = new Map<string, string>();
  for (const h of holdingTickers as { ticker: string; security_id: string }[]) {
    if (h.security_id && h.ticker) {
      tickerSecurityMap.set(h.ticker.toUpperCase(), h.security_id);
    }
  }

  log.push(`[prices] Refreshing prices for ${uniqueTickers.length} ticker(s)`);

  let updated = 0;
  const now = new Date().toISOString();

  // Fetch previous close for each ticker
  for (const ticker of uniqueTickers) {
    try {
      const polygonTicker = ticker.toUpperCase().includes('-USD')
        ? 'X:' + ticker.toUpperCase().replace('-', '')
        : ticker.toUpperCase();

      const response = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(polygonTicker)}/prev?adjusted=true&apiKey=${apiKey}`,
      );

      if (!response.ok) {
        console.warn(`[cron/daily] Polygon API error for ${ticker}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const result = data.results?.[0];

      if (!result || result.c == null) continue;

      const closePrice = result.c;
      const openPrice = result.o;
      const priceDate = new Date(result.t).toISOString().split('T')[0];

      // Look up previous close from market_prices for accurate day_change_pct
      const securityId = tickerSecurityMap.get(ticker.toUpperCase());
      let dayChangePct = openPrice > 0 ? (closePrice - openPrice) / openPrice : 0;

      if (securityId) {
        const { data: prevPrice } = await supabase
          .from('market_prices')
          .select('close')
          .eq('security_id', securityId)
          .lt('price_date', priceDate)
          .order('price_date', { ascending: false })
          .limit(1)
          .single();

        if (prevPrice?.close && Number(prevPrice.close) > 0) {
          dayChangePct = (closePrice - Number(prevPrice.close)) / Number(prevPrice.close);
        }

        // Upsert market_prices entry
        await supabase.from('market_prices').upsert(
          {
            security_id: securityId,
            ticker: ticker.toUpperCase(),
            price_date: priceDate,
            open: openPrice,
            high: result.h,
            low: result.l,
            close: closePrice,
            volume: result.v,
          },
          { onConflict: 'security_id,price_date', ignoreDuplicates: false },
        );
      }

      // Update securities table
      await supabase
        .from('securities')
        .update({ current_price: closePrice, last_updated_at: now })
        .eq('ticker', ticker);

      // Update all holdings with this ticker
      const { data: tickerHoldings } = await supabase
        .from('holdings')
        .select('id, shares, total_cost_basis')
        .eq('ticker', ticker);

      for (const holding of tickerHoldings || []) {
        const totalValue = Number(holding.shares) * closePrice;
        const costBasis = holding.total_cost_basis ? Number(holding.total_cost_basis) : null;

        await supabase
          .from('holdings')
          .update({
            current_price: closePrice,
            total_value: totalValue,
            unrealised_gain_loss: costBasis != null ? totalValue - costBasis : null,
            unrealised_gain_loss_pct:
              costBasis != null && costBasis > 0
                ? (totalValue - costBasis) / costBasis
                : null,
            day_change_pct: dayChangePct,
            last_updated_at: now,
          })
          .eq('id', holding.id);
      }

      updated++;
    } catch (error) {
      console.warn(
        `[cron/daily] Failed to fetch price for ${ticker}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Recalculate portfolio_allocation_pct per user
  await recalcAllocations(supabase, log);

  log.push(`[prices] Updated ${updated}/${uniqueTickers.length} ticker prices`);
  return updated;
}

/**
 * Recalculate portfolio_allocation_pct for every user that has holdings.
 */
async function recalcAllocations(supabase: ServiceClient, log: string[]) {
  try {
    const { data: allHoldings } = await supabase
      .from('holdings')
      .select('id, user_id, total_value');

    if (!allHoldings || allHoldings.length === 0) return;

    // Group by user
    const userHoldings = new Map<string, { id: string; total_value: number }[]>();
    for (const h of allHoldings as { id: string; user_id: string; total_value: number }[]) {
      const existing = userHoldings.get(h.user_id) || [];
      existing.push({ id: h.id, total_value: Number(h.total_value) });
      userHoldings.set(h.user_id, existing);
    }

    for (const [userId, holdings] of userHoldings) {
      const total = holdings.reduce((s, h) => s + h.total_value, 0);
      if (total <= 0) continue;

      for (const h of holdings) {
        const pct = (h.total_value / total) * 100;
        await supabase
          .from('holdings')
          .update({ portfolio_allocation_pct: Math.round(pct * 100) / 100 })
          .eq('id', h.id);
      }
    }

    log.push(`[allocations] Recalculated for ${userHoldings.size} user(s)`);
  } catch (error) {
    console.error('[cron/daily] Error recalculating allocations:', error);
  }
}

/**
 * Compute portfolio_performance metrics for a single user (cron version).
 */
async function updatePortfolioPerformance(supabase: ServiceClient, userId: string, log: string[]) {
  try {
    const { data: holdings } = await supabase
      .from('holdings')
      .select('id, ticker, security_id, total_value, day_change_pct, shares, current_price')
      .eq('user_id', userId);

    if (!holdings || holdings.length === 0) return;

    const totalPV = holdings.reduce(
      (s: number, h: { total_value: number }) => s + Number(h.total_value), 0,
    );
    if (totalPV <= 0) return;

    // Weighted 1-day return (decimal)
    const return1d = holdings.reduce(
      (s: number, h: { total_value: number; day_change_pct: number | null }) => {
        const w = Number(h.total_value) / totalPV;
        return s + w * (Number(h.day_change_pct) || 0);
      }, 0,
    );

    const secIds = [...new Set(
      holdings.map((h: { security_id: string }) => h.security_id).filter(Boolean),
    )];

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data: histPrices } = await supabase
      .from('market_prices')
      .select('security_id, price_date, close')
      .in('security_id', secIds)
      .gte('price_date', oneYearAgo.toISOString().split('T')[0])
      .order('price_date', { ascending: true });

    const priceHist = new Map<string, { date: string; close: number }[]>();
    for (const p of histPrices || []) {
      const arr = priceHist.get(p.security_id) || [];
      arr.push({ date: p.price_date, close: Number(p.close) });
      priceHist.set(p.security_id, arr);
    }

    function computeReturn(days: number): number | null {
      const t = new Date();
      t.setDate(t.getDate() - days);
      const tStr = t.toISOString().split('T')[0];
      let past = 0, curr = 0, matched = 0;
      for (const h of holdings!) {
        const hist = priceHist.get(h.security_id);
        if (!hist || hist.length === 0) continue;
        const entry = [...hist].reverse().find(p => p.date <= tStr);
        if (!entry) continue;
        past += Number(h.shares) * entry.close;
        curr += Number(h.total_value);
        matched++;
      }
      if (matched < holdings!.length / 2 || past <= 0) return null;
      return (curr - past) / past;
    }

    const return1w = computeReturn(7);
    const return1m = computeReturn(30);
    const return3m = computeReturn(90);
    const return6m = computeReturn(180);
    const return1y = computeReturn(365);
    const ys = new Date(new Date().getFullYear(), 0, 1);
    const returnYtd = computeReturn(Math.round((Date.now() - ys.getTime()) / 86400000));

    // Diversification (1 - HHI)
    const hhi = holdings.reduce((s: number, h: { total_value: number }) => {
      const w = Number(h.total_value) / totalPV;
      return s + w * w;
    }, 0);

    // Asset class allocation
    const { data: secs } = await supabase
      .from('securities')
      .select('id, asset_class')
      .in('id', secIds);

    const acMap = new Map<string, string>();
    for (const s of secs || []) acMap.set(s.id, s.asset_class || 'other');

    const acAlloc: Record<string, number> = {};
    for (const h of holdings) {
      const ac = acMap.get(h.security_id) || 'other';
      const pct = (Number(h.total_value) / totalPV) * 100;
      acAlloc[ac] = (acAlloc[ac] || 0) + pct;
    }

    // Volatility & Sharpe from daily portfolio values
    let volatility: number | null = null;
    let sharpeRatio: number | null = null;

    const allDates = new Set<string>();
    for (const [, hist] of priceHist) for (const p of hist) allDates.add(p.date);
    const dates = [...allDates].sort();

    if (dates.length >= 20) {
      const vals: number[] = [];
      for (const d of dates) {
        let pv = 0;
        let ok = true;
        for (const h of holdings) {
          const hist = priceHist.get(h.security_id);
          if (!hist) { ok = false; break; }
          const e = hist.find(p => p.date === d);
          if (!e) { ok = false; break; }
          pv += Number(h.shares) * e.close;
        }
        if (ok && pv > 0) vals.push(pv);
      }
      if (vals.length >= 20) {
        const rets: number[] = [];
        for (let i = 1; i < vals.length; i++) rets.push((vals[i] - vals[i - 1]) / vals[i - 1]);
        const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
        const vari = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
        const dv = Math.sqrt(vari);
        volatility = dv * Math.sqrt(252);
        const rfd = 0.05 / 252;
        sharpeRatio = dv > 0 ? ((mean - rfd) / dv) * Math.sqrt(252) : null;
      }
    }

    await supabase.from('portfolio_performance').insert({
      user_id: userId,
      return_1d_pct: return1d,
      return_1w_pct: return1w,
      return_1m_pct: return1m,
      return_3m_pct: return3m,
      return_6m_pct: return6m,
      return_ytd_pct: returnYtd,
      return_1y_pct: return1y,
      sharpe_ratio: sharpeRatio,
      beta: null,
      volatility,
      diversification_score: Math.min(1, 1 - hhi),
      asset_class_allocation: acAlloc,
    });

    log.push(`[perf] Updated portfolio_performance for user ${userId.slice(0, 8)}...`);
  } catch (error) {
    console.error(`[cron/daily] Error computing portfolio performance for ${userId}:`, error);
  }
}

// ===================================================================
// Snapshot computation - mirrors /api/plaid/sync computeSnapshots
// ===================================================================

async function computeSnapshots(supabase: ServiceClient, userId: string) {
  try {
    const { data: accounts } = await supabase
      .from('linked_accounts')
      .select('account_type, current_balance')
      .eq('user_id', userId)
      .eq('is_active', true);

    const { data: holdings } = await supabase
      .from('holdings')
      .select('total_value')
      .eq('user_id', userId);

    const accts = accounts || [];
    const holdingsList = holdings || [];

    let cashBalance = 0;
    const investmentBalance = holdingsList.reduce(
      (s: number, h: { total_value: number }) => s + Number(h.total_value),
      0,
    );
    let cryptoBalance = 0;
    let creditCardDebt = 0;
    let loanDebt = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const a of accts) {
      const bal = Number(a.current_balance);
      const type = a.account_type;

      if (type === 'credit_card') {
        creditCardDebt += Math.abs(bal);
        totalLiabilities += Math.abs(bal);
      } else if (type === 'loan' || type === 'mortgage') {
        loanDebt += Math.abs(bal);
        totalLiabilities += Math.abs(bal);
      } else if (type === 'crypto') {
        cryptoBalance += bal;
        totalAssets += bal;
      } else if (type === 'brokerage') {
        totalAssets += bal;
      } else {
        cashBalance += bal;
        totalAssets += bal;
      }
    }

    totalAssets += investmentBalance;

    const today = new Date().toISOString().split('T')[0];
    await supabase.from('net_worth_snapshots').upsert(
      {
        user_id: userId,
        snapshot_date: today,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        net_worth: totalAssets - totalLiabilities,
        cash_balance: cashBalance,
        investment_balance: investmentBalance,
        crypto_balance: cryptoBalance,
        credit_card_debt: creditCardDebt,
        loan_debt: loanDebt,
      },
      { onConflict: 'user_id,snapshot_date' },
    );

    // --- Cash Flow Snapshot (monthly) ---
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    const { data: monthTx } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .gte('transaction_date', monthStart)
      .lte('transaction_date', monthEnd);

    let totalIncome = 0;
    let totalExpenses = 0;
    for (const t of monthTx || []) {
      const amt = Number(t.amount);
      if (amt > 0) totalIncome += amt;
      else totalExpenses += Math.abs(amt);
    }

    const netFlow = totalIncome - totalExpenses;
    const savingsAmount = Math.max(0, netFlow);
    const savingsRate = totalIncome > 0 ? savingsAmount / totalIncome : 0;

    await supabase.from('cash_flow_snapshots').upsert(
      {
        user_id: userId,
        snapshot_month: monthStart,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_flow: netFlow,
        savings_amount: savingsAmount,
        savings_rate: savingsRate,
      },
      { onConflict: 'user_id,snapshot_month' },
    );

    // --- Financial Health Score ---
    const netWorth = totalAssets - totalLiabilities;
    const debtToAssetRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 0;
    const avgMonthlyExpenses = totalExpenses > 0 ? totalExpenses : 1;
    const emergencyFundMonths = cashBalance / avgMonthlyExpenses;

    let diversification = 0;
    if (holdingsList.length > 0) {
      const totalHoldingsValue = holdingsList.reduce(
        (s: number, h: { total_value: number }) => s + Number(h.total_value),
        0,
      );
      if (totalHoldingsValue > 0) {
        const hhi = holdingsList.reduce((s: number, h: { total_value: number }) => {
          const weight = Number(h.total_value) / totalHoldingsValue;
          return s + weight * weight;
        }, 0);
        diversification = Math.min(1, 1 - hhi);
      }
    }

    const debtScore = Math.round(Math.max(0, Math.min(100, (1 - debtToAssetRatio) * 100)));
    const savingsScore = Math.round(Math.min(100, savingsRate * 300));
    const emergencyScore = Math.round(Math.min(100, (emergencyFundMonths / 6) * 100));
    const divScore = Math.round(diversification * 100);

    const overallScore = Math.round(
      debtScore * 0.25 + savingsScore * 0.25 + emergencyScore * 0.25 + divScore * 0.25,
    );

    await supabase.from('financial_health_scores').insert({
      user_id: userId,
      overall_score: Math.min(100, Math.max(0, overallScore)),
      debt_to_asset_ratio: debtToAssetRatio,
      savings_rate: savingsRate,
      emergency_fund_months: Math.round(emergencyFundMonths * 100) / 100,
      portfolio_diversification: diversification,
      debt_score: debtScore,
      savings_score: savingsScore,
      emergency_fund_score: emergencyScore,
      diversification_score: divScore,
    });
  } catch (error) {
    console.error('[cron/daily] Error computing snapshots:', error);
  }
}

// ===================================================================
// Insight generation - mirrors /api/insights/generate logic
// ===================================================================

async function generateInsights(supabase: ServiceClient, userId: string): Promise<number> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .split('T')[0];
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString()
      .split('T')[0];

    const [accountsRes, holdingsRes, currentTxRes, prevTxRes, existingInsightsRes] =
      await Promise.all([
        supabase
          .from('linked_accounts')
          .select('id, account_type, current_balance, account_name')
          .eq('user_id', userId)
          .eq('is_active', true),
        supabase
          .from('holdings')
          .select(
            'id, ticker, total_value, total_cost_basis, unrealised_gain_loss, shares, current_price',
          )
          .eq('user_id', userId),
        supabase
          .from('transactions')
          .select('id, amount, category_name, merchant_name, description, transaction_date')
          .eq('user_id', userId)
          .gte('transaction_date', monthStart)
          .lte('transaction_date', monthEnd),
        supabase
          .from('transactions')
          .select('id, amount, category_name, merchant_name, description, transaction_date')
          .eq('user_id', userId)
          .gte('transaction_date', prevMonthStart)
          .lte('transaction_date', prevMonthEnd),
        supabase
          .from('insights')
          .select('title, created_at')
          .eq('user_id', userId)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

    const accounts = accountsRes.data || [];
    const holdings = holdingsRes.data || [];
    const currentTx = currentTxRes.data || [];
    const prevTx = prevTxRes.data || [];
    const existingTitles = new Set(
      (existingInsightsRes.data || []).map((i: { title: string }) => i.title),
    );

    interface InsightCandidate {
      insight_type: 'spending' | 'portfolio' | 'market' | 'tax' | 'credit';
      priority: 'critical' | 'high' | 'medium' | 'low';
      title: string;
      description: string;
      recommended_action?: string;
      estimated_impact_amount?: number;
      confidence_score?: number;
      source_type: 'rule_based';
      related_entity_type?: string;
      related_entity_ids?: string[];
    }

    const candidates: InsightCandidate[] = [];

    // --- Spending spikes by category ---
    const currentSpending = groupSpending(currentTx);
    const prevSpending = groupSpending(prevTx);

    for (const [category, currentAmt] of Object.entries(currentSpending)) {
      const prevAmt = prevSpending[category] || 0;
      if (prevAmt > 0 && currentAmt > prevAmt * 1.3 && currentAmt - prevAmt > 50) {
        const increase = Math.round(((currentAmt - prevAmt) / prevAmt) * 100);
        const displayName = formatCategoryName(category);
        candidates.push({
          insight_type: 'spending',
          priority: increase > 100 ? 'high' : 'medium',
          title: `${displayName} spending up ${increase}%`,
          description: `You've spent $${currentAmt.toFixed(0)} on ${displayName.toLowerCase()} this month, up from $${prevAmt.toFixed(0)} last month.`,
          recommended_action: `Review your recent ${displayName.toLowerCase()} transactions to identify any unexpected charges.`,
          estimated_impact_amount: currentAmt - prevAmt,
          confidence_score: 0.9,
          source_type: 'rule_based',
        });
      }
    }

    // --- Portfolio concentration ---
    const totalPortfolio = holdings.reduce(
      (s: number, h: { total_value: number }) => s + Number(h.total_value),
      0,
    );
    if (totalPortfolio > 0) {
      for (const h of holdings) {
        const weight = Number(h.total_value) / totalPortfolio;
        if (weight > 0.25 && holdings.length > 1) {
          candidates.push({
            insight_type: 'portfolio',
            priority: weight > 0.5 ? 'high' : 'medium',
            title: `${h.ticker} is ${Math.round(weight * 100)}% of your portfolio`,
            description: `A single position making up more than 25% of your portfolio increases risk. ${h.ticker} currently represents $${Number(h.total_value).toLocaleString()} of your $${totalPortfolio.toLocaleString()} portfolio.`,
            recommended_action: `Consider diversifying by reducing your ${h.ticker} position or adding to other holdings.`,
            confidence_score: 0.95,
            source_type: 'rule_based',
            related_entity_type: 'holding',
            related_entity_ids: [h.id],
          });
        }
      }
    }

    // --- Tax-loss harvesting ---
    const losers = holdings.filter(
      (h: { unrealised_gain_loss: number | null }) =>
        h.unrealised_gain_loss && Number(h.unrealised_gain_loss) < -100,
    );
    if (losers.length > 0) {
      const totalLoss = losers.reduce(
        (s: number, h: { unrealised_gain_loss: number }) =>
          s + Math.abs(Number(h.unrealised_gain_loss)),
        0,
      );
      const tickers = losers.map((h: { ticker: string }) => h.ticker).join(', ');
      candidates.push({
        insight_type: 'tax',
        priority: totalLoss > 1000 ? 'high' : 'medium',
        title: `$${totalLoss.toLocaleString()} tax-loss harvesting opportunity`,
        description: `You have unrealized losses in ${tickers} that could offset capital gains and reduce your tax bill by up to $${Math.round(totalLoss * 0.25).toLocaleString()}.`,
        recommended_action: `Review selling ${tickers} to harvest losses, then reinvest in similar but not "substantially identical" assets to maintain exposure.`,
        estimated_impact_amount: Math.round(totalLoss * 0.25),
        confidence_score: 0.85,
        source_type: 'rule_based',
        related_entity_type: 'holding',
        related_entity_ids: losers.map((h: { id: string }) => h.id),
      });
    }

    // --- Idle cash ---
    const cashAccounts = accounts.filter(
      (a: { account_type: string; current_balance: number }) =>
        (a.account_type === 'checking' || a.account_type === 'savings') &&
        Number(a.current_balance) > 0,
    );
    const totalCash = cashAccounts.reduce(
      (s: number, a: { current_balance: number }) => s + Number(a.current_balance),
      0,
    );
    const monthlyExpenses = currentTx
      .filter((t: { amount: number }) => Number(t.amount) < 0)
      .reduce((s: number, t: { amount: number }) => s + Math.abs(Number(t.amount)), 0);

    if (monthlyExpenses > 0 && totalCash > monthlyExpenses * 6) {
      const excess = totalCash - monthlyExpenses * 6;
      candidates.push({
        insight_type: 'spending',
        priority: excess > 10000 ? 'high' : 'medium',
        title: `$${excess.toLocaleString()} idle cash could be working harder`,
        description: `You have $${totalCash.toLocaleString()} in cash accounts - about ${Math.round(totalCash / monthlyExpenses)} months of expenses. After keeping a 6-month emergency fund ($${Math.round(monthlyExpenses * 6).toLocaleString()}), $${excess.toLocaleString()} could earn more.`,
        recommended_action: `Consider moving excess cash to a high-yield savings account or short-term investments.`,
        estimated_impact_amount: Math.round(excess * 0.045),
        confidence_score: 0.8,
        source_type: 'rule_based',
      });
    }

    // Filter duplicates
    const newInsights = candidates.filter(c => !existingTitles.has(c.title));

    if (newInsights.length > 0) {
      const inserts = newInsights.map(insight => ({
        user_id: userId,
        ...insight,
      }));

      const { error: insertError } = await supabase.from('insights').insert(inserts);

      if (insertError) {
        console.error('[cron/daily] Error inserting insights:', insertError);
        return 0;
      }
    }

    // Clean up expired insights
    await supabase
      .from('insights')
      .update({ is_dismissed: true })
      .eq('user_id', userId)
      .lt('expires_at', new Date().toISOString())
      .eq('is_dismissed', false);

    return newInsights.length;
  } catch (error) {
    console.error(`[cron/daily] Error generating insights for ${userId}:`, error);
    return 0;
  }
}

// ===================================================================
// Helpers
// ===================================================================

function findCategoryId(
  plaidCategory: string,
  categoryMap: Map<string, string>,
): string | null {
  const mapping: Record<string, string> = {
    INCOME: 'salary',
    TRANSFER_IN: 'transfer in',
    TRANSFER_OUT: 'transfer out',
    LOAN_PAYMENTS: 'loan payment',
    BANK_FEES: 'bank fees',
    ENTERTAINMENT: 'streaming',
    FOOD_AND_DRINK: 'dining',
    GENERAL_MERCHANDISE: 'general shopping',
    HOME_IMPROVEMENT: 'home goods',
    MEDICAL: 'doctor',
    PERSONAL_CARE: 'personal care',
    GENERAL_SERVICES: 'other',
    GOVERNMENT_AND_NON_PROFIT: 'taxes',
    TRANSPORTATION: 'gas',
    TRAVEL: 'flights',
    RENT_AND_UTILITIES: 'rent',
  };

  const mapped = mapping[plaidCategory];
  if (mapped && categoryMap.has(mapped)) {
    return categoryMap.get(mapped)!;
  }
  return null;
}

function mapSecurityType(plaidType: string): string {
  switch (plaidType) {
    case 'equity':
      return 'equity';
    case 'etf':
      return 'etf';
    case 'mutual fund':
      return 'mutual_fund';
    case 'fixed income':
      return 'bond';
    case 'cryptocurrency':
      return 'crypto';
    case 'commodity':
      return 'commodity';
    default:
      return 'other';
  }
}

function groupSpending(
  transactions: { amount: number; category_name: string | null }[],
): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const t of transactions) {
    const amt = Number(t.amount);
    if (amt >= 0) continue;
    const cat = t.category_name || 'uncategorized';
    groups[cat] = (groups[cat] || 0) + Math.abs(amt);
  }
  return groups;
}

function formatCategoryName(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/AND/g, '&')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ===================================================================
// Market data enrichment (ticker details, dividends, splits)
// ===================================================================

async function enrichMarketData(supabase: ServiceClient, log: string[]) {
  const { getBatchTickerDetails, getUpcomingDividends, getRecentSplits, mapSicToSector } = await import('@/lib/polygon');

  // Get all unique tickers from holdings
  const { data: holdingRows } = await supabase
    .from('holdings')
    .select('ticker, security_id')
    .neq('ticker', 'UNKNOWN');

  if (!holdingRows || holdingRows.length === 0) {
    log.push('[enrich] No holdings to enrich');
    return;
  }

  const tickers = [...new Set(
    holdingRows.map((h: { ticker: string }) => h.ticker).filter(Boolean)
  )] as string[];

  const securityIds = [...new Set(
    holdingRows.map((h: { security_id: string }) => h.security_id).filter(Boolean)
  )] as string[];

  // 1. Enrich securities missing sector data
  let enriched = 0;
  if (securityIds.length > 0) {
    const { data: securities } = await supabase
      .from('securities')
      .select('id, ticker, sector')
      .in('id', securityIds);

    const needsEnrichment = (securities || []).filter(
      (s: { sector: string | null; ticker: string }) => !s.sector && s.ticker && !s.ticker.includes('-USD')
    );

    if (needsEnrichment.length > 0) {
      const detailsMap = await getBatchTickerDetails(
        needsEnrichment.map((s: { ticker: string }) => s.ticker)
      );

      for (const sec of needsEnrichment) {
        const details = detailsMap.get(sec.ticker.toUpperCase());
        if (!details) continue;

        await supabase
          .from('securities')
          .update({
            sector: mapSicToSector(details.sic_description) || null,
            industry: details.sic_description || null,
            logo_url: details.icon_url || details.logo_url || null,
          })
          .eq('id', sec.id);
        enriched++;
      }
    }
  }
  log.push(`[enrich] Enriched ${enriched} securities with sector/industry data`);

  // 2. Fetch upcoming dividends
  const dividends = await getUpcomingDividends(tickers, 90);
  let divsInserted = 0;
  if (dividends.length > 0) {
    const { data: existing } = await supabase
      .from('market_events')
      .select('ticker, event_date')
      .eq('event_type', 'dividend')
      .in('ticker', dividends.map(d => d.ticker));

    const existingKeys = new Set(
      (existing || []).map((e: { ticker: string; event_date: string }) => `${e.ticker}:${e.event_date}`)
    );

    const newDivs = dividends.filter(
      d => !existingKeys.has(`${d.ticker}:${d.ex_dividend_date}`)
    );

    if (newDivs.length > 0) {
      const inserts = newDivs.map(d => ({
        event_type: 'dividend',
        ticker: d.ticker,
        event_date: d.ex_dividend_date,
        title: `${d.ticker} ex-dividend date`,
        description: `$${d.cash_amount.toFixed(4)}/share dividend. Pay date: ${d.pay_date || 'TBD'}.`,
        metadata: { cash_amount: d.cash_amount, pay_date: d.pay_date, frequency: d.frequency },
        impact_level: 'medium',
      }));

      const { error } = await supabase.from('market_events').insert(inserts);
      if (!error) divsInserted = newDivs.length;
    }
  }
  log.push(`[enrich] Found ${divsInserted} new dividend events`);

  // 3. Fetch recent/upcoming splits
  const splits = await getRecentSplits(tickers, 90);
  let splitsInserted = 0;
  if (splits.length > 0) {
    const { data: existing } = await supabase
      .from('market_events')
      .select('ticker, event_date')
      .eq('event_type', 'split')
      .in('ticker', splits.map(s => s.ticker));

    const existingKeys = new Set(
      (existing || []).map((e: { ticker: string; event_date: string }) => `${e.ticker}:${e.event_date}`)
    );

    const newSplits = splits.filter(
      s => !existingKeys.has(`${s.ticker}:${s.execution_date}`)
    );

    if (newSplits.length > 0) {
      const inserts = newSplits.map(s => ({
        event_type: 'split',
        ticker: s.ticker,
        event_date: s.execution_date,
        title: `${s.ticker} ${s.split_to}-for-${s.split_from} stock split`,
        description: `Each share becomes ${s.split_to / s.split_from} shares.`,
        metadata: { split_from: s.split_from, split_to: s.split_to, ratio: s.split_to / s.split_from },
        impact_level: 'high',
      }));

      const { error } = await supabase.from('market_events').insert(inserts);
      if (!error) splitsInserted = newSplits.length;
    }
  }
  log.push(`[enrich] Found ${splitsInserted} new split events`);
}

// ===================================================================
// Market news refresh with sentiment (cron version)
// ===================================================================

async function refreshMarketNews(supabase: ServiceClient, log: string[]) {
  const { getTickerNews, scoreSentiment } = await import('@/lib/polygon');

  const { data: holdingRows } = await supabase
    .from('holdings')
    .select('ticker, security_id')
    .neq('ticker', 'UNKNOWN');

  if (!holdingRows || holdingRows.length === 0) {
    log.push('[news] No holdings for news fetch');
    return;
  }

  const tickers = [...new Set(
    holdingRows.map((h: { ticker: string }) => h.ticker).filter(Boolean)
  )] as string[];

  // Build ticker -> sector map
  const secIds = [...new Set(
    holdingRows.map((h: { security_id: string }) => h.security_id).filter(Boolean)
  )] as string[];

  const tickerSectorMap = new Map<string, string>();
  if (secIds.length > 0) {
    const { data: securities } = await supabase
      .from('securities')
      .select('ticker, sector')
      .in('id', secIds);
    for (const s of (securities || []) as { ticker: string; sector: string | null }[]) {
      if (s.sector) tickerSectorMap.set(s.ticker?.toUpperCase(), s.sector);
    }
  }

  const articles = await getTickerNews(tickers, 30);
  if (articles.length === 0) {
    log.push('[news] No articles from Polygon');
    return;
  }

  const urls = articles.map(a => a.article_url).filter(Boolean);
  const { data: existing } = await supabase
    .from('market_news')
    .select('url')
    .in('url', urls);

  const existingUrls = new Set((existing || []).map((a: { url: string }) => a.url));
  const newArticles = articles.filter(a => a.article_url && !existingUrls.has(a.article_url));

  if (newArticles.length === 0) {
    log.push(`[news] All ${articles.length} articles already exist`);
    return;
  }

  const inserts = newArticles.map(article => {
    const sentiment = scoreSentiment(`${article.title} ${article.description}`);
    const sectors = [...new Set(
      article.tickers
        .map(t => tickerSectorMap.get(t.toUpperCase()))
        .filter(Boolean)
    )];

    return {
      title: article.title,
      summary: article.description || null,
      content: null,
      url: article.article_url,
      image_url: article.image_url || null,
      source: article.source?.name || null,
      author: article.author || null,
      published_at: article.published_utc || new Date().toISOString(),
      tickers: article.tickers,
      sectors: sectors.length > 0 ? sectors : null,
      sentiment,
    };
  });

  const { error } = await supabase.from('market_news').insert(inserts);
  if (error) {
    log.push(`[news] Insert failed: ${error.message}`);
  } else {
    log.push(`[news] Inserted ${newArticles.length} new articles (${articles.length - newArticles.length} duplicates skipped)`);
  }
}
