import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { plaidClient, mapPlaidAccountType } from '@/lib/plaid';
import { RemovedTransaction, Transaction } from 'plaid';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optionally sync a specific item, otherwise sync all
    let itemId: string | undefined;
    try {
      const body = await request.json();
      itemId = body.item_id;
    } catch {
      // No body — sync all items
    }

    // Get user's plaid items
    let query = supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (itemId) {
      query = query.eq('id', itemId);
    }

    const { data: plaidItems, error: itemsError } = await query;

    if (itemsError) {
      console.error('Error fetching plaid items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    if (!plaidItems || plaidItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Plaid connections to sync',
        synced: 0,
      });
    }

    const results = [];

    for (const item of plaidItems) {
      try {
        const result = await syncPlaidItem(supabase, user.id, item);
        results.push(result);
      } catch (error) {
        console.error(`Error syncing item ${item.id}:`, error);
        results.push({
          item_id: item.id,
          institution: item.institution_name,
          success: false,
          error: error instanceof Error ? error.message : 'Sync failed',
        });
      }
    }

    // Update last_synced_at on all linked accounts
    const now = new Date().toISOString();
    await supabase
      .from('linked_accounts')
      .update({ last_synced_at: now, sync_status: 'healthy' })
      .eq('user_id', user.id)
      .eq('is_active', true);

    return NextResponse.json({
      success: true,
      synced_at: now,
      results,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function syncPlaidItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  item: {
    id: string;
    plaid_access_token: string;
    transactions_cursor: string | null;
    institution_name: string | null;
    available_products: string[];
    billed_products: string[];
    consented_products: string[];
  }
) {
  const accessToken = item.plaid_access_token;
  let transactionsAdded = 0;
  let transactionsModified = 0;
  let transactionsRemoved = 0;

  // --- 1. Sync balances ---
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
    // Look up account IDs mapping (plaid_account_id -> our linked_account id)
    const { data: linkedAccounts } = await supabase
      .from('linked_accounts')
      .select('id, plaid_account_id')
      .eq('user_id', userId);

    const accountMap = new Map(
      (linkedAccounts || []).map(a => [a.plaid_account_id, a.id])
    );

    // Look up category mapping
    const { data: categories } = await supabase
      .from('transaction_categories')
      .select('id, name');

    const categoryMap = new Map(
      (categories || []).map(c => [c.name.toLowerCase(), c.id])
    );

    const transactionInserts = allAdded
      .filter(t => accountMap.has(t.account_id))
      .map(t => ({
        account_id: accountMap.get(t.account_id)!,
        user_id: userId,
        plaid_transaction_id: t.transaction_id,
        amount: t.amount * -1, // Plaid uses positive for debits; we use positive for credits
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

      // Build security map
      const securityMap = new Map(
        plaidSecurities.map(s => [s.security_id, s])
      );

      for (const holding of plaidHoldings) {
        const security = securityMap.get(holding.security_id);
        if (!security) continue;

        const ticker = security.ticker_symbol || security.name || 'UNKNOWN';

        // Upsert security
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

        // Find the linked account for this holding
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
              ? ((totalValue - Number(totalCostBasis)) / Number(totalCostBasis)) * 100
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
    } catch (error) {
      // Investments may not be available — that's OK
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

function findCategoryId(
  plaidCategory: string,
  categoryMap: Map<string, string>
): string | null {
  // Map Plaid's personal_finance_category to our category names (lowercase)
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
