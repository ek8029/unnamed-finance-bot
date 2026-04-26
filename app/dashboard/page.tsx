'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Wallet, TrendingUp, ArrowLeftRight, Shield } from 'lucide-react';
import { NetWorthCard } from '@/components/dashboard/net-worth-card';
import { FinancialSummaryCards } from '@/components/dashboard/financial-summary-cards';
import { FinancialHealthScore } from '@/components/dashboard/financial-health-score';
import { IntelligenceFeed } from '@/components/dashboard/intelligence-feed';
import { CashFlowTrend } from '@/components/dashboard/cash-flow-trend';
import { AssetsLiabilitiesComposition } from '@/components/dashboard/assets-liabilities-composition';
import { SavingsRateTimeline } from '@/components/dashboard/savings-rate-timeline';
import { DailyBrief } from '@/components/dashboard/daily-brief';
import { useFinancialSummary, useIntelligence } from '@/hooks/use-financial-data';
import { useFormat } from '@/hooks/use-format';

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-density" role="status" aria-live="polite" aria-label="Loading dashboard data">
      {/* Hero skeleton */}
      <div className="pt-6 pb-4 space-y-3">
        <div className="h-4 bg-[var(--color-bg-elevated)] rounded w-48"></div>
        <div className="h-16 bg-[var(--color-bg-elevated)] rounded w-72"></div>
        <div className="h-8 bg-[var(--color-bg-elevated)] rounded-full w-40"></div>
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-density mt-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-[var(--color-bg-elevated)] rounded-xl"></div>
        ))}
      </div>
      {/* Chart skeleton */}
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
    accounts,
    hasPlaidConnection,
    loading,
    error
  } = useFinancialSummary();

  const {
    insights: feedInsights,
    loading: feedLoading,
    error: feedError,
  } = useIntelligence();

  const { formatCurrency, formatPercentage } = useFormat();

  // Compute dollar change from the last two net worth history points
  const netWorthChange = useMemo(() => {
    if (!netWorthHistory || netWorthHistory.length < 2) return null;
    const current = netWorthHistory[netWorthHistory.length - 1];
    const previous = netWorthHistory[netWorthHistory.length - 2];
    if (!current || !previous) return null;
    return current.value - previous.value;
  }, [netWorthHistory]);

  const netWorthPctChange = financialSummary?.changes?.net_worth ?? null;

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

  // No Plaid connection = show empty state, regardless of stale data
  const hasNoData = !financialSummary || !hasPlaidConnection;

  if (hasNoData) {
    return (
      <div className="container mx-auto card-padding max-w-[1600px]">
        <div className="max-w-3xl mx-auto py-12">

          {/* Hero — big, clear, specific */}
          <div className="text-center space-y-5 mb-12">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Your financial command center is one connection away.
            </h1>
            <p className="text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto leading-relaxed">
              Link a brokerage or bank account to see your net worth, portfolio performance, tax opportunities, and AI-powered insights — all in real time.
            </p>
            <Link
              href="/dashboard/accounts"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black text-base font-bold rounded-lg transition-colors"
            >
              <Wallet className="w-5 h-5" />
              Connect Your Account
            </Link>
            <p className="text-xs text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
              Read-only access via Plaid · 12,000+ institutions · Takes 30 seconds
            </p>
          </div>

          {/* What you'll unlock — specific, tangible */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
            {[
              { icon: TrendingUp, title: 'Portfolio Intelligence', desc: 'See every holding, sector allocation, concentration risk, and unrealized P&L across all accounts in one view.' },
              { icon: Shield, title: 'Tax-Loss Harvesting', desc: 'Helm automatically detects harvestable positions and wash-sale conflicts. Pro users get Form 8949 exports.' },
              { icon: ArrowLeftRight, title: 'Daily Brief', desc: 'Every morning, a personalized newspaper-style brief with what moved, what matters, and what to do.' },
              { icon: Wallet, title: 'Net Worth Tracking', desc: 'Real-time net worth across banks, brokerages, crypto, and credit cards with month-over-month trends.' },
            ].map((feature, i) => (
              <div key={i} className="flex gap-4 p-5 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center shrink-0">
                  <feature.icon className="w-5 h-5 text-[var(--color-gold)]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">{feature.title}</h3>
                  <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Trust bar */}
          <div className="rounded-lg border border-[var(--color-positive)]/15 bg-[var(--color-positive)]/[0.03] p-5">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-[var(--color-positive)] shrink-0 mt-0.5" />
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">Bank-level security, read-only access</h3>
                <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">
                  Helm connects through Plaid, the same infrastructure used by Venmo, Robinhood, and Coinbase.
                  We can see your balances and transactions — we can never move money, place trades, or access your login credentials.
                  Your data is encrypted at rest and in transit. You can disconnect any account at any time.
                </p>
              </div>
            </div>
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

  const netWorth = financialSummary?.net_worth || 0;
  const isPositiveChange = netWorthChange !== null ? netWorthChange >= 0 : true;

  return (
    <div className="container mx-auto card-padding max-w-[1600px]">
      <div className="space-y-density stagger-fade-in">

        {/* ── HERO: Net Worth ── */}
        <section className="pt-2 pb-2">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-positive)] opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-positive)]"></span>
            </span>
            <span
              className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-text-muted)]"
            >
              Net Worth &middot; All Accounts
            </span>
          </div>

          {/* Giant number */}
          <h1
            className="font-mono font-bold tabular-nums text-[var(--color-text-primary)]"
            style={{
              fontSize: 'clamp(48px, 8vw, 96px)',
              letterSpacing: '-0.045em',
              lineHeight: 1.05,
            }}
          >
            {formatCurrency(netWorth)}
          </h1>

          {/* Change pill */}
          {(netWorthChange !== null || netWorthPctChange !== null) && (
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`
                  inline-flex items-center gap-1.5 rounded-full px-3 py-1
                  text-sm font-semibold tabular-nums font-mono
                  ${isPositiveChange
                    ? 'bg-[var(--color-positive)]/15 text-[var(--color-positive)]'
                    : 'bg-[var(--color-negative)]/15 text-[var(--color-negative)]'
                  }
                `}
              >
                {netWorthChange !== null && (
                  <span>
                    {isPositiveChange ? '+' : ''}
                    {formatCurrency(netWorthChange)}
                  </span>
                )}
                {netWorthPctChange !== null && (
                  <span>
                    ({formatPercentage(netWorthPctChange)})
                  </span>
                )}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                vs. last month
              </span>
            </div>
          )}
        </section>

        {/* ── Daily Brief ── */}
        {hasPlaidConnection && <DailyBrief />}

        {/* ── Summary Cards ── */}
        <FinancialSummaryCards
          totalAssets={financialSummary?.total_assets || 0}
          totalLiabilities={financialSummary?.total_liabilities || 0}
          monthlyCashFlow={financialSummary?.monthly_cash_flow || 0}
          portfolioValue={financialSummary?.portfolio_value || 0}
          changes={financialSummary?.changes}
        />

        {/* ── Intelligence Feed ── */}
        {hasPlaidConnection && <IntelligenceFeed
          insights={feedInsights}
          loading={feedLoading}
          error={feedError}
        />}

        {/* ── Net Worth Chart (3/5) + Health Score (2/5) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-density">
          <div className="lg:col-span-3">
            <NetWorthCard
              currentNetWorth={netWorth}
              netWorthHistory={netWorthHistory}
              changePercentage={netWorthPctChange}
            />
          </div>
          <div className="lg:col-span-2">
            {transformedHealthScore && (
              <FinancialHealthScore healthScore={transformedHealthScore} />
            )}
          </div>
        </div>

        {/* ── Cash Flow & Savings (left) + Composition (right) ── */}
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
