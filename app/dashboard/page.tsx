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
    <div className="container mx-auto p-4 max-w-[1600px]">
      <div className="flex gap-4">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0 space-y-4 stagger-fade-in">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="type-h1">Financial Command Center</h1>
            <p className="type-body text-[var(--color-text-secondary)]">
              Real-time intelligence across your complete financial system
            </p>
          </div>

          {/* Row 1: Financial Summary Cards (Full Width) */}
          <div>
            <FinancialSummaryCards
              totalAssets={mockFinancialSummary.total_assets}
              totalLiabilities={mockFinancialSummary.total_liabilities}
              monthlyCashFlow={mockFinancialSummary.monthly_cash_flow}
              portfolioValue={mockFinancialSummary.portfolio_value}
            />
          </div>

          {/* Row 2: Net Worth (2/3) + Health Score (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <NetWorthCard
                currentNetWorth={mockFinancialSummary.net_worth}
                netWorthHistory={mockNetWorthHistory}
              />
            </div>
            <div className="lg:col-span-1">
              <FinancialHealthScore healthScore={mockFinancialHealthScore} />
            </div>
          </div>

          {/* Row 3: Cash Flow + Composition + Savings — equal columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1">
              <CashFlowTrend data={mockCashFlowTrend} />
            </div>
            <div className="lg:col-span-1">
              <AssetsLiabilitiesComposition
                assets={mockAssetsComposition}
                liabilities={mockLiabilitiesComposition}
              />
            </div>
            <div className="lg:col-span-1">
              <SavingsRateTimeline data={mockSavingsRateTimeline} targetRate={30} />
            </div>
          </div>
        </div>

        {/* Right Sidebar - Persistent Intelligence Feed */}
        <aside className="hidden lg:block w-[380px] sticky top-[73px] self-start h-[calc(100vh-89px)]">
          <AIInsightsFeed insights={mockInsights} />
        </aside>
      </div>
    </div>
  );
}
