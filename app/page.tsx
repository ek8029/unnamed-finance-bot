import { NetWorthCard } from '@/components/dashboard/net-worth-card';
import { FinancialSummaryCards } from '@/components/dashboard/financial-summary-cards';
import { FinancialHealthScore } from '@/components/dashboard/financial-health-score';
import { AccountAggregation } from '@/components/dashboard/account-aggregation';
import { AIInsightsFeed } from '@/components/dashboard/ai-insights-feed';
import { PortfolioMonitor } from '@/components/dashboard/portfolio-monitor';
import { PortfolioAllocation } from '@/components/dashboard/portfolio-allocation';
import { TaxIntelligence } from '@/components/dashboard/tax-intelligence';
import {
  mockAccounts,
  mockHoldings,
  mockInsights,
  mockFinancialSummary,
  mockFinancialHealthScore,
  mockNetWorthHistory,
  mockPortfolioAllocation,
  mockTaxIntelligence,
} from '@/lib/mock-data';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">AI Personal CFO</h1>
          <p className="text-gray-600">
            Your personal financial intelligence platform
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
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            <AIInsightsFeed insights={mockInsights} />
            <PortfolioMonitor holdings={mockHoldings} />
          </div>

          {/* Right Column - 1/3 width */}
          <div className="space-y-6">
            <FinancialHealthScore healthScore={mockFinancialHealthScore} />
            <AccountAggregation accounts={mockAccounts} />
            <PortfolioAllocation allocation={mockPortfolioAllocation} />
            <TaxIntelligence taxData={mockTaxIntelligence} />
          </div>
        </div>
      </div>
    </main>
  );
}
