'use client';

import { useMemo, useState } from 'react';
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
import { useDemo } from '@/contexts/demo-context';

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

// ── Mobile Sparkline SVG ──
function MobileSparkline({ data }: { data: { month: string; value: number }[] }) {
  if (!data || data.length < 2) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 360;
  const h = 100;
  const pad = 2;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const linePath = `M${points.join(' L')}`;
  const areaPath = `${linePath} L${w},${h} L0,${h} Z`;
  const gradientId = 'mobile-spark-gradient';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[100px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E6B94D" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#E6B94D" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke="#E6B94D" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Mobile KPI Tile ──
function KpiTile({ label, value, change, changeColor }: {
  label: string;
  value: string;
  change: string | null;
  changeColor: 'positive' | 'negative' | 'muted';
}) {
  const colorClass = changeColor === 'positive'
    ? 'text-[var(--color-positive)]'
    : changeColor === 'negative'
      ? 'text-[var(--color-negative)]'
      : 'text-[var(--color-text-muted)]';

  return (
    <div className="p-3.5 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl">
      <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--color-text-muted)]">
        {label}
      </span>
      <div className="text-[20px] font-bold tabular-nums mt-2 text-[var(--color-text-primary)]">
        {value}
      </div>
      {change && (
        <div className={`font-mono text-[10px] font-semibold mt-1.5 ${colorClass}`}>
          {change}
        </div>
      )}
    </div>
  );
}

// ── Mobile Top Mover Row ──
function MoverRow({ ticker, name, value, changePct, prices }: {
  ticker: string;
  name: string;
  value: string;
  changePct: number | null;
  prices?: number[];
}) {
  const isPositive = (changePct ?? 0) >= 0;
  const color = isPositive ? '#4ADE80' : '#F87171';

  // Mini sparkline for the mover row
  const miniSpark = useMemo(() => {
    if (!prices || prices.length < 2) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const w = 60;
    const h = 24;
    const pts = prices.map((v, i) => {
      const x = (i / (prices.length - 1)) * w;
      const y = 2 + (1 - (v - min) / range) * (h - 4);
      return `${x},${y}`;
    });
    return `M${pts.join(' L')}`;
  }, [prices]);

  return (
    <div className="grid items-center gap-3 py-2.5" style={{ gridTemplateColumns: '36px 1fr 70px 90px' }}>
      {/* Ticker icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center border border-[var(--color-gold-border)] font-mono text-[11px] font-bold text-[var(--color-gold)]"
        style={{ background: 'linear-gradient(135deg, rgba(230,185,77,0.12), rgba(230,185,77,0.04))' }}
      >
        {ticker.slice(0, 2)}
      </div>
      {/* Ticker + name */}
      <div className="min-w-0">
        <div className="font-mono text-[13px] font-bold text-[var(--color-text-primary)] truncate">{ticker}</div>
        <div className="text-[11px] text-[var(--color-text-muted)] truncate">{name}</div>
      </div>
      {/* Mini sparkline */}
      <div className="flex items-center justify-center">
        {miniSpark ? (
          <svg viewBox="0 0 60 24" className="w-[60px] h-6" preserveAspectRatio="none">
            <path d={miniSpark} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        ) : (
          <div className="w-[60px] h-6 bg-[var(--color-bg-elevated)] rounded" />
        )}
      </div>
      {/* Value + change */}
      <div className="text-right">
        <div className="font-mono text-[12px] font-bold text-[var(--color-text-primary)]">{value}</div>
        <div className={`font-mono text-[11px] font-bold ${isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
          {changePct != null ? `${isPositive ? '+' : ''}${changePct.toFixed(2)}%` : '--'}
        </div>
      </div>
    </div>
  );
}

const RANGE_OPTIONS = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'] as const;

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
    holdings,
    hasPlaidConnection,
    loading,
    error
  } = useFinancialSummary();

  const {
    insights: feedInsights,
    loading: feedLoading,
    error: feedError,
  } = useIntelligence();

  const { formatCurrency, formatCurrencyDetailed, formatPercentage } = useFormat();
  const { isDemo, disableDemo } = useDemo();
  const [mobileRange, setMobileRange] = useState<string>('1M');

  // Compute dollar change from the last two net worth history points
  const netWorthChange = useMemo(() => {
    if (!netWorthHistory || netWorthHistory.length < 2) return null;
    const current = netWorthHistory[netWorthHistory.length - 1];
    const previous = netWorthHistory[netWorthHistory.length - 2];
    if (!current || !previous) return null;
    return current.value - previous.value;
  }, [netWorthHistory]);

  const netWorthPctChange = financialSummary?.changes?.net_worth ?? null;

  // Net worth 30d change (first vs last in history)
  const netWorth30dChange = useMemo(() => {
    if (!netWorthHistory || netWorthHistory.length < 2) return null;
    const first = netWorthHistory[0];
    const last = netWorthHistory[netWorthHistory.length - 1];
    if (!first || !last) return null;
    const dollarChange = last.value - first.value;
    const pctChange = first.value !== 0 ? ((last.value - first.value) / first.value) * 100 : 0;
    return { dollar: dollarChange, pct: pctChange };
  }, [netWorthHistory]);

  // Top movers from holdings sorted by absolute day change
  const topMovers = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];
    return [...holdings]
      .filter(h => h.day_change_percentage !== null)
      .sort((a, b) => Math.abs(b.day_change_percentage ?? 0) - Math.abs(a.day_change_percentage ?? 0))
      .slice(0, 4);
  }, [holdings]);

  // Actions count from feed insights
  const actionableInsights = useMemo(() => {
    return feedInsights.filter(i => i.type === 'action' || i.priority === 'high');
  }, [feedInsights]);

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
  const is30dPositive = netWorth30dChange ? netWorth30dChange.dollar >= 0 : true;

  // KPI data for mobile tiles
  const portfolioValue = financialSummary?.portfolio_value || 0;
  const cashValue = (financialSummary?.total_assets || 0) - portfolioValue;
  const totalUnrealized = holdings.reduce((sum, h) => sum + (h.unrealised_gain ?? 0), 0);
  const dayPL = holdings.reduce((sum, h) => {
    const pct = h.day_change_percentage ?? 0;
    return sum + (h.total_value * pct / 100);
  }, 0);

  return (
    <div className="container mx-auto card-padding max-w-[1600px]">
      {/* ── Demo banner (shared) ── */}
      {isDemo && (
        <div className="flex items-center justify-between bg-[var(--color-gold)]/10 border border-[var(--color-gold)]/20 px-4 py-3 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] tracking-wider uppercase text-[var(--color-gold)] font-semibold">Demo Mode</span>
            <span className="text-[13px] text-[var(--color-text-muted)]">Viewing sample data. Connect an account to see your real finances.</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a href="/dashboard/accounts" className="text-[12px] font-semibold text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors">
              Connect Account
            </a>
            <button onClick={disableDemo} className="text-[11px] text-[var(--color-text-muted)]/50 hover:text-[var(--color-text-muted)] transition-colors">
              Exit Demo
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* ── MOBILE LAYOUT (below md) ── */}
      {/* ══════════════════════════════════════════════ */}
      <div className="md:hidden space-y-5">

        {/* ── Header: Eyebrow + Net Worth Hero ── */}
        <section className="pt-1">
          <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-[var(--color-text-muted)]">
            Net Worth &middot; All Accounts
          </span>
          <h1 className="font-mono font-bold tabular-nums tracking-tight text-[36px] leading-tight text-[var(--color-text-primary)] mt-1">
            {formatCurrency(netWorth)}
          </h1>

          {/* Delta pill */}
          {netWorth30dChange && (
            <div className="mt-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-[7px] border ${
                  is30dPositive
                    ? 'bg-[rgba(74,222,128,0.1)] border-[rgba(74,222,128,0.2)]'
                    : 'bg-[rgba(248,113,113,0.1)] border-[rgba(248,113,113,0.2)]'
                }`}
              >
                <span className={`font-mono text-[12px] font-bold tabular-nums ${is30dPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                  {is30dPositive ? '\u25B2' : '\u25BC'} {is30dPositive ? '+' : ''}{formatCurrency(netWorth30dChange.dollar)}
                </span>
                <span className={`font-mono text-[11px] ${is30dPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                  {is30dPositive ? '+' : ''}{(netWorth30dChange.pct ?? 0).toFixed(2)}% &middot; 30d
                </span>
              </span>
            </div>
          )}
        </section>

        {/* ── Sparkline Chart ── */}
        {netWorthHistory && netWorthHistory.length >= 2 && (
          <section>
            <MobileSparkline data={netWorthHistory} />
            <div className="flex justify-between px-1 mt-1">
              <span className="font-mono text-[9px] text-[var(--color-text-muted)]">
                {netWorthHistory.length > 0 ? netWorthHistory[0].month : '30d ago'}
              </span>
              <span className="font-mono text-[9px] text-[var(--color-text-muted)]">
                {netWorthHistory.length > 2 ? netWorthHistory[Math.floor(netWorthHistory.length / 2)].month : '15d'}
              </span>
              <span className="font-mono text-[9px] text-[var(--color-text-muted)]">Today</span>
            </div>
          </section>
        )}

        {/* ── Range Pills ── */}
        <div className="flex gap-1 p-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {RANGE_OPTIONS.map(r => (
            <button
              key={r}
              onClick={() => setMobileRange(r)}
              className={`flex-1 font-mono text-[10px] font-bold py-1.5 rounded-full transition-colors ${
                mobileRange === r
                  ? 'bg-[var(--color-gold)] text-black'
                  : 'text-[var(--color-text-muted)]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* ── KPI Tiles (2x2) ── */}
        <div className="grid grid-cols-2 gap-2">
          <KpiTile
            label="Portfolio"
            value={formatCurrency(portfolioValue)}
            change={financialSummary?.changes?.portfolio !== null && financialSummary?.changes?.portfolio !== undefined
              ? formatPercentage(financialSummary.changes.portfolio)
              : null}
            changeColor={(financialSummary?.changes?.portfolio ?? 0) >= 0 ? 'positive' : 'negative'}
          />
          <KpiTile
            label="Cash"
            value={formatCurrency(cashValue)}
            change={null}
            changeColor="muted"
          />
          <KpiTile
            label="Day P/L"
            value={`${dayPL >= 0 ? '+' : ''}${formatCurrencyDetailed(dayPL)}`}
            change={null}
            changeColor={dayPL >= 0 ? 'positive' : 'negative'}
          />
          <KpiTile
            label="Unrealized"
            value={`${totalUnrealized >= 0 ? '+' : ''}${formatCurrency(totalUnrealized)}`}
            change={null}
            changeColor={totalUnrealized >= 0 ? 'positive' : 'negative'}
          />
        </div>

        {/* ── Actions Teaser Card ── */}
        {actionableInsights.length > 0 && (
          <Link href="/dashboard/actions" className="block">
            <div
              className="p-4 rounded-xl border"
              style={{
                background: 'linear-gradient(135deg, rgba(230,185,77,0.06), rgba(230,185,77,0.01))',
                borderColor: 'rgba(230,185,77,0.2)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                  <span className="text-[var(--color-gold)] mr-1">&#10022;</span>
                  Actions inbox
                </span>
                <span className="font-mono text-[10px] font-bold text-[var(--color-gold)] tracking-wider">
                  {actionableInsights.length} NEW
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                {actionableInsights[0]?.title ?? 'You have actionable insights waiting.'}
              </p>
            </div>
          </Link>
        )}

        {/* ── Top Movers ── */}
        {topMovers.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)]">
                Top Movers Today
              </span>
              <Link href="/dashboard/portfolio" className="font-mono text-[10px] font-semibold text-[var(--color-gold)]">
                See all
              </Link>
            </div>
            <div className="divide-y divide-[var(--color-border-base)]">
              {topMovers.map(h => (
                <MoverRow
                  key={h.id}
                  ticker={h.ticker}
                  name={h.asset_name}
                  value={formatCurrencyDetailed(h.total_value)}
                  changePct={h.day_change_percentage}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* ── DESKTOP LAYOUT (md and up) ── */}
      {/* ══════════════════════════════════════════════ */}
      <div className="hidden md:block">
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
    </div>
  );
}
