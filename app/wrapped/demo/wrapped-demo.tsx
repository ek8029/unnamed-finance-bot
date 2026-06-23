'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { WrappedData } from '@/hooks/use-financial-data';
import { HelmMark } from '@/components/helm-mark';

// ═══════════════════════════════════════════
// Helpers (same as dashboard wrapped)
// ═══════════════════════════════════════════

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

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
// Demo data — convincing Active Trader profile
// ═══════════════════════════════════════════

const DEMO_DATA: WrappedData = {
  period: 'year',
  periodLabel: '2025',
  periodRange: 'Jan 1 – Dec 31, 2025',
  totalReturn: { pct: 22.47, dollars: 34_891 },
  bestPosition: { ticker: 'NVDA', name: 'NVIDIA Corporation', returnPct: 87.3, returnDollars: 14_210, value: 30_490 },
  worstPosition: { ticker: 'INTC', name: 'Intel Corporation', returnPct: -41.2, returnDollars: -3_870, value: 5_520 },
  totalDividends: 1_847,
  tradeCount: 214,
  spyComparison: { userReturn: 22.47, spyReturn: 14.12, beat: true },
  taxSavings: 1_240,
  mostActiveTradingDay: { date: '2025-08-05', trades: 18 },
  sectorBreakdown: [
    { sector: 'Technology', pct: 48, value: 74_400 },
    { sector: 'Healthcare', pct: 16, value: 24_800 },
    { sector: 'Finance', pct: 14, value: 21_700 },
    { sector: 'Energy', pct: 11, value: 17_050 },
    { sector: 'Consumer', pct: 7, value: 10_850 },
    { sector: 'Other', pct: 4, value: 6_200 },
  ],
  healthScoreTrend: { start: 62, end: 78, change: 16 },
  netWorthChange: { start: 155_000, end: 189_891, change: 34_891, changePct: 22.51 },
  positionCount: 31,
  portfolioValue: 155_000,
  investorPersonality: {
    type: 'active-trader',
    title: 'The Active Trader',
    description: "Markets don't sleep and neither does your portfolio. Always in motion, always looking for the next opportunity.",
    traits: ['Market-aware', 'Opportunity-driven', 'Decisive'],
  },
};

// ═══════════════════════════════════════════
// Ambient glow
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
// Top bar
// ═══════════════════════════════════════════

function TopBar({ current }: { current: number }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-3 md:px-10 md:py-4">
      <div className="flex items-center gap-2.5 shrink-0">
        <HelmMark size={18} />
        <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]" style={MONO}>
          Helm / Wrapped &middot; Demo
        </span>
      </div>
      <div className="flex-1 flex items-center gap-1.5 max-w-[200px] mx-auto">
        {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-[2px] flex-1 rounded-full transition-colors duration-300',
              i <= current ? 'bg-[var(--color-gold)]' : 'bg-white/10',
            )}
          />
        ))}
      </div>
      <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums shrink-0" style={MONO}>
        {String(current + 1).padStart(2, '0')} / {String(TOTAL_SLIDES).padStart(2, '0')}
      </span>
      <a
        href="/wrapped"
        className="ml-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-white/50 hover:text-white transition-colors"
        aria-label="Get your own Wrapped"
      >
        <X className="w-4 h-4" />
      </a>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide variants
// ═══════════════════════════════════════════

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? '60%' : '-60%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-60%' : '60%', opacity: 0 }),
};

// ═══════════════════════════════════════════
// Slide 1: COVER
// ═══════════════════════════════════════════

function SlideCover({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-5 md:px-8 overflow-hidden">
      <div className="absolute -top-[30%] -left-[20%] w-[80vw] h-[80vw] rounded-full opacity-[0.08] blur-[140px] pointer-events-none" style={{ background: 'radial-gradient(circle, var(--color-gold), transparent 65%)' }} />
      <div className="relative z-10 max-w-lg w-full">
        <p className="font-semibold text-[13px] uppercase tracking-[0.18em] text-[var(--color-gold)] mb-10" style={MONO}>HELM WRAPPED, DEMO</p>
        <h1 className="font-bold leading-[0.88] tracking-[-0.05em] mb-12" style={{ fontSize: 'clamp(72px, 18vw, 160px)' }}>
          Your<br />
          <span className="italic font-normal text-[var(--color-gold)]" style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}>2025</span>
          <br />wrapped.
        </h1>
        <p className="text-[20px] md:text-[24px] text-[var(--color-text-muted)] leading-relaxed mb-14">
          31 positions. 214 trades. One portfolio.
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
// ═══════════════════════════════════════════

function SlideReturn() {
  const d = DEMO_DATA;
  const pct = d.totalReturn.pct;
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-5 md:px-6 text-center overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] rounded-full opacity-[0.07] blur-[150px] pointer-events-none" style={{ background: 'radial-gradient(circle, #4ADE80, transparent 60%)' }} />
      <div className="relative z-10">
        <p className="text-[14px] text-[var(--color-text-muted)] mb-3">Your portfolio returned</p>
        <div
          className="text-[clamp(60px,18vw,240px)] font-bold leading-none tabular-nums tracking-[-0.05em] text-[#4ADE80]"
          style={{ textShadow: '0 0 60px rgba(74,222,128,0.35), 0 0 120px rgba(74,222,128,0.15)' }}
        >
          {fmtPct(pct)}
        </div>
        <div className="flex items-center justify-center gap-8 mt-8">
          <div className="text-center">
            <p className="text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] mb-1" style={MONO}>S&amp;P 500</p>
            <p className="text-[20px] font-bold" style={MONO}>{fmtPct(d.spyComparison.spyReturn!)}</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] mb-1" style={MONO}>ALPHA</p>
            <p className="text-[20px] font-bold text-[var(--color-gold)]" style={MONO}>{fmtPct(pct - d.spyComparison.spyReturn!)}</p>
          </div>
          <div className="px-5 py-2 rounded-full bg-[#4ADE80]/10 border border-[#4ADE80]/20">
            <p className="text-[14px] font-bold text-[#4ADE80]" style={MONO}>BEAT THE MARKET</p>
          </div>
        </div>
        <p className="text-[11px] text-white/40 mt-6" style={MONO}>
          Return based on cost basis. MVP &amp; villain reflect total gain since purchase.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 3: MVP & VILLAIN
// ═══════════════════════════════════════════

function SlideBestWorst() {
  const best = DEMO_DATA.bestPosition!;
  const worst = DEMO_DATA.worstPosition!;
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-5 md:px-6 overflow-hidden">
      <div className="absolute -top-[20%] -right-[20%] w-[50vw] h-[50vw] rounded-full opacity-[0.06] blur-[120px] pointer-events-none" style={{ background: '#4ADE80' }} />
      <div className="absolute -bottom-[20%] -left-[20%] w-[50vw] h-[50vw] rounded-full opacity-[0.05] blur-[120px] pointer-events-none" style={{ background: '#F87171' }} />
      <div className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <p className="text-[13px] tracking-[0.2em] text-[#4ADE80] mb-3" style={MONO}>YOUR MVP</p>
          <p className="text-[clamp(48px,12vw,80px)] font-bold text-[var(--color-gold)] tracking-tight leading-none" style={MONO}>{best.ticker}</p>
          <p className="text-[clamp(32px,8vw,56px)] font-bold text-[#4ADE80] tabular-nums mt-2">{fmtPct(best.returnPct)}</p>
          <p className="text-[14px] text-[var(--color-text-muted)] mt-2">{best.name} &middot; {fmtDollar(best.returnDollars)}</p>
        </div>
        <div className="w-16 h-px bg-white/10 mx-auto my-6" />
        <div className="text-center">
          <p className="text-[13px] tracking-[0.2em] text-[#F87171] mb-3" style={MONO}>YOUR VILLAIN</p>
          <p className="text-[clamp(48px,12vw,80px)] font-bold text-[#F87171] tracking-tight leading-none" style={MONO}>{worst.ticker}</p>
          <p className="text-[clamp(32px,8vw,56px)] font-bold text-[#F87171] tabular-nums mt-2">{fmtPct(worst.returnPct)}</p>
          <p className="text-[14px] text-[var(--color-text-muted)] mt-2">{worst.name} &middot; {fmtDollar(worst.returnDollars)}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 4: HABITS
// ═══════════════════════════════════════════

function SlideTradingHabits() {
  const d = DEMO_DATA;
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-5 md:px-6 overflow-hidden">
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[70vw] h-[70vw] rounded-full opacity-[0.05] blur-[120px] pointer-events-none" style={{ background: 'var(--color-gold)' }} />
      <div className="relative z-10 text-center">
        <p className="text-[clamp(80px,22vw,160px)] font-bold text-[var(--color-gold)] leading-none tabular-nums tracking-tight">{d.tradeCount}</p>
        <p className="text-[18px] text-[var(--color-text-muted)] mt-2 mb-2">trades this year</p>
        <p className="text-[15px] text-[var(--color-text-muted)] mb-10">Mostly on <span className="text-[var(--color-gold)] font-semibold">Tuesdays</span></p>
        <div className="grid grid-cols-2 gap-2 md:gap-3 w-full max-w-sm mx-auto">
          {[
            { value: fmtDollar(d.totalDividends), label: 'DIVIDENDS' },
            { value: d.positionCount.toString(), label: 'POSITIONS' },
            { value: fmtCompact(d.portfolioValue), label: 'PORTFOLIO' },
            { value: '18', label: 'BUSIEST DAY' },
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
// Slide 5: SECTORS
// ═══════════════════════════════════════════

function SlideSectors() {
  const sectors = DEMO_DATA.sectorBreakdown;
  const nwChange = DEMO_DATA.netWorthChange;
  const sectorColors = ['#E6B94D', '#4ADE80', '#7AA3C7', '#A78BFA', '#C8A165', '#5A6070'];
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-5 md:px-6 overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[70vw] h-[70vw] rounded-full opacity-[0.06] blur-[120px] pointer-events-none" style={{ background: '#7AA3C7' }} />
      <div className="relative z-10 text-center w-full max-w-lg">
        <p className="text-[clamp(80px,22vw,160px)] font-bold leading-none tabular-nums tracking-tight">48%</p>
        <p className="text-[clamp(20px,5vw,32px)] font-bold text-[var(--color-gold)] mt-2 mb-2" style={MONO}>Technology</p>
        <p className="text-[16px] text-[var(--color-text-muted)] mb-10">Your biggest bet.</p>
        <div className="mb-8">
          <div className="flex gap-1 h-4 rounded-full overflow-hidden">
            {sectors.map((s, i) => (
              <div key={s.sector} style={{ flex: Math.max(s.pct, 2), background: sectorColors[i % sectorColors.length] }} className="rounded-sm" />
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 md:gap-x-5 gap-y-1.5 mt-4 md:mt-5">
            {sectors.slice(0, 5).map((s, i) => (
              <span key={s.sector} className="flex items-center gap-1.5 text-[11px] md:text-[14px] text-[var(--color-text-muted)]" style={MONO}>
                <span className="w-3 h-3 rounded-full" style={{ background: sectorColors[i % sectorColors.length] }} />
                {s.sector} {s.pct}%
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center gap-10 mt-4">
          <div>
            <p className="text-[12px] tracking-[0.15em] text-[var(--color-text-muted)]" style={MONO}>NET WORTH</p>
            <p className="text-[28px] font-bold mt-1 tabular-nums text-[#4ADE80]">{fmtDollar(nwChange.change)}</p>
          </div>
          <div>
            <p className="text-[12px] tracking-[0.15em] text-[var(--color-text-muted)]" style={MONO}>CHANGE</p>
            <p className="text-[28px] font-bold mt-1 tabular-nums text-[#4ADE80]">{fmtPct(nwChange.changePct)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 6: PERSONALITY
// ═══════════════════════════════════════════

function SlidePersonality() {
  const p = DEMO_DATA.investorPersonality!;
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-5 md:px-6 text-center overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] rounded-full opacity-[0.08] blur-[140px] pointer-events-none" style={{ background: 'var(--color-gold)' }} />
      <div className="relative z-10">
        <p className="text-[16px] text-[var(--color-text-muted)] mb-6">You invest like</p>
        <h2 className="text-[clamp(48px,13vw,96px)] font-bold tracking-[-0.04em] leading-[0.9] mb-6" style={{ fontFamily: '"Source Serif Pro", Georgia, serif', fontStyle: 'italic' }}>
          <span className="text-[var(--color-gold)]">{p.title}</span>
        </h2>
        <div className="w-20 h-1 bg-[var(--color-gold)] rounded-full mx-auto mb-8" />
        <p className="text-[18px] text-[var(--color-text-muted)] leading-relaxed max-w-md mx-auto mb-8">{p.description}</p>
        <div className="flex flex-wrap justify-center gap-2.5 max-w-md mx-auto">
          {p.traits.map((t) => (
            <span key={t} className="px-5 py-2.5 rounded-full border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/[0.08] text-[14px] font-medium text-[var(--color-gold)]" style={MONO}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Slide 7: CTA (replaces share card in demo)
// ═══════════════════════════════════════════

function SlideCTA() {
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-5 md:px-6 text-center overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] rounded-full opacity-[0.06] blur-[140px] pointer-events-none" style={{ background: 'var(--color-gold)' }} />
      <div className="relative z-10 max-w-lg">
        <p className="font-semibold text-[13px] uppercase tracking-[0.18em] text-[var(--color-gold)] mb-8" style={MONO}>THIS WAS A DEMO</p>
        <h2 className="font-bold tracking-[-0.04em] leading-[0.9] mb-6" style={{ fontSize: 'clamp(48px, 12vw, 96px)' }}>
          Now see{' '}
          <span className="italic text-[var(--color-gold)]" style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}>
            yours.
          </span>
        </h2>
        <p className="text-[18px] text-[var(--color-text-muted)] leading-relaxed mb-10">
          Connect your brokerage. Get your real numbers in 2 minutes. Free.
        </p>
        <a
          href="/wrapped"
          className="inline-flex items-center gap-3 px-14 py-6 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black text-[18px] font-bold tracking-[0.02em] rounded-full transition-all cursor-pointer"
          style={{ boxShadow: '0 12px 40px rgba(230,185,77,0.35)' }}
        >
          Get my Wrapped
          <ChevronRight className="w-6 h-6" />
        </a>
        <p className="text-[13px] text-white/40 mt-6" style={MONO}>Free &middot; 30 seconds &middot; Any brokerage</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Main Demo Page
// ═══════════════════════════════════════════

export function WrappedDemo() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= TOTAL_SLIDES) return;
    setDirection(index > currentSlide ? 1 : -1);
    setCurrentSlide(index);
  }, [currentSlide]);

  const next = useCallback(() => goTo(currentSlide + 1), [currentSlide, goTo]);
  const prev = useCallback(() => goTo(currentSlide - 1), [currentSlide, goTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'Escape') router.push('/wrapped');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, router]);

  const handleTouchStart = (e: React.TouchEvent) => setTouchStartX(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 60) next();
    if (diff < -60) prev();
  };

  function renderSlide(index: number) {
    switch (index) {
      case 0: return <SlideCover onBegin={next} />;
      case 1: return <SlideReturn />;
      case 2: return <SlideBestWorst />;
      case 3: return <SlideTradingHabits />;
      case 4: return <SlideSectors />;
      case 5: return <SlidePersonality />;
      case 6: return <SlideCTA />;
      default: return null;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--color-bg-base)] select-none overflow-hidden cursor-pointer"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        const tag = (e.target as HTMLElement).closest('button, a, [role="button"], input');
        if (!tag && currentSlide < TOTAL_SLIDES - 1) next();
      }}
    >
      <AmbientGlow />
      <TopBar current={currentSlide} />

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Slide {currentSlide + 1} of {TOTAL_SLIDES}
      </div>

      <div className="absolute inset-0 pt-14 overflow-hidden">
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
