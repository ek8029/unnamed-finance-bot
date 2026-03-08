'use client'

import { NetWorthCard } from '@/components/dashboard/net-worth-card';
import { FinancialSummaryCards } from '@/components/dashboard/financial-summary-cards';
import { FinancialHealthScore } from '@/components/dashboard/financial-health-score';
import { AIInsightsFeed } from '@/components/dashboard/ai-insights-feed';
import { CashFlowTrend } from '@/components/dashboard/cash-flow-trend';
import { AssetsLiabilitiesComposition } from '@/components/dashboard/assets-liabilities-composition';
import { SavingsRateTimeline } from '@/components/dashboard/savings-rate-timeline';
import {
  mockFinancialSummary,
  mockFinancialHealthScore,
  mockNetWorthHistory,
  mockInsights,
  mockCashFlowTrend,
  mockAssetsComposition,
  mockLiabilitiesComposition,
  mockSavingsRateTimeline,
} from '@/lib/mock-data';

export default function DashboardOverview() {
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
              totalAssets={mockFinancialSummary.total_assets}
              totalLiabilities={mockFinancialSummary.total_liabilities}
              monthlyCashFlow={mockFinancialSummary.monthly_cash_flow}
              portfolioValue={mockFinancialSummary.portfolio_value}
            />
          </div>

          {/* Row 2: Net Worth (larger, 2/3) + Health Score (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-density">
            <div className="lg:col-span-3">
              <NetWorthCard
                currentNetWorth={mockFinancialSummary.net_worth}
                netWorthHistory={mockNetWorthHistory}
              />
            </div>
            <div className="lg:col-span-2">
              <FinancialHealthScore healthScore={mockFinancialHealthScore} />
            </div>
          </div>

          {/* Row 3: Stacked Cash Flow & Savings (left) + Financial Composition (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-density">
            {/* Left Column: Stacked Metrics */}
            <div className="space-y-density">
              <CashFlowTrend data={mockCashFlowTrend} />
              <SavingsRateTimeline data={mockSavingsRateTimeline} targetRate={30} />
            </div>

            {/* Right Column: Financial Composition */}
            <div>
              <AssetsLiabilitiesComposition
                assets={mockAssetsComposition}
                liabilities={mockLiabilitiesComposition}
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar - Persistent Intelligence Feed */}
        <aside className="hidden lg:block w-[380px] sticky top-4 self-start h-[calc(100vh-104px)]">
          <AIInsightsFeed insights={mockInsights} />
        </aside>
      </div>
    </div>
  );
}
