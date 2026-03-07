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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Overview</h1>
        <p className="text-gray-600">
          Your complete financial picture and AI-powered insights
        </p>
      </div>

      {/* Net Worth Card - Full Width */}
      <NetWorthCard
        currentNetWorth={mockFinancialSummary.net_worth}
        netWorthHistory={mockNetWorthHistory}
      />

      {/* Financial Summary Cards */}
      <FinancialSummaryCards
        totalAssets={mockFinancialSummary.total_assets}
        totalLiabilities={mockFinancialSummary.total_liabilities}
        monthlyCashFlow={mockFinancialSummary.monthly_cash_flow}
        portfolioValue={mockFinancialSummary.portfolio_value}
      />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - AI Insights */}
        <div className="lg:col-span-2">
          <AIInsightsFeed insights={mockInsights} />
        </div>

        {/* Right Column - Health Score */}
        <div>
          <FinancialHealthScore healthScore={mockFinancialHealthScore} />
        </div>
      </div>
    </div>
  );
}
