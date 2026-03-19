import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all data in parallel
    const [
      accountsResult,
      holdingsResult,
      netWorthHistoryResult,
      cashFlowHistoryResult,
      healthScoreResult,
      insightsResult,
    ] = await Promise.all([
      supabase
        .from('linked_accounts')
        .select('*, institutions(name, logo_url)')
        .eq('user_id', user.id),
      supabase
        .from('holdings')
        .select('*, securities(security_name, sector, asset_class)')
        .eq('user_id', user.id),
      // Fetch all net worth history (last 12 months)
      supabase
        .from('net_worth_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })
        .limit(12),
      // Fetch cash flow history (last 6 months)
      supabase
        .from('cash_flow_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_month', { ascending: true })
        .limit(6),
      supabase
        .from('financial_health_scores')
        .select('*')
        .eq('user_id', user.id)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('insights')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // Calculate totals from accounts
    const accounts = accountsResult.data || [];
    const holdings = holdingsResult.data || [];
    const netWorthHistory = netWorthHistoryResult.data || [];
    const cashFlowHistory = cashFlowHistoryResult.data || [];

    // Calculate asset accounts (positive balances, excluding credit cards)
    const assetAccounts = accounts.filter(a =>
      a.current_balance > 0 && a.account_type !== 'credit_card'
    );
    const totalAssets = assetAccounts.reduce((sum, a) => sum + Number(a.current_balance), 0);

    // Calculate liability accounts (credit cards and negative balances)
    const liabilityAccounts = accounts.filter(a =>
      a.account_type === 'credit_card' || a.current_balance < 0
    );
    const totalLiabilities = liabilityAccounts.reduce((sum, a) =>
      sum + Math.abs(Number(a.current_balance)), 0
    );

    // Calculate portfolio value from holdings
    const portfolioValue = holdings.reduce((sum, h) => sum + Number(h.total_value), 0);

    // Net worth
    const netWorth = totalAssets - totalLiabilities;

    // Get monthly cash flow from latest snapshot
    const latestCashFlow = cashFlowHistory[cashFlowHistory.length - 1];
    const monthlyCashFlow = latestCashFlow?.net_flow || 0;

    // Get previous month's net worth snapshot for % change calculations
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const { data: prevSnapshot } = await supabase
      .from('net_worth_snapshots')
      .select('total_assets, total_liabilities, net_worth, investment_balance')
      .eq('user_id', user.id)
      .gte('snapshot_date', prevMonthDate.toISOString().split('T')[0])
      .lte('snapshot_date', prevMonthEnd.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get previous month's cash flow for cash flow % change
    const prevMonthStart = prevMonthDate.toISOString().split('T')[0];
    const { data: prevCashFlow } = await supabase
      .from('cash_flow_snapshots')
      .select('net_flow')
      .eq('user_id', user.id)
      .eq('snapshot_month', prevMonthStart)
      .maybeSingle();

    // Calculate real % changes
    const prevAssets = prevSnapshot ? Number(prevSnapshot.total_assets) : null;
    const prevLiabilities = prevSnapshot ? Number(prevSnapshot.total_liabilities) : null;
    const prevPortfolio = prevSnapshot ? Number(prevSnapshot.investment_balance) : null;
    const prevCashFlowVal = prevCashFlow ? Number(prevCashFlow.net_flow) : null;

    const calcChange = (current: number, prev: number | null) => {
      if (prev === null || prev === 0) return null;
      return Math.round(((current - prev) / Math.abs(prev)) * 1000) / 10; // one decimal
    };

    const financialSummary = {
      net_worth: netWorth,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      monthly_cash_flow: monthlyCashFlow,
      portfolio_value: portfolioValue,
      changes: {
        assets: calcChange(totalAssets, prevAssets),
        liabilities: calcChange(totalLiabilities, prevLiabilities),
        cash_flow: calcChange(monthlyCashFlow, prevCashFlowVal),
        portfolio: calcChange(portfolioValue, prevPortfolio),
      },
    };

    const healthScore = healthScoreResult.data || {
      overall_score: 0,
      debt_to_asset_ratio: 0,
      savings_rate: 0,
      emergency_fund_months: 0,
      portfolio_diversification: 0,
    };

    // Transform net worth history for chart
    const transformedNetWorthHistory = netWorthHistory.map(snapshot => {
      const date = new Date(snapshot.snapshot_date);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        value: Number(snapshot.net_worth),
        assets: Number(snapshot.total_assets),
        liabilities: Number(snapshot.total_liabilities),
      };
    });

    // Transform cash flow history for chart
    const transformedCashFlowHistory = cashFlowHistory.map(snapshot => {
      const date = new Date(snapshot.snapshot_month);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        income: Number(snapshot.total_income),
        expenses: Number(snapshot.total_expenses),
        netFlow: Number(snapshot.net_flow),
      };
    });

    // Build assets composition from accounts by type
    const assetsComposition = buildComposition(assetAccounts, 'account_type', {
      checking: 'Cash',
      savings: 'Savings',
      brokerage: 'Investments',
      crypto: 'Crypto',
    });

    // Build liabilities composition
    const liabilitiesComposition = buildComposition(liabilityAccounts, 'account_type', {
      credit_card: 'Credit Cards',
      loan: 'Loans',
      mortgage: 'Mortgage',
    });

    // Build savings rate timeline from cash flow history
    const savingsRateTimeline = cashFlowHistory.map(snapshot => {
      const date = new Date(snapshot.snapshot_month);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        rate: Math.round(Number(snapshot.savings_rate || 0) * 100),
        saved: Number(snapshot.savings_amount || 0),
      };
    });

    // Transform insights to match frontend expectations
    const transformedInsights = (insightsResult.data || []).map((insight: Record<string, unknown>) => ({
      id: insight.id,
      type: insight.insight_type,
      priority: insight.priority,
      title: insight.title,
      description: insight.description,
      recommended_action: insight.recommended_action,
      estimated_impact: insight.estimated_impact_amount,
      source: insight.source_type,
      created_at: insight.created_at,
    }));

    // Transform accounts for frontend
    const transformedAccounts = accounts.map(account => ({
      id: account.id,
      institution: account.institutions?.name || 'Unknown',
      institution_logo: account.institutions?.logo_url,
      account_type: account.account_type,
      account_name: account.account_name,
      balance: Number(account.current_balance),
      sync_status: account.sync_status,
      last_synced_at: account.last_synced_at,
    }));

    return NextResponse.json({
      financialSummary,
      healthScore: {
        score: healthScore.overall_score,
        debt_to_asset_ratio: healthScore.debt_to_asset_ratio,
        savings_rate: healthScore.savings_rate,
        emergency_fund_months: healthScore.emergency_fund_months,
        portfolio_diversification: healthScore.portfolio_diversification,
      },
      accounts: transformedAccounts,
      holdings,
      insights: transformedInsights,
      netWorthHistory: transformedNetWorthHistory,
      cashFlowHistory: transformedCashFlowHistory,
      assetsComposition,
      liabilitiesComposition,
      savingsRateTimeline,
    });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to build composition data
function buildComposition(
  accounts: Array<{ account_type: string; current_balance: number; account_name: string }>,
  groupBy: string,
  labelMap: Record<string, string>
) {
  const grouped: Record<string, { value: number; items: string[] }> = {};

  for (const account of accounts) {
    const key = account[groupBy as keyof typeof account] as string;
    const label = labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const value = Math.abs(Number(account.current_balance));

    if (!grouped[label]) {
      grouped[label] = { value: 0, items: [] };
    }
    grouped[label].value += value;
    grouped[label].items.push(account.account_name);
  }

  const total = Object.values(grouped).reduce((sum, g) => sum + g.value, 0);

  return Object.entries(grouped).map(([name, data]) => ({
    name,
    value: data.value,
    percentage: total > 0 ? Math.round((data.value / total) * 100) : 0,
    items: data.items,
  }));
}
