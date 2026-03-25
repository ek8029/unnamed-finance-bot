'use client';

import Link from 'next/link';
import { Wallet, TrendingUp, ArrowLeftRight, Shield } from 'lucide-react';
import { NetWorthCard } from '@/components/dashboard/net-worth-card';
import { FinancialSummaryCards } from '@/components/dashboard/financial-summary-cards';
import { FinancialHealthScore } from '@/components/dashboard/financial-health-score';
import { IntelligenceFeed } from '@/components/dashboard/intelligence-feed';
import { CashFlowTrend } from '@/components/dashboard/cash-flow-trend';
import { AssetsLiabilitiesComposition } from '@/components/dashboard/assets-liabilities-composition';
import { SavingsRateTimeline } from '@/components/dashboard/savings-rate-timeline';
import { useFinancialSummary, useIntelligence } from '@/hooks/use-financial-data';

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-density">
      <div className="h-8 bg-[var(--color-bg-elevated)] rounded w-1/3"></div>
      <div className="h-4 bg-[var(--color-bg-elevated)] rounded w-1/2"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-density mt-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-[var(--color-bg-elevated)] rounded-xl"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-density mt-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-40 bg-[var(--color-bg-elevated)] rounded-xl"></div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardOverview() {
  const {
    financialSummary,
    healthScore,
    netWorthHistory,
    cashFlowHistory,
    assetsComposition,
    liabilitiesComposition,
    savingsRateTimeline,
    loading,
    error
  } = useFinancialSummary();

  const {
    insights: feedInsights,
    loading: feedLoading,
    error: feedError,
  } = useIntelligence();

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
        <div className="bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 text-[var(--color-negative)] p-6 rounded-xl">
          <h2 className="font-semibold mb-2">Error loading dashboard</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // New user, no accounts connected
  const hasNoData = !financialSummary ||
    (financialSummary.total_assets === 0 &&
     financialSummary.total_liabilities === 0 &&
     financialSummary.portfolio_value === 0);

  if (hasNoData) {
    return (
      <div className="container mx-auto card-padding max-w-[1600px]">
        <div className="max-w-2xl mx-auto py-16">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center mx-auto">
              <Wallet className="w-8 h-8 text-[var(--color-gold)]" />
            </div>
            <div>
              <h1 className="type-h1 mb-2">Welcome to Helm</h1>
              <p className="type-body text-[var(--color-text-secondary)] max-w-md mx-auto">
                Connect your first financial account to unlock your personalized command center with real-time intelligence.
              </p>
            </div>

            <Link
              href="/dashboard/accounts"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black font-semibold rounded-lg transition-colors"
            >
              <Wallet className="w-4 h-4" />
              Connect Your First Account
            </Link>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            {[
              {
                icon: Shield,
                title: 'Connect securely',
                description: 'Link your bank accounts, credit cards, and brokerages through Plaid. Your credentials never touch our servers.',
              },
              {
                icon: TrendingUp,
                title: 'See the full picture',
                description: 'Your net worth, cash flow, portfolio, and health score update automatically after each sync.',
              },
              {
                icon: ArrowLeftRight,
                title: 'Get intelligence',
                description: 'Helm analyzes your financial data and surfaces actionable insights tailored to your situation.',
              },
            ].map((step, i) => (
              <div key={i} className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl p-6 text-center">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-overlay)] flex items-center justify-center mx-auto mb-4">
                  <step.icon className="w-5 h-5 text-[var(--color-text-secondary)]" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">{step.title}</h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const transformedHealthScore = healthScore ? {
    score: healthScore.score || 0,
    debt_to_asset_ratio: healthScore.debt_to_asset_ratio || 0,
    savings_rate: healthScore.savings_rate || 0,
    emergency_fund_months: healthScore.emergency_fund_months || 0,
    portfolio_diversification: healthScore.portfolio_diversification || 0,
  } : null;

  return (
    <div className="container mx-auto card-padding max-w-[1600px]">
      <div className="space-y-density stagger-fade-in">
        {/* Header */}
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
            changes={financialSummary?.changes}
          />
        </div>

        {/* Row 2: Collapsible Alerts Pane */}
        <IntelligenceFeed
          insights={feedInsights}
          loading={feedLoading}
          error={feedError}
        />

        {/* Row 3: Net Worth (3/5) + Health Score (2/5) */}
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

        {/* Row 4: Cash Flow & Savings + Financial Composition */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-density">
          <div className="space-y-density">
            {cashFlowHistory.length > 0 && <CashFlowTrend data={cashFlowHistory} />}
            {savingsRateTimeline.length > 0 && <SavingsRateTimeline data={savingsRateTimeline} targetRate={30} />}
          </div>
          <div>
            <AssetsLiabilitiesComposition
              assets={assetsComposition}
              liabilities={liabilitiesComposition}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
