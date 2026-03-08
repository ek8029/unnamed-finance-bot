import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all user data in parallel
    const [
      profileResult,
      preferencesResult,
      accountsResult,
      holdingsResult,
      transactionsResult,
      insightsResult,
      netWorthResult,
      cashFlowResult,
      taxEstimatesResult,
      capitalGainsResult,
    ] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('id', user.id).single(),
      supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
      supabase.from('linked_accounts').select('*').eq('user_id', user.id),
      supabase.from('holdings').select('*, security:securities(security_name, sector, asset_class)').eq('user_id', user.id),
      supabase.from('transactions').select('*').eq('user_id', user.id).order('transaction_date', { ascending: false }).limit(500),
      supabase.from('insights').select('*').eq('user_id', user.id),
      supabase.from('net_worth_snapshots').select('*').eq('user_id', user.id).order('snapshot_date', { ascending: false }),
      supabase.from('cash_flow_snapshots').select('*').eq('user_id', user.id).order('snapshot_month', { ascending: false }),
      supabase.from('tax_estimates').select('*').eq('user_id', user.id),
      supabase.from('capital_gains').select('*').eq('user_id', user.id),
    ]);

    // Build export data object
    const exportData = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profileResult.data,
      preferences: preferencesResult.data,
      accounts: accountsResult.data?.map(account => ({
        institution: account.account_name,
        type: account.account_type,
        balance: account.current_balance,
        lastSynced: account.last_synced_at,
      })),
      holdings: holdingsResult.data?.map(holding => ({
        ticker: holding.ticker,
        name: holding.security?.security_name,
        shares: holding.shares,
        currentPrice: holding.current_price,
        totalValue: holding.total_value,
        costBasis: holding.total_cost_basis,
        unrealizedGain: holding.unrealised_gain_loss,
        sector: holding.security?.sector,
        assetClass: holding.security?.asset_class,
      })),
      transactions: transactionsResult.data?.map(tx => ({
        date: tx.transaction_date,
        description: tx.description,
        amount: tx.amount,
        category: tx.category_name,
        merchant: tx.merchant_name,
      })),
      insights: insightsResult.data?.map(insight => ({
        type: insight.insight_type,
        title: insight.title,
        description: insight.description,
        recommendedAction: insight.recommended_action,
        createdAt: insight.created_at,
        isDismissed: insight.is_dismissed,
      })),
      netWorthHistory: netWorthResult.data?.map(snapshot => ({
        date: snapshot.snapshot_date,
        netWorth: snapshot.net_worth,
        totalAssets: snapshot.total_assets,
        totalLiabilities: snapshot.total_liabilities,
      })),
      cashFlowHistory: cashFlowResult.data?.map(snapshot => ({
        month: snapshot.snapshot_month,
        income: snapshot.total_income,
        expenses: snapshot.total_expenses,
        netFlow: snapshot.net_flow,
        savingsRate: snapshot.savings_rate,
      })),
      taxEstimates: taxEstimatesResult.data,
      capitalGains: capitalGainsResult.data?.map(gain => ({
        ticker: gain.ticker,
        transactionDate: gain.transaction_date,
        type: gain.gain_loss_type,
        shares: gain.shares,
        proceeds: gain.proceeds,
        costBasis: gain.cost_basis,
        gainLoss: gain.gain_loss,
      })),
    };

    // Return as downloadable JSON file
    const jsonContent = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="helm-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
