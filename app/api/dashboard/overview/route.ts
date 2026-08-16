import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncAllItems } from '@/lib/plaid-sync';
import { assetBalance, isLiabilityType, liabilityBalance } from '@/lib/account-balance';

/**
 * GET /api/dashboard/overview
 * Aggregated dashboard data: net worth, portfolio, top holdings,
 * recent transactions, and cash flow.
 * Triggers a background sync if last sync was > 1 hour ago.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if sync is needed (last sync > 1 hour ago)
    const { data: latestItem } = await supabase
      .from('plaid_items')
      .select('last_balances_sync')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_balances_sync', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const lastSync = latestItem?.last_balances_sync
      ? new Date(latestItem.last_balances_sync)
      : null;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const isStale = !lastSync || lastSync < oneHourAgo;

    if (isStale) {
      syncAllItems(supabase, user.id).catch(err =>
        console.error('[overview] background sync failed:', err)
      );
    }

    // 1. Net worth (latest snapshot)
    const { data: netWorthSnapshot } = await supabase
      .from('net_worth_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Account balances
    const { data: accounts } = await supabase
      .from('linked_accounts')
      .select('id, account_name, account_type, account_subtype, current_balance, available_balance, institution_id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Asset and liability semantics live in lib/account-balance. This used to
    // inline them and got two things wrong: it read current_balance for cash,
    // which overstates by whatever is pending, and it wrapped liabilities in
    // Math.abs(), which turns a credit balance on a card into debt.
    let cashAssets = 0;
    let totalLiabilities = 0;
    for (const a of accounts || []) {
      if (isLiabilityType(a.account_type)) {
        totalLiabilities += liabilityBalance(a);
      } else if (a.account_type !== 'brokerage') {
        // Brokerage value comes from holdings, not account balance
        cashAssets += assetBalance(a);
      }
    }
    const totalBalance = cashAssets - totalLiabilities;

    // 3. Holdings (all for accurate total, top 10 for display)
    const { data: allHoldings } = await supabase
      .from('holdings')
      .select('ticker, shares, current_price, total_value, unrealised_gain_loss')
      .eq('user_id', user.id)
      .order('total_value', { ascending: false });

    const holdings = allHoldings || [];
    const portfolioValue = holdings.reduce((sum, h) => sum + Number(h.total_value), 0);
    const topHoldings = holdings.slice(0, 10);

    // 4. Recent transactions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('id, description, amount, transaction_date, merchant_name, category_name')
      .eq('user_id', user.id)
      .gte('transaction_date', thirtyDaysAgo)
      .order('transaction_date', { ascending: false })
      .limit(50);

    // 5. Cash flow (current month)
    const { data: cashFlow } = await supabase
      .from('cash_flow_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('snapshot_month', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 6. Connection health
    const { data: plaidItems } = await supabase
      .from('plaid_items')
      .select('id, institution_name, status, error_code, error_message, last_balances_sync')
      .eq('user_id', user.id);

    const degradedConnections = (plaidItems || []).filter(i => i.status !== 'active');

    return NextResponse.json({
      sync_triggered: isStale,
      net_worth: netWorthSnapshot ? {
        total_assets: netWorthSnapshot.total_assets,
        total_liabilities: netWorthSnapshot.total_liabilities,
        net_worth: netWorthSnapshot.net_worth,
        cash: netWorthSnapshot.cash_balance,
        investments: netWorthSnapshot.investment_balance,
      } : null,
      accounts: {
        count: (accounts || []).length,
        total_balance: totalBalance,
      },
      portfolio: {
        value: portfolioValue,
        top_holdings: topHoldings,
      },
      cash_flow: cashFlow ? {
        income: cashFlow.total_income,
        expenses: cashFlow.total_expenses,
        net_flow: cashFlow.net_flow,
        savings_rate: cashFlow.savings_rate,
      } : null,
      recent_transactions: recentTransactions || [],
      connections: {
        total: (plaidItems || []).length,
        degraded: degradedConnections.length,
        degraded_items: degradedConnections.map(i => ({
          id: i.id,
          institution: i.institution_name,
          status: i.status,
          error: i.error_message,
        })),
      },
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
  }
}
