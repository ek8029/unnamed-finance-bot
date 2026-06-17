'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PortfolioMonitor } from '@/components/dashboard/portfolio-monitor';
import { PortfolioAllocation } from '@/components/dashboard/portfolio-allocation';
import { MarketIntelligence } from '@/components/portfolio/market-intelligence';
import { useHoldings, useTaxData } from '@/hooks/use-financial-data';
import { CompanyLogo } from '@/components/company-logo';
import { TrendingUp, TrendingDown, Filter, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFormat } from '@/hooks/use-format';
import { computePortfolioLookthrough } from '@/lib/etf-holdings';
import { CONCENTRATION_THRESHOLDS } from '@/lib/financial-config';
import { ScrollHint } from '@/components/ui/scroll-hint';
import { PriceFlash } from '@/components/price-flash';
import { Fragment } from 'react';
import { WhyIOwnThis } from '@/components/thesis/why-i-own-this';
import { useThesisEnabled } from '@/lib/use-thesis-access';
import { summarizePillars, type ThesisSummary } from '@/lib/thesis-summary';

/* ------------------------------------------------------------------ */
/*  CSV download helper                                                */
/* ------------------------------------------------------------------ */
function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  return <CompanyLogo ticker={ticker} size={32} shape="rounded" />;
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
    () => holdings.reduce((sum, h) => sum + ((h.cost_basis ?? 0) * h.shares), 0),
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

  /* ---------- look-through exposure ---------- */
  const lookthrough = useMemo(() => {
    if (holdings.length === 0 || totalValue <= 0) return [];
    const holdingsInput = holdings.map(h => ({ ticker: h.ticker, totalValue: h.total_value }));
    const exposureMap = computePortfolioLookthrough(holdingsInput, totalValue);
    const entries = Array.from(exposureMap.entries())
      .map(([ticker, data]) => ({ ticker, ...data }))
      .filter(e => e.indirectWeight > 0 || e.totalWeight > CONCENTRATION_THRESHOLDS.medium)
      .sort((a, b) => b.totalWeight - a.totalWeight);
    return entries;
  }, [holdings, totalValue]);

  const hasIndirectExposure = useMemo(() => lookthrough.some(e => e.indirectWeight > 0), [lookthrough]);

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
        case 'avgCost': return dir * ((a.cost_basis ?? 0) - (b.cost_basis ?? 0));
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

  /* ---------- positions sub-tab ---------- */
  const [positionsView, setPositionsView] = useState<'positions' | 'exposure'>('positions');

  /* ---------- filter ---------- */
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSectors, setFilterSectors] = useState<Set<string>>(new Set());
  const [filterAssetClasses, setFilterAssetClasses] = useState<Set<string>>(new Set());
  const [filterSources, setFilterSources] = useState<Set<string>>(new Set());
  const thesisEnabled = useThesisEnabled();
  const [thesisSummaries, setThesisSummaries] = useState<Record<string, ThesisSummary>>({});
  const [expandedThesisTicker, setExpandedThesisTicker] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const thesisMountedRef = useRef(true);
  useEffect(() => {
    thesisMountedRef.current = true;
    return () => { thesisMountedRef.current = false; };
  }, []);

  const refreshThesisSummaries = useCallback(async () => {
    try {
      const res = await fetch('/api/thesis');
      if (!res.ok || !thesisMountedRef.current) return;
      const data = await res.json() as { theses: { ticker: string; pillars: Parameters<typeof summarizePillars>[0] }[] };
      if (!thesisMountedRef.current) return;
      const map: Record<string, ThesisSummary> = {};
      for (const t of data.theses) map[t.ticker] = summarizePillars(t.pillars);
      setThesisSummaries(map);
    } catch { /* column degrades to seed CTA */ }
  }, []);

  useEffect(() => {
    if (thesisEnabled) refreshThesisSummaries();
  }, [refreshThesisSummaries, thesisEnabled]);

  // Close filter on click outside
  useEffect(() => {
    if (!filterOpen) return;
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [filterOpen]);

  const sectors = useMemo(() => [...new Set(holdings.map(h => h.sector).filter(Boolean))].sort() as string[], [holdings]);
  const assetClasses = useMemo(() => [...new Set(holdings.map(h => h.asset_class).filter(Boolean))].sort() as string[], [holdings]);
  const exposureSources = useMemo(() => {
    const s = new Set<string>();
    lookthrough.forEach(e => e.sources.forEach(src => { if (src !== 'Direct') s.add(src); }));
    return [...s].sort();
  }, [lookthrough]);

  const hasActiveFilter = filterSectors.size > 0 || filterAssetClasses.size > 0 || filterSources.size > 0;
  const activeFilterCount = filterSectors.size + filterAssetClasses.size + filterSources.size;

  const toggleFilter = (set: Set<string>, setFn: (s: Set<string>) => void, val: string) => {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    setFn(next);
  };

  const clearAllFilters = () => { setFilterSectors(new Set()); setFilterAssetClasses(new Set()); setFilterSources(new Set()); };

  const filteredPositions = useMemo(() => {
    let result = sortedPositions;
    if (filterSectors.size > 0) result = result.filter(h => h.sector && filterSectors.has(h.sector));
    if (filterAssetClasses.size > 0) result = result.filter(h => h.asset_class && filterAssetClasses.has(h.asset_class));
    return result;
  }, [sortedPositions, filterSectors, filterAssetClasses]);

  const filteredLookthrough = useMemo(() => {
    if (filterSources.size === 0) return lookthrough;
    return lookthrough.filter(e => e.sources.some(s => filterSources.has(s)));
  }, [lookthrough, filterSources]);

  /* ---------- export CSV ---------- */
  const handleExportCSV = useCallback(() => {
    const source = positionsView === 'exposure' && hasIndirectExposure ? filteredLookthrough : null;
    if (source) {
      const rows = [
        ['Ticker', 'Direct %', 'Indirect %', 'Total %', 'Sources'].join(','),
        ...source.map(e =>
          [e.ticker, e.directWeight.toFixed(2), e.indirectWeight.toFixed(2), e.totalWeight.toFixed(2), `"${e.sources.join('; ')}"`].join(',')
        ),
      ];
      downloadCSV(rows.join('\n'), 'helm-true-exposure.csv');
    } else {
      const data = filteredPositions;
      const rows = [
        ['Ticker', 'Name', 'Shares', 'Avg Cost', 'Price', 'Day Change %', 'Value', 'Allocation %', 'Unrealized P/L', 'Sector'].join(','),
        ...data.map(h =>
          [
            h.ticker,
            `"${h.asset_name}"`,
            h.shares,
            (h.cost_basis ?? 0).toFixed(2),
            h.current_price.toFixed(2),
            (h.day_change_percentage ?? 0).toFixed(2),
            h.total_value.toFixed(2),
            h.portfolio_allocation.toFixed(2),
            (h.unrealised_gain ?? 0).toFixed(2),
            h.sector || '',
          ].join(',')
        ),
      ];
      downloadCSV(rows.join('\n'), 'helm-positions.csv');
    }
  }, [positionsView, hasIndirectExposure, filteredLookthrough, filteredPositions]);

  /* ---------- header tab state (visual only) ---------- */
  const tabs = ['Portfolio', 'Concentration'] as const;
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('Portfolio');

  /* ================================================================ */
  /*  EARLY RETURNS                                                    */
  /* ================================================================ */
  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="container mx-auto px-4 py-4 sm:p-6 max-w-[1600px]">
        <div className="bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 text-[var(--color-negative)] p-4 sm:p-6 rounded-xl">
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
    <div className="container mx-auto px-4 py-4 sm:py-6 max-w-[1600px]">
      <div className="flex lg:gap-6">
        {/* ======================================================= */}
        {/*  MAIN CONTENT                                            */}
        {/* ======================================================= */}
        <div className="flex-1 min-w-0 space-y-4 sm:space-y-6">

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
          <div className="space-y-3 sm:space-y-4">
            {/* Portfolio value — always full width */}
            <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-4 sm:p-5">
              <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-1">
                Portfolio value
              </span>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono tabular-nums font-semibold text-[var(--color-text-primary)] leading-none text-3xl sm:text-4xl lg:text-[52px]">
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

            {/* Unrealized P/L + Day Change — side by side, each gets half */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-4 sm:p-5">
                <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-1">
                  Unrealized P/L
                </span>
                <span className={`block font-mono tabular-nums text-xl sm:text-2xl font-semibold leading-tight ${
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

              <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg p-4 sm:p-5">
                <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-1">
                  Day Change
                </span>
                <span className={`block font-mono tabular-nums text-xl sm:text-2xl font-semibold leading-tight ${
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <TrendingDown className="w-4 h-4 text-[var(--color-gold)] shrink-0" />
                    <div>
                      <span className="text-[13px] sm:text-sm font-medium text-[var(--color-text-primary)]">
                        {formatCurrency(harvestable)} in harvestable losses
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-2 hidden sm:inline">
                        across {underwater.length} position{underwater.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/tools/tlh-calculator?${calcParams.toString()}`}
                    className="text-xs font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors ml-7 sm:ml-0"
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
          <div className="lg:hidden space-y-4">

            {/* ── Mobile Value Header ── */}
            <div className="px-1">
              <div className="flex items-baseline gap-1">
                <span className="text-[20px] sm:text-[34px] font-bold tabular-nums text-[var(--color-text-primary)] leading-none">
                  {formatCurrency(totalValue).replace(/\.\d+$/, '')}
                </span>
                <span className="text-[16px] sm:text-[20px] text-[var(--color-text-muted)] tabular-nums leading-none">
                  .{(totalValue % 1).toFixed(2).slice(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`font-mono text-[11px] sm:text-[13px] font-bold tabular-nums ${
                  totalDayChange >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                }`}>
                  {totalDayChange >= 0 ? '+' : ''}{formatCurrency(totalDayChange)} ({dayChangePercentage >= 0 ? '+' : ''}{dayChangePercentage.toFixed(2)}%)
                </span>
                <span className="font-mono text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider">today</span>
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

            {/* ── Mobile Positions Header with Toggle ── */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                {hasIndirectExposure ? (
                  <div className="flex items-center gap-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-0.5">
                    <button
                      onClick={() => setPositionsView('positions')}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${positionsView === 'positions' ? 'bg-[var(--color-gold)] text-black' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                    >
                      Positions
                    </button>
                    <button
                      onClick={() => setPositionsView('exposure')}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${positionsView === 'exposure' ? 'bg-[var(--color-gold)] text-black' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                    >
                      True Exposure
                    </button>
                  </div>
                ) : (
                  <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Positions</h2>
                )}
                <span className="font-mono text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5">
                  {positionsView === 'positions' ? holdings.length : lookthrough.length}
                </span>
              </div>
            </div>

            {/* ── Mobile Position Cards / True Exposure ── */}
            {positionsView === 'exposure' && hasIndirectExposure ? (
              <TrueExposureSection
                lookthrough={lookthrough}
                open={true}
                onToggle={() => {}}
                formatCurrency={formatCurrency}
              />
            ) : (
            <div className="space-y-2">
            {filteredPositions.map((h) => {
              const dayPct = h.day_change_percentage ?? 0;
              const sparkPath = generateSparklinePath(h.ticker);
              const sparkTrend = dayPct >= 0;
              return (
                <Link
                  key={h.id}
                  href={`/dashboard/holdings/${h.ticker}`}
                  className="block p-3.5 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl active:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  <div className="grid grid-cols-[32px_1fr_auto] gap-1.5 sm:gap-3 items-center">
                    <TickerIcon ticker={h.ticker} />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1.5 sm:gap-2">
                        <span className="font-mono text-[13px] sm:text-[14px] font-bold tracking-wide text-[var(--color-text-primary)]">
                          {h.ticker}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-[var(--color-text-muted)] truncate">
                          {h.shares} sh &middot; <PriceFlash value={h.current_price}>${h.current_price.toFixed(2)}</PriceFlash>
                        </span>
                      </div>
                      <div className="text-[11px] sm:text-[12px] text-[var(--color-text-muted)] mt-0.5 truncate">
                        {h.asset_name}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-0.5 sm:gap-1">
                      <div className="font-mono text-[12px] sm:text-[13px] font-bold tabular-nums text-[var(--color-text-primary)]">
                        {h.total_value >= 1000 ? `$${(h.total_value / 1000).toFixed(1)}k` : formatCurrency(h.total_value)}
                      </div>
                      <svg width="40" height="14" viewBox="0 0 80 24" fill="none" className="block sm:hidden">
                        <path d={sparkPath} stroke={sparkTrend ? 'var(--color-positive)' : 'var(--color-negative)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                      <svg width="48" height="16" viewBox="0 0 80 24" fill="none" className="hidden sm:block">
                        <path d={sparkPath} stroke={sparkTrend ? 'var(--color-positive)' : 'var(--color-negative)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
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
            )}

            {/* ── Mobile Market Intelligence ── */}
            {holdings.length > 0 && (
              <div className="mt-4 space-y-4">
                <MarketIntelligence
                  holdings={transformedHoldings}
                  className="max-h-none"
                />
                <StressTest holdings={holdings} totalValue={totalValue} formatCurrency={formatCurrency} />
              </div>
            )}
          </div>

          {/* ── Desktop: Table view ── */}
          <div className="hidden lg:block border border-[var(--color-border-base)] rounded-lg overflow-hidden bg-[var(--color-bg-surface)]">
            {/* Table header bar */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-3">
                {hasIndirectExposure ? (
                  <div className="flex items-center gap-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-0.5">
                    <button
                      onClick={() => setPositionsView('positions')}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${positionsView === 'positions' ? 'bg-[var(--color-gold)] text-black' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                    >
                      Positions
                    </button>
                    <button
                      onClick={() => setPositionsView('exposure')}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${positionsView === 'exposure' ? 'bg-[var(--color-gold)] text-black' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
                    >
                      True Exposure
                    </button>
                  </div>
                ) : (
                  <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Positions</h2>
                )}
                <span className="font-mono text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded px-1.5 py-0.5">
                  {positionsView === 'positions' ? holdings.length : lookthrough.length}
                </span>
                {positionsView === 'positions' && (
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                    sorted by {sortKey} {sortDir}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative" ref={filterRef}>
                  <button
                    onClick={() => setFilterOpen(f => !f)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium border rounded-md transition-colors cursor-pointer ${
                      hasActiveFilter
                        ? 'text-[var(--color-gold)] border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]'
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </button>
                  {filterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-lg shadow-xl overflow-hidden">
                      <div className="px-3 py-2.5 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">Filters</span>
                        {hasActiveFilter && (
                          <button onClick={clearAllFilters} className="text-[10px] font-mono text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors cursor-pointer">
                            Clear all
                          </button>
                        )}
                      </div>
                      <div className="p-3 space-y-3 max-h-[320px] overflow-y-auto">
                        {/* Sector chips */}
                        {sectors.length > 0 && (
                          <div>
                            <label className="block font-mono text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Sector</label>
                            <div className="flex flex-wrap gap-1.5">
                              {sectors.map(s => (
                                <button
                                  key={s}
                                  onClick={() => toggleFilter(filterSectors, setFilterSectors, s)}
                                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border ${
                                    filterSectors.has(s)
                                      ? 'bg-[var(--color-gold)]/15 border-[var(--color-gold)]/40 text-[var(--color-gold)]'
                                      : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-base)]'
                                  }`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Asset class chips */}
                        {assetClasses.length > 1 && (
                          <div>
                            <label className="block font-mono text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Asset Class</label>
                            <div className="flex flex-wrap gap-1.5">
                              {assetClasses.map(c => (
                                <button
                                  key={c}
                                  onClick={() => toggleFilter(filterAssetClasses, setFilterAssetClasses, c)}
                                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border ${
                                    filterAssetClasses.has(c)
                                      ? 'bg-[var(--color-gold)]/15 border-[var(--color-gold)]/40 text-[var(--color-gold)]'
                                      : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-base)]'
                                  }`}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Source ETF chips (True Exposure) */}
                        {positionsView === 'exposure' && exposureSources.length > 0 && (
                          <div>
                            <label className="block font-mono text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] mb-2">Source ETF</label>
                            <div className="flex flex-wrap gap-1.5">
                              {exposureSources.map(s => (
                                <button
                                  key={s}
                                  onClick={() => toggleFilter(filterSources, setFilterSources, s)}
                                  className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border ${
                                    filterSources.has(s)
                                      ? 'bg-[var(--color-gold)]/15 border-[var(--color-gold)]/40 text-[var(--color-gold)]'
                                      : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-base)]'
                                  }`}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] rounded-md bg-[var(--color-bg-elevated)] transition-colors cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Export
                </button>
              </div>
            </div>

            {/* Active filter pills */}
            {hasActiveFilter && (
              <div className="flex items-center gap-1.5 flex-wrap px-5 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/30">
                {[...filterSectors].map(s => (
                  <span key={`s-${s}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-gold)]/10 text-[var(--color-gold)] border border-[var(--color-gold)]/20">
                    {s}
                    <button onClick={() => toggleFilter(filterSectors, setFilterSectors, s)} className="hover:text-[var(--color-text-primary)] transition-colors cursor-pointer ml-0.5">×</button>
                  </span>
                ))}
                {[...filterAssetClasses].map(c => (
                  <span key={`a-${c}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-gold)]/10 text-[var(--color-gold)] border border-[var(--color-gold)]/20">
                    {c}
                    <button onClick={() => toggleFilter(filterAssetClasses, setFilterAssetClasses, c)} className="hover:text-[var(--color-text-primary)] transition-colors cursor-pointer ml-0.5">×</button>
                  </span>
                ))}
                {[...filterSources].map(s => (
                  <span key={`src-${s}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--color-gold)]/10 text-[var(--color-gold)] border border-[var(--color-gold)]/20">
                    {s}
                    <button onClick={() => toggleFilter(filterSources, setFilterSources, s)} className="hover:text-[var(--color-text-primary)] transition-colors cursor-pointer ml-0.5">×</button>
                  </span>
                ))}
                <button onClick={clearAllFilters} className="text-[10px] font-mono text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors cursor-pointer ml-1">
                  Clear all
                </button>
              </div>
            )}

            {/* Table or True Exposure */}
            {positionsView === 'exposure' && hasIndirectExposure ? (
              <div className="p-4">
                <TrueExposureSection
                  lookthrough={filteredLookthrough}
                  open={true}
                  onToggle={() => {}}
                  formatCurrency={formatCurrency}
                />
              </div>
            ) : (<>
            <ScrollHint>
              <table className="w-full min-w-[1060px]">
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
                    {thesisEnabled && (
                    <th className="text-left px-2 py-2.5 w-[120px]">
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Thesis</span>
                    </th>
                    )}
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
                  {filteredPositions.map((h, idx) => {
                    const avgCost = h.cost_basis ?? 0;
                    const dayPct = h.day_change_percentage ?? 0;
                    const pl = h.unrealised_gain ?? 0;
                    const allocPct = h.portfolio_allocation;
                    const sparkPath = generateSparklinePath(h.ticker);
                    const sparkTrend = dayPct >= 0;

                    return (
                      <Fragment key={h.id}>
                      <tr
                        className={`h-16 border-b border-[var(--color-border-subtle)] ${
                          idx % 2 === 1 ? 'bg-[var(--color-bg-elevated)]/20' : ''
                        }`}
                      >
                        {/* SYMBOL */}
                        <td className="pl-5 pr-2 py-2">
                          <Link href={`/dashboard/holdings/${h.ticker}`} className="flex items-center gap-2.5 group rounded hover:bg-[var(--color-bg-elevated)]/50 -mx-1.5 px-1.5 py-1 transition-colors">
                            <TickerIcon ticker={h.ticker} />
                            <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors">
                              {h.ticker}
                            </span>
                          </Link>
                        </td>
                        {/* NAME + sector */}
                        <td className="px-2 py-2">
                          <Link href={`/dashboard/holdings/${h.ticker}`} className="flex flex-col group rounded hover:bg-[var(--color-bg-elevated)]/50 -mx-1.5 px-1.5 py-1 transition-colors">
                            <span className="text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] truncate max-w-[180px] transition-colors">
                              {h.asset_name}
                            </span>
                            {h.sector && (
                              <span className="font-mono text-[10px] text-[var(--color-text-muted)] truncate">
                                {h.sector}
                              </span>
                            )}
                          </Link>
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
                          <PriceFlash value={h.current_price} className="font-mono text-sm tabular-nums text-[var(--color-text-primary)]">
                            {formatCurrencyDetailed(h.current_price)}
                          </PriceFlash>
                        </td>
                        {/* DAY % */}
                        <td className="px-2 py-2 text-right">
                          <span className={`font-mono text-sm tabular-nums ${
                            dayPct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                          }`}>
                            {dayPct >= 0 ? '+' : ''}{dayPct.toFixed(2)}%
                          </span>
                        </td>
                        {/* THESIS (allowlisted only while unlaunched) */}
                        {thesisEnabled && (
                        <td className="px-2 py-2">
                          {(() => {
                            const s = thesisSummaries[h.ticker];
                            const open = expandedThesisTicker === h.ticker;
                            const toggle = () => {
                              if (open) { setExpandedThesisTicker(null); refreshThesisSummaries(); }
                              else setExpandedThesisTicker(h.ticker);
                            };
                            const STATUS_COLORS: Record<string, string> = {
                              intact: 'var(--color-positive)', weakening: 'var(--color-gold)',
                              broken: 'var(--color-negative)', unverified: 'var(--color-text-muted)',
                            };
                            if (s && s.confirmedCount > 0) {
                              const segments = (['broken', 'weakening', 'unverified', 'intact'] as const)
                                .flatMap((st) => Array.from({ length: s.statusCounts[st] }, () => STATUS_COLORS[st]));
                              return (
                                <button onClick={toggle} className="group/th flex flex-col gap-1 w-full text-left rounded hover:bg-[var(--color-bg-elevated)]/50 -mx-1.5 px-1.5 py-1 transition-colors" aria-expanded={open}>
                                  <span className="flex gap-0.5 h-[3px] w-[72px]">
                                    {segments.map((c, i) => (
                                      <span key={i} className="flex-1 rounded-full" style={{ background: c }} />
                                    ))}
                                  </span>
                                  <span className="font-mono text-[10px] tracking-[0.04em]" style={{ color: s.statusCounts.broken > 0 ? STATUS_COLORS.broken : s.statusCounts.weakening > 0 ? STATUS_COLORS.weakening : s.statusCounts.intact > 0 ? STATUS_COLORS.intact : 'var(--color-text-muted)' }}>
                                    {s.statusCounts.intact} of {s.confirmedCount} intact
                                    {s.statusCounts.broken > 0 ? ` · ${s.statusCounts.broken} broken` : s.statusCounts.weakening > 0 ? ` · ${s.statusCounts.weakening} weakening` : ''}
                                  </span>
                                </button>
                              );
                            }
                            if (s && s.draftCount > 0) {
                              return (
                                <button onClick={toggle} className="font-mono text-[10px] text-[var(--color-gold)] rounded hover:bg-[var(--color-bg-elevated)]/50 -mx-1.5 px-1.5 py-1 transition-colors" aria-expanded={open}>
                                  Review {s.draftCount} draft{s.draftCount === 1 ? '' : 's'}
                                </button>
                              );
                            }
                            return (
                              <button onClick={toggle} className="font-mono text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] rounded -mx-1.5 px-1.5 py-1 transition-colors" aria-expanded={open}>
                                + Thesis
                              </button>
                            );
                          })()}
                        </td>
                        )}
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
                      {thesisEnabled && expandedThesisTicker === h.ticker && (
                        <tr className="border-b border-[var(--color-border-subtle)]">
                          <td colSpan={11} className="px-5 py-4 bg-[var(--color-bg-elevated)]/30">
                            <div className="max-w-[760px]">
                              <WhyIOwnThis ticker={h.ticker} />
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </ScrollHint>

            {/* Table footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/40">
              <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                Showing {filteredPositions.length} of {holdings.length} positions
              </span>
              <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                Total value: <span className="text-[var(--color-text-primary)] font-medium">{formatCurrency(totalValue)}</span>
              </span>
            </div>
            </>)}
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

              // Use look-through for true concentration metrics
              const lt = computePortfolioLookthrough(
                holdings.map(h => ({ ticker: h.ticker, totalValue: h.total_value })),
                totalVal,
              );
              const ltEntries = [...lt.entries()].sort((a, b) => b[1].totalWeight - a[1].totalWeight);
              const ltWeights = ltEntries.map(([, e]) => e.totalWeight / 100);
              const topTicker = ltEntries[0]?.[0] ?? '—';
              const topWeight = ltWeights[0] ?? 0;

              // HHI on look-through weights (true diversification)
              const hhi = ltWeights.reduce((s, w) => s + w * w, 0);
              const diversificationScore = Math.round((1 - hhi) * 100);
              const effectivePositions = Math.round(1 / (hhi || 1));
              const scoreColor = diversificationScore >= 70 ? 'var(--color-positive)' : diversificationScore >= 40 ? 'var(--color-warning-text)' : 'var(--color-negative)';

              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                  <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
                    <div className="font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-2">Diversification Score</div>
                    <div className="text-[28px] sm:text-[40px] font-bold tabular-nums" style={{ color: scoreColor, fontFamily: 'var(--font-mono)' }}>{diversificationScore}</div>
                    <div className="text-[13px] text-[var(--color-text-muted)] mt-1">out of 100 (look-through)</div>
                    <div className="mt-3 h-2 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${diversificationScore}%`, backgroundColor: scoreColor }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
                    <div className="font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-2">Effective Positions</div>
                    <div className="text-[28px] sm:text-[40px] font-bold tabular-nums text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-mono)' }}>{effectivePositions}</div>
                    <div className="text-[13px] text-[var(--color-text-muted)] mt-1">of {ltEntries.length} underlying names</div>
                    <div className="text-[12px] text-[var(--color-text-muted)] mt-2" style={{ fontFamily: 'var(--font-mono)' }}>
                      HHI: {(hhi * 10000).toFixed(0)} / 10,000
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] p-5">
                    <div className="font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-2">Top Exposure (Look-Through)</div>
                    <div className="text-[28px] sm:text-[40px] font-bold tabular-nums" style={{ color: topWeight > 0.25 ? 'var(--color-negative)' : 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {(topWeight * 100).toFixed(1)}%
                    </div>
                    <div className="text-[13px] text-[var(--color-text-muted)] mt-1">{topTicker}</div>
                    <div className="text-[12px] text-[var(--color-text-muted)] mt-2">
                      {topWeight > 0.25 ? '⚠ Exceeds 25% single-name threshold' : '✓ Within concentration limits'}
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

  // Compute look-through: aggregate direct + indirect exposure per underlying ticker
  const totalPortfolioValue = useMemo(() => holdings.reduce((s, h) => s + h.total_value, 0), [holdings]);
  const lookthroughData = useMemo(() => {
    const lt = computePortfolioLookthrough(
      holdings.map(h => ({ ticker: h.ticker, totalValue: h.total_value })),
      totalPortfolioValue,
    );
    // Merge: keep direct holdings, overlay with look-through totals
    const merged = new Map<string, { ticker: string; totalWeight: number; directWeight: number; indirectWeight: number; value: number; name: string; sources: string[] }>();
    // Add direct holdings
    for (const h of holdings) {
      const upper = h.ticker.toUpperCase();
      const ltEntry = lt.get(upper);
      if (!ltEntry) {
        merged.set(upper, { ticker: h.ticker, totalWeight: h.portfolio_allocation, directWeight: h.portfolio_allocation, indirectWeight: 0, value: h.total_value, name: h.asset_name, sources: ['Direct'] });
      }
    }
    // Add/merge look-through entries
    for (const [ticker, entry] of lt) {
      const existing = merged.get(ticker);
      if (existing) {
        existing.totalWeight = entry.totalWeight;
        existing.directWeight = entry.directWeight;
        existing.indirectWeight = entry.indirectWeight;
        existing.sources = entry.sources;
      } else {
        merged.set(ticker, { ticker, totalWeight: entry.totalWeight, directWeight: entry.directWeight, indirectWeight: entry.indirectWeight, value: (entry.totalWeight / 100) * totalPortfolioValue, name: ticker, sources: entry.sources });
      }
    }
    return [...merged.values()];
  }, [holdings, totalPortfolioValue]);

  const sorted = useMemo(() =>
    [...lookthroughData].sort((a, b) => b.totalWeight - a.totalWeight),
    [lookthroughData]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return sorted;
    const terms = search.toUpperCase().split(',').map(s => s.trim()).filter(Boolean);
    return sorted.filter(h => terms.some(t => h.ticker.toUpperCase().includes(t) || h.name.toUpperCase().includes(t)));
  }, [sorted, search]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageItems = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[15px]">Single-Name Risk (Look-Through)</CardTitle>
            <p className="text-[12px] text-[var(--color-text-muted)] font-mono mt-1">
              Includes ETF and leveraged product exposure · Red {'>'} 25% · Yellow {'>'} 10% · ETF weights as of Q2 2026
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
            const alloc = h.totalWeight;
            const hasIndirect = h.indirectWeight > 0;
            const barColor = alloc > 25 ? 'var(--color-negative)' : alloc > 10 ? 'var(--color-warning-text)' : 'var(--color-gold)';
            const textColor = alloc > 25 ? 'text-[var(--color-negative)]' : alloc > 10 ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-text-primary)]';
            return (
              <div
                key={h.ticker}
                className="flex items-center gap-3 py-2.5 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-overlay)] transition-colors rounded px-1 -mx-1 group"
              >
                <span className="font-mono text-[14px] font-bold text-[var(--color-gold)] w-16 shrink-0">{h.ticker}</span>
                <div className="flex-1 min-w-0">
                  <div className="h-2.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                    {hasIndirect ? (
                      <>
                        <div className="h-full rounded-l-full float-left" style={{ width: `${Math.min(100, h.directWeight)}%`, backgroundColor: barColor }} />
                        <div className="h-full rounded-r-full float-left opacity-50" style={{ width: `${Math.min(100 - h.directWeight, h.indirectWeight)}%`, backgroundColor: barColor }} />
                      </>
                    ) : (
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, alloc)}%`, backgroundColor: barColor }} />
                    )}
                  </div>
                  {hasIndirect && (
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5 block">
                      {h.directWeight.toFixed(1)}% direct + {h.indirectWeight.toFixed(1)}% via {h.sources.filter(s => s !== 'Direct').join(', ')}
                    </span>
                  )}
                </div>
                <span className={`font-mono text-[14px] font-bold tabular-nums w-16 text-right ${textColor}`}>
                  {alloc.toFixed(1)}%
                </span>
                <span className="font-mono text-[12px] text-[var(--color-text-muted)] tabular-nums w-24 text-right">
                  {formatCurrency(h.value)}
                </span>
              </div>
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

/* ── True Exposure Section ── */

function TrueExposureSection({ lookthrough, open, onToggle, formatCurrency }: {
  lookthrough: { ticker: string; directWeight: number; indirectWeight: number; totalWeight: number; sources: string[] }[];
  open: boolean;
  onToggle: () => void;
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="border border-[var(--color-border-base)] rounded-lg overflow-hidden bg-[var(--color-bg-surface)]">
      <button
        onClick={onToggle}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[var(--color-bg-elevated)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--color-gold)]">
            True Exposure
          </span>
          <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
            {lookthrough.length} ticker{lookthrough.length !== 1 ? 's' : ''} with indirect exposure
          </span>
          <span className="font-mono text-[9px] text-[var(--color-text-muted)]/60 hidden sm:inline">
            · ETF weights as of Q2 2026
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-[var(--color-border-subtle)]">
          <ScrollHint>
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-[var(--color-bg-elevated)]/60">
                  <th className="text-left pl-4 pr-1 py-2 w-[70px]">
                    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Ticker</span>
                  </th>
                  <th className="text-right px-1 py-2 w-[72px]">
                    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Direct %</span>
                  </th>
                  <th className="text-right px-1 py-2 w-[72px]">
                    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Indirect %</span>
                  </th>
                  <th className="text-right px-1 py-2 w-[68px]">
                    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Total %</span>
                  </th>
                  <th className="text-left pl-2 pr-4 py-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Sources</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lookthrough.map((entry, idx) => {
                  const totalColor = entry.totalWeight > 25
                    ? 'text-[var(--color-negative)]'
                    : entry.totalWeight > 10
                      ? 'text-[var(--color-warning-text,var(--color-gold))]'
                      : 'text-[var(--color-text-primary)]';
                  return (
                    <tr
                      key={entry.ticker}
                      className={`border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)]/50 transition-colors ${
                        idx % 2 === 1 ? 'bg-[var(--color-bg-elevated)]/20' : ''
                      }`}
                    >
                      <td className="pl-4 pr-1 py-2">
                        <span className="font-mono text-sm font-semibold text-[var(--color-gold)]">{entry.ticker}</span>
                      </td>
                      <td className="px-1 py-2 text-right">
                        <span className="font-mono text-sm tabular-nums text-[var(--color-text-secondary)]">
                          {entry.directWeight > 0 ? `${entry.directWeight.toFixed(2)}%` : '--'}
                        </span>
                      </td>
                      <td className="px-1 py-2 text-right">
                        <span className="font-mono text-sm tabular-nums text-[var(--color-text-secondary)]">
                          {entry.indirectWeight > 0 ? `${entry.indirectWeight.toFixed(2)}%` : '--'}
                        </span>
                      </td>
                      <td className="px-1 py-2 text-right">
                        <span className={`font-mono text-sm tabular-nums font-medium ${totalColor}`}>
                          {entry.totalWeight.toFixed(2)}%
                        </span>
                      </td>
                      <td className="pl-2 pr-4 py-2">
                        <span className="font-mono text-[11px] text-[var(--color-text-muted)] truncate block max-w-[200px]">
                          {entry.sources.join(', ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollHint>
          <div className="px-5 py-2.5 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/40">
            <span className="font-mono text-[9px] text-[var(--color-text-muted)]">
              Indirect exposure via ETF holdings and leveraged products. Weights approximate based on fund prospectuses.
            </span>
          </div>
        </div>
      )}
    </div>
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
