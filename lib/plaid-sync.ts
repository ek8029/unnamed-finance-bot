/**
 * Plaid data sync service.
 * Extracted from app/api/plaid/sync/route.ts so it can be called
 * from API routes, webhooks, and the dashboard overview endpoint.
 */
import { createClient as createServiceRoleClient } from '@supabase/supabase-js';
import { plaidClient, mapPlaidAccountType } from '@/lib/plaid';
import { logPlaidSuccess, logPlaidError } from '@/lib/plaid-logger';
import { assetBalance, isLiabilityType, liabilityBalance } from '@/lib/account-balance';
import { extractPlaidError } from '@/lib/plaid-errors';
import { summarizeCashFlow, countsAsCashFlow } from '@/lib/cash-flow';
import { aggregateHoldingLots } from '@/lib/holdings-aggregate';
import { planStalePrune } from '@/lib/holdings-prune';
import { canonicalTicker } from '@/lib/ticker-alias';
import { InvestmentTransaction, RemovedTransaction, Transaction } from 'plaid';
import {
  EMERGENCY_FUND_MONTHS,
  SAVINGS_SCORE_MULTIPLIER,
  HEALTH_SCORE_WEIGHTS,
} from '@/lib/financial-config';

// The supabase client type (works with both user-scoped and service-role clients)
type SupabaseClient = {
  from: (table: string) => {
    select: (...args: unknown[]) => unknown;
    insert: (...args: unknown[]) => unknown;
    update: (...args: unknown[]) => unknown;
    upsert: (...args: unknown[]) => unknown;
    delete: (...args: unknown[]) => unknown;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export interface PlaidItemForSync {
  id: string;
  plaid_access_token: string;
  transactions_cursor: string | null;
  institution_name: string | null;
  available_products: string[];
  billed_products: string[];
  consented_products: string[];
}

export interface SyncResult {
  item_id: string;
  institution: string | null;
  success: boolean;
  error?: string;
  transactions?: { added: number; modified: number; removed: number };
  holdings_synced?: number;
}

/**
 * Sync a single Plaid item: balances, transactions, and holdings.
 */
export async function syncPlaidItem(
  supabase: AnyClient,
  userId: string,
  item: PlaidItemForSync
): Promise<SyncResult> {
  const accessToken = item.plaid_access_token;
  let transactionsAdded = 0;
  let transactionsModified = 0;
  let transactionsRemoved = 0;

  // --- 1. Sync balances ---
  try {
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
          // This was missing, so last_synced_at was written once at link time
          // and never again. Balances kept refreshing underneath it, and the
          // account list told people their data was days old when it had
          // updated that morning: 72 of 136 active accounts were showing a
          // sync date older than their own updated_at. The web list also drives
          // a "stale" badge off this field, so healthy connections were being
          // labelled stale.
          last_synced_at: new Date().toISOString(),
        })
        .eq('plaid_account_id', account.account_id)
        .eq('user_id', userId);
    }

    await logPlaidSuccess(userId, 'accountsGet', { item_id: item.id });
  } catch (error) {
    const pe = extractPlaidError(error);
    await logPlaidError(
      userId, 'accountsGet',
      pe?.errorCode || 'UNKNOWN',
      pe?.errorMessage || (error instanceof Error ? error.message : 'Balance sync failed'),
    );
    throw error;
  }

  // --- 2. Sync transactions (incremental) ---
  let cursor = item.transactions_cursor || undefined;
  let hasMore = true;
  let iterations = 0;
  const MAX_SYNC_ITERATIONS = 50;
  const allAdded: Transaction[] = [];
  const allModified: Transaction[] = [];
  const allRemoved: RemovedTransaction[] = [];

  // Guarded like balances and holdings: a transactions error right after link
  // (PRODUCT_NOT_READY is routine) must not abort the whole sync — holdings
  // never imported when this threw, including via the recovery webhook.
  try {
    while (hasMore && iterations < MAX_SYNC_ITERATIONS) {
      iterations++;
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: cursor,
        count: 500,
      });

      allAdded.push(...response.data.added);
      allModified.push(...response.data.modified);
      allRemoved.push(...response.data.removed);

      hasMore = response.data.has_more;
      cursor = response.data.next_cursor;
    }
  } catch (err) {
    console.error(
      '[plaid-sync] transactions sync failed (continuing to holdings):',
      err instanceof Error ? err.message : err,
    );
  }

  // Process added transactions
  if (allAdded.length > 0) {
    const { data: linkedAccounts } = await supabase
      .from('linked_accounts')
      .select('id, plaid_account_id')
      .eq('user_id', userId);

    const accountMap = new Map(
      (linkedAccounts || []).map((a: { plaid_account_id: string; id: string }) => [a.plaid_account_id, a.id])
    );

    const { data: categories } = await supabase
      .from('transaction_categories')
      .select('id, name');

    const categoryMap = new Map<string, string>(
      (categories || []).map((c: { name: string; id: string }) => [c.name.toLowerCase(), c.id])
    );

    const transactionInserts = allAdded
      .filter(t => accountMap.has(t.account_id))
      .map(t => ({
        account_id: accountMap.get(t.account_id)!,
        user_id: userId,
        plaid_transaction_id: t.transaction_id,
        amount: t.amount * -1,
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
        console.error('Error inserting transactions:', txError);
      } else {
        transactionsAdded = transactionInserts.length;
      }
    }
  }

  if (allModified.length > 0) {
    const modifiedResults = await Promise.allSettled(allModified.map(t =>
      supabase
        .from('transactions')
        .update({
          amount: t.amount * -1,
          description: t.name,
          merchant_name: t.merchant_name || null,
          is_pending: t.pending,
        })
        .eq('plaid_transaction_id', t.transaction_id)
        .eq('user_id', userId)
    ));
    const modifiedFailures = modifiedResults.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (modifiedFailures.length > 0) {
      console.error(`[plaid-sync] ${modifiedFailures.length} modified transaction updates failed`);
    }
    transactionsModified = allModified.length;
  }

  // Process removed transactions (single bulk delete)
  const removedIds = allRemoved
    .map(t => t.transaction_id)
    .filter((id): id is string => Boolean(id));
  if (removedIds.length > 0) {
    await supabase
      .from('transactions')
      .delete()
      .in('plaid_transaction_id', removedIds)
      .eq('user_id', userId);
    transactionsRemoved = removedIds.length;
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

  await logPlaidSuccess(userId, 'transactionsSync', {
    item_id: item.id,
    added: transactionsAdded,
    modified: transactionsModified,
    removed: transactionsRemoved,
  });

  // --- 3. Sync holdings (if investments product is available) ---
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

      const securityMap = new Map(
        plaidSecurities.map(s => [s.security_id, s])
      );

      // Batch-fetch all linked_accounts for this user into a Map
      const { data: userLinkedAccounts } = await supabase
        .from('linked_accounts')
        .select('id, plaid_account_id')
        .eq('user_id', userId);

      const linkedAccountMap = new Map(
        (userLinkedAccounts || []).map((a: { plaid_account_id: string; id: string }) => [a.plaid_account_id, a.id])
      );

      // Collect unique securities for batch upsert
      const securitiesUpserts = new Map<string, {
        ticker: string;
        security_name: string;
        asset_class: string;
        exchange: string | null;
        cusip: string | null;
        isin: string | null;
        current_price: number | null;
      }>();

      // Pre-compute holding data keyed by ticker for the holdings upsert
      const holdingsByTicker: {
        ticker: string;
        plaid_account_id: string;
        quantity: number;
        institution_value: number | null;
        close_price: number | null;
        cost_basis: number | null;
      }[] = [];

      // Brokerages can return the SAME economic position under several Plaid
      // security records (a real ticker, a broker variant symbol, and a record
      // with no ticker at all where we fall back to the security name). Left
      // alone that becomes two or three holdings rows for one position, which
      // both fragments exposure and double-counts portfolio value.
      const seenLots = new Set<string>();

      for (const holding of plaidHoldings) {
        const security = securityMap.get(holding.security_id);
        if (!security) continue;

        // Canonicalise before anything else, so variant symbols and
        // name-as-ticker rows resolve to one security and one holding.
        const ticker = canonicalTicker(security.ticker_symbol || security.name || 'UNKNOWN');
        const linkedAccountId = linkedAccountMap.get(holding.account_id);
        if (!linkedAccountId) continue;

        // Same account + same position + same size + same value = the same lot
        // reported more than once. Keep the first, drop the rest.
        const lotKey = `${holding.account_id}|${ticker}|${holding.quantity}|${holding.institution_value ?? ''}`;
        if (seenLots.has(lotKey)) continue;
        seenLots.add(lotKey);

        // Collect security upsert (deduped by ticker)
        if (!securitiesUpserts.has(ticker)) {
          securitiesUpserts.set(ticker, {
            ticker: ticker,
            security_name: security.name || ticker,
            asset_class: mapSecurityType(security.type || ''),
            exchange: security.market_identifier_code || null,
            cusip: security.cusip || null,
            isin: security.isin || null,
            current_price: security.close_price
              ?? (holding.quantity > 0 && holding.institution_value
                ? holding.institution_value / holding.quantity
                : null),
          });
        }

        holdingsByTicker.push({
          ticker,
          plaid_account_id: holding.account_id,
          quantity: holding.quantity,
          institution_value: holding.institution_value,
          close_price: security.close_price,
          cost_basis: holding.cost_basis ?? null,
        });
      }

      // Batch upsert all securities at once
      const securitiesArray = Array.from(securitiesUpserts.values());
      let dbSecurities: { id: string; ticker: string }[] = [];
      if (securitiesArray.length > 0) {
        const { data, error: securitiesError } = await supabase
          .from('securities')
          .upsert(securitiesArray, {
            onConflict: 'ticker',
            ignoreDuplicates: false,
          })
          .select('id, ticker');

        if (securitiesError) {
          console.error('[plaid-sync] securities upsert failed:', securitiesError.message);
        }
        dbSecurities = data || [];
      }

      // Build ticker -> security DB id map
      const tickerToSecurityId = new Map(
        dbSecurities.map((s: { ticker: string; id: string }) => [s.ticker, s.id])
      );

      // Any holding we could not resolve to a security or an account. It is
      // still a position the user holds; we simply cannot write it. Pruning must
      // be disabled when this happens, because a row we failed to map looks
      // exactly like a row Plaid stopped reporting, and one of those is safe to
      // delete while the other is somebody's money.
      let unmappedHoldings = 0;

      // Build holdings upsert array
      const holdingsUpserts = aggregateHoldingLots(holdingsByTicker)
        .map(h => {
          const securityId = tickerToSecurityId.get(h.ticker);
          const linkedAccountId = linkedAccountMap.get(h.plaid_account_id);
          if (!securityId || !linkedAccountId) {
            unmappedHoldings++;
            return null;
          }

          // Brokerages keep reporting closed positions at quantity 0. Persisting
          // them produced "ghost" holdings: rows that render in the positions
          // list but contribute nothing to value or exposure, which reads to the
          // user as a position that silently vanished from their totals.
          // Note: only EXACTLY zero is dropped. Negative quantities are short
          // positions and must be kept.
          if (Number(h.quantity) === 0) return null;

          // ONE source of truth per row, with the other derived from it.
          //
          // total_value used to prefer the broker's institution_value while
          // current_price preferred Plaid's security-level close_price. When
          // those two disagree (different valuation times, accrued interest,
          // share-class marks) the stored row failed shares x price ==
          // total_value: the positions table showed a price and a value that
          // did not multiply out, and unrealised P/L jumped the moment live
          // prices loaded and recomputed on the other basis.
          //
          // The broker's own mark wins when present. It is what the user's
          // statement says, and it covers securities Plaid has no close price
          // for at all. refreshMarketPrices later moves both fields together,
          // so the invariant holds from here on.
          const brokerMark =
            h.institution_value != null && h.quantity !== 0 ? Number(h.institution_value) : null;
          const totalValue = brokerMark ?? h.quantity * (h.close_price ?? 0);
          const currentPrice = brokerMark != null ? brokerMark / h.quantity : (h.close_price ?? 0);
          const totalCostBasis = h.cost_basis;

          return {
            user_id: userId,
            account_id: linkedAccountId,
            security_id: securityId,
            ticker: h.ticker,
            shares: h.quantity,
            average_cost_basis: totalCostBasis && h.quantity
              ? Number(totalCostBasis) / h.quantity
              : null,
            total_cost_basis: totalCostBasis,
            current_price: currentPrice,
            total_value: totalValue,
            unrealised_gain_loss: totalCostBasis
              ? totalValue - Number(totalCostBasis)
              : null,
            unrealised_gain_loss_pct: totalCostBasis && Number(totalCostBasis) > 0
              ? (totalValue - Number(totalCostBasis)) / Number(totalCostBasis)
              : null,
            // Plaid is a real price writer, so it must stamp freshness too.
            // Previously only the Finazon refresh set this, which made every
            // instrument Finazon does not cover (mutual funds, money market,
            // OTC ADRs, broker pool codes) look weeks stale when it had in fact
            // just been repriced from the brokerage.
            last_updated_at: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      // Batch upsert all holdings at once
      if (holdingsUpserts.length > 0) {
        const { error: holdingsError } = await supabase
          .from('holdings')
          .upsert(holdingsUpserts, {
            onConflict: 'user_id,security_id,account_id',
          });

        if (holdingsError) console.error('[plaid-sync] holdings upsert failed:', holdingsError.message);
        holdingsSynced = holdingsError ? 0 : holdingsUpserts.length;

        // Clear ghosts left by earlier syncs, so existing books self-heal on the
        // next run rather than needing a one-off cleanup. Zero-quantity rows are
        // never written above, so anything still at zero is stale by definition.
        if (!holdingsError) {
          const { error: ghostError, count: ghostsCleared } = await supabase
            .from('holdings')
            .delete({ count: 'exact' })
            .eq('user_id', userId)
            .eq('shares', 0);
          if (ghostError) console.error('[plaid-sync] ghost cleanup failed:', ghostError.message);
          else if (ghostsCleared) console.log(`[plaid-sync] cleared ${ghostsCleared} zero-share holding(s) for user ${userId}`);
        }

        // Drop positions this account has stopped reporting entirely. The
        // decision of what is safe to delete lives in lib/holdings-prune.ts and
        // is tested there; this only carries it out.
        {
          const plan = planStalePrune(
            holdingsUpserts as unknown as { account_id: string; security_id: string }[],
            { unmappedHoldings, upsertFailed: !!holdingsError },
          );
          if (!plan.prune) {
            if (unmappedHoldings > 0 || holdingsError) {
              console.warn(`[plaid-sync] not pruning stale positions for user ${userId}: ${plan.reason}`);
            }
          } else {
            for (const a of plan.skippedAccounts) {
              console.warn(`[plaid-sync] account ${a} has too many positions to prune safely`);
            }
            for (const [accountId, securityIds] of plan.keepByAccount) {
              const { data: dropped, error: pruneError } = await supabase
                .from('holdings')
                .delete()
                .eq('user_id', userId)
                .eq('account_id', accountId)
                .not('security_id', 'in', `(${securityIds.join(',')})`)
                .select('ticker, total_value');
              if (pruneError) {
                console.error('[plaid-sync] stale-position prune failed:', pruneError.message);
              } else if (dropped && dropped.length > 0) {
                const rows = dropped as unknown as { ticker: string; total_value: number | null }[];
                const value = rows.reduce((sum, d) => sum + Number(d.total_value ?? 0), 0);
                console.log(
                  `[plaid-sync] dropped ${rows.length} position(s) no longer reported for user ${userId}: ` +
                    `${rows.map((d) => d.ticker).join(', ')} ($${Math.round(value).toLocaleString()})`,
                );
              }
            }
          }
        }

        // ── Reconcile manual holdings ──
        // If a ticker now exists in a Plaid-linked account, remove the
        // duplicate from the Manual Portfolio so it doesn't double-count.
        if (holdingsSynced > 0) try {
          const syncedTickers = (holdingsUpserts as { ticker: string }[]).map(h => h.ticker);
          const { data: manualAccounts } = await supabase
            .from('linked_accounts')
            .select('id')
            .eq('user_id', userId)
            .eq('account_name', 'Manual Portfolio');

          if (manualAccounts && manualAccounts.length > 0) {
            const manualAccountIds = manualAccounts.map((a: { id: string }) => a.id);
            const { data: removed } = await supabase
              .from('holdings')
              .delete()
              .eq('user_id', userId)
              .in('account_id', manualAccountIds)
              .in('ticker', syncedTickers)
              .select('ticker');

            if (removed && removed.length > 0) {
              console.log(`[plaid-sync] Reconciled ${removed.length} manual holdings: ${removed.map((r: { ticker: string }) => r.ticker).join(', ')}`);
            }
          }
        } catch (reconErr) {
          console.error('[plaid-sync] Manual holdings reconciliation failed:', reconErr);
          // Non-fatal — continue sync
        }
      }

      await supabase
        .from('plaid_items')
        .update({ last_holdings_sync: new Date().toISOString() })
        .eq('id', item.id);

      await logPlaidSuccess(userId, 'investmentsHoldingsGet', {
        item_id: item.id,
        holdings_synced: holdingsSynced,
      });
    } catch (error) {
      // Investments may not be available - that's OK
      console.log('Holdings sync skipped or failed:', error instanceof Error ? error.message : error);
    }

    // --- 4. Sync investment transactions (trades, dividends, fees) ---
    try {
      await syncInvestmentTransactions(supabase, userId, item, accessToken);
    } catch (error) {
      // Non-fatal — must never break the holdings sync above
      console.log('Investment transactions sync skipped or failed:', error instanceof Error ? error.message : error);
    }
  }

  return {
    item_id: item.id,
    institution: item.institution_name,
    success: true,
    transactions: { added: transactionsAdded, modified: transactionsModified, removed: transactionsRemoved },
    holdings_synced: holdingsSynced,
  };
}

/**
 * Sync investment transactions (buys, sells, dividends, fees) for an item.
 * Fetches the last 24 months from Plaid and upserts into investment_transactions.
 */
async function syncInvestmentTransactions(
  supabase: AnyClient,
  userId: string,
  item: PlaidItemForSync,
  accessToken: string
): Promise<void> {
  const endDate = new Date().toISOString().split('T')[0];
  const startWindow = new Date();
  startWindow.setMonth(startWindow.getMonth() - 24);
  const startDate = startWindow.toISOString().split('T')[0];

  // Paginate through all investment transactions (500/page)
  const allInvestmentTx: InvestmentTransaction[] = [];
  const plaidSecurityMap = new Map<string, { ticker_symbol: string | null; name: string | null }>();
  let invOffset = 0;
  let invTotal = 0;
  let invIterations = 0;
  const MAX_INV_PAGES = 50;

  do {
    invIterations++;
    const response = await plaidClient.investmentsTransactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: 500, offset: invOffset },
    });

    invTotal = response.data.total_investment_transactions;
    allInvestmentTx.push(...response.data.investment_transactions);
    for (const s of response.data.securities) {
      plaidSecurityMap.set(s.security_id, { ticker_symbol: s.ticker_symbol, name: s.name });
    }

    if (response.data.investment_transactions.length === 0) break;
    invOffset += response.data.investment_transactions.length;
  } while (invOffset < invTotal && invIterations < MAX_INV_PAGES);

  if (allInvestmentTx.length === 0) return;

  // Map Plaid account ids -> linked_accounts ids
  const { data: userLinkedAccounts } = await supabase
    .from('linked_accounts')
    .select('id, plaid_account_id')
    .eq('user_id', userId);

  const linkedAccountMap = new Map(
    (userLinkedAccounts || []).map((a: { plaid_account_id: string; id: string }) => [a.plaid_account_id, a.id])
  );

  // Map tickers -> securities DB ids (securities were upserted by the holdings sync)
  const tickers = Array.from(
    new Set(
      allInvestmentTx
        .map(t => (t.security_id ? plaidSecurityMap.get(t.security_id)?.ticker_symbol : null))
        .filter((t): t is string => Boolean(t))
    )
  );

  const tickerToSecurityId = new Map<string, string>();
  if (tickers.length > 0) {
    const { data: dbSecurities } = await supabase
      .from('securities')
      .select('id, ticker')
      .in('ticker', tickers);

    for (const s of dbSecurities || []) {
      tickerToSecurityId.set(s.ticker, s.id);
    }
  }

  const investmentTxUpserts = allInvestmentTx
    .filter(t => linkedAccountMap.has(t.account_id))
    .map(t => {
      const security = t.security_id ? plaidSecurityMap.get(t.security_id) : null;
      const ticker = security?.ticker_symbol || null;
      return {
        user_id: userId,
        account_id: linkedAccountMap.get(t.account_id)!,
        security_id: ticker ? tickerToSecurityId.get(ticker) ?? null : null,
        plaid_investment_transaction_id: t.investment_transaction_id,
        ticker,
        name: t.name || security?.name || null,
        transaction_type: t.subtype || t.type,
        quantity: t.quantity,
        price: t.price,
        // Plaid: positive = cash out (buy). App convention: positive = money in.
        amount: t.amount * -1,
        fees: t.fees ?? null,
        transaction_date: t.date,
      };
    });

  if (investmentTxUpserts.length > 0) {
    // investment_transactions is service-write-only (RLS). syncPlaidItem also runs
    // on the user-initiated dashboard path with a user client, which RLS blocks —
    // so this specific write always goes through a service client, and investment
    // history now populates immediately instead of only on the nightly cron.
    const svc = createServiceRoleClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { error: invError } = await svc
      .from('investment_transactions')
      .upsert(investmentTxUpserts, {
        onConflict: 'plaid_investment_transaction_id',
        ignoreDuplicates: false,
      });

    if (invError) {
      console.error('Error upserting investment transactions:', invError);
      await logPlaidError(
        userId, 'investmentsTransactionsGet',
        'DB_UPSERT_FAILED',
        invError.message || 'Investment transactions upsert failed',
      );
      return;
    }
  }

  await logPlaidSuccess(userId, 'investmentsTransactionsGet', {
    item_id: item.id,
    investment_transactions_synced: investmentTxUpserts.length,
  });
}

/**
 * Sync all active Plaid items for a user.
 */
export async function syncAllItems(
  supabase: AnyClient,
  userId: string
): Promise<SyncResult[]> {
  const { data: plaidItems, error } = await supabase
    .from('plaid_items')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error || !plaidItems || plaidItems.length === 0) {
    return [];
  }

  const results: SyncResult[] = [];

  for (const item of plaidItems) {
    try {
      const result = await syncPlaidItem(supabase, userId, item);
      results.push(result);
    } catch (err) {
      results.push({
        item_id: item.id,
        institution: item.institution_name,
        success: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      });
    }
  }

  // No blanket stamp here any more. syncPlaidItem now sets last_synced_at on
  // each account it actually refreshed, which is the only honest place for it:
  // this ran unconditionally after the loop, so when one item threw, every
  // account on it was still marked sync_status 'healthy' and stamped as synced
  // right now. It also only ever ran from the dashboard, so the cron and the
  // webhook left the timestamp frozen at link time while balances moved
  // underneath it.

  // Compute snapshots after sync
  await computeSnapshots(supabase, userId);

  return results;
}

/**
 * Compute net worth, cash flow, and financial health snapshots.
 */
export async function computeSnapshots(
  supabase: AnyClient,
  userId: string
): Promise<void> {
  try {
    const { data: accounts } = await supabase
      .from('linked_accounts')
      .select('id, account_type, account_subtype, current_balance, available_balance')
      .eq('user_id', userId)
      .eq('is_active', true);

    const { data: holdings } = await supabase
      .from('holdings')
      .select('total_value, account_id')
      .eq('user_id', userId);

    const accts = accounts || [];
    const holdingsList = holdings || [];
    // Accounts whose value is already represented by holdings rows — adding
    // their balance on top would double-count (crypto accounts sync holdings
    // like BTC-USD just as brokerages do).
    const accountsWithHoldings = new Set(
      holdingsList.map((h: { account_id: string | null }) => h.account_id).filter(Boolean),
    );

    let cashBalance = 0;
    const investmentBalance = holdingsList.reduce((s: number, h: { total_value: number }) => s + Number(h.total_value), 0);
    let cryptoBalance = 0;
    let creditCardDebt = 0;
    let loanDebt = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const a of accts) {
      const type = a.account_type;
      // Cash is `available` where the institution reports it, because that is
      // what the bank shows and it nets out pending charges. Liabilities stay
      // on `current`: `available` on a card is the unused credit line.
      const bal = isLiabilityType(type) ? liabilityBalance(a) : assetBalance(a);

      if (type === 'credit_card') {
        // Signed, per Plaid convention: positive = owed, negative = credit
        // balance in the user's favor. abs() would count a credit AS debt.
        creditCardDebt += bal;
        totalLiabilities += bal;
      } else if (type === 'loan' || type === 'mortgage') {
        loanDebt += bal;
        totalLiabilities += bal;
      } else if (type === 'crypto') {
        if (!accountsWithHoldings.has(a.id)) {
          // Only count the account balance when its coins are NOT already
          // counted as holdings rows.
          cryptoBalance += bal;
          totalAssets += bal;
        }
      } else if (type === 'brokerage') {
        // Skip brokerage account balance — investment value comes from
        // holdings below, which reflects latest market prices.
        // Adding both would double-count.
      } else {
        cashBalance += bal;
        totalAssets += bal;
      }
    }

    totalAssets += investmentBalance;

    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('net_worth_snapshots')
      .upsert({
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
      }, {
        onConflict: 'user_id,snapshot_date',
      });

    // Cash Flow Snapshot (monthly)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: monthTx } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .gte('transaction_date', monthStart)
      .lte('transaction_date', monthEnd);

    // Investment cash for the same month (dividends, fees, transfers...). Trades
    // (buy/sell) are excluded inside summarizeCashFlow — they're internal moves.
    const { data: monthInvTx } = await supabase
      .from('investment_transactions')
      .select('amount, transaction_type')
      .eq('user_id', userId)
      .gte('transaction_date', monthStart)
      .lte('transaction_date', monthEnd);

    const { totalIncome, totalExpenses, netFlow } = summarizeCashFlow([
      ...(monthTx || []),
      ...(monthInvTx || []),
    ]);
    const savingsAmount = Math.max(0, netFlow);
    // Use rolling average savings rate if available (same pattern as emergency fund)
    let savingsRate = totalIncome > 0 ? savingsAmount / totalIncome : 0;
    try {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
      const { data: recentFlows } = await supabase
        .from('cash_flow_snapshots')
        .select('savings_rate')
        .eq('user_id', userId)
        .gte('snapshot_month', threeMonthsAgo)
        .order('snapshot_month', { ascending: false })
        .limit(3);

      if (recentFlows && recentFlows.length >= 2) {
        const avgRate = recentFlows.reduce((s: number, r: { savings_rate: number }) => s + Number(r.savings_rate), 0) / recentFlows.length;
        // Blend current month with rolling average (don't mask negative months)
        savingsRate = avgRate;
      }
    } catch {
      // Fallback to current month
    }

    await supabase
      .from('cash_flow_snapshots')
      .upsert({
        user_id: userId,
        snapshot_month: monthStart,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_flow: netFlow,
        savings_amount: savingsAmount,
        savings_rate: savingsRate,
      }, {
        onConflict: 'user_id,snapshot_month',
      });

    // Financial Health Score
    const debtToAssetRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 0;

    // Emergency fund: use rolling 3-month average expenses if available,
    // falling back to current month. A single month's expenses is too
    // volatile — one big purchase could halve the emergency score.
    let avgMonthlyExpenses = totalExpenses > 0 ? totalExpenses : 1;
    try {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
      const { data: recentCashFlows } = await supabase
        .from('cash_flow_snapshots')
        .select('total_expenses')
        .eq('user_id', userId)
        .gte('snapshot_month', threeMonthsAgo)
        .order('snapshot_month', { ascending: false })
        .limit(3);

      if (recentCashFlows && recentCashFlows.length >= 2) {
        const totalRecentExpenses = recentCashFlows.reduce(
          (sum: number, row: { total_expenses: number }) => sum + Number(row.total_expenses), 0
        );
        const avg = totalRecentExpenses / recentCashFlows.length;
        if (avg > 0) avgMonthlyExpenses = avg;
      }
    } catch {
      // Fallback to current month — non-fatal
    }

    const emergencyFundMonths = cashBalance / avgMonthlyExpenses;

    let diversification = 0;
    if (holdingsList.length > 0) {
      const totalHoldingsValue = holdingsList.reduce((s: number, h: { total_value: number }) => s + Number(h.total_value), 0);
      if (totalHoldingsValue > 0) {
        const hhi = holdingsList.reduce((s: number, h: { total_value: number }) => {
          const weight = Number(h.total_value) / totalHoldingsValue;
          return s + weight * weight;
        }, 0);
        diversification = Math.min(1, 1 - hhi);
      }
    }

    const debtScore = Math.round(Math.max(0, Math.min(100, (1 - debtToAssetRatio) * 100)));
    const savingsScore = Math.round(Math.min(100, savingsRate * SAVINGS_SCORE_MULTIPLIER));
    const emergencyScore = Math.round(Math.min(100, (emergencyFundMonths / EMERGENCY_FUND_MONTHS) * 100));
    const divScore = Math.round(diversification * 100);
    const overallScore = Math.round(
      debtScore * HEALTH_SCORE_WEIGHTS.debt +
      savingsScore * HEALTH_SCORE_WEIGHTS.savings +
      emergencyScore * HEALTH_SCORE_WEIGHTS.emergencyFund +
      divScore * HEALTH_SCORE_WEIGHTS.diversification
    );

    // Atomic upsert — avoids race condition between dashboard auto-sync and
    // daily cron running concurrently (DELETE+INSERT was not atomic).
    // onConflict:'user_id' needs the UNIQUE(user_id) added in migration 052;
    // before that it errored silently (unchecked), so the health score never
    // persisted. Check the error now so a future failure is visible, not silent.
    const { error: healthErr } = await supabase
      .from('financial_health_scores')
      .upsert({
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
        calculated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (healthErr) console.error(`[plaid-sync] financial_health_scores upsert failed for ${userId}:`, healthErr.message);

    // Backfill historical snapshots for new users (runs once when ≤1 snapshot exists)
    await backfillHistoricalSnapshots(supabase, userId, {
      totalAssets,
      totalLiabilities,
      cashBalance,
      investmentBalance,
      cryptoBalance,
      creditCardDebt,
      loanDebt,
    });
  } catch (error) {
    console.error('Error computing snapshots:', error);
  }
}

/**
 * Backfill 5 months of historical snapshots for new users.
 * Cash-flow snapshots use real transaction data (accurate).
 * Net-worth snapshots estimate balances by working backwards from
 * current values using transaction deltas.
 * Only runs when user has ≤1 existing snapshot — no-ops after that.
 */
async function backfillHistoricalSnapshots(
  supabase: AnyClient,
  userId: string,
  current: {
    totalAssets: number;
    totalLiabilities: number;
    cashBalance: number;
    investmentBalance: number;
    cryptoBalance: number;
    creditCardDebt: number;
    loanDebt: number;
  }
): Promise<void> {
  try {
    const { count } = await supabase
      .from('net_worth_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (count !== null && count > 1) return; // Already have history

    const now = new Date();

    // Fetch transactions from past 6 months for accurate cash-flow data
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, transaction_date')
      .eq('user_id', userId)
      .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0]);

    // Investment cash over the same window. Buys/sells are internal moves and are
    // skipped (countsAsCashFlow); everything else buckets by sign like bank rows.
    const { data: investmentTransactions } = await supabase
      .from('investment_transactions')
      .select('amount, transaction_type, transaction_date')
      .eq('user_id', userId)
      .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0]);

    // Group transactions by month
    const monthlyFlows = new Map<string, { income: number; expenses: number }>();
    for (const tx of transactions || []) {
      const d = new Date(tx.transaction_date + 'T12:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      if (!monthlyFlows.has(key)) monthlyFlows.set(key, { income: 0, expenses: 0 });
      const flow = monthlyFlows.get(key)!;
      const amt = Number(tx.amount);
      if (amt > 0) flow.income += amt;
      else flow.expenses += Math.abs(amt);
    }
    for (const tx of investmentTransactions || []) {
      if (!countsAsCashFlow(tx.transaction_type)) continue;
      const d = new Date(tx.transaction_date + 'T12:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      if (!monthlyFlows.has(key)) monthlyFlows.set(key, { income: 0, expenses: 0 });
      const flow = monthlyFlows.get(key)!;
      const amt = Number(tx.amount);
      if (amt > 0) flow.income += amt;
      else flow.expenses += Math.abs(amt);
    }

    // Build ordered month keys: current → 5 months back
    const monthKeys: string[] = [];
    for (let i = 0; i <= 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    }

    // Walk backwards from current cash balance to estimate historical figures.
    // For each month, subtract that month's net transaction flow from the running
    // cash total. Example: if current cash is $100k and April had +$2k net inflow,
    // then March ending cash was ~$98k. This is accurate for cash; investments and
    // crypto use a slight backward variance since we lack historical prices.
    let estCash = current.cashBalance;
    const netWorthRows: Record<string, unknown>[] = [];
    const cashFlowRows: Record<string, unknown>[] = [];

    for (let i = 0; i < monthKeys.length; i++) {
      const monthKey = monthKeys[i];
      const flow = monthlyFlows.get(monthKey) || { income: 0, expenses: 0 };
      const netFlow = flow.income - flow.expenses;

      // Subtract this month's net flow BEFORE the skip — this is intentional.
      // After subtraction, estCash represents the balance at the START of this month.
      // For i=0 (current month), we subtract but skip row creation since today's
      // snapshot already exists. The subtracted value carries forward correctly.
      estCash -= netFlow;

      if (i === 0) continue; // Current month already has a snapshot

      // Investments/crypto: apply conservative backward variance (~0.8%/mo for equities,
      // ~1.5%/mo for crypto). These are approximations — replaced with real data as
      // daily snapshots accumulate. Floors (0.90/0.85) prevent unrealistic values.
      const estInvestment = current.investmentBalance * Math.max(0.90, 1 - i * 0.008);
      const estCrypto = current.cryptoBalance * Math.max(0.85, 1 - i * 0.015);
      const safeCash = Math.max(0, estCash);
      const estAssets = safeCash + estInvestment + estCrypto;
      // Liabilities assumed constant — we lack historical credit card/loan balance data.
      // This is a known approximation; real snapshots replace this over time.
      const estLiabilities = current.totalLiabilities;

      netWorthRows.push({
        user_id: userId,
        snapshot_date: monthKey,
        total_assets: Math.round(estAssets * 100) / 100,
        total_liabilities: Math.round(estLiabilities * 100) / 100,
        net_worth: Math.round((estAssets - estLiabilities) * 100) / 100,
        cash_balance: Math.round(safeCash * 100) / 100,
        investment_balance: Math.round(estInvestment * 100) / 100,
        crypto_balance: Math.round(estCrypto * 100) / 100,
        credit_card_debt: current.creditCardDebt,
        loan_debt: current.loanDebt,
      });

      const savingsAmt = Math.max(0, netFlow);
      cashFlowRows.push({
        user_id: userId,
        snapshot_month: monthKey,
        total_income: Math.round(flow.income * 100) / 100,
        total_expenses: Math.round(flow.expenses * 100) / 100,
        net_flow: Math.round(netFlow * 100) / 100,
        savings_amount: Math.round(savingsAmt * 100) / 100,
        savings_rate: flow.income > 0 ? Math.round((savingsAmt / flow.income) * 10000) / 10000 : 0,
      });
    }

    if (netWorthRows.length > 0) {
      await supabase
        .from('net_worth_snapshots')
        .upsert(netWorthRows, { onConflict: 'user_id,snapshot_date' });
    }
    if (cashFlowRows.length > 0) {
      await supabase
        .from('cash_flow_snapshots')
        .upsert(cashFlowRows, { onConflict: 'user_id,snapshot_month' });
    }
  } catch (error) {
    // Best-effort — don't break the sync
    console.error('Error backfilling historical snapshots:', error);
  }
}

// --- Helpers ---

function findCategoryId(
  plaidCategory: string,
  categoryMap: Map<string, string>
): string | null {
  const mapping: Record<string, string> = {
    'INCOME': 'salary',
    'TRANSFER_IN': 'transfer in',
    'TRANSFER_OUT': 'transfer out',
    'LOAN_PAYMENTS': 'loan payment',
    'BANK_FEES': 'bank fees',
    'ENTERTAINMENT': 'streaming',
    'FOOD_AND_DRINK': 'dining',
    'GENERAL_MERCHANDISE': 'general shopping',
    'HOME_IMPROVEMENT': 'home goods',
    'MEDICAL': 'doctor',
    'PERSONAL_CARE': 'personal care',
    'GENERAL_SERVICES': 'other',
    'GOVERNMENT_AND_NON_PROFIT': 'taxes',
    'TRANSPORTATION': 'gas',
    'TRAVEL': 'flights',
    'RENT_AND_UTILITIES': 'rent',
  };

  const mapped = mapping[plaidCategory];
  if (mapped && categoryMap.has(mapped)) {
    return categoryMap.get(mapped)!;
  }
  return null;
}

function mapSecurityType(plaidType: string): string {
  switch (plaidType) {
    case 'equity': return 'equity';
    case 'etf': return 'etf';
    case 'mutual fund': return 'mutual_fund';
    case 'fixed income': return 'bond';
    case 'cryptocurrency': return 'crypto';
    case 'commodity': return 'commodity';
    default: return 'other';
  }
}
