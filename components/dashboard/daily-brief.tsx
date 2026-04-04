'use client';

import { useState, useEffect, useCallback } from 'react';
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

function SectorHeatLabels({ sectors }: { sectors: BriefData['sectorHeat'] }) {
  if (sectors.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      <span className="text-[0.6875rem] text-[var(--color-text-muted)]">Sectors:</span>
      {sectors.map((sector) => (
        <span key={sector.sector} className="text-[0.75rem] whitespace-nowrap">
          <span className="text-[var(--color-text-secondary)]">{sector.sector}</span>
          <span className={cn('font-mono tabular-nums ml-1', colorClass(sector.changePct))}>
            {formatPct(sector.changePct)}
          </span>
        </span>
      ))}
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
        <div className="px-4 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[0.8125rem] text-[var(--color-text-secondary)] leading-snug">
              Your portfolio moved{' '}
              <span className={cn('text-[1rem] font-mono tabular-nums font-semibold', colorClass(brief.portfolio.overnightChange))}>
                {formatLargeCurrency(brief.portfolio.overnightChange)}
              </span>{' '}
              <span className={cn('text-[0.8125rem] font-mono tabular-nums', colorClass(brief.portfolio.overnightChangePct))}>
                ({formatPct(brief.portfolio.overnightChangePct)})
              </span>{' '}
              overnight
            </p>
            <button
              onClick={handleDismiss}
              className="shrink-0 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              aria-label="Dismiss brief"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
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
            {brief.movers.length > 0 && (
              <>
                <span className="text-[var(--color-border-strong)] text-[0.625rem]">|</span>
                {brief.movers.slice(0, 3).map((mover) => (
                  <span key={mover.ticker} className="text-[0.75rem] whitespace-nowrap">
                    <span className="font-mono tabular-nums font-medium text-[var(--color-text-primary)]">{mover.ticker}</span>
                    <span className={cn('font-mono tabular-nums ml-1', colorClass(mover.changePct))}>
                      {formatPct(mover.changePct)}
                    </span>
                    <span className={cn('font-mono tabular-nums text-[0.6875rem] ml-0.5 opacity-60', colorClass(mover.dollarImpact))}>
                      ({formatImpact(mover.dollarImpact)})
                    </span>
                  </span>
                ))}
              </>
            )}
          </div>

          {brief.sectorHeat.length > 0 && (
            <SectorHeatLabels sectors={brief.sectorHeat} />
          )}

          {hasEvents && (
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              {brief.earningsThisWeek.slice(0, 2).map((e) => (
                <span key={e.ticker} className="text-[0.6875rem] text-[var(--color-text-muted)]">
                  Earnings {formatEventDay(e.reportDate)}: <span className="font-mono font-medium text-[var(--color-text-secondary)]">{e.ticker}</span> ({e.portfolioWeight.toFixed(1)}%)
                </span>
              ))}
              {brief.dividendsThisWeek.slice(0, 2).map((d) => (
                <span key={d.ticker} className="text-[0.6875rem] text-[var(--color-text-muted)]">
                  Ex-div {formatEventDay(d.exDate)}: <span className="font-mono font-medium text-[var(--color-text-secondary)]">{d.ticker}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
