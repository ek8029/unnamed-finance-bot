'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useWrapped, type WrappedData } from '@/hooks/use-financial-data';
import { HelmMark } from '@/components/helm-mark';

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

const TOTAL_SLIDES = 7;


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

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-8 overflow-hidden">
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Eyebrow */}
        <p
          className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-10"
          style={MONO}
        >
          HELM WRAPPED
        </p>

        {/* Headline */}
        <h1
          className="text-[clamp(72px,18vw,160px)] font-bold tracking-[-0.055em] leading-[0.85] mb-10"
        >
          You had a{' '}
          <span
            className="italic font-normal text-[var(--color-gold)]"
            style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}
          >
            year.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-[18px] text-[var(--color-text-muted)] mb-14">
          12 months. {trades} trades. One portfolio.
        </p>

        {/* CTA */}
        <button
          onClick={(e) => { e.stopPropagation(); onBegin(); }}
          className="px-10 py-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black rounded-sm cursor-pointer transition-colors"
          style={MONO}
        >
          <span className="text-[11px] font-bold tracking-[0.18em] uppercase">
            BEGIN WRAP &rarr;
          </span>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 2: THE RETURN
// ═══════════════════════════════════════════

function SlideReturn({ data }: { data: WrappedData | null }) {
  const pct = data?.totalReturn.pct ?? 0;
  const positive = pct >= 0;
  const spyReturn = data?.spyComparison.spyReturn;
  const alpha = spyReturn != null ? pct - spyReturn : null;

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 text-center overflow-hidden">
      <div className="relative z-10 w-full max-w-2xl">
        {/* Eyebrow */}
        <p
          className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-8"
          style={MONO}
        >
          &sect; 01 &mdash; THE RETURN
        </p>

        {/* Intro */}
        <p className="text-[28px] text-[var(--color-text-muted)] mb-4">
          Your portfolio returned
        </p>

        {/* Massive number */}
        <div
          className={cn(
            'text-[clamp(120px,30vw,260px)] font-bold leading-[0.85] tabular-nums tracking-[-0.06em]',
            positive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]',
          )}
          style={{
            textShadow: positive
              ? '0 0 80px rgba(74,222,128,0.3)'
              : '0 0 80px rgba(248,113,113,0.3)',
          }}
        >
          {pct >= 0 ? '+' : ''}{Math.abs(pct).toFixed(2)}
          <span className="text-[clamp(60px,15vw,140px)]">%</span>
        </div>

        {/* Comparison stats */}
        <div className="flex items-center justify-center gap-10 mt-10">
          {spyReturn != null && (
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2" style={MONO}>S&amp;P 500</p>
              <p className="text-[28px] font-bold tabular-nums" style={MONO}>{fmtPct(spyReturn)}</p>
            </div>
          )}
          {alpha != null && (
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2" style={MONO}>ALPHA</p>
              <p className={cn('text-[28px] font-bold tabular-nums', alpha >= 0 ? 'text-[var(--color-gold)]' : 'text-[var(--color-negative-text)]')} style={MONO}>{fmtPct(alpha)}</p>
            </div>
          )}
          {data?.spyComparison.beat && (
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2" style={MONO}>PEER RANK</p>
              <p className="text-[28px] font-bold tabular-nums text-[var(--color-positive)]" style={MONO}>Top 15%</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 3: MVP & VILLAIN
// ═══════════════════════════════════════════

function SlideBestWorst({ data }: { data: WrappedData | null }) {
  const best = data?.bestPosition;
  const worst = data?.worstPosition;

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 overflow-hidden">
      <div className="relative z-10 w-full max-w-2xl">
        {/* Eyebrow */}
        <p
          className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-8 text-center"
          style={MONO}
        >
          &sect; 02 &mdash; WINNERS &amp; LOSERS
        </p>

        {/* Headline */}
        <h2 className="text-[clamp(32px,6vw,56px)] font-bold text-center leading-tight mb-10">
          Your MVP was{' '}
          <span className="text-[var(--color-positive)]">{best?.ticker ?? '---'}</span>.
          {' '}Your villain was{' '}
          <span className="text-[var(--color-negative-text)]">{worst?.ticker ?? '---'}</span>.
        </h2>

        {/* Two cards side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* MVP card */}
          <div className="p-8 border border-[var(--color-positive)]/20 bg-[var(--color-positive)]/[0.04] rounded-lg">
            <p className="text-[32px] font-bold text-[var(--color-positive)]" style={MONO}>{best?.ticker ?? '---'}</p>
            <p className="text-[14px] text-[var(--color-text-muted)] mt-1">{best?.name ?? ''}</p>
            <p className="text-[clamp(36px,8vw,64px)] font-bold text-[var(--color-positive)] tabular-nums mt-6">
              {best ? fmtPct(best.returnPct) : '---'}
            </p>
            <p className="text-[14px] text-[var(--color-text-muted)] mt-2" style={MONO}>
              {best ? fmtDollar(best.returnDollars) : ''}
            </p>
          </div>

          {/* Villain card */}
          <div className="p-8 border border-[var(--color-negative-text)]/20 bg-[var(--color-negative-text)]/[0.04] rounded-lg">
            <p className="text-[32px] font-bold text-[var(--color-negative-text)]" style={MONO}>{worst?.ticker ?? '---'}</p>
            <p className="text-[14px] text-[var(--color-text-muted)] mt-1">{worst?.name ?? ''}</p>
            <p className="text-[clamp(36px,8vw,64px)] font-bold text-[var(--color-negative-text)] tabular-nums mt-6">
              {worst ? fmtPct(worst.returnPct) : '---'}
            </p>
            <p className="text-[14px] text-[var(--color-text-muted)] mt-2" style={MONO}>
              {worst ? fmtDollar(worst.returnDollars) : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 4: HABITS
// ═══════════════════════════════════════════

function SlideTradingHabits({ data }: { data: WrappedData | null }) {
  const trades = data?.tradeCount ?? 0;
  const activeDay = data?.mostActiveTradingDay;
  const dividends = data?.totalDividends ?? 0;
  const positions = data?.positionCount ?? 0;
  const portfolioVal = data?.portfolioValue ?? 0;

  const activeDayLabel = activeDay
    ? new Date(activeDay.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
    : null;

  const stats = [
    { value: trades.toString(), label: 'TOTAL TRADES', sub: 'Across all positions' },
    { value: positions.toString(), label: 'POSITIONS', sub: 'Active holdings' },
    { value: fmtDollar(dividends), label: 'DIVIDENDS', sub: 'Income collected' },
    { value: activeDay ? `${activeDay.trades}` : '—', label: 'BUSIEST DAY', sub: activeDay ? new Date(activeDay.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '' },
  ];

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 overflow-hidden">
      <div className="relative z-10 w-full max-w-2xl">
        {/* Eyebrow */}
        <p
          className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-8 text-center"
          style={MONO}
        >
          &sect; 03 &mdash; HOW YOU TRADED
        </p>

        {/* Headline */}
        <h2 className="text-[clamp(28px,5vw,44px)] font-bold text-center leading-tight mb-10">
          You made <span className="text-[var(--color-gold)]">{trades}</span> trades
          {activeDayLabel && (
            <> &mdash; mostly on <span className="text-[var(--color-gold)]">{activeDayLabel}s</span></>
          )}.
        </h2>

        {/* Stat grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="p-6 border border-white/[0.06] rounded-lg">
              <p className="text-[clamp(28px,5vw,40px)] font-bold tabular-nums">{s.value}</p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-gold)] mt-3" style={MONO}>{s.label}</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-2">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 5: CONVICTION (sectors)
// ═══════════════════════════════════════════

function SlideSectors({ data }: { data: WrappedData | null }) {
  const sectors = data?.sectorBreakdown ?? [];
  const nwChange = data?.netWorthChange;
  const sectorColors = ['#E6B94D', '#4ADE80', '#7AA3C7', '#A78BFA', '#C8A165', '#5A6070'];
  const topSector = sectors.length > 0 ? sectors[0] : null;

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 overflow-hidden">
      <div className="relative z-10 w-full max-w-2xl">
        {/* Eyebrow */}
        <p
          className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-8 text-center"
          style={MONO}
        >
          &sect; 04 &mdash; YOUR BETS
        </p>

        {/* Headline */}
        {topSector && (
          <h2 className="text-[clamp(28px,5vw,44px)] font-bold text-center leading-tight mb-10">
            {topSector.pct >= 40
              ? 'Nearly half your gains came from one sector.'
              : <><span className="text-[var(--color-gold)]">{topSector.sector}</span> led your portfolio.</>
            }
          </h2>
        )}

        {/* Sector bar */}
        {sectors.length > 0 && (
          <div className="flex gap-1 h-14 mb-4">
            {sectors.map((s, i) => (
              <div
                key={s.sector}
                className="rounded-sm flex items-center justify-center overflow-hidden"
                style={{
                  flex: Math.max(s.pct, 2),
                  background: sectorColors[i % sectorColors.length],
                }}
              >
                {s.pct >= 10 && (
                  <span className="text-[11px] font-bold text-black/80 truncate px-2" style={MONO}>
                    {s.sector} {s.pct.toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 3-col stat row */}
        <div className="flex items-start justify-center gap-10 mt-10">
          {topSector && (
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2" style={MONO}>TOP SECTOR</p>
              <p className="text-[28px] font-bold">{topSector.sector}</p>
              <p className="text-[13px] text-[var(--color-text-muted)] mt-1">{topSector.pct.toFixed(0)}% of portfolio</p>
            </div>
          )}
          {nwChange && nwChange.change !== 0 && (
            <>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2" style={MONO}>NET WORTH</p>
                <p className={cn('text-[28px] font-bold tabular-nums', nwChange.change >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]')}>{fmtDollar(nwChange.change)}</p>
                <p className="text-[13px] text-[var(--color-text-muted)] mt-1">Change this period</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-2" style={MONO}>CHANGE</p>
                <p className={cn('text-[28px] font-bold tabular-nums', nwChange.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]')}>{fmtPct(nwChange.changePct)}</p>
                <p className="text-[13px] text-[var(--color-text-muted)] mt-1">Percentage</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 6: INVESTOR PERSONALITY
// ═══════════════════════════════════════════

function SlidePersonality({ data }: { data: WrappedData | null }) {
  const p = data?.investorPersonality;
  const title = p?.title ?? 'The Investor';
  const desc = p?.description ?? 'A unique approach to building wealth.';
  const traits = p?.traits ?? [];

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 text-center overflow-hidden">
      <div className="relative z-10 flex flex-col items-center">
        {/* Eyebrow */}
        <p
          className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-8"
          style={MONO}
        >
          &sect; 05 &mdash; YOUR TYPE
        </p>

        {/* Intro */}
        <p className="text-[20px] text-[var(--color-text-muted)] mb-6">You invest like</p>

        {/* Personality title */}
        <h2
          className="text-[clamp(48px,13vw,96px)] font-bold tracking-[-0.04em] leading-[0.9] mb-6 text-[var(--color-gold)]"
          style={{ fontFamily: '"Source Serif Pro", Georgia, serif', fontStyle: 'italic' }}
        >
          {title}
        </h2>

        {/* Gold underline bar */}
        <div className="w-24 h-1 bg-[var(--color-gold)] rounded-full mb-8" />

        {/* Description */}
        <p className="text-[18px] text-[var(--color-text-muted)] leading-relaxed max-w-lg mb-8">{desc}</p>

        {/* Trait pills */}
        {traits.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2.5 max-w-lg">
            {traits.map((t) => (
              <span
                key={t}
                className="px-5 py-2.5 rounded-full border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/[0.08] text-[14px] text-[var(--color-gold)]"
                style={MONO}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 7: SHARE CARD
// ═══════════════════════════════════════════

function SlideShareCard({ data, onShareImage, onShareTwitter }: { data: WrappedData | null; onShareImage: () => void; onShareTwitter: () => void }) {
  const pct = data?.totalReturn.pct ?? 0;
  const positive = pct >= 0;
  const trades = data?.tradeCount ?? 0;
  const dividends = data?.totalDividends ?? 0;
  const year = data?.periodLabel ?? new Date().getFullYear().toString();
  const alpha = data?.spyComparison.spyReturn != null ? pct - data.spyComparison.spyReturn : null;
  const mvpTicker = data?.bestPosition?.ticker ?? '---';
  const personalityTitle = data?.investorPersonality?.title ?? 'The Investor';
  const portfolioVal = data?.portfolioValue ?? 0;
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
    <div className="relative flex flex-col items-center justify-center h-full px-6 overflow-hidden">
      <div className="relative z-10 w-full max-w-5xl">
        {/* Eyebrow */}
        <p
          className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-8 text-center lg:text-left"
          style={MONO}
        >
          &sect; 06 &mdash; YOUR CARD
        </p>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* LEFT: CTA */}
          <div className="text-center lg:text-left">
            <h2 className="text-[clamp(36px,6vw,64px)] font-bold tracking-tight leading-[1.1] mb-5">
              Take the Helm.{' '}
              <span
                className="italic text-[var(--color-gold)]"
                style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}
              >
                Again.
              </span>
            </h2>
            <p className="text-[16px] text-[var(--color-text-muted)] mb-8">
              Your Helm terminal is ready.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <button
                onClick={handleShareImage}
                disabled={shareStatus === 'generating'}
                className="px-7 py-3.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black font-bold text-[11px] uppercase tracking-[0.18em] rounded-sm transition-colors cursor-pointer disabled:opacity-60"
                style={MONO}
              >
                {shareStatus === 'generating' ? 'Sharing...' : shareStatus === 'copied' ? 'Copied!' : 'Share card \u2192'}
              </button>
              <button
                onClick={onShareTwitter}
                className="px-7 py-3.5 border border-white/10 hover:border-white/20 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-bold text-[11px] uppercase tracking-[0.18em] rounded-sm transition-colors cursor-pointer"
                style={MONO}
              >
                Post on X
              </button>
            </div>
          </div>

          {/* RIGHT: Share card preview */}
          <div className="flex justify-center lg:justify-end">
            <div
              className="relative w-full max-w-[340px] rounded-xl border border-[var(--color-gold)]/30 p-8 shadow-2xl"
              style={{
                aspectRatio: '3/4',
                background: 'linear-gradient(135deg, #0F0F0F, #080808)',
              }}
            >
              {/* Card top row */}
              <div className="flex items-center justify-between mb-8">
                <HelmMark size={22} />
                <span className="text-[9px] uppercase tracking-[0.2em] text-[var(--color-gold)]" style={MONO}>
                  WRAPPED {year}
                </span>
              </div>

              {/* Return */}
              <p
                className={cn(
                  'text-[clamp(48px,10vw,88px)] font-bold tabular-nums leading-none mb-2',
                  positive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]',
                )}
              >
                {fmtPct(pct)}
              </p>

              {/* Peer rank placeholder */}
              <p className="text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-4" style={MONO}>
                TOP 15% OF HELM USERS
              </p>

              {/* Gold divider */}
              <div className="h-px bg-[var(--color-gold)]/20 my-7" />

              {/* 2x2 stat grid + extra rows */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1" style={MONO}>MVP</p>
                  <p className="text-[16px] font-bold text-[var(--color-gold)] tabular-nums" style={MONO}>{mvpTicker}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1" style={MONO}>TRADES</p>
                  <p className="text-[16px] font-bold tabular-nums" style={MONO}>{trades}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1" style={MONO}>DIVIDENDS</p>
                  <p className="text-[16px] font-bold tabular-nums" style={MONO}>{fmtDollar(dividends)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1" style={MONO}>ALPHA</p>
                  <p className="text-[16px] font-bold text-[var(--color-gold)] tabular-nums" style={MONO}>{alpha != null ? fmtPct(alpha) : '---'}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1" style={MONO}>TYPE</p>
                  <p className="text-[14px] font-bold text-[var(--color-gold)]" style={MONO}>{personalityTitle}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1" style={MONO}>PORTFOLIO</p>
                  <p className="text-[16px] font-bold tabular-nums" style={MONO}>{fmtDollar(portfolioVal)}</p>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="absolute bottom-6 left-8 right-8 flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]" style={MONO}>
                  HELMTERMINAL.DEV
                </span>
                <span className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]" style={MONO}>
                  #HELMWRAPPED
                </span>
              </div>
            </div>
          </div>
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
    // Build shareable text summary
    const lines = [
      `My ${data.periodLabel ?? new Date().getFullYear()} Wrapped — Helm Terminal`,
      '',
      `Return: ${fmtPct(data.totalReturn.pct)} (${fmtDollar(data.totalReturn.dollars)})`,
      data.spyComparison.beat ? `Beat the S&P 500 by ${(data.totalReturn.pct - (data.spyComparison.spyReturn ?? 0)).toFixed(1)}%` : null,
      '',
      `MVP: ${data.bestPosition?.ticker ?? '---'} (${fmtPct(data.bestPosition?.returnPct ?? 0)})`,
      `Villain: ${data.worstPosition?.ticker ?? '---'} (${fmtPct(data.worstPosition?.returnPct ?? 0)})`,
      '',
      `${data.tradeCount} trades · ${data.positionCount ?? 0} positions`,
      data.totalDividends > 0 ? `${fmtDollar(data.totalDividends)} in dividends` : null,
      data.investorPersonality?.title ? `Type: ${data.investorPersonality.title}` : null,
      data.sectorBreakdown?.[0] ? `Top sector: ${data.sectorBreakdown[0].sector} (${data.sectorBreakdown[0].pct.toFixed(0)}%)` : null,
      '',
      'Get yours free → helmterminal.dev/wrapped',
    ].filter(Boolean).join('\n');

    // Try native share (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Helm Wrapped',
          text: lines,
          url: 'https://helmterminal.dev/wrapped',
        });
        return;
      } catch { /* user cancelled */ }
    }

    // Fallback: copy text to clipboard
    await navigator.clipboard.writeText(lines);
  }, [data]);

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
      case 5: return <SlidePersonality data={data} />;
      case 6: return <SlideShareCard data={data} onShareImage={handleShareImage} onShareTwitter={handleShareTwitter} />;
      default: return null;
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[var(--color-bg-base)] select-none overflow-hidden cursor-pointer"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        const tag = (e.target as HTMLElement).closest('button, a, [role="button"], input');
        if (!tag && currentSlide < TOTAL_SLIDES - 1) next();
      }}
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
