import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { parseDateLocal, formatMonthShort } from '@/lib/date-format';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch accounts and cash flow history in parallel
    const [accountsResult, cashFlowResult, netWorthResult] = await Promise.all([
      supabase
        .from('linked_accounts')
        .select(`
          *,
          institution:institutions(name, slug, logo_url)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('current_balance', { ascending: false }),
      supabase
        .from('cash_flow_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_month', { ascending: true })
        .limit(6),
      supabase
        .from('net_worth_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })
        .limit(6),
    ]);

    if (accountsResult.error) {
      console.error('Error fetching accounts:', accountsResult.error);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    const accounts = accountsResult.data || [];
    const cashFlow = cashFlowResult.data || [];
    const netWorth = netWorthResult.data || [];

    // Transform data to match frontend expectations
    const transformedAccounts = accounts.map(account => ({
      id: account.id,
      user_id: account.user_id,
      institution: account.institution?.name || account.account_name,
      account_type: account.account_type,
      balance: account.current_balance,
      account_name: account.account_name,
      sync_status: account.sync_status,
      last_synced_at: account.last_synced_at,
    }));

    // Build balance history from net worth snapshots with cash flow
    const balanceHistory = netWorth.map((snapshot, index) => {
      const date = parseDateLocal(snapshot.snapshot_date);
      const flow = cashFlow[index] || { total_income: 0, total_expenses: 0 };
      return {
        month: formatMonthShort(date),
        balance: Number(snapshot.total_assets) - Number(snapshot.total_liabilities),
        inflows: Number(flow.total_income || 0),
        outflows: Number(flow.total_expenses || 0),
      };
    });

    return NextResponse.json({
      accounts: transformedAccounts,
      balanceHistory,
    });
  } catch (error) {
    console.error('Error in accounts route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
