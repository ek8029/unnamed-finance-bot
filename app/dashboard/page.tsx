'use client'

import { NetWorthCard } from '@/components/dashboard/net-worth-card';
import { FinancialSummaryCards } from '@/components/dashboard/financial-summary-cards';
import { FinancialHealthScore } from '@/components/dashboard/financial-health-score';
import { AIInsightsFeed } from '@/components/dashboard/ai-insights-feed';
import {
  mockFinancialSummary,
  mockFinancialHealthScore,
  mockNetWorthHistory,
  mockInsights,
} from '@/lib/mock-data';

export default function DashboardOverview() {
  return (
    <div className="container mx-auto p-4 max-w-[1600px]">
      <div className="flex gap-4">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="type-h1">Overview</h1>
            <p className="type-body text-helm-secondary">
              Your complete financial picture
            </p>
          </div>

          {/* Asymmetric Grid - Hero Layout (2:1 ratio) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 auto-rows-min">
            {/* Net Worth - Hero Monitor (2 columns) */}
            <div className="lg:col-span-2">
              <NetWorthCard
                currentNetWorth={mockFinancialSummary.net_worth}
                netWorthHistory={mockNetWorthHistory}
              />
            </div>

            {/* Financial Health Score (1 column) */}
            <div className="lg:col-span-1">
              <FinancialHealthScore healthScore={mockFinancialHealthScore} />
            </div>

            {/* Financial Summary - 4 Equal Cards (Full Width) */}
            <div className="lg:col-span-3">
              <FinancialSummaryCards
                totalAssets={mockFinancialSummary.total_assets}
                totalLiabilities={mockFinancialSummary.total_liabilities}
                monthlyCashFlow={mockFinancialSummary.monthly_cash_flow}
                portfolioValue={mockFinancialSummary.portfolio_value}
              />
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
