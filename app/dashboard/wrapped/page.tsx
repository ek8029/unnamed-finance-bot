'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { cn } from '@/lib/utils';

// ── Types ──

interface WrappedPosition {
  ticker: string;
  name: string;
  returnPct: number;
  returnDollars: number;
  value: number;
}

interface WrappedData {
  period: 'quarter' | 'year';
  periodLabel: string;
  periodRange: string;
  totalReturn: { pct: number; dollars: number };
  bestPosition: WrappedPosition | null;
  worstPosition: WrappedPosition | null;
  totalDividends: number;
  tradeCount: number;
  spyComparison: { userReturn: number; spyReturn: number | null; beat: boolean | null };
  taxSavings: number;
  mostActiveTradingDay: { date: string; trades: number } | null;
  sectorBreakdown: { sector: string; pct: number; value: number }[];
  healthScoreTrend: { start: number | null; end: number | null; change: number };
  netWorthChange: { start: number; end: number; change: number; changePct: number };
  positionCount: number;
  portfolioValue: number;
}

type CardType = 'intro' | 'return' | 'best' | 'spy' | 'worst' | 'tax' | 'health' | 'summary';

// ── Helpers ──

function fmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function fmtDollars(n: number): string {
  return `${n >= 0 ? '+' : '-'}$${fmt(Math.abs(n))}`;
}

// ── Branding footer for every card ──

function CardBranding() {
  return (
    <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 opacity-60">
      <HelmMark size={28} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em' }}
            className="text-[var(--color-text-muted)] uppercase">
        helmterminal.dev
      </span>
    </div>
  );
}

// ── Progress bar ──

function ProgressBar({ total, current }: { total: number; current: number }) {
  return (
    <div className="absolute top-4 left-6 right-6 flex gap-1.5 z-20">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-[3px] flex-1 rounded-full transition-all duration-500',
            i <= current ? 'bg-[var(--color-gold)]' : 'bg-white/15',
          )}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// Card Components
// ═══════════════════════════════════════════

function IntroCard({ data }: { data: WrappedData }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <div className="mb-8 animate-[scale-in_0.6s_ease-out]">
        <HelmMark size={72} />
      </div>
      <p className="uppercase tracking-[0.25em] text-[var(--color-gold)] mb-4"
         style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        Portfolio Wrapped
      </p>
      <h1 className="text-[clamp(2.5rem,8vw,4.5rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.1] mb-4">
        Your {data.periodLabel}<br />in Review
      </h1>
      <p className="text-[var(--color-text-muted)] text-sm" style={{ fontFamily: 'var(--font-mono)' }}>
        {data.periodRange}
      </p>
      <p className="text-[var(--color-text-muted)] text-xs mt-6 animate-pulse">
        Tap to continue
      </p>
      <CardBranding />
    </div>
  );
}

function ReturnCard({ data }: { data: WrappedData }) {
  const isPositive = data.totalReturn.pct >= 0;
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <p className="uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-6"
         style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        Your Portfolio Returned
      </p>
      <div className={cn(
        'text-[clamp(3.5rem,12vw,7rem)] font-bold tracking-tight leading-none mb-4',
        isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
      )}
           style={{ fontFeatureSettings: "'tnum' 1" }}>
        {fmtPct(data.totalReturn.pct)}
      </div>
      <div className={cn(
        'text-[clamp(1.5rem,5vw,2.5rem)] font-semibold tracking-tight',
        isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
      )}
           style={{ fontFeatureSettings: "'tnum' 1", opacity: 0.8 }}>
        {fmtDollars(data.totalReturn.dollars)}
      </div>
      <div className="mt-8 flex items-center gap-4 text-[var(--color-text-muted)]">
        <div className="text-center">
          <p className="text-2xl font-bold text-[var(--color-text-primary)]"
             style={{ fontFeatureSettings: "'tnum' 1" }}>{data.positionCount}</p>
          <p className="text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
            Positions
          </p>
        </div>
        <div className="w-px h-8 bg-[var(--color-border-base)]" />
        <div className="text-center">
          <p className="text-2xl font-bold text-[var(--color-text-primary)]"
             style={{ fontFeatureSettings: "'tnum' 1" }}>${fmt(data.portfolioValue)}</p>
          <p className="text-xs uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>
            Portfolio
          </p>
        </div>
      </div>
      <CardBranding />
    </div>
  );
}

function BestTradeCard({ data }: { data: WrappedData }) {
  const pos = data.bestPosition!;
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <p className="uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-6"
         style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        Your Best Trade
      </p>
      <div className="text-[clamp(3rem,10vw,6rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-3">
        {pos.ticker}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">{pos.name}</p>
      <div className="text-[clamp(2rem,7vw,4rem)] font-bold tracking-tight text-[var(--color-positive)] leading-none mb-2"
           style={{ fontFeatureSettings: "'tnum' 1" }}>
        +{pos.returnPct.toFixed(1)}%
      </div>
      <div className="text-xl font-semibold text-[var(--color-positive)]"
           style={{ fontFeatureSettings: "'tnum' 1", opacity: 0.8 }}>
        +${fmt(pos.returnDollars)}
      </div>
      <div className="mt-6 px-4 py-2 rounded-full border border-[var(--color-positive)]/20 bg-[var(--color-positive)]/5">
        <span className="text-xs text-[var(--color-positive)]" style={{ fontFamily: 'var(--font-mono)' }}>
          Position value: ${fmt(pos.value)}
        </span>
      </div>
      <CardBranding />
    </div>
  );
}

function SpyComparisonCard({ data }: { data: WrappedData }) {
  const beat = data.spyComparison.beat;
  const diff = data.spyComparison.spyReturn != null
    ? Math.abs(data.spyComparison.userReturn - data.spyComparison.spyReturn)
    : 0;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <p className="uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-6"
         style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        vs. The Market
      </p>
      {beat ? (
        <>
          <div className="text-[clamp(1.5rem,5vw,2.5rem)] font-bold text-[var(--color-text-primary)] mb-4">
            You beat the
          </div>
          <div className="text-[clamp(3rem,10vw,5.5rem)] font-bold tracking-tight text-[var(--color-gold)] leading-none mb-4">
            S&P 500
          </div>
          {diff > 0 && (
            <div className="text-xl font-semibold text-[var(--color-positive)]"
                 style={{ fontFeatureSettings: "'tnum' 1" }}>
              by {diff.toFixed(1)} percentage points
            </div>
          )}
        </>
      ) : beat === false ? (
        <>
          <div className="text-[clamp(1.5rem,5vw,2rem)] font-semibold text-[var(--color-text-secondary)] mb-4">
            The S&P 500 edged ahead
          </div>
          <div className="text-[clamp(2rem,7vw,3.5rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-4"
               style={{ fontFeatureSettings: "'tnum' 1" }}>
            {fmtPct(data.spyComparison.userReturn)}
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Your return vs SPY&apos;s {data.spyComparison.spyReturn != null ? fmtPct(data.spyComparison.spyReturn) : 'N/A'}
          </p>
        </>
      ) : (
        <>
          <div className="text-[clamp(2rem,7vw,3.5rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-4"
               style={{ fontFeatureSettings: "'tnum' 1" }}>
            {fmtPct(data.spyComparison.userReturn)}
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">Your portfolio return</p>
        </>
      )}
      <div className="mt-8 grid grid-cols-2 gap-8">
        <div className="text-center">
          <p className="type-eyebrow text-[var(--color-text-muted)] mb-1">You</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]"
             style={{ fontFeatureSettings: "'tnum' 1" }}>
            {fmtPct(data.spyComparison.userReturn)}
          </p>
        </div>
        <div className="text-center">
          <p className="type-eyebrow text-[var(--color-text-muted)] mb-1">S&P 500</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]"
             style={{ fontFeatureSettings: "'tnum' 1" }}>
            {data.spyComparison.spyReturn != null ? fmtPct(data.spyComparison.spyReturn) : '—'}
          </p>
        </div>
      </div>
      <CardBranding />
    </div>
  );
}

function WorstTradeCard({ data }: { data: WrappedData }) {
  const pos = data.worstPosition!;
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <p className="uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-6"
         style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        Your Biggest Challenge
      </p>
      <div className="text-[clamp(3rem,10vw,6rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-3">
        {pos.ticker}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6">{pos.name}</p>
      <div className="text-[clamp(2rem,7vw,4rem)] font-bold tracking-tight text-[var(--color-negative)] leading-none mb-2"
           style={{ fontFeatureSettings: "'tnum' 1" }}>
        {pos.returnPct.toFixed(1)}%
      </div>
      <div className="text-xl font-semibold text-[var(--color-negative)]"
           style={{ fontFeatureSettings: "'tnum' 1", opacity: 0.8 }}>
        -${fmt(Math.abs(pos.returnDollars))}
      </div>
      <CardBranding />
    </div>
  );
}

function TaxSavingsCard({ data }: { data: WrappedData }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <p className="uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-6"
         style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        Helm Saved You
      </p>
      <div className="text-[clamp(3rem,10vw,6rem)] font-bold tracking-tight text-[var(--color-gold)] leading-none mb-4"
           style={{ fontFeatureSettings: "'tnum' 1" }}>
        ${fmt(data.taxSavings)}
      </div>
      <p className="text-lg text-[var(--color-text-secondary)]">
        in tax-loss harvesting
      </p>
      <div className="mt-8 px-5 py-3 rounded-xl border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)]">
        <p className="text-xs text-[var(--color-gold)]" style={{ fontFamily: 'var(--font-mono)' }}>
          That&apos;s money back in your pocket
        </p>
      </div>
      <CardBranding />
    </div>
  );
}

function HealthScoreCard({ data }: { data: WrappedData }) {
  const { start, end, change } = data.healthScoreTrend;
  const improved = change > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <p className="uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-6"
         style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        Financial Health Score
      </p>
      {start !== null && end !== null && start !== end ? (
        <>
          <div className="flex items-center gap-6 mb-6">
            <div className="text-center">
              <p className="text-[var(--color-text-muted)] text-xs mb-2"
                 style={{ fontFamily: 'var(--font-mono)' }}>Start</p>
              <div className="text-[clamp(2.5rem,8vw,4.5rem)] font-bold text-[var(--color-text-secondary)]"
                   style={{ fontFeatureSettings: "'tnum' 1" }}>
                {start}
              </div>
            </div>
            <div className="text-3xl text-[var(--color-text-muted)]">&rarr;</div>
            <div className="text-center">
              <p className="text-[var(--color-text-muted)] text-xs mb-2"
                 style={{ fontFamily: 'var(--font-mono)' }}>Now</p>
              <div className={cn(
                'text-[clamp(2.5rem,8vw,4.5rem)] font-bold',
                improved ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
              )}
                   style={{ fontFeatureSettings: "'tnum' 1" }}>
                {end}
              </div>
            </div>
          </div>
          <div className={cn(
            'text-xl font-semibold',
            improved ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
          )}>
            {improved ? '+' : ''}{change} points
          </div>
        </>
      ) : (
        <div className="text-[clamp(3rem,10vw,5.5rem)] font-bold tracking-tight text-[var(--color-gold)] leading-none"
             style={{ fontFeatureSettings: "'tnum' 1" }}>
          {end ?? start ?? '—'}
        </div>
      )}
      <CardBranding />
    </div>
  );
}

function SummaryCard({ data, onShare }: { data: WrappedData; onShare: () => void }) {
  const stats = [
    { label: 'Total Return', value: fmtPct(data.totalReturn.pct), sub: fmtDollars(data.totalReturn.dollars) },
    data.bestPosition && { label: 'Best Trade', value: data.bestPosition.ticker, sub: `+${data.bestPosition.returnPct.toFixed(1)}%` },
    data.worstPosition && { label: 'Biggest Challenge', value: data.worstPosition.ticker, sub: `${data.worstPosition.returnPct.toFixed(1)}%` },
    data.tradeCount > 0 && { label: 'Total Trades', value: `${data.tradeCount}`, sub: null },
    data.totalDividends > 0 && { label: 'Dividends', value: `$${fmt(data.totalDividends)}`, sub: null },
    data.taxSavings > 0 && { label: 'Tax Savings', value: `$${fmt(data.taxSavings)}`, sub: null },
    data.netWorthChange.change !== 0 && { label: 'Net Worth Change', value: fmtDollars(data.netWorthChange.change), sub: fmtPct(data.netWorthChange.changePct) },
    data.sectorBreakdown.length > 0 && { label: 'Top Sector', value: data.sectorBreakdown[0].sector, sub: `${data.sectorBreakdown[0].pct.toFixed(0)}%` },
  ].filter(Boolean) as { label: string; value: string; sub: string | null }[];

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <div className="mb-6">
        <HelmMark size={36} />
      </div>
      <p className="uppercase tracking-[0.25em] text-[var(--color-gold)] mb-6"
         style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
        {data.periodLabel} Summary
      </p>

      <div className="w-full max-w-sm space-y-3 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border-base)]/30">
            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider"
                  style={{ fontFamily: 'var(--font-mono)' }}>
              {s.label}
            </span>
            <div className="text-right">
              <span className="text-sm font-bold text-[var(--color-text-primary)]"
                    style={{ fontFeatureSettings: "'tnum' 1" }}>
                {s.value}
              </span>
              {s.sub && (
                <span className="text-xs text-[var(--color-text-muted)] ml-2"
                      style={{ fontFeatureSettings: "'tnum' 1" }}>
                  {s.sub}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onShare}
        className="flex items-center gap-2 px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black font-semibold rounded-lg transition-colors"
      >
        <Share2 className="w-4 h-4" />
        Share on X
      </button>

      <CardBranding />
    </div>
  );
}

// ═══════════════════════════════════════════
// Loading State
// ═══════════════════════════════════════════

function LoadingState() {
  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-base)] flex flex-col items-center justify-center">
      <div className="animate-pulse">
        <HelmMark size={64} />
      </div>
      <p className="text-[var(--color-text-muted)] text-sm mt-6" style={{ fontFamily: 'var(--font-mono)' }}>
        Compiling your wrapped...
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════

export default function WrappedPage() {
  const router = useRouter();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCard, setCurrentCard] = useState(0);
  const [period, setPeriod] = useState<'quarter' | 'year'>('quarter');
  const [touchStartX, setTouchStartX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    setCurrentCard(0);
    fetch(`/api/dashboard/wrapped?period=${period}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [period]);

  // Build cards dynamically based on available data
  const cards = useMemo<CardType[]>(() => {
    if (!data) return [];
    const c: CardType[] = ['intro', 'return'];
    if (data.bestPosition) c.push('best');
    if (data.spyComparison.beat !== null || data.spyComparison.userReturn !== 0) c.push('spy');
    if (data.worstPosition) c.push('worst');
    if (data.taxSavings > 0) c.push('tax');
    if (data.healthScoreTrend.start !== null || data.healthScoreTrend.end !== null) c.push('health');
    c.push('summary');
    return c;
  }, [data]);

  // Navigation
  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= cards.length) return;
    setCurrentCard(index);
  }, [cards.length]);

  const next = useCallback(() => goTo(currentCard + 1), [currentCard, goTo]);
  const prev = useCallback(() => goTo(currentCard - 1), [currentCard, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'Escape') router.push('/dashboard');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, router]);

  // Touch swipe
  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 60) next();
    if (diff < -60) prev();
  };

  // Click zones (left third = back, right two-thirds = forward)
  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) prev();
    else next();
  };

  // Share on X
  const handleShare = () => {
    if (!data) return;
    const lines = [
      `My ${data.periodLabel} investing wrapped by @helmterminal:`,
      '',
      `${fmtPct(data.totalReturn.pct)} return (${fmtDollars(data.totalReturn.dollars)})`,
    ];
    if (data.bestPosition) {
      lines.push(`Best trade: ${data.bestPosition.ticker} (+${data.bestPosition.returnPct.toFixed(0)}%)`);
    }
    if (data.spyComparison.beat) {
      lines.push('Beat the S&P 500');
    }
    if (data.taxSavings > 0) {
      lines.push(`Tax savings: $${fmt(data.taxSavings)}`);
    }
    lines.push('', 'Get yours: helmterminal.dev');

    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <LoadingState />;

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-base)] flex flex-col items-center justify-center">
        <p className="text-[var(--color-text-secondary)] mb-4">Unable to generate your wrapped.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-hi)]"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Render current card
  function renderCard(type: CardType) {
    switch (type) {
      case 'intro':   return <IntroCard data={data!} />;
      case 'return':  return <ReturnCard data={data!} />;
      case 'best':    return <BestTradeCard data={data!} />;
      case 'spy':     return <SpyComparisonCard data={data!} />;
      case 'worst':   return <WorstTradeCard data={data!} />;
      case 'tax':     return <TaxSavingsCard data={data!} />;
      case 'health':  return <HealthScoreCard data={data!} />;
      case 'summary': return <SummaryCard data={data!} onShare={handleShare} />;
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[var(--color-bg-base)] select-none overflow-hidden"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar */}
      <ProgressBar total={cards.length} current={currentCard} />

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); router.push('/dashboard'); }}
        className="absolute top-5 right-5 z-30 w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Period toggle */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex gap-1 p-1 rounded-full bg-white/5 border border-white/10">
        {(['quarter', 'year'] as const).map(p => (
          <button
            key={p}
            onClick={(e) => { e.stopPropagation(); setPeriod(p); }}
            className={cn(
              'px-3 py-1 rounded-full text-xs transition-all duration-200',
              period === p
                ? 'bg-[var(--color-gold)] text-black font-semibold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
            )}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {p === 'quarter' ? 'Quarter' : 'Year'}
          </button>
        ))}
      </div>

      {/* Card content */}
      <div className="absolute inset-0 pt-20">
        {cards.map((type, i) => (
          <div
            key={`${type}-${i}`}
            className={cn(
              'absolute inset-0 transition-all duration-500 ease-out',
              i === currentCard
                ? 'opacity-100 scale-100 translate-x-0'
                : i < currentCard
                  ? 'opacity-0 scale-95 -translate-x-8 pointer-events-none'
                  : 'opacity-0 scale-95 translate-x-8 pointer-events-none',
            )}
          >
            {renderCard(type)}
          </div>
        ))}
      </div>

      {/* Navigation arrows (desktop) */}
      {currentCard > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors hidden md:flex"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {currentCard < cards.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors hidden md:flex"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Card counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 text-xs text-[var(--color-text-muted)]"
           style={{ fontFamily: 'var(--font-mono)' }}>
        {currentCard + 1} / {cards.length}
      </div>
    </div>
  );
}
