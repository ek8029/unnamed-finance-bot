'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BriefData {
  portfolio: {
    totalValue: number;
    overnightChange: number;
    overnightChangePct: number;
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
    changePct: number;
    dollarImpact: number;
  }[];
  sectorHeat: {
    sector: string;
    weight: number;
    changePct: number;
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
    localStorage.setItem(`${STORAGE_PREFIX}${getTodayKey()}`, '1');
  } catch {}
}

function formatLargeCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(value);
  }
  if (abs >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatImpact(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 10_000) {
    return `${sign}$${(abs / 1000).toFixed(0)}K`;
  }
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}K`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function colorClass(value: number): string {
  if (value > 0) return 'text-[var(--color-positive)]';
  if (value < 0) return 'text-[var(--color-negative)]';
  return 'text-[var(--color-text-secondary)]';
}

function formatVixLevel(level: string): string {
  return level
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatEventDay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

function SectorHeatStrip({ sectors }: { sectors: BriefData['sectorHeat'] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const totalWeight = useMemo(
    () => sectors.reduce((sum, s) => sum + s.weight, 0),
    [sectors],
  );

  if (sectors.length === 0 || totalWeight === 0) return null;

  return (
    <div className="relative">
      <div ref={stripRef} className="flex h-2 w-full overflow-hidden">
        {sectors.map((sector, i) => {
          const pct = (sector.weight / totalWeight) * 100;
          let bg: string;
          if (sector.changePct > 0.5) bg = 'bg-[var(--color-positive)]';
          else if (sector.changePct > 0.1) bg = 'bg-[var(--color-positive)]/60';
          else if (sector.changePct < -0.5) bg = 'bg-[var(--color-negative)]';
          else if (sector.changePct < -0.1) bg = 'bg-[var(--color-negative)]/60';
          else bg = 'bg-[var(--color-bg-elevated)]';

          return (
            <div
              key={sector.sector}
              className={cn(
                'h-full transition-opacity duration-150',
                bg,
                hoveredIndex !== null && hoveredIndex !== i && 'opacity-40',
              )}
              style={{ width: `${pct}%` }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}
      </div>
      {hoveredIndex !== null && (
        <div className="absolute top-full mt-1 left-0 z-10 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] px-2 py-1 pointer-events-none">
          <span className="text-[0.6875rem] text-[var(--color-text-primary)]">
            {sectors[hoveredIndex].sector}
          </span>
          <span className={cn('text-[0.6875rem] font-mono tabular-nums ml-1.5', colorClass(sectors[hoveredIndex].changePct))}>
            {formatPct(sectors[hoveredIndex].changePct)}
          </span>
          <span className="text-[0.6875rem] text-[var(--color-text-muted)] ml-1.5">
            {sectors[hoveredIndex].weight.toFixed(1)}% of portfolio
          </span>
        </div>
      )}
    </div>
  );
}

function BriefSkeleton() {
  return (
    <div className="bg-[var(--color-bg-surface)] border-l-2 border-[var(--color-gold)] px-4 py-4 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-72 bg-[var(--color-bg-elevated)] rounded" />
        <div className="h-4 w-4 bg-[var(--color-bg-elevated)] rounded" />
      </div>
      <div className="flex gap-6">
        <div className="h-4 w-24 bg-[var(--color-bg-elevated)] rounded" />
        <div className="h-4 w-24 bg-[var(--color-bg-elevated)] rounded" />
        <div className="h-4 w-28 bg-[var(--color-bg-elevated)] rounded" />
        <div className="h-4 w-16 bg-[var(--color-bg-elevated)] rounded" />
      </div>
      <div className="h-2 w-full bg-[var(--color-bg-elevated)] rounded" />
      <div className="flex items-center justify-between">
        <div className="h-4 w-80 bg-[var(--color-bg-elevated)] rounded" />
        <div className="h-4 w-40 bg-[var(--color-bg-elevated)] rounded" />
      </div>
    </div>
  );
}

export function DailyBrief() {
  const [data, setData] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [collapsed, setCollapsed] = useState(() => isDismissedToday());

  useEffect(() => {
    let cancelled = false;

    async function fetchBrief() {
      try {
        const res = await fetch('/api/dashboard/brief');
        if (!res.ok) throw new Error('Failed to fetch brief');
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBrief();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismiss = useCallback(() => {
    dismissToday();
    setCollapsed(true);
  }, []);

  const handleExpand = useCallback(() => {
    setCollapsed(false);
  }, []);

  if (error || (!loading && !data)) return null;
  if (loading) return <BriefSkeleton />;

  const brief = data!;

  if (collapsed) {
    return (
      <div
        className="bg-[var(--color-bg-surface)] border-l-2 border-[var(--color-gold)] px-4 py-2.5 flex items-center justify-between cursor-pointer"
        onClick={handleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleExpand();
          }
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] font-medium text-[var(--color-text-muted)]">Today&apos;s Brief</span>
          <span className={cn('text-[0.75rem] font-mono tabular-nums', colorClass(brief.portfolio.overnightChange))}>
            {formatImpact(brief.portfolio.overnightChange)} ({formatPct(brief.portfolio.overnightChangePct)})
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
      </div>
    );
  }

  const hasEarnings = brief.earningsThisWeek.length > 0;
  const hasDividends = brief.dividendsThisWeek.length > 0;
  const hasEvents = hasEarnings || hasDividends;

  return (
    <div
      className="bg-[var(--color-bg-surface)] border-l-2 border-[var(--color-gold)]"
      style={{
        display: 'grid',
        gridTemplateRows: '1fr',
        transition: 'grid-template-rows 300ms ease',
      }}
    >
      <div className="overflow-hidden">
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <p className="text-[0.8125rem] text-[var(--color-text-secondary)] leading-snug">
              Your portfolio moved{' '}
              <span className={cn('text-[1.125rem] font-mono tabular-nums font-semibold', colorClass(brief.portfolio.overnightChange))}>
                {formatLargeCurrency(brief.portfolio.overnightChange)}
              </span>{' '}
              <span className={cn('text-[0.8125rem] font-mono tabular-nums', colorClass(brief.portfolio.overnightChangePct))}>
                ({formatPct(brief.portfolio.overnightChangePct)})
              </span>{' '}
              overnight
            </p>
            <button
              onClick={handleDismiss}
              className="shrink-0 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              aria-label="Dismiss brief"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {brief.market.spy && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[0.6875rem] text-[var(--color-text-muted)]">SPY</span>
                <span className={cn('text-[0.8125rem] font-mono tabular-nums font-medium', colorClass(brief.market.spy.changePct))}>
                  {formatPct(brief.market.spy.changePct)}
                </span>
              </div>
            )}
            {brief.market.qqq && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[0.6875rem] text-[var(--color-text-muted)]">QQQ</span>
                <span className={cn('text-[0.8125rem] font-mono tabular-nums font-medium', colorClass(brief.market.qqq.changePct))}>
                  {formatPct(brief.market.qqq.changePct)}
                </span>
              </div>
            )}
            {brief.market.vix && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[0.6875rem] text-[var(--color-gold)]">VIX</span>
                <span className="text-[0.8125rem] font-mono tabular-nums font-medium text-[var(--color-text-primary)]">
                  {brief.market.vix.price.toFixed(1)}
                </span>
                <span className="text-[0.6875rem] text-[var(--color-text-muted)]">
                  &middot; {formatVixLevel(brief.market.vix.level)}
                </span>
              </div>
            )}
            {brief.market.treasury10y ? (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[0.6875rem] text-[var(--color-text-muted)]">10Y</span>
                <span className="text-[0.8125rem] font-mono tabular-nums font-medium text-[var(--color-text-primary)]">
                  {brief.market.treasury10y.yield.toFixed(2)}%
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[0.6875rem] text-[var(--color-text-muted)]">10Y</span>
                <span className="text-[0.8125rem] font-mono tabular-nums text-[var(--color-text-muted)]">&mdash;</span>
              </div>
            )}
          </div>

          {brief.sectorHeat.length > 0 && (
            <SectorHeatStrip sectors={brief.sectorHeat} />
          )}

          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            {brief.movers.length > 0 && (
              <div className="flex flex-wrap items-baseline gap-x-1">
                <span className="text-[0.6875rem] text-[var(--color-text-muted)] mr-1">Top movers:</span>
                {brief.movers.slice(0, 3).map((mover, i) => (
                  <span key={mover.ticker} className="text-[0.8125rem] whitespace-nowrap">
                    {i > 0 && <span className="text-[var(--color-text-muted)] mx-1.5">&nbsp;</span>}
                    <span className="font-mono tabular-nums font-medium text-[var(--color-text-primary)]">{mover.ticker}</span>
                    <span className={cn('font-mono tabular-nums ml-1', colorClass(mover.changePct))}>
                      {formatPct(mover.changePct)}
                    </span>
                    <span className={cn('font-mono tabular-nums text-[0.75rem] ml-0.5 opacity-70', colorClass(mover.dollarImpact))}>
                      ({formatImpact(mover.dollarImpact)})
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-0.5 lg:items-end lg:text-right shrink-0">
              {hasEvents ? (
                <>
                  {brief.earningsThisWeek.slice(0, 2).map((e) => (
                    <span key={e.ticker} className="text-[0.75rem] text-[var(--color-text-secondary)]">
                      Earnings {formatEventDay(e.reportDate)}:{' '}
                      <span className="font-mono tabular-nums font-medium text-[var(--color-text-primary)]">{e.ticker}</span>
                      <span className="text-[var(--color-text-muted)] ml-1">({e.portfolioWeight.toFixed(1)}%)</span>
                    </span>
                  ))}
                  {brief.dividendsThisWeek.slice(0, 2).map((d) => (
                    <span key={d.ticker} className="text-[0.75rem] text-[var(--color-text-secondary)]">
                      Ex-div {formatEventDay(d.exDate)}:{' '}
                      <span className="font-mono tabular-nums font-medium text-[var(--color-text-primary)]">{d.ticker}</span>
                    </span>
                  ))}
                </>
              ) : (
                <span className="text-[0.75rem] text-[var(--color-text-muted)]">No events this week</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
