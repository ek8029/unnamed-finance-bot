/**
 * Plaid data sync service.
 * Extracted from app/api/plaid/sync/route.ts so it can be called
 * from API routes, webhooks, and the dashboard overview endpoint.
 */
import { plaidClient, mapPlaidAccountType } from '@/lib/plaid';
import { logPlaidSuccess, logPlaidError } from '@/lib/plaid-logger';
import { extractPlaidError } from '@/lib/plaid-errors';
import { RemovedTransaction, Transaction } from 'plaid';

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
  const allAdded: Transaction[] = [];
  const allModified: Transaction[] = [];
  const allRemoved: RemovedTransaction[] = [];

  while (hasMore) {
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

      for (const holding of plaidHoldings) {
        const security = securityMap.get(holding.security_id);
        if (!security) continue;

        const ticker = security.ticker_symbol || security.name || 'UNKNOWN';

        const { data: dbSecurity } = await supabase
          .from('securities')
          .upsert({
            ticker: ticker,
            security_name: security.name || ticker,
            asset_class: mapSecurityType(security.type || ''),
            exchange: security.market_identifier_code || null,
            cusip: security.cusip || null,
            isin: security.isin || null,
            current_price: security.close_price ?? null,
          }, {
            onConflict: 'ticker',
            ignoreDuplicates: false,
          })
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
        const totalValue = holding.institution_value ?? (holding.quantity * currentPrice);
        const totalCostBasis = holding.cost_basis ?? null;

        await supabase
          .from('holdings')
          .upsert({
            user_id: userId,
            account_id: linkedAccount.id,
            security_id: dbSecurity.id,
            ticker: ticker,
            shares: holding.quantity,
            average_cost_basis: totalCostBasis && holding.quantity
              ? Number(totalCostBasis) / holding.quantity
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
          }, {
            onConflict: 'user_id,security_id,account_id',
          });

        holdingsSynced++;
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

  // Update last_synced_at on all linked accounts
  const now = new Date().toISOString();
  await supabase
    .from('linked_accounts')
    .update({ last_synced_at: now, sync_status: 'healthy' })
    .eq('user_id', userId)
    .eq('is_active', true);

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
    const investmentBalance = holdingsList.reduce((s: number, h: { total_value: number }) => s + Number(h.total_value), 0);
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
    const avgMonthlyExpenses = totalExpenses > 0 ? totalExpenses : 1;
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
    const savingsScore = Math.round(Math.min(100, savingsRate * 300));
    const emergencyScore = Math.round(Math.min(100, (emergencyFundMonths / 6) * 100));
    const divScore = Math.round(diversification * 100);
    const overallScore = Math.round(
      debtScore * 0.25 + savingsScore * 0.25 + emergencyScore * 0.25 + divScore * 0.25
    );

    await supabase
      .from('financial_health_scores')
      .insert({
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
    console.error('Error computing snapshots:', error);
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
