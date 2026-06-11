'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { useToast } from '@/contexts/toast-context';
import { NetWorthCard } from '@/components/dashboard/net-worth-card';
import { FinancialSummaryCards } from '@/components/dashboard/financial-summary-cards';
import { FinancialHealthScore } from '@/components/dashboard/financial-health-score';
import { IntelligenceFeed } from '@/components/dashboard/intelligence-feed';
import { CashFlowTrend } from '@/components/dashboard/cash-flow-trend';
import { AssetsLiabilitiesComposition } from '@/components/dashboard/assets-liabilities-composition';
import { SavingsRateTimeline } from '@/components/dashboard/savings-rate-timeline';
import { DailyBrief } from '@/components/dashboard/daily-brief';
import { useFinancialSummary, useIntelligence, useHoldings } from '@/hooks/use-financial-data';
import { useFormat } from '@/hooks/use-format';
import { useDemo } from '@/contexts/demo-context';
import posthog from 'posthog-js';

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

  // Live portfolio value: useHoldings polls /api/market/quotes every 30s
  // and recomputes totalValue client-side. Overrides the static DB aggregate.
  const { totalValue: liveHoldingsValue } = useHoldings();

  const { formatCurrency, formatPercentage } = useFormat();
  const { isDemo, enableDemo, disableDemo } = useDemo();
  const router = useRouter();
  const toast = useToast();
  const [plaidError, setPlaidError] = useState<string | null>(null);

  useEffect(() => {
    posthog.capture('dashboard_viewed', { has_plaid: hasPlaidConnection, is_demo: isDemo });
  }, [hasPlaidConnection, isDemo]);

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
      <div className="container mx-auto px-4 md:card-padding max-w-[1600px]">
        <div className="flex flex-col min-h-[calc(100vh-200px)]">

          {/* Main content — vertically centered, readable width */}
          <div className="flex-1 flex flex-col justify-center max-w-[580px] mx-auto md:mx-0 md:ml-[8%] py-16">

            <h1
              className="font-bold tracking-[-0.04em] leading-[1.1] text-[var(--color-text-primary)] mb-5"
              style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}
            >
              Your dashboard is ready.
            </h1>

            <p className="text-[14px] sm:text-[15px] text-[var(--color-text-muted)] leading-[1.7] mb-8 sm:mb-10 max-w-[480px]">
              Your dashboard runs on real data. Connect a brokerage for automatic sync, or add your holdings manually to get started in 15 seconds.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <PlaidLinkButton
                className="px-9 py-4 text-[14px] font-bold rounded-[3px]"
                onSuccess={() => router.refresh()}
                onError={(msg) => setPlaidError(msg)}
                onLinkError={(_code, message) => {
                  toast.error('Connection failed', message);
                }}
              >
                Connect via Plaid
              </PlaidLinkButton>
              <a
                href="/dashboard/portfolio/add"
                className="inline-flex items-center justify-center px-9 py-4 text-[14px] font-bold rounded-[3px] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors"
              >
                Add holdings manually
              </a>
            </div>
            {plaidError && (
              <p className="text-[13px] text-[var(--color-negative)] mt-3">{plaidError}</p>
            )}

            {/* Trust strip */}
            <div className="mt-4 flex flex-col gap-1.5 max-w-[480px]">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-[12px] text-[var(--color-text-muted)]">
                <Lock className="w-3 h-3 shrink-0" />
                <span>Read-only access — Helm can never move your money</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#555] pl-[18px]">
                Secured by Plaid · 256-bit encryption · 12,000+ institutions
              </p>
            </div>

            {/* Plaid trust section */}
            <div className="mt-7 sm:mt-9 pt-5 sm:pt-6 border-t border-[var(--color-border-subtle)] max-w-[500px]">
              <p className="text-[14px] sm:text-[15px] font-bold text-[var(--color-text-primary)] mb-3 sm:mb-4">What is Plaid?</p>
              <p className="text-[13px] sm:text-[14px] text-[var(--color-text-muted)] leading-[1.7] mb-4 sm:mb-5">
                Plaid is the infrastructure layer between your bank and apps like Venmo, Robinhood, Coinbase, and Wealthfront. Over 12,000 financial institutions are supported.
              </p>

              <div className="flex flex-col">
                {[
                  { label: 'Access', text: 'Read-only.', detail: ' Helm can view balances and transactions. It cannot move money, place trades, or modify your accounts.' },
                  { label: 'Credentials', text: 'Never shared.', detail: ' Your login is entered directly in Plaid\'s secure window. Helm never sees your username or password.' },
                  { label: 'Encryption', text: 'AES-256', detail: ' in transit and at rest. Same standard used by major banks.' },
                  { label: 'Control', text: 'Disconnect anytime', detail: ' from Settings. Your data is deleted immediately.' },
                ].map((fact) => (
                  <div key={fact.label} className="flex items-baseline gap-2 sm:gap-3 py-2 sm:py-2.5 border-b border-[var(--color-border-subtle)] last:border-b-0 text-[13px] sm:text-[14px]">
                    <span className="shrink-0 w-[80px] sm:w-[100px] text-[10px] sm:text-[11px] tracking-[0.12em] uppercase text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {fact.label}
                    </span>
                    <span className="text-[#888]">
                      <strong className="text-[var(--color-text-primary)] font-semibold">{fact.text}</strong>
                      {fact.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Demo escape */}
            <div className="mt-7 sm:mt-9 pt-4 sm:pt-5 border-t border-[var(--color-border-subtle)] max-w-[500px]">
              <button
                onClick={() => { enableDemo(); router.refresh(); }}
                className="px-6 py-3 border border-[var(--color-border-base)] rounded-[3px] text-[13px] font-semibold text-[var(--color-text-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors cursor-pointer bg-transparent"
              >
                Explore with sample data
              </button>
              <p className="text-[13px] text-[#555] mt-2.5" style={{ fontFamily: 'var(--font-mono)' }}>
                See the full dashboard with a fictional portfolio. No account needed.
              </p>
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
    <div className="container mx-auto px-4 md:card-padding max-w-[1600px]">
      <div className="space-y-4 md:space-y-density stagger-fade-in">
        {isDemo && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/20 px-4 py-3 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] tracking-wider uppercase text-[var(--color-gold)] font-semibold">Demo Mode</span>
              <span className="text-[13px] text-[var(--color-text-muted)] hidden sm:inline">Viewing sample data.</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={disableDemo} className="text-[12px] font-semibold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors cursor-pointer">
                Connect Account
              </button>
              <button onClick={disableDemo} className="text-[11px] text-[var(--color-text-muted)]/50 hover:text-[var(--color-text-muted)] transition-colors">
                Exit Demo
              </button>
            </div>
          </div>
        )}

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
            className="font-mono font-bold tabular-nums text-[var(--color-text-primary)] max-w-full"
            style={{
              fontSize: 'clamp(40px, 7vw, 96px)',
              letterSpacing: '-0.04em',
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
          portfolioValue={(!isDemo && liveHoldingsValue > 0) ? liveHoldingsValue : (financialSummary?.portfolio_value || 0)}
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
