'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BriefData {
  portfolio: {
    totalValue: number;
    overnightChange: number;
    overnightChangePct: number;
    vsBenchmark: number | null;
  };
  market: {
    spy: { price: number; changePct: number } | null;
    qqq: { price: number; changePct: number } | null;
    vix: { price: number; level: string } | null;
    treasury10y: { yield: number } | null;
  };
  movers: {
    ticker: string;
    name: string;
    sector: string;
    changePct: number;
    dollarImpact: number;
  }[];
  allHoldings: {
    ticker: string;
    name: string;
    sector: string;
    changePct: number;
    dollarImpact: number;
  }[];
  sectorHeat: {
    sector: string;
    weight: number;
    changePct: number;
    tickers: string[];
  }[];
  earningsThisWeek: {
    ticker: string;
    reportDate: string;
    portfolioWeight: number;
  }[];
  dividendsThisWeek: {
    ticker: string;
    exDate: string;
  }[];
}

const COLORS = {
  positiveStrong: 'rgba(74, 222, 128, 0.8)',
  positiveMild: 'rgba(74, 222, 128, 0.4)',
  positiveText: '#4ADE80',
  positiveTextMild: 'rgba(74, 222, 128, 0.6)',
  negativeStrong: 'rgba(239, 68, 68, 0.8)',
  negativeMild: 'rgba(239, 68, 68, 0.4)',
  negativeText: '#ef4444',
  negativeTextMild: 'rgba(239, 68, 68, 0.6)',
  neutralBar: 'rgba(255, 255, 255, 0.08)',
  neutralDot: 'rgba(255, 255, 255, 0.2)',
};

const STORAGE_PREFIX = 'helm-brief-dismissed-';

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function isDismissedToday(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${getTodayKey()}`) === '1';
  } catch {
    return false;
  }
}

function dismissToday(): void {
  try {
    const key = `${STORAGE_PREFIX}${getTodayKey()}`;
    localStorage.setItem(key, '1');
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX) && k !== key) {
        localStorage.removeItem(k);
      }
    }
  } catch {}
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function colorClass(value: number): string {
  if (value > 0) return 'text-[var(--color-positive)]';
  if (value < 0) return 'text-[var(--color-negative)]';
  return 'text-[var(--color-text-muted)]';
}

function formatEventDay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
}

function sectorBarColor(changePct: number): string {
  if (changePct > 0.5) return COLORS.positiveStrong;
  if (changePct > 0.1) return COLORS.positiveMild;
  if (changePct < -0.5) return COLORS.negativeStrong;
  if (changePct < -0.1) return COLORS.negativeMild;
  return COLORS.neutralBar;
}

function sectorDotColor(changePct: number): string {
  if (changePct > 0.5) return COLORS.positiveText;
  if (changePct > 0.1) return COLORS.positiveTextMild;
  if (changePct < -0.5) return COLORS.negativeText;
  if (changePct < -0.1) return COLORS.negativeTextMild;
  return COLORS.neutralDot;
}

function BriefSkeleton() {
  return (
    <div className="bg-[var(--color-bg-surface)] border-l-2 border-[var(--color-gold)] px-5 py-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-80 bg-[var(--color-bg-elevated)] rounded" />
        <div className="h-4 w-4 bg-[var(--color-bg-elevated)] rounded" />
      </div>
      <div className="flex gap-6">
        <div className="h-4 w-20 bg-[var(--color-bg-elevated)] rounded" />
        <div className="h-4 w-20 bg-[var(--color-bg-elevated)] rounded" />
      </div>
      <div className="h-2 w-full bg-[var(--color-bg-elevated)] rounded" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 bg-[var(--color-bg-elevated)] rounded" />
        <div className="h-16 bg-[var(--color-bg-elevated)] rounded" />
      </div>
    </div>
  );
}

export function DailyBrief() {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [collapsed, setCollapsed] = useState(() => isDismissedToday());
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchBrief() {
      try {
        const res = await fetch('/api/dashboard/brief', { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to fetch brief');
        const json = await res.json();
        if (!controller.signal.aborted) setData(json);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchBrief();
    return () => controller.abort();
  }, []);

  const handleDismiss = useCallback(() => {
    dismissToday();
    setCollapsed(true);
  }, []);

  const handleExpand = useCallback(() => {
    setCollapsed(false);
  }, []);

  const toggleSector = useCallback((sector: string) => {
    setSectorFilter((prev) => (prev === sector ? null : sector));
  }, []);

  if (error || (!loading && !data)) return null;
  if (loading) return <BriefSkeleton />;

  const brief = data!;

  if (collapsed) {
    return (
      <div
        className="bg-[var(--color-bg-surface)] border-l-2 border-[var(--color-gold)] px-5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[var(--color-bg-elevated)] transition-colors"
        onClick={handleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleExpand(); }
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[0.75rem] font-medium text-[var(--color-text-muted)]">Today&apos;s Brief</span>
          <span className={cn('text-[0.8125rem] font-mono tabular-nums font-medium', colorClass(brief.portfolio.overnightChange))}>
            {formatCurrency(brief.portfolio.overnightChange)}
          </span>
          <span className={cn('text-[0.75rem] font-mono tabular-nums', colorClass(brief.portfolio.overnightChangePct))}>
            ({formatPct(brief.portfolio.overnightChangePct)})
          </span>
          {brief.portfolio.vsBenchmark !== null && (
            <span className="text-[0.6875rem] text-[var(--color-text-muted)]">
              vs SPY {brief.portfolio.vsBenchmark >= 0 ? '+' : ''}{brief.portfolio.vsBenchmark.toFixed(1)}pp
            </span>
          )}
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
      </div>
    );
  }

  const activeSector = sectorFilter
    ? brief.sectorHeat.find((s) => s.sector === sectorFilter)
    : null;

  const sectorTickerSet = activeSector
    ? new Set(activeSector.tickers)
    : null;

  const filteredMovers = sectorTickerSet
    ? brief.allHoldings.filter((m) => sectorTickerSet.has(m.ticker))
    : brief.movers;

  const hasEarnings = brief.earningsThisWeek.length > 0;
  const hasDividends = brief.dividendsThisWeek.length > 0;
  const hasEvents = hasEarnings || hasDividends;

  return (
    <div className="bg-[var(--color-bg-surface)] border-l-2 border-[var(--color-gold)]">
      <div className="px-5 py-4 space-y-4">

        {/* ── Row 1: Headline ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[0.8125rem] text-[var(--color-text-secondary)]">Portfolio overnight</span>
              <span className={cn('text-[1.25rem] font-mono tabular-nums font-bold', colorClass(brief.portfolio.overnightChange))}>
                {formatCurrency(brief.portfolio.overnightChange)}
              </span>
              <span className={cn('text-[0.875rem] font-mono tabular-nums', colorClass(brief.portfolio.overnightChangePct))}>
                {formatPct(brief.portfolio.overnightChangePct)}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1">
              {brief.market.spy && (
                <span className="text-[0.75rem]">
                  <span className="text-[var(--color-text-muted)]">SPY </span>
                  <span className={cn('font-mono tabular-nums font-medium', colorClass(brief.market.spy.changePct))}>
                    {formatPct(brief.market.spy.changePct)}
                  </span>
                </span>
              )}
              {brief.market.qqq && (
                <span className="text-[0.75rem]">
                  <span className="text-[var(--color-text-muted)]">QQQ </span>
                  <span className={cn('font-mono tabular-nums font-medium', colorClass(brief.market.qqq.changePct))}>
                    {formatPct(brief.market.qqq.changePct)}
                  </span>
                </span>
              )}
              {brief.portfolio.vsBenchmark !== null && (
                <span className={cn('text-[0.75rem] font-mono tabular-nums', colorClass(brief.portfolio.vsBenchmark))}>
                  {brief.portfolio.vsBenchmark >= 0 ? 'Outperforming' : 'Underperforming'} SPY by {Math.abs(brief.portfolio.vsBenchmark).toFixed(1)}pp
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors rounded hover:bg-[var(--color-bg-overlay)]"
            aria-label="Dismiss brief"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Row 2: Sector heat (interactive) ── */}
        {brief.sectorHeat.length > 0 && (
          <div className="space-y-2">
            <div className="flex h-2 w-full overflow-hidden rounded-sm">
              {(() => {
                const totalWeight = brief.sectorHeat.reduce((sum, s) => sum + s.weight, 0);
                return brief.sectorHeat.map((sector, i) => (
                  <div
                    key={sector.sector}
                    className={cn(
                      'h-full cursor-pointer transition-opacity duration-150',
                      sectorFilter && sectorFilter !== sector.sector && 'opacity-25',
                    )}
                    style={{
                      width: `${(sector.weight / totalWeight) * 100}%`,
                      backgroundColor: sectorBarColor(sector.changePct),
                      marginRight: i < brief.sectorHeat.length - 1 ? '1px' : '0',
                    }}
                    title={`${sector.sector}: ${formatPct(sector.changePct)} · ${sector.weight.toFixed(1)}% of portfolio`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSector(sector.sector)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSector(sector.sector); } }}
                  />
                ));
              })()}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {brief.sectorHeat.map((sector) => (
                <div
                  key={sector.sector}
                  className={cn(
                    'flex items-center gap-1.5 cursor-pointer transition-opacity duration-150 rounded px-1 -mx-1',
                    sectorFilter === sector.sector && 'bg-[var(--color-bg-overlay)]',
                    sectorFilter && sectorFilter !== sector.sector && 'opacity-40',
                  )}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSector(sector.sector)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSector(sector.sector); } }}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sectorDotColor(sector.changePct) }} />
                  <span className="text-[0.6875rem] text-[var(--color-text-secondary)]">{sector.sector}</span>
                  <span className={cn('text-[0.6875rem] font-mono tabular-nums', colorClass(sector.changePct))}>
                    {formatPct(sector.changePct)}
                  </span>
                  <span className="text-[0.5625rem] text-[var(--color-text-muted)] font-mono tabular-nums">{sector.weight.toFixed(0)}%</span>
                </div>
              ))}
              {sectorFilter && (
                <button
                  onClick={() => setSectorFilter(null)}
                  className="text-[0.625rem] text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Row 3: Movers (filtered) ── */}
        {filteredMovers.length > 0 && (
          <div>
            <span className="text-[0.625rem] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
              {sectorFilter ? `${sectorFilter} Movers` : 'Movers'}
            </span>
            <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1">
              {filteredMovers.map((mover) => (
                <div key={mover.ticker} className="flex items-baseline justify-between py-0.5">
                  <span className="text-[0.8125rem] font-mono tabular-nums font-medium text-[var(--color-text-primary)]">
                    {mover.ticker}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className={cn('text-[0.8125rem] font-mono tabular-nums', colorClass(mover.changePct))}>
                      {formatPct(mover.changePct)}
                    </span>
                    <span className={cn('text-[0.6875rem] font-mono tabular-nums opacity-60', colorClass(mover.dollarImpact))}>
                      {formatCurrency(mover.dollarImpact)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 4: Events ── */}
        {hasEvents && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1 border-t border-[var(--color-border-subtle)]">
            {brief.earningsThisWeek.slice(0, 3).map((e) => (
              <span key={e.ticker} className="text-[0.6875rem] text-[var(--color-text-muted)]">
                Earnings {formatEventDay(e.reportDate)}: <span className="font-mono font-medium text-[var(--color-text-secondary)]">{e.ticker}</span>
                <span className="ml-1 opacity-60">({e.portfolioWeight.toFixed(1)}%)</span>
              </span>
            ))}
            {brief.dividendsThisWeek.slice(0, 3).map((d) => (
              <span key={d.ticker} className="text-[0.6875rem] text-[var(--color-text-muted)]">
                Ex-div {formatEventDay(d.exDate)}: <span className="font-mono font-medium text-[var(--color-text-secondary)]">{d.ticker}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
