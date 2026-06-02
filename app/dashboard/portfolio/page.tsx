'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { PortfolioMonitor } from '@/components/dashboard/portfolio-monitor';
import { PortfolioAllocation } from '@/components/dashboard/portfolio-allocation';
import { MarketIntelligence } from '@/components/portfolio/market-intelligence';
import { useHoldings, useTaxData } from '@/hooks/use-financial-data';
import { TrendingUp, TrendingDown, Filter, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFormat } from '@/hooks/use-format';

/* ------------------------------------------------------------------ */
/*  Deterministic sparkline SVG generator                              */
/* ------------------------------------------------------------------ */
function generateSparklinePath(ticker: string, width = 80, height = 24): string {
  // Seed from ticker charCodes for deterministic output
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) {
    seed = ((seed << 5) - seed + ticker.charCodeAt(i)) | 0;
  }
  const pseudoRandom = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed & 0x7fffffff) / 0x7fffffff;
  };
  const points = 12;
  const step = width / (points - 1);
  const coords: [number, number][] = [];
  let y = height * 0.5;
  for (let i = 0; i < points; i++) {
    y = Math.max(2, Math.min(height - 2, y + (pseudoRandom() - 0.48) * 8));
    coords.push([i * step, y]);
  }
  return 'M' + coords.map(([x, yv]) => `${x.toFixed(1)},${yv.toFixed(1)}`).join(' L');
}

/* ------------------------------------------------------------------ */
/*  Ticker icon with gold gradient                                     */
/* ------------------------------------------------------------------ */
function TickerIcon({ ticker }: { ticker: string }) {
  return (
    <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, var(--color-gold) 0%, #b8860b 100%)' }}>
      <span className="text-[11px] font-bold text-black leading-none font-mono">
        {ticker.slice(0, 2)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */
function LoadingSkeleton() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-[1600px] animate-pulse">
      <div className="flex gap-6">
        <div className="flex-1 space-y-6">
          <div className="h-5 bg-[var(--color-bg-elevated)] rounded w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2 h-28 bg-[var(--color-bg-elevated)] rounded-lg" />
            <div className="h-28 bg-[var(--color-bg-elevated)] rounded-lg" />
            <div className="h-28 bg-[var(--color-bg-elevated)] rounded-lg" />
          </div>
          <div className="h-96 bg-[var(--color-bg-elevated)] rounded-lg" />
          <div className="h-64 bg-[var(--color-bg-elevated)] rounded-lg" />
        </div>
        <div className="hidden lg:block w-[420px]">
          <div className="h-[600px] bg-[var(--color-bg-elevated)] rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sort key + direction types for Positions table                     */
/* ------------------------------------------------------------------ */
type PositionSortKey = 'ticker' | 'name' | 'shares' | 'avgCost' | 'price' | 'dayPct' | 'value' | 'alloc' | 'pl';

export default function PortfolioPage() {
  const { formatCurrency, formatCurrencyDetailed } = useFormat();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holdingsData: any = useHoldings();
  const { data: taxData } = useTaxData();

  const holdings: {
    id: string; ticker: string; asset_name: string; shares: number;
    current_price: number; total_value: number; day_change_percentage: number | null;
    portfolio_allocation: number; sector?: string; asset_class?: string;
    cost_basis?: number; unrealised_gain?: number;
  }[] = holdingsData.holdings ?? [];

  const allocation: { name: string; value: number; percentage: number }[] = holdingsData.allocation ?? [];
  const totalValue: number = holdingsData.totalValue ?? 0;
  const performanceMetrics = holdingsData.performanceMetrics ?? null;
  const portfolioHistory: { label: string; value: number; gain_loss: number }[] = holdingsData.portfolioHistory ?? [];
  const loading: boolean = holdingsData.loading ?? true;
  const error: string | null = holdingsData.error ?? null;
  const lastRefreshed: string | null = holdingsData.lastRefreshed ?? null;

  /* ---------- computed aggregates ---------- */
  const { totalDayChange, dayChangePercentage } = useMemo(() => {
    const totalDayChange = holdings.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, holding: any) => {
        // Precise formula: V * p / (1 + p) where p is decimal. day_change_percentage is already * 100.
        const pDecimal = (holding.day_change_percentage ?? 0) / 100;
        return sum + (pDecimal !== -1 ? (holding.total_value * pDecimal) / (1 + pDecimal) : -holding.total_value);
      },
      0,
    );
    const dayChangePercentage = totalValue > 0 ? (totalDayChange / totalValue) * 100 : 0;
    return { totalDayChange, dayChangePercentage };
  }, [holdings, totalValue]);

  const totalUnrealized = useMemo(
    () => holdings.reduce((sum, h) => sum + (h.unrealised_gain ?? 0), 0),
    [holdings],
  );
  const totalCostBasis = useMemo(
    () => holdings.reduce((sum, h) => sum + (h.cost_basis ?? 0), 0),
    [holdings],
  );
  const unrealizedPct = totalCostBasis > 0 ? (totalUnrealized / totalCostBasis) * 100 : 0;

  /* ---------- performance chart ranges ---------- */
  type RangeKey = '3M' | '6M' | '1Y' | 'ALL';

  const singlePointFallback = totalValue > 0
    ? [{ label: (() => { const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date().getMonth()]; return `${m} '${new Date().getFullYear().toString().slice(-2)}`; })(), value: totalValue }]
    : [];

  const performanceSeries: Record<RangeKey, { label: string; value: number }[]> = {
    '3M': portfolioHistory.length > 0 ? portfolioHistory.slice(-3) : singlePointFallback,
    '6M': portfolioHistory.length > 0 ? portfolioHistory.slice(-6) : singlePointFallback,
    '1Y': portfolioHistory.length > 0 ? portfolioHistory : singlePointFallback,
    ALL: portfolioHistory.length > 0 ? portfolioHistory : singlePointFallback,
  };
  const [range, setRange] = useState<RangeKey>('6M');

  /* ---------- transform holdings for sidebar components ---------- */
  const transformedHoldings = holdings.map(h => ({
    id: h.id, user_id: '', ticker: h.ticker, asset_name: h.asset_name,
    shares: h.shares, current_price: h.current_price, total_value: h.total_value,
    day_change_percentage: h.day_change_percentage, portfolio_allocation: h.portfolio_allocation,
    sector: h.sector, asset_class: h.asset_class, cost_basis: h.cost_basis,
    unrealised_gain: h.unrealised_gain,
  }));

  const transformedAllocation = allocation.map(a => ({
    name: a.name, value: a.value, percentage: a.percentage,
  }));

  /* ---------- positions table sorting ---------- */
  const [sortKey, setSortKey] = useState<PositionSortKey>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = useCallback((key: PositionSortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }, [sortKey]);

  const sortedPositions = useMemo(() => {
    const copy = [...holdings];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'ticker': return dir * a.ticker.localeCompare(b.ticker);
        case 'name': return dir * a.asset_name.localeCompare(b.asset_name);
        case 'shares': return dir * (a.shares - b.shares);
        case 'avgCost': return dir * ((a.cost_basis && a.shares ? a.cost_basis / a.shares : 0) - (b.cost_basis && b.shares ? b.cost_basis / b.shares : 0));
        case 'price': return dir * (a.current_price - b.current_price);
        case 'dayPct': return dir * ((a.day_change_percentage ?? 0) - (b.day_change_percentage ?? 0));
        case 'value': return dir * (a.total_value - b.total_value);
        case 'alloc': return dir * (a.portfolio_allocation - b.portfolio_allocation);
        case 'pl': return dir * ((a.unrealised_gain ?? 0) - (b.unrealised_gain ?? 0));
        default: return 0;
      }
    });
    return copy;
  }, [holdings, sortKey, sortDir]);

  // Hooks that the old code used (must stay above early returns)
  const sortedByAllocation = useMemo(() => [...holdings].sort((a, b) => b.portfolio_allocation - a.portfolio_allocation), [holdings]);
  const sortedByDayChange = useMemo(() => [...holdings].sort((a, b) => (b.day_change_percentage ?? 0) - (a.day_change_percentage ?? 0)), [holdings]);

  /* ---------- header tab state (visual only) ---------- */
  const tabs = ['Portfolio', 'Concentration'] as const;
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Portfolio');

  /* ================================================================ */
  /*  EARLY RETURNS                                                    */
  /* ================================================================ */
  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-[1600px]">
        <div className="bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 text-[var(--color-negative)] p-6 rounded-xl">
          <h2 className="font-semibold mb-2">Error loading portfolio</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="container mx-auto card-padding max-w-[1600px]">
        <div className="max-w-2xl mx-auto py-16">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center mx-auto">
              <TrendingUp className="w-8 h-8 text-[var(--color-gold)]" />
            </div>
            <div>
              <h1 className="type-h1 mb-2">No holdings yet</h1>
              <p className="type-body text-[var(--color-text-secondary)] max-w-md mx-auto">
                Add your holdings manually in 15 seconds, or connect a brokerage for automatic sync.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Link
                href="/dashboard/accounts"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black font-semibold rounded-lg transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                Connect brokerage
              </Link>
              <Link
                href="/dashboard/portfolio/add"
                className="inline-flex items-center gap-2 px-6 py-3 border border-[var(--color-border-strong)] text-[var(--color-text-primary)] font-semibold rounded-lg hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors"
              >
                Add holdings manually
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  Column header helper                                             */
  /* ================================================================ */
  const ColHeader = ({ label, sortId, className = '' }: { label: string; sortId: PositionSortKey; className?: string }) => (
    <button
      onClick={() => handleSort(sortId)}
      className={`group inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors ${className}`}
    >
      {label}
      <span className="inline-flex flex-col -space-y-1">
        <ChevronUp className={`w-2.5 h-2.5 ${sortKey === sortId && sortDir === 'asc' ? 'text-[var(--color-gold)]' : 'opacity-30'}`} />
        <ChevronDown className={`w-2.5 h-2.5 ${sortKey === sortId && sortDir === 'desc' ? 'text-[var(--color-gold)]' : 'opacity-30'}`} />
      </span>
    </button>
  );

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="container mx-auto px-4 py-6 max-w-[1600px]">
      <div className="flex gap-6">
        {/* ======================================================= */}
        {/*  MAIN CONTENT                                            */}
        {/* ======================================================= */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* ---- 1. HEADER STRIP ---- */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Breadcrumb — hidden on mobile, redundant with sidebar */}
            <div className="hidden sm:flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="flex-shrink-0">
                <rect width="20" height="20" rx="4" fill="var(--color-gold)" fillOpacity="0.15" />
                <path d="M6 6h2v8H6V6zm6 0h2v8h-2V6zm-4 3h4v2H8V9z" fill="var(--color-gold)" />
              </svg>
              <span className="font-mono text-xs text-[var(--color-text-muted)]">
                Helm
              </span>
              <span className="font-mono text-xs text-[var(--color-text-muted)]">/</span>
              <span className="font-mono text-xs text-[var(--color-text-muted)]">
                Portfolio
              </span>
              <span className="font-mono text-xs text-[var(--color-text-muted)] mx-0.5">
                &#8250;
              </span>
              <span className="font-mono text-xs text-[var(--color-text-primary)] font-medium">
                All accounts
              </span>
              {lastRefreshed && (
                <>
                  <span className="mx-2 w-px h-3 bg-[var(--color-border-base)]" />
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-positive)] animate-pulse" />
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                    {lastRefreshed}
                  </span>
                </>
              )}
            </div>

            {/* Tab pills */}
            <div className="flex items-center gap-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-0.5 w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-[var(--color-gold)] text-black'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* ---- 2. HEADLINE STATS ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Portfolio value -- spans 2 cols on lg */}
            <div className="sm:col-span-2 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-5">
              <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-1">
                Portfolio value
              </span>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono tabular-nums font-semibold text-[var(--color-text-primary)] leading-none"
                  style={{ fontSize: 'clamp(32px, 4vw, 52px)' }}>
                  {formatCurrency(totalValue)}
                </span>
                <span className={`inline-flex items-center gap-1 font-mono text-sm tabular-nums ${
                  dayChangePercentage >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                }`}>
                  {dayChangePercentage >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {dayChangePercentage >= 0 ? '+' : ''}{dayChangePercentage.toFixed(2)}%
                  <span className="text-[var(--color-text-muted)] text-xs ml-1">today</span>
                </span>
              </div>
              <span className="block font-mono text-xs text-[var(--color-text-muted)] mt-1.5 tabular-nums">
                {holdings.length} position{holdings.length !== 1 ? 's' : ''} across {new Set(holdings.map(h => h.sector).filter(Boolean)).size} sectors
              </span>
            </div>

            {/* Unrealized P/L */}
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-5">
              <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-1">
                Unrealized P/L
              </span>
              <span className={`block font-mono tabular-nums text-2xl font-semibold leading-tight ${
                totalUnrealized >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
              }`}>
                {totalUnrealized >= 0 ? '+' : ''}{formatCurrency(totalUnrealized)}
              </span>
              <span className={`block font-mono tabular-nums text-xs mt-1 ${
                unrealizedPct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
              }`}>
                {unrealizedPct >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%
              </span>
            </div>

            {/* Day Change */}
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-5">
              <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-1">
                Day Change
              </span>
              <span className={`block font-mono tabular-nums text-2xl font-semibold leading-tight ${
                totalDayChange >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
              }`}>
                {totalDayChange >= 0 ? '+' : ''}{formatCurrency(totalDayChange)}
              </span>
              <span className={`block font-mono tabular-nums text-xs mt-1 ${
                dayChangePercentage >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
              }`}>
                {dayChangePercentage >= 0 ? '+' : ''}{dayChangePercentage.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* ---- TAB CONTENT ---- */}
          {(activeTab === 'Portfolio') && (
          <>
          {/* ---- 3. TLH BANNER ---- */}
          {(() => {
            const underwater = holdings.filter(h => (h.unrealised_gain ?? 0) < 0);
            const harvestable = underwater.reduce((sum, h) => sum + Math.abs(h.unrealised_gain ?? 0), 0);
            if (underwater.length === 0) return null;
            const realizedGains = Math.max(0, (taxData?.realized?.shortTermGains ?? 0) + (taxData?.realized?.longTermGains ?? 0));
            const calcParams = new URLSearchParams({
              losses: Math.round(harvestable).toString(),
              portfolio: Math.round(totalValue).toString(),
              ...(realizedGains > 0 ? { gains: Math.round(realizedGains).toString() } : {}),
            });
            return (
              <div className="rounded-lg border border-[var(--color-gold)]/15 bg-[var(--color-gold)]/[0.02] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingDown className="w-4 h-4 text-[var(--color-gold)]" />
                    <div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {formatCurrency(harvestable)} in harvestable losses
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-2">
                        across {underwater.length} position{underwater.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/tools/tlh-calculator?${calcParams.toString()}`}
                    className="text-xs font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors whitespace-nowrap"
                  >
                    Estimate tax savings &rarr;
                  </Link>
                </div>
                {realizedGains > 0 && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--color-gold)]/10">
                    <TrendingUp className="w-3.5 h-3.5 text-[var(--color-positive)]" />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      YTD realized gains: <span className="text-[var(--color-positive)] font-mono">{formatCurrency(realizedGains)}</span> — losses can offset these dollar-for-dollar
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ---- 4. POSITIONS ---- */}

          {/* ── Mobile: Card view ── */}
          <div className="md:hidden space-y-4">

            {/* ── Mobile Value Header ── */}
            <div className="px-1">
              <div className="flex items-baseline gap-1">
                <span className="text-[34px] font-bold tabular-nums text-[var(--color-text-primary)] leading-none">
                  {formatCurrency(totalValue).replace(/\.\d+$/, '')}
                </span>
                <span className="text-[20px] text-[var(--color-text-muted)] tabular-nums leading-none">
                  .{(totalValue % 1).toFixed(2).slice(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`font-mono text-[13px] font-bold tabular-nums ${
                  totalDayChange >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                }`}>
                  {totalDayChange >= 0 ? '+' : ''}{formatCurrency(totalDayChange)} ({dayChangePercentage >= 0 ? '+' : ''}{dayChangePercentage.toFixed(2)}%)
                </span>
                <span className="font-mono text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">YTD</span>
              </div>
            </div>

            {/* ── Mobile Sector Allocation Strip ── */}
            {allocation.length > 0 && (() => {
              const sectorColors = [
                'var(--color-gold)', '#6366f1', '#22c55e', '#ef4444', '#f59e0b',
                '#8b5cf6', '#06b6d4', '#ec4899', '#64748b', '#14b8a6',
              ];
              const topSectorPct = allocation[0]?.percentage ?? 0;
              return (
                <div className="px-1 space-y-2">
                  <div className="flex gap-[2px] h-[7px] rounded-full overflow-hidden">
                    {allocation.slice(0, 8).map((sector, i) => (
                      <div
                        key={sector.name}
                        style={{
                          flex: sector.percentage,
                          backgroundColor: sectorColors[i % sectorColors.length],
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between">
                    {allocation.slice(0, 4).map((sector, i) => (
                      <div key={sector.name} className="flex items-center gap-1">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: sectorColors[i % sectorColors.length] }}
                        />
                        <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                          {sector.name.length > 10 ? sector.name.slice(0, 10) + '.' : sector.name} {sector.percentage.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  {topSectorPct > 35 && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-warning-text,var(--color-gold))]">
                      <span>&#9888;</span>
                      <span>Concentrated &mdash; top sector is {topSectorPct.toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Mobile Filter Pills ── */}
            <div className="flex gap-1.5 overflow-x-auto px-1 pb-1 -mx-1 scrollbar-none">
              {['All', 'Equities', 'ETFs', 'Crypto', 'Cash'].map((label, i) => (
                <button
                  key={label}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full font-mono text-[11px] border transition-colors ${
                    i === 0
                      ? 'bg-[rgba(230,185,77,0.1)] text-[var(--color-gold)] border-[var(--color-gold-border)]'
                      : 'bg-transparent text-[var(--color-text-muted)] border-[var(--color-border-subtle)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Mobile Positions Header ── */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Positions</h2>
                <span className="font-mono text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5">
                  {holdings.length}
                </span>
              </div>
            </div>

            {/* ── Mobile Position Cards ── */}
            <div className="space-y-2">
            {sortedPositions.map((h) => {
              const dayPct = h.day_change_percentage ?? 0;
              const sparkPath = generateSparklinePath(h.ticker);
              const sparkTrend = dayPct >= 0;
              return (
                <Link
                  key={h.id}
                  href={`/dashboard/holdings/${h.ticker}`}
                  className="block p-3.5 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl active:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  <div className="grid grid-cols-[40px_1fr_auto] gap-3 items-center">
                    <TickerIcon ticker={h.ticker} />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[14px] font-bold tracking-wide text-[var(--color-text-primary)]">
                          {h.ticker}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-muted)] truncate">
                          {h.shares} sh &middot; ${h.current_price.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[12px] text-[var(--color-text-muted)] mt-0.5 truncate">
                        {h.asset_name}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <div className="font-mono text-[13px] font-bold tabular-nums text-[var(--color-text-primary)]">
                        {h.total_value >= 1000 ? `$${(h.total_value / 1000).toFixed(1)}k` : formatCurrency(h.total_value)}
                      </div>
                      <svg width="48" height="16" viewBox="0 0 80 24" fill="none" className="block">
                        <path
                          d={sparkPath}
                          stroke={sparkTrend ? 'var(--color-positive)' : 'var(--color-negative)'}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                      <div className={`font-mono text-[11px] font-bold tabular-nums ${
                        dayPct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                      }`}>
                        {dayPct >= 0 ? '+' : ''}{dayPct.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            </div>
          </div>

          {/* ── Desktop: Table view ── */}
          <div className="hidden md:block border border-[var(--color-border-base)] rounded-lg overflow-hidden bg-[var(--color-bg-surface)]">
            {/* Table header bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Positions</h2>
                <span className="font-mono text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5">
                  {holdings.length}
                </span>
                <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                  sorted by {sortKey} {sortDir}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] rounded-md bg-[var(--color-bg-elevated)] transition-colors">
                  <Filter className="w-3 h-3" />
                  Filter
                </button>
                <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] rounded-md bg-[var(--color-bg-elevated)] transition-colors">
                  <Download className="w-3 h-3" />
                  Export
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="bg-[var(--color-bg-elevated)]/60">
                    <th className="text-left pl-5 pr-2 py-2.5 w-[100px]">
                      <ColHeader label="Symbol" sortId="ticker" />
                    </th>
                    <th className="text-left px-2 py-2.5">
                      <ColHeader label="Name" sortId="name" />
                    </th>
                    <th className="text-right px-2 py-2.5">
                      <ColHeader label="Shares" sortId="shares" className="justify-end" />
                    </th>
                    <th className="text-right px-2 py-2.5">
                      <ColHeader label="Avg Cost" sortId="avgCost" className="justify-end" />
                    </th>
                    <th className="text-right px-2 py-2.5">
                      <ColHeader label="Price" sortId="price" className="justify-end" />
                    </th>
                    <th className="text-right px-2 py-2.5">
                      <ColHeader label="Day %" sortId="dayPct" className="justify-end" />
                    </th>
                    <th className="px-2 py-2.5 w-[96px]">
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">30D</span>
                    </th>
                    <th className="text-right px-2 py-2.5">
                      <ColHeader label="Value" sortId="value" className="justify-end" />
                    </th>
                    <th className="text-right px-2 py-2.5">
                      <ColHeader label="Alloc" sortId="alloc" className="justify-end" />
                    </th>
                    <th className="text-right pl-2 pr-5 py-2.5">
                      <ColHeader label="P/L" sortId="pl" className="justify-end" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPositions.map((h, idx) => {
                    const avgCost = h.cost_basis && h.shares ? h.cost_basis / h.shares : 0;
                    const dayPct = h.day_change_percentage ?? 0;
                    const pl = h.unrealised_gain ?? 0;
                    const allocPct = h.portfolio_allocation;
                    const sparkPath = generateSparklinePath(h.ticker);
                    const sparkTrend = dayPct >= 0;

                    return (
                      <tr
                        key={h.id}
                        className={`h-16 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)]/50 transition-colors ${
                          idx % 2 === 1 ? 'bg-[var(--color-bg-elevated)]/20' : ''
                        }`}
                      >
                        {/* SYMBOL */}
                        <td className="pl-5 pr-2 py-2">
                          <Link href={`/dashboard/holdings/${h.ticker}`} className="flex items-center gap-2.5 group">
                            <TickerIcon ticker={h.ticker} />
                            <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors">
                              {h.ticker}
                            </span>
                          </Link>
                        </td>
                        {/* NAME + sector */}
                        <td className="px-2 py-2">
                          <div className="flex flex-col">
                            <span className="text-sm text-[var(--color-text-primary)] truncate max-w-[180px]">
                              {h.asset_name}
                            </span>
                            {h.sector && (
                              <span className="font-mono text-[10px] text-[var(--color-text-muted)] truncate">
                                {h.sector}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* SHARES */}
                        <td className="px-2 py-2 text-right">
                          <span className="font-mono text-sm tabular-nums text-[var(--color-text-primary)]">
                            {h.shares % 1 === 0 ? h.shares.toLocaleString() : h.shares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                          </span>
                        </td>
                        {/* AVG COST */}
                        <td className="px-2 py-2 text-right">
                          <span className="font-mono text-sm tabular-nums text-[var(--color-text-secondary)]">
                            {avgCost > 0 ? formatCurrencyDetailed(avgCost) : '--'}
                          </span>
                        </td>
                        {/* PRICE */}
                        <td className="px-2 py-2 text-right">
                          <span className="font-mono text-sm tabular-nums text-[var(--color-text-primary)]">
                            {formatCurrencyDetailed(h.current_price)}
                          </span>
                        </td>
                        {/* DAY % */}
                        <td className="px-2 py-2 text-right">
                          <span className={`font-mono text-sm tabular-nums ${
                            dayPct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                          }`}>
                            {dayPct >= 0 ? '+' : ''}{dayPct.toFixed(2)}%
                          </span>
                        </td>
                        {/* 30D SPARKLINE */}
                        <td className="px-2 py-2">
                          <svg width="80" height="24" viewBox="0 0 80 24" fill="none" className="block">
                            <path
                              d={sparkPath}
                              stroke={sparkTrend ? 'var(--color-positive)' : 'var(--color-negative)'}
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                            />
                          </svg>
                        </td>
                        {/* VALUE */}
                        <td className="px-2 py-2 text-right">
                          <span className="font-mono text-sm tabular-nums font-medium text-[var(--color-text-primary)]">
                            {formatCurrency(h.total_value)}
                          </span>
                        </td>
                        {/* ALLOC % + mini bar */}
                        <td className="px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[var(--color-gold)]"
                                style={{ width: `${Math.min(100, allocPct)}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs tabular-nums text-[var(--color-text-secondary)] w-10 text-right">
                              {allocPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        {/* P/L */}
                        <td className="pl-2 pr-5 py-2 text-right">
                          <span className={`font-mono text-sm tabular-nums ${
                            pl >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                          }`}>
                            {pl >= 0 ? '+' : ''}{formatCurrency(pl)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/40">
              <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                Showing {sortedPositions.length} of {holdings.length} positions
              </span>
              <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                Total value: <span className="text-[var(--color-text-primary)] font-medium">{formatCurrency(totalValue)}</span>
              </span>
            </div>
          </div>

          </>
          )}

          {(activeTab === 'Portfolio') && (
          <>
          {/* ---- 5. PERFORMANCE CHART ---- */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="type-h2 flex items-center gap-2">
                  Performance over time
                </CardTitle>
                <CardDescription className="font-mono text-[11px]">
                  Portfolio value evolution across selected time range
                </CardDescription>
              </div>
              <div className="flex gap-1">
                {(Object.keys(performanceSeries) as RangeKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setRange(key)}
                    className={`px-2.5 py-1.5 rounded-md font-mono text-[11px] transition-colors duration-200 ${
                      range === key
                        ? 'bg-[var(--color-gold-surface)] text-[var(--color-gold)] border border-[var(--color-gold-border)]'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-base)]'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                {performanceSeries[range].length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="type-body text-[var(--color-text-muted)]">
                      Portfolio history will build as prices update daily
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceSeries[range]} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
                      <defs>
                        <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        stroke="var(--color-text-muted)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        fontFamily="var(--font-mono)"
                      />
                      <YAxis
                        stroke="var(--color-text-muted)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(0)}k`}
                        fontFamily="var(--font-mono)"
                        width={52}
                      />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value)), 'Portfolio']}
                        contentStyle={{
                          backgroundColor: 'var(--color-bg-elevated)',
                          border: '1px solid var(--color-border-base)',
                          borderRadius: '4px',
                          color: 'var(--color-text-primary)',
                          fontSize: '12px',
                        }}
                        labelStyle={{
                          color: 'var(--color-text-secondary)',
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-gold)"
                        fill="url(#perfGradient)"
                        strokeWidth={2}
                        dot={performanceSeries[range].length <= 2}
                        activeDot={{ r: 4, fill: 'var(--color-gold)', stroke: 'var(--color-bg-surface)', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          </>
          )}

          {(activeTab === 'Portfolio') && (
          <>
          {/* ---- 6. ALLOCATION, SECTOR, METRICS ROW ---- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PortfolioAllocation allocation={transformedAllocation} />

            {/* Sector Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Sector Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {allocation.slice(0, 5).map((sector) => (
                  <div key={sector.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="type-label text-[var(--color-text-secondary)]">{sector.name}</span>
                      <span className="font-mono tabular-nums text-[var(--color-text-primary)]">{sector.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-full h-1.5">
                      <div
                        className="bg-[var(--color-gold)] h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, sector.percentage)}%` }}
                      />
                    </div>
                    <div className="font-mono tabular-nums text-xs text-[var(--color-text-muted)]">
                      {formatCurrencyDetailed(sector.value)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    label: '1 Month Return',
                    value: performanceMetrics?.return_1m != null ? `${performanceMetrics.return_1m >= 0 ? '+' : ''}${performanceMetrics.return_1m.toFixed(1)}%` : 'N/A',
                    color: performanceMetrics?.return_1m != null && performanceMetrics.return_1m >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
                  },
                  {
                    label: '3 Month Return',
                    value: performanceMetrics?.return_3m != null ? `${performanceMetrics.return_3m >= 0 ? '+' : ''}${performanceMetrics.return_3m.toFixed(1)}%` : 'N/A',
                    color: performanceMetrics?.return_3m != null && performanceMetrics.return_3m >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
                  },
                  {
                    label: 'YTD Return',
                    value: performanceMetrics?.return_ytd != null ? `${performanceMetrics.return_ytd >= 0 ? '+' : ''}${performanceMetrics.return_ytd.toFixed(1)}%` : 'N/A',
                    color: performanceMetrics?.return_ytd != null && performanceMetrics.return_ytd >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
                  },
                  {
                    label: 'Sharpe Ratio',
                    value: performanceMetrics?.sharpe_ratio != null ? performanceMetrics.sharpe_ratio.toFixed(2) : 'N/A',
                    color: 'text-[var(--color-text-primary)]',
                  },
                  {
                    label: 'Beta',
                    value: performanceMetrics?.beta != null ? performanceMetrics.beta.toFixed(2) : 'N/A',
                    color: 'text-[var(--color-text-primary)]',
                  },
                ].map((metric) => (
                  <div key={metric.label} className="flex items-center justify-between">
                    <span className="type-label text-[var(--color-text-secondary)]">{metric.label}</span>
                    <span className={`font-mono tabular-nums ${metric.color}`}>{metric.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          </>
          )}

          {/* ---- CONCENTRATION TAB ---- */}
          {activeTab === 'Concentration' && (
          <>
            {/* HHI / Diversification Score */}
            {(() => {
              const totalVal = holdings.reduce((s, h) => s + h.total_value, 0);
              if (totalVal <= 0) return null;
              const weights = holdings.map(h => h.total_value / totalVal);
              const hhi = weights.reduce((s, w) => s + w * w, 0);
              const diversificationScore = Math.round((1 - hhi) * 100);
              const effectivePositions = Math.round(1 / (hhi || 1));
              const scoreColor = diversificationScore >= 70 ? 'var(--color-positive)' : diversificationScore >= 40 ? 'var(--color-warning-text)' : 'var(--color-negative)';

              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                  <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
                    <div className="font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-2">Diversification Score</div>
                    <div className="text-[40px] font-bold tabular-nums" style={{ color: scoreColor, fontFamily: 'var(--font-mono)' }}>{diversificationScore}</div>
                    <div className="text-[13px] text-[var(--color-text-muted)] mt-1">out of 100</div>
                    <div className="mt-3 h-2 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${diversificationScore}%`, backgroundColor: scoreColor }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
                    <div className="font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-2">Effective Positions</div>
                    <div className="text-[40px] font-bold tabular-nums text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-mono)' }}>{effectivePositions}</div>
                    <div className="text-[13px] text-[var(--color-text-muted)] mt-1">of {holdings.length} actual holdings</div>
                    <div className="text-[12px] text-[var(--color-text-muted)] mt-2" style={{ fontFamily: 'var(--font-mono)' }}>
                      HHI: {(hhi * 10000).toFixed(0)} / 10,000
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
                    <div className="font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-2">Top Holding Weight</div>
                    <div className="text-[40px] font-bold tabular-nums" style={{ color: (weights[0] ?? 0) > 0.25 ? 'var(--color-negative)' : 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {((weights[0] ?? 0) * 100).toFixed(1)}%
                    </div>
                    <div className="text-[13px] text-[var(--color-text-muted)] mt-1">{holdings[0]?.ticker ?? '—'}</div>
                    <div className="text-[12px] text-[var(--color-text-muted)] mt-2">
                      {(weights[0] ?? 0) > 0.25 ? '⚠ Exceeds 25% single-name threshold' : '✓ Within concentration limits'}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Single-Name Concentration Table with Search + Pagination */}
            <ConcentrationTable holdings={holdings} formatCurrency={formatCurrency} />

            {/* Sector Concentration vs S&P Benchmark */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-[15px]">Sector Concentration</CardTitle>
                <p className="text-[12px] text-[var(--color-text-muted)] font-mono">Your sector weights vs typical S&P 500 allocation</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(() => {
                    const spBenchmark: Record<string, number> = {
                      'Technology': 31, 'Healthcare': 12, 'Financials': 13, 'Consumer Discretionary': 10,
                      'Communication Services': 9, 'Industrials': 8, 'Consumer Staples': 6, 'Energy': 4,
                      'Utilities': 2, 'Real Estate': 2, 'Materials': 2, 'Other': 1,
                    };
                    return allocation.map((sector) => {
                      const benchmark = spBenchmark[sector.name] ?? 3;
                      const diff = sector.percentage - benchmark;
                      const diffColor = Math.abs(diff) > 10 ? 'var(--color-warning-text)' : 'var(--color-text-muted)';
                      return (
                        <div key={sector.name} className="flex items-center gap-3">
                          <span className="text-[13px] text-[var(--color-text-secondary)] w-40 shrink-0">{sector.name}</span>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-2 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden relative">
                              <div className="h-full bg-[var(--color-gold)] rounded-full" style={{ width: `${Math.min(100, sector.percentage)}%` }} />
                              <div className="absolute top-0 bottom-0 w-0.5 bg-white/30" style={{ left: `${Math.min(100, benchmark)}%` }} title={`S&P: ${benchmark}%`} />
                            </div>
                          </div>
                          <span className="font-mono text-[13px] font-bold tabular-nums w-14 text-right text-[var(--color-text-primary)]">
                            {sector.percentage.toFixed(1)}%
                          </span>
                          <span className="font-mono text-[11px] tabular-nums w-16 text-right" style={{ color: diffColor }}>
                            {diff >= 0 ? '+' : ''}{diff.toFixed(1)}pp
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="flex items-center gap-2 mt-4 text-[11px] text-[var(--color-text-muted)]">
                  <div className="w-3 h-0.5 bg-[var(--color-gold)] rounded" /> Your allocation
                  <div className="w-3 h-0.5 bg-white/30 rounded ml-3" /> S&P 500 benchmark
                </div>
              </CardContent>
            </Card>

            {/* What-If Scenario */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-[15px]">Stress Test — What if your top holding drops 20%?</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const top = holdings[0];
                  if (!top) return <p className="text-sm text-[var(--color-text-muted)]">No holdings</p>;
                  const dropPct = 0.20;
                  const loss = top.total_value * dropPct;
                  const portfolioImpact = totalValue > 0 ? (loss / totalValue) * 100 : 0;
                  const newTotal = totalValue - loss;
                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="rounded-lg border border-[var(--color-border-subtle)] p-4">
                        <div className="font-mono text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">Position</div>
                        <div className="text-[18px] font-bold text-[var(--color-gold)] mt-1" style={{ fontFamily: 'var(--font-mono)' }}>{top.ticker}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--color-negative)]/20 bg-[var(--color-negative)]/[0.03] p-4">
                        <div className="font-mono text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">Loss at -20%</div>
                        <div className="text-[18px] font-bold text-[var(--color-negative)] mt-1" style={{ fontFamily: 'var(--font-mono)' }}>-{formatCurrency(loss)}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--color-negative)]/20 bg-[var(--color-negative)]/[0.03] p-4">
                        <div className="font-mono text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">Portfolio Impact</div>
                        <div className="text-[18px] font-bold text-[var(--color-negative)] mt-1" style={{ fontFamily: 'var(--font-mono)' }}>-{portfolioImpact.toFixed(1)}%</div>
                      </div>
                      <div className="rounded-lg border border-[var(--color-border-subtle)] p-4">
                        <div className="font-mono text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase">New Total</div>
                        <div className="text-[18px] font-bold text-[var(--color-text-primary)] mt-1" style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(newTotal)}</div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </>
          )}

          {/* ---- Legacy PortfolioMonitor (hidden, keeps data flow) ---- */}
          <div className="hidden">
            <PortfolioMonitor holdings={transformedHoldings} />
          </div>
        </div>

        {/* ======================================================= */}
        {/*  RIGHT SIDEBAR                                           */}
        {/* ======================================================= */}
        <aside className="hidden lg:block w-[420px] flex-shrink-0">
          <div className="sticky top-20 space-y-4">
            <MarketIntelligence
              holdings={transformedHoldings}
              className="max-h-[calc(100vh-12rem)] flex flex-col"
            />
            {holdings.length > 0 && (
              <StressTest holdings={holdings} totalValue={totalValue} formatCurrency={formatCurrency} />
            )}
          </div>
        </aside>
      </div>

      {/* Disclaimer */}
      <p className="font-mono text-[10px] text-[var(--color-text-muted)] mt-6 text-center">
        Prices may be delayed up to 60 seconds. Not intended for active trading.
      </p>
    </div>
  );
}

/* ── Concentration Table with Search + Pagination ── */

function ConcentrationTable({ holdings, formatCurrency }: {
  holdings: { id: string; ticker: string; portfolio_allocation: number; total_value: number; asset_name: string }[];
  formatCurrency: (n: number) => string;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PER_PAGE = 10;

  const sorted = useMemo(() =>
    [...holdings].sort((a, b) => b.portfolio_allocation - a.portfolio_allocation),
    [holdings]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const terms = search.toUpperCase().split(',').map(s => s.trim()).filter(Boolean);
    return sorted.filter(h => terms.some(t => h.ticker.includes(t) || h.asset_name.toUpperCase().includes(t)));
  }, [sorted, search]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageItems = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[15px]">Single-Name Risk</CardTitle>
            <p className="text-[12px] text-[var(--color-text-muted)] font-mono mt-1">
              Red {'>'} 25% · Yellow {'>'} 10% · Search by ticker (comma-separated)
            </p>
          </div>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="AAPL, NVDA, MSFT..."
            className="w-48 px-3 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {pageItems.map((h) => {
            const alloc = h.portfolio_allocation;
            const barColor = alloc > 25 ? 'var(--color-negative)' : alloc > 10 ? 'var(--color-warning-text)' : 'var(--color-gold)';
            const textColor = alloc > 25 ? 'text-[var(--color-negative)]' : alloc > 10 ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-text-primary)]';
            return (
              <Link
                key={h.id}
                href={`/dashboard/holdings/${h.ticker}`}
                className="flex items-center gap-3 py-2.5 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-overlay)] transition-colors rounded px-1 -mx-1 group"
              >
                <span className="font-mono text-[14px] font-bold text-[var(--color-gold)] group-hover:text-[var(--color-gold-hi)] w-16 shrink-0">{h.ticker}</span>
                <div className="flex-1 min-w-0">
                  <div className="h-2.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, alloc)}%`, backgroundColor: barColor }} />
                  </div>
                </div>
                <span className={`font-mono text-[14px] font-bold tabular-nums w-16 text-right ${textColor}`}>
                  {alloc.toFixed(1)}%
                </span>
                <span className="font-mono text-[12px] text-[var(--color-text-muted)] tabular-nums w-24 text-right">
                  {formatCurrency(h.total_value)}
                </span>
              </Link>
            );
          })}
          {pageItems.length === 0 && (
            <p className="text-[13px] text-[var(--color-text-muted)] py-4 text-center">No holdings match &quot;{search}&quot;</p>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--color-border-subtle)]">
            <span className="text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
              {filtered.length} holdings · page {page + 1}/{totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-[12px] rounded border border-[var(--color-border-base)] text-[var(--color-text-secondary)] disabled:opacity-30 hover:border-[var(--color-border-strong)] transition-colors"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 text-[12px] rounded border border-[var(--color-border-base)] text-[var(--color-text-secondary)] disabled:opacity-30 hover:border-[var(--color-border-strong)] transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Stress Test / Scenario Analysis ── */

function StressTest({ holdings, totalValue, formatCurrency }: {
  holdings: { ticker: string; total_value: number; portfolio_allocation: number; asset_name: string; sector?: string }[];
  totalValue: number;
  formatCurrency: (n: number) => string;
}) {
  const [mode, setMode] = useState<'ticker' | 'sector'>('ticker');
  const [selectedTicker, setSelectedTicker] = useState(holdings[0]?.ticker ?? '');
  const [selectedSector, setSelectedSector] = useState('');
  const [dropPct, setDropPct] = useState(10);
  const [open, setOpen] = useState(false);

  const sectors = useMemo(() => {
    const map = new Map<string, { value: number; tickers: string[] }>();
    for (const h of holdings) {
      const s = h.sector || 'Other';
      const existing = map.get(s) || { value: 0, tickers: [] };
      existing.value += h.total_value;
      existing.tickers.push(h.ticker);
      map.set(s, existing);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].value - a[1].value);
  }, [holdings]);

  useEffect(() => {
    if (sectors.length > 0 && !selectedSector) setSelectedSector(sectors[0][0]);
  }, [sectors, selectedSector]);

  const impact = useMemo(() => {
    if (mode === 'ticker') {
      const h = holdings.find(x => x.ticker === selectedTicker);
      if (!h) return null;
      const loss = h.total_value * (dropPct / 100);
      return {
        label: `${selectedTicker} drops ${dropPct}%`,
        loss,
        newTotal: totalValue - loss,
        portfolioImpactPct: (loss / totalValue) * 100,
        weight: h.portfolio_allocation,
      };
    } else {
      const sector = sectors.find(([s]) => s === selectedSector);
      if (!sector) return null;
      const loss = sector[1].value * (dropPct / 100);
      return {
        label: `${selectedSector} sector drops ${dropPct}%`,
        loss,
        newTotal: totalValue - loss,
        portfolioImpactPct: (loss / totalValue) * 100,
        weight: (sector[1].value / totalValue) * 100,
        tickers: sector[1].tickers,
      };
    }
  }, [mode, selectedTicker, selectedSector, dropPct, holdings, sectors, totalValue]);

  return (
    <div className="border border-[var(--color-border-base)] rounded-md bg-[var(--color-bg-surface)] overflow-hidden">
      {/* Header — collapsible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--color-bg-elevated)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Scenario Analysis</span>
          <span className="font-mono text-[9px] text-[var(--color-gold)] tracking-wider uppercase">Beta</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-border-subtle)]">
          {/* Mode toggle */}
          <div className="flex gap-1.5 pt-3">
            <button
              onClick={() => setMode('ticker')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${mode === 'ticker' ? 'bg-[var(--color-gold)] text-black' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'}`}
            >
              Ticker
            </button>
            <button
              onClick={() => setMode('sector')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${mode === 'sector' ? 'bg-[var(--color-gold)] text-black' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'}`}
            >
              Sector
            </button>
          </div>

          {/* Selectors — stacked for sidebar */}
          <div className="space-y-2">
            {mode === 'ticker' ? (
              <select
                value={selectedTicker}
                onChange={e => setSelectedTicker(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] text-[12px] text-[var(--color-text-primary)] font-mono"
              >
                {holdings.sort((a, b) => b.total_value - a.total_value).map(h => (
                  <option key={h.ticker} value={h.ticker}>{h.ticker}</option>
                ))}
              </select>
            ) : (
              <select
                value={selectedSector}
                onChange={e => setSelectedSector(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] text-[12px] text-[var(--color-text-primary)] font-mono"
              >
                {sectors.map(([s]) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--color-text-muted)] font-mono">if it drops</span>
              <select
                value={dropPct}
                onChange={e => setDropPct(Number(e.target.value))}
                className="flex-1 px-2.5 py-1.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] text-[12px] text-[var(--color-negative)] font-mono font-bold"
              >
                {[5, 10, 15, 20, 25, 30, 40, 50].map(p => (
                  <option key={p} value={p}>-{p}%</option>
                ))}
              </select>
            </div>
          </div>

          {/* Results — vertical rows for sidebar */}
          {impact && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between items-baseline py-1.5 border-b border-[var(--color-border-subtle)]">
                <span className="font-mono text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Impact</span>
                <span className="font-mono text-[14px] font-bold text-[var(--color-negative)]">-{impact.portfolioImpactPct.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-baseline py-1.5 border-b border-[var(--color-border-subtle)]">
                <span className="font-mono text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Loss</span>
                <span className="font-mono text-[14px] font-bold text-[var(--color-negative)]">-{formatCurrency(impact.loss)}</span>
              </div>
              <div className="flex justify-between items-baseline py-1.5 border-b border-[var(--color-border-subtle)]">
                <span className="font-mono text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">New Total</span>
                <span className="font-mono text-[14px] font-bold text-[var(--color-text-primary)]">{formatCurrency(impact.newTotal)}</span>
              </div>
              <div className="flex justify-between items-baseline py-1.5">
                <span className="font-mono text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Weight</span>
                <span className="font-mono text-[14px] font-bold text-[var(--color-text-primary)]">{impact.weight.toFixed(1)}%</span>
              </div>
            </div>
          )}

          <p className="font-mono text-[9px] text-[var(--color-text-muted)]">
            Hypothetical. Does not account for correlations.
          </p>
        </div>
      )}
    </div>
  );
}
