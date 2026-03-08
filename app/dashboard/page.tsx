'use client';

import { NetWorthCard } from '@/components/dashboard/net-worth-card';
import { FinancialSummaryCards } from '@/components/dashboard/financial-summary-cards';
import { FinancialHealthScore } from '@/components/dashboard/financial-health-score';
import { AIInsightsFeed } from '@/components/dashboard/ai-insights-feed';
import { CashFlowTrend } from '@/components/dashboard/cash-flow-trend';
import { AssetsLiabilitiesComposition } from '@/components/dashboard/assets-liabilities-composition';
import { SavingsRateTimeline } from '@/components/dashboard/savings-rate-timeline';
import { useFinancialSummary } from '@/hooks/use-financial-data';

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-density">
      <div className="h-8 bg-neutral-800 rounded w-1/3"></div>
      <div className="h-4 bg-neutral-800 rounded w-1/2"></div>
      <div className="grid grid-cols-4 gap-density mt-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-neutral-800 rounded-xl"></div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-density mt-6">
        <div className="col-span-3 h-64 bg-neutral-800 rounded-xl"></div>
        <div className="col-span-2 h-64 bg-neutral-800 rounded-xl"></div>
      </div>
    </div>
  );
}

export default function DashboardOverview() {
  const {
    financialSummary,
    healthScore,
    insights,
    netWorthHistory,
    cashFlowHistory,
    assetsComposition,
    liabilitiesComposition,
    savingsRateTimeline,
    loading,
    error
  } = useFinancialSummary();

  if (loading) {
    return (
      <div className="container mx-auto card-padding max-w-[1600px]">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto card-padding max-w-[1600px]">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl">
          <h2 className="font-semibold mb-2">Error loading dashboard</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Transform API data to match component props (FinancialHealthScore type)
  const transformedHealthScore = healthScore ? {
    score: healthScore.score || 0,
    debt_to_asset_ratio: healthScore.debt_to_asset_ratio || 0,
    savings_rate: healthScore.savings_rate || 0,
    emergency_fund_months: healthScore.emergency_fund_months || 0,
    portfolio_diversification: healthScore.portfolio_diversification || 0,
  } : null;

  // Transform insights for the feed (must match Insight type from @/types)
  const transformedInsights = insights.map(insight => ({
    id: insight.id,
    user_id: '', // Not needed for display
    type: (insight.type === 'portfolio' ? 'portfolio' : insight.type) as 'spending' | 'portfolio' | 'market' | 'tax' | 'credit',
    title: insight.title,
    description: insight.description,
    recommended_action: insight.recommended_action,
    timestamp: new Date(insight.created_at),
    is_dismissed: false,
    is_useful: undefined,
  }));

  return (
    <div className="container mx-auto card-padding max-w-[1600px]">
      <div className="flex gap-density">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0 space-y-density stagger-fade-in">
          {/* Header with better spacing */}
          <div className="space-y-2 mb-1">
            <h1 className="type-h1">Financial Command Center</h1>
            <p className="type-body text-[var(--color-text-secondary)]">
              Real-time intelligence across your complete financial system
            </p>
          </div>

          {/* Row 1: Financial Summary Cards */}
          <div>
            <FinancialSummaryCards
              totalAssets={financialSummary?.total_assets || 0}
              totalLiabilities={financialSummary?.total_liabilities || 0}
              monthlyCashFlow={financialSummary?.monthly_cash_flow || 0}
              portfolioValue={financialSummary?.portfolio_value || 0}
            />
          </div>

          {/* Row 2: Net Worth (larger, 2/3) + Health Score (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-density">
            <div className="lg:col-span-3">
              <NetWorthCard
                currentNetWorth={financialSummary?.net_worth || 0}
                netWorthHistory={netWorthHistory}
              />
            </div>
            <div className="lg:col-span-2">
              {transformedHealthScore && (
                <FinancialHealthScore healthScore={transformedHealthScore} />
              )}
            </div>
          </div>

          {/* Row 3: Stacked Cash Flow & Savings (left) + Financial Composition (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-density">
            {/* Left Column: Stacked Metrics */}
            <div className="space-y-density">
              <CashFlowTrend data={cashFlowHistory} />
              <SavingsRateTimeline data={savingsRateTimeline} targetRate={30} />
            </div>

            {/* Right Column: Financial Composition */}
            <div>
              <AssetsLiabilitiesComposition
                assets={assetsComposition}
                liabilities={liabilitiesComposition}
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar - Persistent Intelligence Feed */}
        <aside className="hidden lg:block w-[380px] sticky top-4 self-start h-[calc(100vh-104px)]">
          <AIInsightsFeed insights={transformedInsights} />
        </aside>
      </div>
    </div>
  );
}
