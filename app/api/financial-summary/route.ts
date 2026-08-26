import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { parseDateLocal, formatMonthLabel, formatMonthShort } from '@/lib/date-format';
import { computeSnapshots } from '@/lib/plaid-sync';
import { assetBalance, isLiabilityType, liabilityBalance } from '@/lib/account-balance';
import { intradayNetWorthSeries, onlyToday } from '@/lib/market/intraday-series';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update last_seen_at (fire-and-forget, throttled to 1/hour via DB)
    supabase
      .from('user_profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', user.id)
      .or(`last_seen_at.is.null,last_seen_at.lt.${new Date(Date.now() - 3600000).toISOString()}`)
      .then(() => {});

    // Fetch all data in parallel
    const [
      accountsResult,
      holdingsResult,
      netWorthHistoryResult,
      cashFlowHistoryResult,
      healthScoreResult,
      insightsResult,
      plaidItemsResult,
      intradayResult,
    ] = await Promise.all([
      supabase
        .from('linked_accounts')
        .select('*, institutions(name, logo_url)')
        .eq('user_id', user.id)
        .eq('is_active', true),
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
        .limit(400),
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
      supabase
        .from('plaid_items')
        .select('id')
        .eq('user_id', user.id),
      // Today's five-minute book values (migration 066) for the 1D range.
      // A day's worth is at most 78 rows; the ET-day filter happens below.
      supabase
        .from('portfolio_intraday_snapshots')
        .select('captured_at, total_value')
        .eq('user_id', user.id)
        .gte('captured_at', new Date(Date.now() - 86_400_000).toISOString())
        .order('captured_at', { ascending: true })
        .limit(200),
    ]);

    // Calculate totals from accounts
    const accounts = accountsResult.data || [];
    const holdings = holdingsResult.data || [];
    let netWorthHistory = netWorthHistoryResult.data || [];
    let cashFlowHistory = cashFlowHistoryResult.data || [];

    // Classify accounts using the SAME logic as computeSnapshots in plaid-sync.ts:
    //   credit_card / loan / mortgage  → liability (signed: negative = credit owed to user)
    //   brokerage                      → skip (investment value comes from holdings)
    //   crypto w/ holdings rows        → skip (coins already counted as holdings)
    //   everything else                → cash asset
    const accountsWithHoldings = new Set(
      holdings.map((h: { account_id?: string | null }) => h.account_id).filter(Boolean),
    );
    const cashAccounts: typeof accounts = [];
    const liabilityAccounts: typeof accounts = [];
    let cashAssets = 0;
    let totalLiabilities = 0;

    for (const a of accounts) {
      const type = a.account_type;
      // Cash reads `available` where reported, per lib/account-balance: it nets
      // out pending charges and matches what the bank itself shows.
      const bal = isLiabilityType(type) ? liabilityBalance(a) : assetBalance(a);

      if (type === 'credit_card' || type === 'loan' || type === 'mortgage') {
        liabilityAccounts.push(a);
        // Signed per Plaid convention: abs() would count a credit balance
        // (money owed TO the user) as debt.
        totalLiabilities += bal;
      } else if (type === 'brokerage') {
        // Skip — investment value comes from holdings below
      } else if (type === 'crypto' && accountsWithHoldings.has(a.id)) {
        // Skip — this account's coins are counted as holdings rows below
      } else {
        cashAccounts.push(a);
        cashAssets += bal;
      }
    }

    // Portfolio value from holdings (source of truth for investments)
    const portfolioValue = holdings.reduce((sum, h) => sum + Number(h.total_value), 0);

    // Total assets = cash/savings + portfolio (no double-counting)
    const totalAssets = cashAssets + portfolioValue;

    // Net worth
    const netWorth = totalAssets - totalLiabilities;

    // If user has accounts but ≤1 snapshot, trigger snapshot computation + backfill.
    // This handles seeded/test accounts and users whose first sync didn't complete.
    if (accounts.length > 0 && netWorthHistory.length <= 1) {
      try {
        await computeSnapshots(supabase, user.id);
        // Re-fetch snapshots after backfill
        const [freshNW, freshCF] = await Promise.all([
          supabase
            .from('net_worth_snapshots')
            .select('*')
            .eq('user_id', user.id)
            .order('snapshot_date', { ascending: true })
            .limit(400),
          supabase
            .from('cash_flow_snapshots')
            .select('*')
            .eq('user_id', user.id)
            .order('snapshot_month', { ascending: true })
            .limit(6),
        ]);
        netWorthHistory = freshNW.data || [];
        cashFlowHistory = freshCF.data || [];
      } catch (e) {
        console.error('Error computing snapshots on dashboard load:', e);
      }
    }

    // Get monthly cash flow from latest snapshot
    const latestCashFlow = cashFlowHistory[cashFlowHistory.length - 1];
    const monthlyCashFlow = latestCashFlow?.net_flow || 0;

    // Get previous month's net worth snapshot for % change calculations
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    let prevSnapshot = (await supabase
      .from('net_worth_snapshots')
      .select('total_assets, total_liabilities, net_worth, investment_balance, snapshot_date')
      .eq('user_id', user.id)
      .gte('snapshot_date', prevMonthDate.toISOString().split('T')[0])
      .lte('snapshot_date', prevMonthEnd.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle()).data;

    // Fallback: if no previous-month snapshot, use earliest available (not today)
    if (!prevSnapshot) {
      prevSnapshot = (await supabase
        .from('net_worth_snapshots')
        .select('total_assets, total_liabilities, net_worth, investment_balance, snapshot_date')
        .eq('user_id', user.id)
        .lt('snapshot_date', today)
        .order('snapshot_date', { ascending: true })
        .limit(1)
        .maybeSingle()).data;
    }

    // Get previous month's cash flow for cash flow % change
    const prevMonthStart = prevMonthDate.toISOString().split('T')[0];
    let prevCashFlow = (await supabase
      .from('cash_flow_snapshots')
      .select('net_flow')
      .eq('user_id', user.id)
      .eq('snapshot_month', prevMonthStart)
      .maybeSingle()).data;

    // Fallback: use earliest available cash flow snapshot (not current month)
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    if (!prevCashFlow) {
      prevCashFlow = (await supabase
        .from('cash_flow_snapshots')
        .select('net_flow')
        .eq('user_id', user.id)
        .lt('snapshot_month', currentMonthStart)
        .order('snapshot_month', { ascending: true })
        .limit(1)
        .maybeSingle()).data;
    }

    // Calculate real % changes
    const prevAssets = prevSnapshot ? Number(prevSnapshot.total_assets) : null;
    const prevLiabilities = prevSnapshot ? Number(prevSnapshot.total_liabilities) : null;
    const prevNetWorth = prevSnapshot ? Number(prevSnapshot.net_worth) : null;
    const prevPortfolio = prevSnapshot ? Number(prevSnapshot.investment_balance) : null;
    const prevCashFlowVal = prevCashFlow ? Number(prevCashFlow.net_flow) : null;

    const calcChange = (current: number, prev: number | null) => {
      if (prev === null || prev === 0) return null;
      return Math.round(((current - prev) / Math.abs(prev)) * 1000) / 10;
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
        net_worth: calcChange(netWorth, prevNetWorth),
        // Dollar change against the same snapshot baseline as the % change.
        // Null when there is no meaningful baseline (e.g. brand-new account
        // whose first snapshot is $0) so the UI hides the badge instead of
        // showing the entire balance as a "monthly gain".
        net_worth_dollar:
          prevNetWorth !== null && prevNetWorth !== 0
            ? Math.round((netWorth - prevNetWorth) * 100) / 100
            : null,
        net_worth_baseline_date: prevSnapshot?.snapshot_date ?? null,
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
    // NOTE: Date-only strings ("2026-04-01") parse as UTC midnight, which
    // shifts to the previous day in western timezones. Adding T12:00:00 avoids this.
    // Deduplicate snapshots by month label — multiple snapshots in the same
    // month (e.g., backfill on the 1st + real sync on the 8th) both format as
    // "Apr '26", creating duplicate x-axis entries on the chart. Keep the LATEST
    // snapshot per month, then override the current month with live-computed values.
    const snapshotsByMonth = new Map<string, { month: string; value: number; assets: number; liabilities: number }>();
    for (const snapshot of netWorthHistory) {
      const date = parseDateLocal(snapshot.snapshot_date);
      const label = formatMonthLabel(date);
      // Later snapshots overwrite earlier ones for the same month
      snapshotsByMonth.set(label, {
        month: label,
        value: Number(snapshot.net_worth),
        assets: Number(snapshot.total_assets),
        liabilities: Number(snapshot.total_liabilities),
      });
    }

    // Override current month with live-computed values so the graph's latest
    // point matches the displayed net worth exactly.
    const todayLabel = formatMonthLabel(now);
    snapshotsByMonth.set(todayLabel, { month: todayLabel, value: netWorth, assets: totalAssets, liabilities: totalLiabilities });

    const transformedNetWorthHistory = Array.from(snapshotsByMonth.values());

    // Daily net-worth series (one point per snapshot day) for fine-grained chart
    // ranges (1W / 1M / ...). Deduped by date; today's live value appended so the
    // latest point matches the displayed net worth exactly.
    const dailyByDate = new Map<string, { date: string; value: number }>();
    for (const snapshot of netWorthHistory) {
      dailyByDate.set(snapshot.snapshot_date, {
        date: snapshot.snapshot_date,
        value: Number(snapshot.net_worth),
      });
    }
    dailyByDate.set(today, { date: today, value: netWorth });
    const netWorthDaily = Array.from(dailyByDate.values()).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );

    // Intraday (1D) series: the book at each tick today, with cash and
    // liabilities added back so the last point is the displayed net worth.
    const netWorthIntraday = intradayNetWorthSeries(
      onlyToday(intradayResult.data ?? [], now),
      netWorth,
      portfolioValue,
    );

    // Transform cash flow history for chart
    const transformedCashFlowHistory = cashFlowHistory.map(snapshot => {
      const date = parseDateLocal(snapshot.snapshot_month);
      return {
        month: formatMonthShort(date),
        income: Number(snapshot.total_income),
        expenses: Number(snapshot.total_expenses),
        netFlow: Number(snapshot.net_flow),
      };
    });

    // Build assets composition: cash accounts by type + holdings as "Investments"
    // Uses the SAME sources as totalAssets so the numbers agree.
    const assetsComposition = buildComposition(cashAccounts, 'account_type', {
      checking: 'Cash',
      savings: 'Savings',
      crypto: 'Crypto',
    });
    if (portfolioValue > 0) {
      assetsComposition.push({
        name: 'Investments',
        value: portfolioValue,
        percentage: 0,
        items: [...new Set(holdings.map((h: Record<string, unknown>) => String(h.ticker || 'Unknown')))].slice(0, 10),
      });
    }
    // Recalculate percentages so they sum correctly against totalAssets
    for (const item of assetsComposition) {
      item.percentage = totalAssets > 0 ? Math.round((item.value / totalAssets) * 100) : 0;
    }

    // Build liabilities composition
    const liabilitiesComposition = buildComposition(liabilityAccounts, 'account_type', {
      credit_card: 'Credit Cards',
      loan: 'Loans',
      mortgage: 'Mortgage',
    });

    // Build savings rate timeline from cash flow history
    const savingsRateTimeline = cashFlowHistory.map(snapshot => {
      const date = parseDateLocal(snapshot.snapshot_month);
      return {
        month: formatMonthShort(date),
        rate: Number(snapshot.savings_rate || 0) * 100,
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
        savings_rate: latestCashFlow?.savings_rate ?? healthScore.savings_rate,
        emergency_fund_months: healthScore.emergency_fund_months,
        portfolio_diversification: healthScore.portfolio_diversification,
      },
      accounts: transformedAccounts,
      // "Connected" = the user has REAL data: a Plaid item OR manually entered
      // holdings. Plaid-only checks sent manual-entry users to the empty/demo
      // screen with their own book invisible (lost a real user to this).
      hasPlaidConnection: (plaidItemsResult.data?.length ?? 0) > 0 || holdings.length > 0,
      holdings,
      insights: transformedInsights,
      netWorthHistory: transformedNetWorthHistory,
      netWorthDaily,
      netWorthIntraday,
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
  accounts: Array<{
    account_type: string;
    account_subtype?: string | null;
    current_balance: number;
    available_balance?: number | null;
    account_name: string;
  }>,
  groupBy: string,
  labelMap: Record<string, string>
) {
  const grouped: Record<string, { value: number; items: string[] }> = {};

  for (const account of accounts) {
    const key = account[groupBy as keyof typeof account] as string;
    const label = labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    // The same figures the totals above are built from, or the chart and the
    // number beside it disagree. This read current_balance through Math.abs(),
    // so the asset slices ignored pending charges and a card sitting in credit
    // was drawn as a slice of debt.
    const value = isLiabilityType(account.account_type)
      ? liabilityBalance(account)
      : assetBalance(account);

    // A slice can only be a magnitude. An account in credit, or overdrawn,
    // belongs in the totals but cannot be drawn as negative area, so it is left
    // out of the composition rather than flipped positive.
    if (value <= 0) continue;

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
