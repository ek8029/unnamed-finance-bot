import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncAllItems } from '@/lib/plaid-sync';
import { assetBalance, isLiabilityType, liabilityBalance } from '@/lib/account-balance';
import { rateLimit } from '@/lib/rate-limit';

// Every read in GET feeds the response, so any failed read answers 500.
// supabase-js reports a failure in `error` with data null; read as data alone
// it became accounts.count 0 and portfolio.value 0, which the phone showed as
// "Nothing connected yet" and cached as the truth.
function readFailed(what: string, error: unknown) {
  console.error(`[overview] ${what} read failed:`, error);
  return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 });
}

/**
 * GET /api/dashboard/overview
 * Aggregated dashboard data: net worth, portfolio, top holdings,
 * recent transactions, and cash flow.
 * Triggers a background sync for stale active connections, with an attempt
 * cooldown so a failed import cannot repeat on every GET in this instance.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if sync is needed (last sync > 1 hour ago)
    const { data: latestItem, error: latestItemError } = await supabase
      .from('plaid_items')
      .select('last_balances_sync')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_balances_sync', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (latestItemError) return readFailed('plaid_items sync check', latestItemError);

    const lastSync = latestItem?.last_balances_sync
      ? new Date(latestItem.last_balances_sync)
      : null;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const isStale = !lastSync || lastSync < oneHourAgo;

    // Claim before starting work, not after success. The limiter is in-memory
    // per server instance; it is not a distributed lock across cold starts.
    const syncTriggered = Boolean(latestItem) && isStale &&
      rateLimit(`overview-auto-sync:${user.id}`, 1, 5 * 60).allowed;
    if (syncTriggered) {
      syncAllItems(supabase, user.id).catch(err =>
        console.error('[overview] background sync failed:', err)
      );
    }

    // 1. Net worth (latest snapshot)
    const { data: netWorthSnapshot, error: netWorthError } = await supabase
      .from('net_worth_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (netWorthError) return readFailed('net_worth_snapshots', netWorthError);

    // 2. Account balances
    const { data: accounts, error: accountsError } = await supabase
      .from('linked_accounts')
      .select('id, account_name, account_type, account_subtype, current_balance, available_balance, institution_id')
      .eq('user_id', user.id)
      .eq('is_active', true);
    if (accountsError) return readFailed('linked_accounts', accountsError);

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
    const { data: allHoldings, error: holdingsError } = await supabase
      .from('holdings')
      .select('ticker, shares, current_price, total_value, unrealised_gain_loss')
      .eq('user_id', user.id)
      .order('total_value', { ascending: false });
    if (holdingsError) return readFailed('holdings', holdingsError);

    const holdings = allHoldings || [];
    const portfolioValue = holdings.reduce((sum, h) => sum + Number(h.total_value), 0);

    // FOLD TO POSITIONS, THEN TAKE THE TOP TEN. This was `holdings.slice(0, 10)`,
    // which took the ten biggest LOT ROWS. A name held at two brokerages is two
    // rows, and only the rows large enough to make the cut survived, so the
    // caller rendered a fraction of the position as though it were the whole
    // thing: the ICP's AAPL showed 152 shares worth $46,494 here while the
    // portfolio page showed the real 258 shares worth $78,876. Two of our own
    // screens quoting different numbers for the same holding.
    //
    // The bug only ever hit multi-brokerage users, which is precisely who this
    // product is for. `portfolioValue` above was always right because it sums
    // every row before any truncation.
    const byTicker = new Map<string, { ticker: string; shares: number; current_price: number; total_value: number; unrealised_gain_loss: number | null }>();
    for (const h of holdings) {
      const prev = byTicker.get(h.ticker);
      const gain = h.unrealised_gain_loss == null ? null : Number(h.unrealised_gain_loss);
      if (!prev) {
        byTicker.set(h.ticker, {
          ticker: h.ticker,
          shares: Number(h.shares),
          current_price: Number(h.current_price),
          total_value: Number(h.total_value),
          unrealised_gain_loss: gain,
        });
        continue;
      }
      prev.shares += Number(h.shares);
      prev.total_value += Number(h.total_value);
      // One lot with no basis makes the WHOLE position's gain unknown. Summing
      // the lots we can price would report a smaller number as if it were
      // complete, and a P/L that is quietly missing a leg is worse than one
      // that says it cannot be computed.
      prev.unrealised_gain_loss = prev.unrealised_gain_loss == null || gain == null
        ? null
        : prev.unrealised_gain_loss + gain;
    }
    const topHoldings = [...byTicker.values()]
      .sort((a, b) => b.total_value - a.total_value)
      .slice(0, 10);

    // 4. Recent transactions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const { data: recentTransactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('id, description, amount, transaction_date, merchant_name, category_name')
      .eq('user_id', user.id)
      .gte('transaction_date', thirtyDaysAgo)
      .order('transaction_date', { ascending: false })
      .limit(50);
    if (transactionsError) return readFailed('transactions', transactionsError);

    // 5. Cash flow (current month)
    const { data: cashFlow, error: cashFlowError } = await supabase
      .from('cash_flow_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('snapshot_month', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cashFlowError) return readFailed('cash_flow_snapshots', cashFlowError);

    // 6. Connection health
    const { data: plaidItems, error: plaidItemsError } = await supabase
      .from('plaid_items')
      .select('id, institution_name, status, error_code, error_message, last_balances_sync')
      .eq('user_id', user.id);
    if (plaidItemsError) return readFailed('plaid_items', plaidItemsError);

    const degradedConnections = (plaidItems || []).filter(i => i.status !== 'active');

    return NextResponse.json({
      sync_triggered: syncTriggered,
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
