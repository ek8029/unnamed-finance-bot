'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, X, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useWrapped, type WrappedData } from '@/hooks/use-financial-data';
import { HelmMark } from '@/components/helm-mark';
import { generateShareCard, type ShareCardData, type SlideType } from '@/components/wrapped/share-card-canvas';

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

const fmt = (n: number, decimals = 1) =>
  Math.abs(n) >= 1000
    ? `${(n / 1000).toFixed(1)}k`
    : n.toFixed(decimals);

const fmtDollar = (n: number) =>
  n < 0
    ? `-$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtPct = (n: number) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

const TOTAL_SLIDES = 6;

// Slide index → share card type mapping
const slideTypes: SlideType[] = ['summary', 'return', 'bestWorst', 'habits', 'sectors', 'summary'];

function buildCardData(data: WrappedData, slideIdx: number): ShareCardData {
  const year = data.periodLabel ?? new Date().getFullYear().toString();
  return {
    slideType: slideTypes[slideIdx] || 'summary',
    year,
    returnPct: data.totalReturn.pct,
    returnDollars: data.totalReturn.dollars,
    spyPct: data.spyComparison.spyReturn ?? undefined,
    beat: data.spyComparison.beat ?? undefined,
    bestTicker: data.bestPosition?.ticker,
    bestReturnPct: data.bestPosition?.returnPct,
    worstTicker: data.worstPosition?.ticker,
    worstReturnPct: data.worstPosition?.returnPct,
    personality: undefined,
    tradeCount: data.tradeCount,
    totalDividends: data.totalDividends,
    positionCount: data.positionCount ?? 0,
    topSector: data.sectorBreakdown?.[0]?.sector,
    topSectorPct: data.sectorBreakdown?.[0]?.pct,
  };
}

// ═══════════════════════════════════════════
// Ambient glow blobs
// ═══════════════════════════════════════════

function AmbientGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-[30%] -left-[20%] w-[60vw] h-[60vw] rounded-full bg-[var(--color-gold)] opacity-[0.03] blur-[120px]" />
      <div className="absolute -bottom-[20%] -right-[15%] w-[50vw] h-[50vw] rounded-full bg-emerald-500 opacity-[0.025] blur-[100px]" />
      <div className="absolute top-[40%] left-[60%] w-[30vw] h-[30vw] rounded-full bg-[var(--color-gold)] opacity-[0.02] blur-[80px]" />
    </div>
  );
}

// ═══════════════════════════════════════════
// Top bar: HELM mark + title + progress + counter
// ═══════════════════════════════════════════

function TopBar({ current, year }: { current: number; year: string }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-4 px-6 py-4 md:px-10">
      {/* HELM branding */}
      <div className="flex items-center gap-2.5 shrink-0">
        <HelmMark size={18} />
        <span
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
          style={MONO}
        >
          Helm / Wrapped &middot; {year}
        </span>
      </div>

      {/* Progress dots (gold line segments) */}
      <div className="flex-1 flex items-center gap-1.5 max-w-[200px] mx-auto">
        {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-[2px] flex-1 rounded-full transition-colors duration-300',
              i <= current
                ? 'bg-[var(--color-gold)]'
                : 'bg-white/10',
            )}
          />
        ))}
      </div>

      {/* Slide counter + close */}
      <span
        className="text-[11px] text-[var(--color-text-muted)] tabular-nums shrink-0"
        style={MONO}
      >
        {String(current + 1).padStart(2, '0')} / {String(TOTAL_SLIDES).padStart(2, '0')}
      </span>
      <a
        href="/dashboard"
        className="ml-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white transition-colors"
        aria-label="Close Wrapped"
      >
        <X className="w-4 h-4" />
      </a>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide transition variants
// ═══════════════════════════════════════════

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '60%' : '-60%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? '-60%' : '60%',
    opacity: 0,
  }),
};

// ═══════════════════════════════════════════
// Slide 1: COVER
// ═══════════════════════════════════════════

function SlideCover({
  data,
  onBegin,
}: {
  data: WrappedData | null;
  onBegin: () => void;
}) {
  const year = data?.periodLabel ?? new Date().getFullYear().toString();
  const trades = data?.tradeCount ?? 0;
  const range = data?.periodRange ?? '';

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      {/* Eyebrow */}
      <p
        className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-6"
        style={MONO}
      >
        Your Portfolio &middot; {year} in Review
      </p>

      {/* Headline */}
      <h1 className="text-[clamp(40px,8vw,72px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.05] mb-5">
        {data?.totalReturn?.pct != null && data.totalReturn.pct > 0 ? (
          <>Your portfolio grew{' '}
            <span className="italic text-[var(--color-gold)]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {Math.abs(data.totalReturn.pct).toFixed(1)}%.
            </span>
          </>
        ) : data?.totalReturn?.pct != null ? (
          <>A tough {year}.{' '}
            <span className="italic text-[var(--color-negative)]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              Let&apos;s review.
            </span>
          </>
        ) : (
          <>Your {year}{' '}
            <span className="italic text-[var(--color-gold)]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              in review.
            </span>
          </>
        )}
      </h1>

      {/* Subtitle */}
      <p className="text-[15px] text-[var(--color-text-secondary)] mb-10 max-w-md" style={MONO}>
        {trades > 0 ? `${trades} trades` : 'Your portfolio'} &middot; {range || year}
      </p>

      {/* CTA */}
      <button
        onClick={(e) => { e.stopPropagation(); onBegin(); }}
        className="group flex items-center gap-2 px-8 py-3.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[14px] rounded-full cursor-pointer transition-colors duration-200"
      >
        Begin Wrapped
        <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 2: TOTAL RETURN
// ═══════════════════════════════════════════

function SlideReturn({ data }: { data: WrappedData | null }) {
  const pct = data?.totalReturn.pct ?? 0;
  const positive = pct >= 0;
  const spyReturn = data?.spyComparison.spyReturn;
  const alpha = spyReturn != null ? pct - spyReturn : null;

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      {/* Eyebrow */}
      <p
        className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-8"
        style={MONO}
      >
        &sect; 01 &mdash; The Return
      </p>

      {/* Giant percentage */}
      <div
        className={cn(
          'text-[clamp(80px,25vw,260px)] font-bold leading-none tabular-nums tracking-tighter mb-6',
          positive ? 'text-emerald-400' : 'text-red-400',
        )}
        style={{
          textShadow: positive
            ? '0 0 80px rgba(52,211,153,0.3), 0 0 160px rgba(52,211,153,0.1)'
            : '0 0 80px rgba(248,113,113,0.3), 0 0 160px rgba(248,113,113,0.1)',
        }}
      >
        {fmtPct(pct)}
      </div>

      {/* Comparison row */}
      <div className="flex items-center gap-6 text-[13px]" style={MONO}>
        {spyReturn != null && (
          <span className="text-[var(--color-text-muted)]">
            S&amp;P 500: {fmtPct(spyReturn)}
          </span>
        )}
        {alpha != null && (
          <span className={cn(
            'px-3 py-1 rounded-full text-[12px] font-medium',
            alpha >= 0
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400',
          )}>
            Alpha: {fmtPct(alpha)}
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 3: BEST & WORST
// ═══════════════════════════════════════════

function SlideBestWorst({ data }: { data: WrappedData | null }) {
  const best = data?.bestPosition;
  const worst = data?.worstPosition;

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      {/* Eyebrow */}
      <p
        className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-6"
        style={MONO}
      >
        &sect; 02 &mdash; Winners &amp; Losers
      </p>

      {/* Headline */}
      <h2 className="text-[clamp(22px,4vw,36px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight mb-10 max-w-2xl">
        Your MVP was{' '}
        <span className="text-emerald-400">{best?.ticker ?? '---'}</span>.{' '}
        Your villain was{' '}
        <span className="text-red-400">{worst?.ticker ?? '---'}</span>.
      </h2>

      {/* Two cards */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl">
        {/* Best card */}
        <div className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-6">
          <p className="text-[11px] uppercase tracking-widest text-emerald-400 mb-3" style={MONO}>
            Best
          </p>
          <p className="text-[20px] font-bold text-[var(--color-text-primary)] mb-1">
            {best?.ticker ?? '---'}
          </p>
          <p className="text-[13px] text-[var(--color-text-muted)] mb-4 truncate">
            {best?.name ?? 'No position data'}
          </p>
          <p className="text-[28px] font-bold text-emerald-400 tabular-nums">
            {best ? fmtPct(best.returnPct) : '---'}
          </p>
          <p className="text-[13px] text-[var(--color-text-muted)] tabular-nums" style={MONO}>
            {best ? fmtDollar(best.returnDollars) : ''}
          </p>
        </div>

        {/* Worst card */}
        <div className="flex-1 rounded-xl border border-red-500/30 bg-red-500/[0.04] p-6">
          <p className="text-[11px] uppercase tracking-widest text-red-400 mb-3" style={MONO}>
            Worst
          </p>
          <p className="text-[20px] font-bold text-[var(--color-text-primary)] mb-1">
            {worst?.ticker ?? '---'}
          </p>
          <p className="text-[13px] text-[var(--color-text-muted)] mb-4 truncate">
            {worst?.name ?? 'No position data'}
          </p>
          <p className="text-[28px] font-bold text-red-400 tabular-nums">
            {worst ? fmtPct(worst.returnPct) : '---'}
          </p>
          <p className="text-[13px] text-[var(--color-text-muted)] tabular-nums" style={MONO}>
            {worst ? fmtDollar(worst.returnDollars) : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 4: TRADING HABITS
// ═══════════════════════════════════════════

function SlideTradingHabits({ data }: { data: WrappedData | null }) {
  const trades = data?.tradeCount ?? 0;
  const activeDay = data?.mostActiveTradingDay;
  const dividends = data?.totalDividends ?? 0;
  const positions = data?.positionCount ?? 0;
  const portfolioVal = data?.portfolioValue ?? 0;

  // Format the most active day nicely
  const activeDayLabel = activeDay
    ? new Date(activeDay.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const stats = [
    { label: 'Trades', value: trades.toString() },
    { label: 'Dividends', value: fmtDollar(dividends) },
    { label: 'Positions', value: positions.toString() },
    { label: 'Portfolio', value: fmtDollar(portfolioVal) },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      {/* Eyebrow */}
      <p
        className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-6"
        style={MONO}
      >
        &sect; 03 &mdash; How You Traded
      </p>

      {/* Headline */}
      <h2 className="text-[clamp(22px,4vw,36px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight mb-4 max-w-2xl">
        {trades} trade{trades !== 1 ? 's' : ''}.{' '}
        {activeDayLabel ? (
          <>
            Busiest day: <span className="text-[var(--color-gold)]">{activeDayLabel}</span>.
          </>
        ) : (
          <span className="text-[var(--color-gold)]">Steady hands.</span>
        )}
      </h2>

      {activeDay && (
        <p className="text-[13px] text-[var(--color-text-muted)] mb-10" style={MONO}>
          {activeDay.trades} trades on your most active day
        </p>
      )}

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
          >
            <p className="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2" style={MONO}>
              {s.label}
            </p>
            <p className="text-[22px] font-bold text-[var(--color-text-primary)] tabular-nums">
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 5: SECTORS
// ═══════════════════════════════════════════

function SlideSectors({ data }: { data: WrappedData | null }) {
  const sectors = data?.sectorBreakdown ?? [];
  const nwChange = data?.netWorthChange;
  const healthTrend = data?.healthScoreTrend;

  // Color palette for sector bar
  const sectorColors = [
    'bg-[var(--color-gold)]',
    'bg-emerald-400',
    'bg-sky-400',
    'bg-purple-400',
    'bg-orange-400',
    'bg-pink-400',
  ];

  const topSector = sectors.length > 0 ? sectors[0] : null;

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      {/* Eyebrow */}
      <p
        className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-6"
        style={MONO}
      >
        &sect; 04 &mdash; Your Bets
      </p>

      {/* Headline */}
      <h2 className="text-[clamp(20px,3.5vw,32px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight mb-10 max-w-xl">
        {topSector && topSector.pct >= 40
          ? `Nearly half your portfolio is in ${topSector.sector}.`
          : topSector
            ? `${topSector.sector} leads your portfolio at ${topSector.pct.toFixed(0)}%.`
            : 'Your sector allocation.'}
      </h2>

      {/* Horizontal stacked bar */}
      {sectors.length > 0 && (
        <div className="w-full max-w-lg mb-4">
          <div className="flex h-8 rounded-lg overflow-hidden">
            {sectors.map((s, i) => (
              <div
                key={s.sector}
                className={cn('transition-all duration-500', sectorColors[i % sectorColors.length])}
                style={{ width: `${Math.max(s.pct, 2)}%` }}
                title={`${s.sector}: ${s.pct.toFixed(1)}%`}
              />
            ))}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
            {sectors.map((s, i) => (
              <div key={s.sector} className="flex items-center gap-1.5">
                <div className={cn('w-2 h-2 rounded-full', sectorColors[i % sectorColors.length])} />
                <span className="text-[11px] text-[var(--color-text-muted)]" style={MONO}>
                  {s.sector} {s.pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats below */}
      <div className="flex items-center gap-6 mt-6 text-[13px]" style={MONO}>
        {nwChange && nwChange.change !== 0 && (
          <span className="text-[var(--color-text-secondary)]">
            Net worth: {fmtDollar(nwChange.change)} ({fmtPct(nwChange.changePct)})
          </span>
        )}
        {healthTrend && healthTrend.end != null && (
          <span className="text-[var(--color-text-secondary)]">
            Health: {healthTrend.end}/100
            {healthTrend.change !== 0 && (
              <span className={cn(
                'ml-1',
                healthTrend.change > 0 ? 'text-emerald-400' : 'text-red-400',
              )}>
                ({healthTrend.change > 0 ? '+' : ''}{healthTrend.change})
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 6: SHARE CARD
// ═══════════════════════════════════════════

function SlideShareCard({ data, onShareImage, onShareTwitter }: { data: WrappedData | null; onShareImage: () => void; onShareTwitter: () => void }) {
  const pct = data?.totalReturn.pct ?? 0;
  const positive = pct >= 0;
  const positions = data?.positionCount ?? 0;
  const trades = data?.tradeCount ?? 0;
  const dividends = data?.totalDividends ?? 0;
  const year = data?.periodLabel ?? new Date().getFullYear().toString();
  const [shareStatus, setShareStatus] = useState<'idle' | 'generating' | 'copied'>('idle');

  const handleShareImage = async () => {
    setShareStatus('generating');
    try {
      await onShareImage();
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2500);
    } catch {
      setShareStatus('idle');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center h-full px-6 gap-10 lg:gap-16">
      {/* Left: CTA */}
      <div className="text-center lg:text-left max-w-sm">
        <p
          className="text-[11px] uppercase tracking-[0.25em] text-[var(--color-text-muted)] mb-6"
          style={MONO}
        >
          &sect; 05 &mdash; Your Card
        </p>
        <h2 className="text-[clamp(28px,5vw,48px)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.1] mb-4">
          Take the Helm.{' '}
          <span className="italic text-[var(--color-gold)]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Again.
          </span>
        </h2>
        <p className="text-[15px] text-[var(--color-text-secondary)] mb-8">
          Another year of data-driven decisions. Your portfolio story, tracked.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
          <button
            onClick={handleShareImage}
            disabled={shareStatus === 'generating'}
            className="px-6 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[14px] rounded-full transition-colors duration-200 text-center flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Share2 className="w-4 h-4" />
            {shareStatus === 'generating' ? 'Generating...' : shareStatus === 'copied' ? 'Copied!' : 'Share Wrapped'}
          </button>
          <button
            onClick={onShareTwitter}
            className="px-6 py-3 border border-white/10 hover:border-white/20 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-medium text-[14px] rounded-full transition-colors duration-200 text-center cursor-pointer"
          >
            Post on X
          </button>
          <a
            href="/dashboard"
            className="px-6 py-3 border border-white/10 hover:border-white/20 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-medium text-[14px] rounded-full transition-colors duration-200 text-center"
          >
            Close
          </a>
        </div>
      </div>

      {/* Right: Share card mock */}
      <div className="w-full max-w-[320px] rounded-2xl border border-white/10 bg-[var(--color-bg-base)] p-8 shadow-2xl">
        {/* Card header */}
        <div className="flex items-center gap-2 mb-6">
          <HelmMark size={16} />
          <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]" style={MONO}>
            Helm Wrapped {year}
          </span>
        </div>

        {/* Return */}
        <p
          className={cn(
            'text-[48px] font-bold tabular-nums leading-none mb-6',
            positive ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          {fmtPct(pct)}
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1" style={MONO}>
              Positions
            </p>
            <p className="text-[18px] font-bold text-[var(--color-text-primary)] tabular-nums">{positions}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1" style={MONO}>
              Trades
            </p>
            <p className="text-[18px] font-bold text-[var(--color-text-primary)] tabular-nums">{trades}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1" style={MONO}>
              Dividends
            </p>
            <p className="text-[18px] font-bold text-[var(--color-text-primary)] tabular-nums">{fmtDollar(dividends)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1" style={MONO}>
              Return
            </p>
            <p className={cn(
              'text-[18px] font-bold tabular-nums',
              positive ? 'text-emerald-400' : 'text-red-400',
            )}>
              {fmtDollar(data?.totalReturn.dollars ?? 0)}
            </p>
          </div>
        </div>

        {/* Hashtag */}
        <div className="pt-4 border-t border-white/[0.06]">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-gold)] font-medium text-center" style={MONO}>
            #HELMWRAPPED
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════

export default function WrappedPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<'quarter' | 'year'>('year');
  const { data, loading, error } = useWrapped(period);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const year = data?.periodLabel ?? new Date().getFullYear().toString();

  // Navigation
  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= TOTAL_SLIDES) return;
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  }, [currentSlide]);

  const next = useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo]);
  const prev = useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo]);

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

  // ── Share handlers ──

  const handleShareImage = useCallback(async () => {
    if (!data) return;
    const cardData = buildCardData(data, currentSlide);
    const blob = await generateShareCard(cardData);
    const file = new File([blob], 'helm-wrapped.png', { type: 'image/png' });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'My Helm Wrapped',
        text: 'Check out my investment year in review',
        url: 'https://helmterminal.dev/wrapped',
        files: [file],
      });
    } else {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
    }
  }, [data, currentSlide]);

  const handleShareTwitter = useCallback(() => {
    if (!data) return;
    const captions: Record<number, string> = {
      0: `My investment year in review is ready.\n\nGet yours free`,
      1: `My portfolio returned ${fmtPct(data.totalReturn.pct)} this year${data.spyComparison.beat ? ` — beat the S&P 500 by ${(data.totalReturn.pct - (data.spyComparison.spyReturn ?? 0)).toFixed(1)}%` : ''}.\n\nGet your Wrapped free`,
      2: `Best trade: ${data.bestPosition?.ticker ?? '---'} at ${fmtPct(data.bestPosition?.returnPct ?? 0)}.\nWorst: ${data.worstPosition?.ticker ?? '---'} at ${fmtPct(data.worstPosition?.returnPct ?? 0)}.\n\nEvery investor has both.`,
      3: `${data.tradeCount} trades this year.${data.totalDividends > 0 ? ` $${Math.round(data.totalDividends).toLocaleString()} in dividends.` : ''}\n\nMy Helm Wrapped`,
      4: `My portfolio conviction: ${data.sectorBreakdown?.[0]?.sector ?? 'diversified'}.\n\nWhat's yours?`,
      5: `${fmtPct(data.totalReturn.pct)} return\n${data.bestPosition?.ticker ?? '---'} was my MVP\n${data.tradeCount} trades\n\nGet yours free`,
    };
    const text = captions[currentSlide] ?? captions[5]!;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://helmterminal.dev/wrapped')}`;
    window.open(url, '_blank', 'width=550,height=420');
  }, [data, currentSlide]);

  // ── Loading / Error ──

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-base)] flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-[var(--color-gold)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] text-[var(--color-text-muted)]" style={MONO}>
          Generating your Wrapped...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg-base)] flex flex-col items-center justify-center">
        <p className="text-[var(--color-text-secondary)] mb-4">Unable to generate your Wrapped.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Slide renderer ──

  function renderSlide(index: number) {
    switch (index) {
      case 0: return <SlideCover data={data} onBegin={next} />;
      case 1: return <SlideReturn data={data} />;
      case 2: return <SlideBestWorst data={data} />;
      case 3: return <SlideTradingHabits data={data} />;
      case 4: return <SlideSectors data={data} />;
      case 5: return <SlideShareCard data={data} onShareImage={handleShareImage} onShareTwitter={handleShareTwitter} />;
      default: return null;
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[var(--color-bg-base)] select-none overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <AmbientGlow />
      <TopBar current={currentSlide} year={year} />

      {/* Slide content */}
      <div className="absolute inset-0 pt-14">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={reduceMotion ? undefined : slideVariants}
            initial={reduceMotion ? { opacity: 0 } : 'enter'}
            animate={reduceMotion ? { opacity: 1 } : 'center'}
            exit={reduceMotion ? { opacity: 0 } : 'exit'}
            transition={{ duration: reduceMotion ? 0.15 : 0.5, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-0"
          >
            {renderSlide(currentSlide)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      {currentSlide > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5 transition-colors cursor-pointer hidden md:flex"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {currentSlide < TOTAL_SLIDES - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full flex items-center justify-center text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] hover:bg-[var(--color-gold)]/5 transition-colors cursor-pointer hidden md:flex"
          aria-label="Next slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
