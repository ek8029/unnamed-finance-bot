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

const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${Math.round(abs)}`;
};

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
        <p className="text-[14px] tracking-[0.3em] text-[var(--color-gold)] mb-10" style={MONO}>HELM WRAPPED</p>

        <h1 className="font-bold leading-[0.88] tracking-[-0.05em] mb-12" style={{ fontSize: 'clamp(72px, 18vw, 160px)' }}>
          Your<br />
          <span className="italic font-normal text-[var(--color-gold)]" style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}>{year}</span>
          <br />wrapped.
        </h1>

        <p className="text-[20px] md:text-[24px] text-[var(--color-text-muted)] leading-relaxed mb-14">
          {positions > 0 ? `${positions} positions. ${trades} trades. One portfolio.` : `${trades > 0 ? `${trades} trades.` : ''} One portfolio.`}
        </p>

        <button
          onClick={(e) => { e.stopPropagation(); onBegin(); }}
          className="group inline-flex items-center gap-3 px-12 py-5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black font-bold text-[17px] rounded-full cursor-pointer transition-all"
          style={{ boxShadow: '0 12px 40px rgba(230,185,77,0.35)' }}
        >
          Begin Wrapped
          <ChevronRight className="w-6 h-6 transition-transform group-hover:translate-x-1" />
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

function SlideShareCard({ data, onShareImage: _onShareImage, onShareTwitter }: { data: WrappedData | null; onShareImage: () => void; onShareTwitter: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const pct = data?.totalReturn.pct ?? 0;
  const positive = pct >= 0;
  const trades = data?.tradeCount ?? 0;
  const dividends = data?.totalDividends ?? 0;
  const portfolioVal = data?.portfolioValue ?? 0;
  const year = data?.periodLabel ?? new Date().getFullYear().toString();
  const best = data?.bestPosition;
  const worst = data?.worstPosition;
  const personality = data?.investorPersonality;
  const spyReturn = data?.spyComparison?.spyReturn;
  const alpha = spyReturn != null ? pct - spyReturn : null;
  const sectors = data?.sectorBreakdown ?? [];
  const [shareStatus, setShareStatus] = useState<'idle' | 'generating' | 'copied'>('idle');

  const sectorColors = ['#E6B94D', '#7AA3C7', '#9FB89D', '#C8A165', '#8E7DC7', '#5A6070'];

  const handleShareImage = async () => {
    if (!cardRef.current) return;
    setShareStatus('generating');
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#0A0A0A',
      });
      // Convert data URL to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], 'helm-wrapped.png', { type: 'image/png' });

      // Try native share with image
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'My Helm Wrapped',
          url: 'https://helmterminal.dev/wrapped',
          files: [file],
        });
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2500);
        return;
      }

      // Try clipboard
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2500);
        return;
      } catch { /* not supported */ }

      // Fallback: download
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'helm-wrapped.png';
      a.click();
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2500);
    } catch {
      setShareStatus('idle');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center h-full px-4 md:px-6 gap-8 lg:gap-12 overflow-y-auto">
      {/* Left: CTA */}
      <div className="text-center lg:text-left max-w-sm shrink-0">
        <p className="text-[12px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-6" style={MONO}>
          &sect; 06 &mdash; Your Card
        </p>
        <h2 className="text-[clamp(32px,6vw,56px)] font-bold tracking-[-0.03em] leading-[1.05] mb-4">
          Take the Helm.{' '}
          <span className="italic text-[var(--color-gold)]" style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}>
            Again.
          </span>
        </h2>
        <p className="text-[16px] text-white/50 mb-8">
          Share your year. Flex your numbers.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
          <button
            onClick={handleShareImage}
            disabled={shareStatus === 'generating'}
            className="px-8 py-3.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black font-bold text-[14px] rounded-sm transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {shareStatus === 'generating' ? 'Sharing...' : shareStatus === 'copied' ? 'Copied!' : 'Share Wrapped'}
          </button>
          <button
            onClick={onShareTwitter}
            className="px-6 py-3.5 border border-white/10 hover:border-white/20 text-white/60 hover:text-white font-medium text-[14px] rounded-sm transition-colors cursor-pointer"
          >
            Post on X
          </button>
        </div>
      </div>

      {/* Right: V4 Share Card */}
      <div className="w-full max-w-[480px] shrink-0">
        <div
          ref={cardRef}
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: '#0A0A0A',
            border: '2px solid rgba(230,185,77,0.25)',
            padding: '28px 32px',
            aspectRatio: '4/5',
            boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
          }}
        >
          {/* Gold glow */}
          <div className="absolute top-[25%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-[0.04] blur-[80px] pointer-events-none" style={{ background: '#E6B94D' }} />

          {/* Top bar */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelmMark size={16} />
              <span className="text-[10px] font-bold tracking-[0.12em] text-[var(--color-gold)]" style={MONO}>
                HELM <span style={{ fontFamily: '"Source Serif Pro", Georgia, serif', fontStyle: 'italic', fontWeight: 400, letterSpacing: '0.03em' }}>Wrapped</span>
              </span>
            </div>
            <span className="text-[9px] text-white/40 tracking-[0.2em]" style={MONO}>{year}</span>
          </div>

          {/* Hero return */}
          <div className="relative z-10 text-center my-4">
            <p
              className={cn('font-bold leading-[0.82] tabular-nums tracking-[-0.04em]', positive ? 'text-[#4ADE80]' : 'text-[#F87171]')}
              style={{ fontSize: 'clamp(56px, 14vw, 88px)', textShadow: positive ? '0 0 60px rgba(74,222,128,0.2)' : '0 0 60px rgba(248,113,113,0.2)' }}
            >
              {fmtPct(pct)}
            </p>
            <div className="flex items-baseline justify-center gap-3 mt-2">
              <span style={{ fontFamily: '"Source Serif Pro", Georgia, serif', fontStyle: 'italic' }} className="text-[14px] text-[var(--color-gold)]">
                {positive ? 'beat the market' : 'tough year'}
              </span>
              {alpha != null && (
                <span className="text-[12px] text-[var(--color-gold)] font-bold" style={MONO}>ALPHA {fmtPct(alpha)}</span>
              )}
            </div>
          </div>

          {/* Sector bar */}
          {sectors.length > 0 && (
            <div className="relative z-10 mb-3">
              <div className="flex gap-[2px] h-[6px] rounded-full overflow-hidden mb-1.5">
                {sectors.map((s, i) => (
                  <div key={s.sector} style={{ flex: Math.max(s.pct, 2), background: sectorColors[i % sectorColors.length] }} className="rounded-sm" />
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {sectors.slice(0, 4).map((s, i) => (
                  <span key={s.sector} className="text-[8px] font-medium" style={{ ...MONO, color: sectorColors[i % sectorColors.length] }}>
                    {s.pct.toFixed(0)}% {s.sector}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Gold divider */}
          <div className="relative z-10 h-px my-3" style={{ background: 'linear-gradient(to right, transparent, rgba(230,185,77,0.3), transparent)' }} />

          {/* 2x3 stat grid */}
          <div className="relative z-10 grid grid-cols-3 gap-2.5">
            {/* MVP */}
            <div className="p-3.5 rounded-lg" style={{ background: 'rgba(230,185,77,0.03)', border: '1px solid rgba(230,185,77,0.12)' }}>
              <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>MVP</p>
              <p className="text-[28px] font-bold text-[var(--color-gold)] mt-1" style={MONO}>{best?.ticker ?? '---'}</p>
              <p className="text-[13px] font-semibold text-[#4ADE80]" style={MONO}>{best ? fmtPct(best.returnPct) : ''}</p>
            </div>
            {/* Type */}
            <div className="p-3.5 rounded-lg" style={{ background: 'rgba(230,185,77,0.03)', border: '1px solid rgba(230,185,77,0.12)' }}>
              <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>TYPE</p>
              <p className="text-[18px] font-bold text-[var(--color-gold)] mt-1 leading-tight" style={{ fontFamily: '"Source Serif Pro", Georgia, serif', fontStyle: 'italic' }}>
                {personality?.title ?? 'Investor'}
              </p>
            </div>
            {/* Trades */}
            <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>TRADES</p>
              <p className="text-[28px] font-bold text-white mt-1 tabular-nums" style={MONO}>{trades}</p>
            </div>
            {/* Dividends */}
            <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.05] overflow-hidden">
              <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>DIVIDENDS</p>
              <p className="text-[28px] font-bold text-white mt-1 tabular-nums" style={MONO}>{fmtCompact(dividends)}</p>
            </div>
            {/* Portfolio */}
            <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>PORTFOLIO</p>
              <p className="text-[28px] font-bold text-white mt-1 tabular-nums" style={MONO}>{fmtCompact(portfolioVal)}</p>
            </div>
            {/* Villain */}
            <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <p className="text-[9px] text-white/40 tracking-[0.15em]" style={MONO}>VILLAIN</p>
              <p className="text-[28px] font-bold text-[#F87171] mt-1" style={MONO}>{worst?.ticker ?? '---'}</p>
              <p className="text-[13px] font-semibold text-[#F87171]" style={MONO}>{worst ? fmtPct(worst.returnPct) : ''}</p>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="relative z-10 mt-3 flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'rgba(230,185,77,0.05)', border: '1px solid rgba(230,185,77,0.12)' }}>
            <span className="text-[8px] text-white/60 tracking-[0.1em] font-semibold" style={MONO}>HELMTERMINAL.DEV/WRAPPED</span>
            <span className="text-[9px] text-[var(--color-gold)] font-bold" style={{ fontFamily: '"Source Serif Pro", Georgia, serif', fontStyle: 'italic' }}>Get yours free &rarr;</span>
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
    const { generateShareCard } = await import('@/components/wrapped/share-card-canvas');
    const blob = await generateShareCard({
      year: data.periodLabel ?? new Date().getFullYear().toString(),
      returnPct: data.totalReturn.pct,
      returnDollars: data.totalReturn.dollars,
      spyReturn: data.spyComparison.spyReturn,
      beat: data.spyComparison.beat ?? false,
      bestTicker: data.bestPosition?.ticker ?? '---',
      bestReturnPct: data.bestPosition?.returnPct ?? 0,
      worstTicker: data.worstPosition?.ticker ?? '---',
      worstReturnPct: data.worstPosition?.returnPct ?? 0,
      personality: data.investorPersonality?.title ?? 'Investor',
      tradeCount: data.tradeCount,
      totalDividends: data.totalDividends,
      portfolioValue: data.portfolioValue,
      sectors: data.sectorBreakdown ?? [],
    });
    const file = new File([blob], 'helm-wrapped.png', { type: 'image/png' });

    // Try native share with image (mobile)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: 'My Helm Wrapped',
          url: 'https://helmterminal.dev/wrapped',
          files: [file],
        });
        return;
      } catch { /* cancelled */ }
    }

    // Try clipboard image
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return;
    } catch { /* not supported */ }

    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'helm-wrapped.png';
    a.click();
    URL.revokeObjectURL(url);
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
