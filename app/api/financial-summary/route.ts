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
      netWorthResult,
      healthScoreResult,
      insightsResult,
    ] = await Promise.all([
      supabase
        .from('linked_accounts')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('holdings')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('net_worth_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('financial_health_scores')
        .select('*')
        .eq('user_id', user.id)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single(),
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

    // Calculate asset accounts (positive balances)
    const totalAssets = accounts
      .filter(a => a.current_balance > 0)
      .reduce((sum, a) => sum + Number(a.current_balance), 0);

    // Calculate liability accounts (negative balances or credit cards)
    const totalLiabilities = Math.abs(
      accounts
        .filter(a => a.current_balance < 0 || a.account_type === 'credit_card')
        .reduce((sum, a) => sum + Math.min(0, Number(a.current_balance)), 0)
    );

    // Calculate portfolio value from holdings
    const portfolioValue = holdings.reduce((sum, h) => sum + Number(h.total_value), 0);

    // Net worth
    const netWorth = totalAssets - totalLiabilities;

    // Monthly cash flow (simplified - would be calculated from transactions)
    const monthlyCashFlow = 8450; // Placeholder for now

    const financialSummary = {
      net_worth: netWorth,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      monthly_cash_flow: monthlyCashFlow,
      portfolio_value: portfolioValue,
    };

    const healthScore = healthScoreResult.data || {
      score: 0,
      debt_to_asset_ratio: 0,
      savings_rate: 0,
      emergency_fund_months: 0,
      portfolio_diversification: 0,
    };

    // Transform insights to match frontend expectations
    const transformedInsights = (insightsResult.data || []).map((insight: Record<string, unknown>) => ({
      id: insight.id,
      type: insight.insight_type, // Map database column to expected field
      priority: insight.priority,
      title: insight.title,
      description: insight.description,
      recommended_action: insight.recommended_action,
      estimated_impact: insight.estimated_impact_amount,
      source: insight.source_type,
      created_at: insight.created_at,
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
      accounts,
      holdings,
      insights: transformedInsights,
      netWorthHistory: netWorthResult.data ? [netWorthResult.data] : [],
    });
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
