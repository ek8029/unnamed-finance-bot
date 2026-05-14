'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, X, Share2 } from 'lucide-react';
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
// Slide 1: COVER — cinematic opener
// Dark with gold glow. Massive serif headline.
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
  const positions = data?.positionCount ?? 0;

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-8 overflow-hidden">
      <div className="absolute -top-[30%] -left-[20%] w-[80vw] h-[80vw] rounded-full opacity-[0.08] blur-[140px] pointer-events-none" style={{ background: 'radial-gradient(circle, #E6B94D, transparent 65%)' }} />

      <div className="relative z-10 max-w-lg">
        <p className="text-[12px] tracking-[0.3em] text-[var(--color-gold)] mb-8" style={MONO}>HELM WRAPPED</p>

        <h1 className="text-[clamp(60px,15vw,100px)] font-bold leading-[0.88] tracking-[-0.05em] mb-10">
          Your<br />
          <span className="italic font-normal text-[var(--color-gold)]" style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}>{year}</span>
          <br />wrapped.
        </h1>

        <p className="text-[18px] text-[var(--color-text-muted)] leading-relaxed mb-12">
          {positions > 0 ? `${positions} positions. ${trades} trades. One portfolio.` : `${trades > 0 ? `${trades} trades.` : ''} One portfolio.`}
        </p>

        <button
          onClick={(e) => { e.stopPropagation(); onBegin(); }}
          className="group inline-flex items-center gap-2.5 px-10 py-4 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black font-bold text-[15px] rounded-full cursor-pointer transition-all"
          style={{ boxShadow: '0 8px 32px rgba(230,185,77,0.3)' }}
        >
          Begin Wrapped
          <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 2: THE RETURN
// Green/red tinted bg. Number fills screen.
// ═══════════════════════════════════════════

function SlideReturn({ data }: { data: WrappedData | null }) {
  const pct = data?.totalReturn.pct ?? 0;
  const positive = pct >= 0;
  const spyReturn = data?.spyComparison.spyReturn;
  const alpha = spyReturn != null ? pct - spyReturn : null;

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 text-center overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] rounded-full opacity-[0.07] blur-[150px] pointer-events-none" style={{ background: `radial-gradient(circle, ${positive ? '#4ADE80' : '#F87171'}, transparent 60%)` }} />

      <div className="relative z-10">
        <p className="text-[14px] text-[var(--color-text-muted)] mb-3">Your portfolio returned</p>

        <div
          className={cn('text-[clamp(100px,30vw,240px)] font-bold leading-none tabular-nums tracking-[-0.05em]', positive ? 'text-[#4ADE80]' : 'text-[#F87171]')}
          style={{ textShadow: positive ? '0 0 60px rgba(74,222,128,0.35), 0 0 120px rgba(74,222,128,0.15)' : '0 0 60px rgba(248,113,113,0.35), 0 0 120px rgba(248,113,113,0.15)' }}
        >
          {fmtPct(pct)}
        </div>

        <div className="flex items-center justify-center gap-8 mt-8">
          {spyReturn != null && (
            <div className="text-center">
              <p className="text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] mb-1" style={MONO}>S&amp;P 500</p>
              <p className="text-[20px] font-bold" style={MONO}>{fmtPct(spyReturn)}</p>
            </div>
          )}
          {alpha != null && (
            <div className="text-center">
              <p className="text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] mb-1" style={MONO}>ALPHA</p>
              <p className={cn('text-[20px] font-bold', alpha >= 0 ? 'text-[var(--color-gold)]' : 'text-[#F87171]')} style={MONO}>{fmtPct(alpha)}</p>
            </div>
          )}
          {data?.spyComparison.beat && (
            <div className="px-5 py-2 rounded-full bg-[#4ADE80]/10 border border-[#4ADE80]/20">
              <p className="text-[14px] font-bold text-[#4ADE80]" style={MONO}>BEAT THE MARKET</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 3: MVP & VILLAIN
// Green glow top, red glow bottom
// ═══════════════════════════════════════════

function SlideBestWorst({ data }: { data: WrappedData | null }) {
  const best = data?.bestPosition;
  const worst = data?.worstPosition;

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 overflow-hidden">
      <div className="absolute -top-[20%] -right-[20%] w-[50vw] h-[50vw] rounded-full opacity-[0.06] blur-[120px] pointer-events-none" style={{ background: '#4ADE80' }} />
      <div className="absolute -bottom-[20%] -left-[20%] w-[50vw] h-[50vw] rounded-full opacity-[0.05] blur-[120px] pointer-events-none" style={{ background: '#F87171' }} />

      <div className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <p className="text-[13px] tracking-[0.2em] text-[#4ADE80] mb-3" style={MONO}>YOUR MVP</p>
          <p className="text-[clamp(48px,12vw,80px)] font-bold text-[var(--color-gold)] tracking-tight leading-none" style={MONO}>{best?.ticker ?? '---'}</p>
          <p className="text-[clamp(32px,8vw,56px)] font-bold text-[#4ADE80] tabular-nums mt-2">{best ? fmtPct(best.returnPct) : '---'}</p>
          <p className="text-[14px] text-[var(--color-text-muted)] mt-2">{best?.name ?? ''} &middot; {best ? fmtDollar(best.returnDollars) : ''}</p>
        </div>

        <div className="w-16 h-px bg-white/10 mx-auto my-6" />

        <div className="text-center">
          <p className="text-[13px] tracking-[0.2em] text-[#F87171] mb-3" style={MONO}>YOUR VILLAIN</p>
          <p className="text-[clamp(48px,12vw,80px)] font-bold text-[#F87171] tracking-tight leading-none" style={MONO}>{worst?.ticker ?? '---'}</p>
          <p className="text-[clamp(32px,8vw,56px)] font-bold text-[#F87171] tabular-nums mt-2">{worst ? fmtPct(worst.returnPct) : '---'}</p>
          <p className="text-[14px] text-[var(--color-text-muted)] mt-2">{worst?.name ?? ''} &middot; {worst ? fmtDollar(worst.returnDollars) : ''}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 4: HABITS
// Gold tint. Trade count hero number.
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

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 overflow-hidden">
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[70vw] h-[70vw] rounded-full opacity-[0.05] blur-[120px] pointer-events-none" style={{ background: '#E6B94D' }} />

      <div className="relative z-10 text-center">
        <p className="text-[clamp(80px,22vw,160px)] font-bold text-[var(--color-gold)] leading-none tabular-nums tracking-tight">{trades}</p>
        <p className="text-[18px] text-[var(--color-text-muted)] mt-2 mb-2">trades this year</p>
        {activeDayLabel && (
          <p className="text-[15px] text-[var(--color-text-muted)] mb-10">Mostly on <span className="text-[var(--color-gold)] font-semibold">{activeDayLabel}s</span></p>
        )}

        <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto">
          {[
            { value: fmtDollar(dividends), label: 'DIVIDENDS' },
            { value: positions.toString(), label: 'POSITIONS' },
            { value: fmtDollar(portfolioVal), label: 'PORTFOLIO' },
            { value: activeDay ? `${activeDay.trades}` : '—', label: 'BUSIEST DAY' },
          ].map((s) => (
            <div key={s.label} className="p-5 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
              <p className="text-[clamp(24px,5vw,32px)] font-bold tabular-nums">{s.value}</p>
              <p className="text-[11px] tracking-[0.15em] text-[var(--color-gold)] mt-2" style={MONO}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 5: CONVICTION
// Blue/purple tint. Big sector % hero.
// ═══════════════════════════════════════════

function SlideSectors({ data }: { data: WrappedData | null }) {
  const sectors = data?.sectorBreakdown ?? [];
  const nwChange = data?.netWorthChange;
  const sectorColors = ['#E6B94D', '#4ADE80', '#7AA3C7', '#A78BFA', '#C8A165', '#5A6070'];
  const topSector = sectors.length > 0 ? sectors[0] : null;

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[70vw] h-[70vw] rounded-full opacity-[0.06] blur-[120px] pointer-events-none" style={{ background: '#7AA3C7' }} />

      <div className="relative z-10 text-center w-full max-w-lg">
        {topSector && (
          <>
            <p className="text-[clamp(80px,22vw,160px)] font-bold leading-none tabular-nums tracking-tight">{topSector.pct.toFixed(0)}%</p>
            <p className="text-[clamp(20px,5vw,32px)] font-bold text-[var(--color-gold)] mt-2 mb-2" style={MONO}>{topSector.sector}</p>
            <p className="text-[16px] text-[var(--color-text-muted)] mb-10">{topSector.pct >= 40 ? 'Concentrated conviction.' : 'Your biggest bet.'}</p>
          </>
        )}

        {sectors.length > 0 && (
          <div className="mb-8">
            <div className="flex gap-1 h-4 rounded-full overflow-hidden">
              {sectors.map((s, i) => (
                <div key={s.sector} style={{ flex: Math.max(s.pct, 2), background: sectorColors[i % sectorColors.length] }} className="rounded-sm" />
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-5">
              {sectors.slice(0, 5).map((s, i) => (
                <span key={s.sector} className="flex items-center gap-2 text-[14px] text-[var(--color-text-muted)]" style={MONO}>
                  <span className="w-3 h-3 rounded-full" style={{ background: sectorColors[i % sectorColors.length] }} />
                  {s.sector} {s.pct.toFixed(0)}%
                </span>
              ))}
            </div>
          </div>
        )}

        {nwChange && nwChange.change !== 0 && (
          <div className="flex items-center justify-center gap-10 mt-4">
            <div>
              <p className="text-[12px] tracking-[0.15em] text-[var(--color-text-muted)]" style={MONO}>NET WORTH</p>
              <p className={cn('text-[28px] font-bold mt-1 tabular-nums', nwChange.change >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]')}>{fmtDollar(nwChange.change)}</p>
            </div>
            <div>
              <p className="text-[12px] tracking-[0.15em] text-[var(--color-text-muted)]" style={MONO}>CHANGE</p>
              <p className={cn('text-[28px] font-bold mt-1 tabular-nums', nwChange.changePct >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]')}>{fmtPct(nwChange.changePct)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 6: INVESTOR PERSONALITY
// Warm gold atmosphere. Serif italic hero.
// ═══════════════════════════════════════════

function SlidePersonality({ data }: { data: WrappedData | null }) {
  const p = data?.investorPersonality;
  const title = p?.title ?? 'The Investor';
  const desc = p?.description ?? 'A unique approach to building wealth.';
  const traits = p?.traits ?? [];

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 text-center overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] rounded-full opacity-[0.08] blur-[140px] pointer-events-none" style={{ background: '#E6B94D' }} />

      <div className="relative z-10">
        <p className="text-[16px] text-[var(--color-text-muted)] mb-6">You invest like</p>

        <h2 className="text-[clamp(48px,13vw,96px)] font-bold tracking-[-0.04em] leading-[0.9] mb-6" style={{ fontFamily: '"Source Serif Pro", Georgia, serif', fontStyle: 'italic' }}>
          <span className="text-[var(--color-gold)]">{title}</span>
        </h2>

        <div className="w-20 h-1 bg-[var(--color-gold)] rounded-full mx-auto mb-8" />

        <p className="text-[18px] text-[var(--color-text-muted)] leading-relaxed max-w-md mx-auto mb-8">{desc}</p>

        {traits.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2.5 max-w-md mx-auto">
            {traits.map((t) => (
              <span key={t} className="px-5 py-2.5 rounded-full border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/[0.08] text-[14px] font-medium text-[var(--color-gold)]" style={MONO}>{t}</span>
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
            {shareStatus === 'generating' ? 'Sharing...' : shareStatus === 'copied' ? 'Copied!' : 'Share Wrapped'}
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
