'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronLeft, ChevronRight, Share2, Copy, Check } from 'lucide-react';
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

interface InvestorPersonality {
  type: string;
  title: string;
  description: string;
  traits: string[];
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
  topHoldings: { ticker: string; name: string; value: number; pct: number }[];
  investorPersonality: InvestorPersonality;
  uniqueTickersTraded: number;
}

type CardType =
  | 'intro' | 'netWorth' | 'return' | 'best' | 'spy'
  | 'worst' | 'sectors' | 'topHoldings' | 'dividends'
  | 'trading' | 'tax' | 'health' | 'personality' | 'summary';

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

const TNUM: React.CSSProperties = { fontFeatureSettings: "'tnum' 1" };
const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const EYEBROW: React.CSSProperties = { ...MONO, fontSize: '11px', letterSpacing: '0.25em' };

// ── Stagger entrance animation ──

function stagger(active: boolean, index: number, reduceMotion = false): React.CSSProperties {
  if (reduceMotion) {
    return { opacity: active ? 1 : 0 };
  }
  return {
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0)' : 'translateY(16px)',
    transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
    transitionDelay: active ? `${index * 120 + 200}ms` : '0ms',
  };
}

// ── Count-up animation hook ──

function useCountUp(end: number, active: boolean, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) { setVal(0); return; }
    let raf: number;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(end * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, active, duration]);
  return val;
}

// ── Confetti ──

const CONFETTI_COLORS = ['#B8914A', '#E8ECF1', '#4ADE80', '#38BDF8', '#F472B6', '#FBBF24', '#A78BFA'];

function Confetti() {
  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${3 + Math.random() * 94}%`,
              top: '-12px',
              width: `${3 + Math.random() * 6}px`,
              height: `${3 + Math.random() * 6}px`,
              borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0',
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animation: `confetti-fall ${2 + Math.random() * 2.5}s ${Math.random() * 0.8}s ease-out forwards`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// ── Share utilities ──

function shareToX(text: string) {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function nativeShare(text: string) {
  if (navigator.share) {
    await navigator.share({ text });
    return true;
  }
  return false;
}

function CardShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const full = text + '\n\nGet yours → helmterminal.dev';

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Try native share first (mobile), fall back to X
    const shared = await nativeShare(full);
    if (!shared) shareToX(full);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[var(--color-gold)] border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 hover:bg-[var(--color-gold)]/15 transition-colors"
        style={{ ...MONO, fontSize: '10px' }}
      >
        <Share2 className="w-3 h-3" />
        Share
      </button>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2.5 py-2 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/10 transition-colors"
        style={{ ...MONO, fontSize: '10px' }}
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-3 h-3 text-[var(--color-positive)]" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

// ── Branding footer ──

function CardBranding({ shareText }: { shareText?: string }) {
  return (
    <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2.5">
      {shareText && <CardShareButton text={shareText} />}
      <div className="flex items-center gap-2 opacity-50">
        <HelmMark size={24} />
        <span style={{ ...MONO, fontSize: '10px', letterSpacing: '0.1em' }}
              className="text-[var(--color-text-muted)] uppercase">
          helmterminal.dev
        </span>
      </div>
    </div>
  );
}

// ── Progress bar ──

function ProgressBar({ total, current }: { total: number; current: number }) {
  return (
    <div className="absolute top-4 left-6 right-6 flex gap-1.5 z-20">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="h-[3px] flex-1 rounded-full overflow-hidden bg-white/10">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              i < current ? 'w-full bg-[var(--color-gold)]'
                : i === current ? 'w-full bg-[var(--color-gold)] animate-pulse'
                : 'w-0',
            )}
          />
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// Card Components
// ═══════════════════════════════════════════

function IntroCard({ data, active }: { data: WrappedData; active: boolean }) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 80%, rgba(184,145,74,0.18), transparent 70%)' }} />
      <div style={stagger(active, 0)}>
        <HelmMark size={80} />
      </div>
      <p className="uppercase text-[var(--color-gold)] mt-8 mb-4"
         style={{ ...stagger(active, 1), ...EYEBROW }}>
        Portfolio Wrapped
      </p>
      <h1 className="text-[clamp(2.5rem,8vw,4.5rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.1] mb-4"
          style={stagger(active, 2)}>
        Your {data.periodLabel}<br />in Review
      </h1>
      <p className="text-[var(--color-text-muted)] text-sm mb-2" style={{ ...stagger(active, 3), ...MONO }}>
        {data.periodRange}
      </p>
      <div className="flex items-center gap-1.5 mt-8 text-[var(--color-text-muted)] text-xs animate-pulse"
           style={stagger(active, 4)}>
        <span>Tap to begin</span>
        <ChevronRight className="w-3 h-3" />
      </div>
      <CardBranding />
    </div>
  );
}

function NetWorthCard({ data, active }: { data: WrappedData; active: boolean }) {
  const isPositive = data.netWorthChange.change >= 0;
  const animVal = useCountUp(Math.abs(data.netWorthChange.change), active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: isPositive
             ? 'radial-gradient(ellipse at 50% 60%, rgba(56,189,248,0.12), transparent 70%)'
             : 'radial-gradient(ellipse at 50% 60%, rgba(248,113,113,0.1), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-6"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Your Financial Picture
      </p>
      <div className={cn(
        'text-[clamp(3rem,10vw,6rem)] font-bold tracking-tight leading-none mb-3',
        isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
      )} style={{ ...stagger(active, 1), ...TNUM }}>
        {data.netWorthChange.change >= 0 ? '+' : '-'}${fmt(Math.round(animVal))}
      </div>
      <p className={cn(
        'text-lg font-semibold mb-8',
        isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
      )} style={{ ...stagger(active, 2), ...TNUM, opacity: 0.8 }}>
        {fmtPct(data.netWorthChange.changePct)} net worth change
      </p>
      <div className="flex items-center gap-6" style={stagger(active, 3)}>
        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)] mb-1" style={MONO}>Start</p>
          <p className="text-xl font-bold text-[var(--color-text-secondary)]" style={TNUM}>
            ${fmt(data.netWorthChange.start)}
          </p>
        </div>
        <div className="text-2xl text-[var(--color-text-muted)]">&rarr;</div>
        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)] mb-1" style={MONO}>Now</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]" style={TNUM}>
            ${fmt(data.netWorthChange.end)}
          </p>
        </div>
      </div>
      <CardBranding shareText={`My net worth ${isPositive ? 'grew' : 'changed'} by ${fmtDollars(data.netWorthChange.change)} this ${data.periodLabel.toLowerCase()}`} />
    </div>
  );
}

function ReturnCard({ data, active }: { data: WrappedData; active: boolean }) {
  const isPositive = data.totalReturn.pct >= 0;
  const animPct = useCountUp(Math.abs(data.totalReturn.pct), active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: isPositive
             ? 'radial-gradient(ellipse at 50% 60%, rgba(74,222,128,0.12), transparent 70%)'
             : 'radial-gradient(ellipse at 50% 60%, rgba(248,113,113,0.1), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-6"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Your Portfolio Returned
      </p>
      <div className={cn(
        'text-[clamp(3.5rem,12vw,7rem)] font-bold tracking-tight leading-none mb-4',
        isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
      )} style={{ ...stagger(active, 1), ...TNUM }}>
        {isPositive ? '+' : '-'}{animPct.toFixed(1)}%
      </div>
      <div className={cn(
        'text-[clamp(1.5rem,5vw,2.5rem)] font-semibold tracking-tight',
        isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
      )} style={{ ...stagger(active, 2), ...TNUM, opacity: 0.8 }}>
        {fmtDollars(data.totalReturn.dollars)}
      </div>
      <div className="mt-8 flex items-center gap-4 text-[var(--color-text-muted)]"
           style={stagger(active, 3)}>
        <div className="text-center">
          <p className="text-2xl font-bold text-[var(--color-text-primary)]" style={TNUM}>
            {data.positionCount}
          </p>
          <p className="text-xs uppercase tracking-wider" style={MONO}>Positions</p>
        </div>
        <div className="w-px h-8 bg-[var(--color-border-base)]" />
        <div className="text-center">
          <p className="text-2xl font-bold text-[var(--color-text-primary)]" style={TNUM}>
            ${fmt(data.portfolioValue)}
          </p>
          <p className="text-xs uppercase tracking-wider" style={MONO}>Portfolio</p>
        </div>
      </div>
      <CardBranding shareText={`My portfolio returned ${fmtPct(data.totalReturn.pct)} (${fmtDollars(data.totalReturn.dollars)}) this ${data.periodLabel.toLowerCase()}`} />
    </div>
  );
}

function BestTradeCard({ data, active }: { data: WrappedData; active: boolean }) {
  const pos = data.bestPosition!;
  const animPct = useCountUp(pos.returnPct, active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(52,211,153,0.15), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-2"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Your MVP
      </p>
      <p className="text-sm text-[var(--color-gold)] mb-6"
         style={{ ...stagger(active, 0), ...MONO }}>
        Best Performing Position
      </p>
      <div className="text-[clamp(3rem,10vw,6rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-2"
           style={stagger(active, 1)}>
        {pos.ticker}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6"
         style={stagger(active, 2)}>
        {pos.name}
      </p>
      <div className="text-[clamp(2rem,7vw,4rem)] font-bold tracking-tight text-[var(--color-positive)] leading-none mb-2"
           style={{ ...stagger(active, 3), ...TNUM }}>
        +{animPct.toFixed(1)}%
      </div>
      <div className="text-xl font-semibold text-[var(--color-positive)]"
           style={{ ...stagger(active, 4), ...TNUM, opacity: 0.8 }}>
        +${fmt(pos.returnDollars)}
      </div>
      <div className="mt-6 px-4 py-2 rounded-full border border-[var(--color-positive)]/20 bg-[var(--color-positive)]/5"
           style={stagger(active, 5)}>
        <span className="text-xs text-[var(--color-positive)]" style={MONO}>
          Position value: ${fmt(pos.value)}
        </span>
      </div>
      <CardBranding shareText={`My MVP this ${data.periodLabel.toLowerCase()}: $${pos.ticker} (+${pos.returnPct.toFixed(0)}%)`} />
    </div>
  );
}

function SpyComparisonCard({ data, active }: { data: WrappedData; active: boolean }) {
  const beat = data.spyComparison.beat;
  const diff = data.spyComparison.spyReturn != null
    ? Math.abs(data.spyComparison.userReturn - data.spyComparison.spyReturn)
    : 0;

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: beat
             ? 'radial-gradient(ellipse at 50% 60%, rgba(184,145,74,0.18), transparent 70%)'
             : 'radial-gradient(ellipse at 50% 60%, rgba(148,163,184,0.08), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-6"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        vs. The Market
      </p>
      {beat ? (
        <>
          <div className="text-[clamp(1.5rem,5vw,2.5rem)] font-bold text-[var(--color-text-primary)] mb-4"
               style={stagger(active, 1)}>
            You beat the
          </div>
          <div className="text-[clamp(3rem,10vw,5.5rem)] font-bold tracking-tight text-[var(--color-gold)] leading-none mb-4"
               style={stagger(active, 2)}>
            S&P 500
          </div>
          {diff > 0 && (
            <div className="text-xl font-semibold text-[var(--color-positive)]"
                 style={{ ...stagger(active, 3), ...TNUM }}>
              by {diff.toFixed(1)} percentage points
            </div>
          )}
        </>
      ) : beat === false ? (
        <>
          <div className="text-[clamp(1.5rem,5vw,2rem)] font-semibold text-[var(--color-text-secondary)] mb-4"
               style={stagger(active, 1)}>
            The S&P 500 edged ahead
          </div>
          <div className="text-[clamp(2rem,7vw,3.5rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-4"
               style={{ ...stagger(active, 2), ...TNUM }}>
            {fmtPct(data.spyComparison.userReturn)}
          </div>
          <p className="text-sm text-[var(--color-text-muted)]" style={stagger(active, 3)}>
            Your return vs SPY&apos;s {data.spyComparison.spyReturn != null ? fmtPct(data.spyComparison.spyReturn) : 'N/A'}
          </p>
        </>
      ) : (
        <>
          <div className="text-[clamp(2rem,7vw,3.5rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-4"
               style={{ ...stagger(active, 1), ...TNUM }}>
            {fmtPct(data.spyComparison.userReturn)}
          </div>
          <p className="text-sm text-[var(--color-text-muted)]" style={stagger(active, 2)}>
            Your portfolio return
          </p>
        </>
      )}
      <div className="mt-8 grid grid-cols-2 gap-8" style={stagger(active, 4)}>
        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1" style={MONO}>You</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]" style={TNUM}>
            {fmtPct(data.spyComparison.userReturn)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1" style={MONO}>S&P 500</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]" style={TNUM}>
            {data.spyComparison.spyReturn != null ? fmtPct(data.spyComparison.spyReturn) : '—'}
          </p>
        </div>
      </div>
      <CardBranding shareText={beat ? `I beat the S&P 500 this ${data.periodLabel.toLowerCase()}. ${fmtPct(data.spyComparison.userReturn)} vs ${fmtPct(data.spyComparison.spyReturn!)}` : undefined} />
    </div>
  );
}

function WorstTradeCard({ data, active }: { data: WrappedData; active: boolean }) {
  const pos = data.worstPosition!;

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 70%, rgba(248,113,113,0.08), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-6"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Biggest Challenge
      </p>
      <div className="text-[clamp(3rem,10vw,6rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-3"
           style={stagger(active, 1)}>
        {pos.ticker}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6"
         style={stagger(active, 2)}>
        {pos.name}
      </p>
      <div className="text-[clamp(2rem,7vw,4rem)] font-bold tracking-tight text-[var(--color-negative)] leading-none mb-2"
           style={{ ...stagger(active, 3), ...TNUM }}>
        {pos.returnPct.toFixed(1)}%
      </div>
      <div className="text-xl font-semibold text-[var(--color-negative)]"
           style={{ ...stagger(active, 4), ...TNUM, opacity: 0.8 }}>
        -${fmt(Math.abs(pos.returnDollars))}
      </div>
      <p className="mt-6 text-xs text-[var(--color-text-muted)] max-w-xs"
         style={{ ...stagger(active, 5), ...MONO }}>
        Every portfolio has them — it&apos;s how you respond that matters
      </p>
      <CardBranding />
    </div>
  );
}

function SectorBreakdownCard({ data, active }: { data: WrappedData; active: boolean }) {
  const maxPct = Math.max(...data.sectorBreakdown.map(s => s.pct));

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 30% 60%, rgba(168,85,247,0.1), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-8"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Where Your Money Lives
      </p>
      <div className="w-full max-w-sm space-y-3">
        {data.sectorBreakdown.map((s, i) => (
          <div key={s.sector} style={stagger(active, i + 1)}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--color-text-secondary)]" style={MONO}>
                {s.sector}
              </span>
              <span className="text-xs font-semibold text-[var(--color-text-primary)]" style={TNUM}>
                {s.pct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: active ? `${(s.pct / maxPct) * 100}%` : '0%',
                  transitionDelay: `${(i + 1) * 120 + 400}ms`,
                  background: i === 0 ? 'var(--color-gold)'
                    : i === 1 ? 'rgba(184,145,74,0.7)'
                    : `rgba(184,145,74,${0.5 - i * 0.08})`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <CardBranding shareText={`My top sector: ${data.sectorBreakdown[0]?.sector} at ${data.sectorBreakdown[0]?.pct.toFixed(0)}%`} />
    </div>
  );
}

function TopHoldingsCard({ data, active }: { data: WrappedData; active: boolean }) {
  const maxVal = data.topHoldings.length > 0 ? data.topHoldings[0].value : 1;

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(56,189,248,0.08), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-8"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Your Biggest Bets
      </p>
      <div className="w-full max-w-sm space-y-4">
        {data.topHoldings.map((h, i) => (
          <div key={h.ticker} style={stagger(active, i + 1)}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--color-text-primary)]">{h.ticker}</span>
                <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[120px]" style={MONO}>
                  {h.name}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-[var(--color-text-primary)]" style={TNUM}>
                  ${fmt(h.value)}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] ml-1.5" style={TNUM}>
                  {h.pct.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: active ? `${(h.value / maxVal) * 100}%` : '0%',
                  transitionDelay: `${(i + 1) * 120 + 400}ms`,
                  background: 'var(--color-gold)',
                  opacity: 1 - i * 0.15,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <CardBranding shareText={`My top 5 holdings: ${data.topHoldings.map(h => `$${h.ticker}`).join(', ')}`} />
    </div>
  );
}

function DividendCard({ data, active }: { data: WrappedData; active: boolean }) {
  const animVal = useCountUp(data.totalDividends, active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(45,212,191,0.12), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-6"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Passive Income
      </p>
      <p className="text-lg text-[var(--color-text-secondary)] mb-4"
         style={stagger(active, 1)}>
        You earned
      </p>
      <div className="text-[clamp(3rem,10vw,6rem)] font-bold tracking-tight text-[var(--color-positive)] leading-none mb-4"
           style={{ ...stagger(active, 2), ...TNUM }}>
        ${fmt(Math.round(animVal))}
      </div>
      <p className="text-lg text-[var(--color-text-secondary)]"
         style={stagger(active, 3)}>
        while you slept
      </p>
      <div className="mt-8 px-5 py-3 rounded-xl border border-[var(--color-positive)]/20 bg-[var(--color-positive)]/5"
           style={stagger(active, 4)}>
        <p className="text-xs text-[var(--color-positive)]" style={MONO}>
          In dividends & interest this {data.periodLabel.toLowerCase()}
        </p>
      </div>
      <CardBranding shareText={`I earned $${fmt(data.totalDividends)} in passive income this ${data.periodLabel.toLowerCase()}`} />
    </div>
  );
}

function TradingActivityCard({ data, active }: { data: WrappedData; active: boolean }) {
  const animTrades = useCountUp(data.tradeCount, active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 60% 60%, rgba(251,191,36,0.1), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-6"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Your Trading Activity
      </p>
      <div className="text-[clamp(3rem,10vw,6rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-2"
           style={{ ...stagger(active, 1), ...TNUM }}>
        {Math.round(animTrades)}
      </div>
      <p className="text-lg text-[var(--color-text-secondary)] mb-8"
         style={stagger(active, 2)}>
        trades executed
      </p>
      <div className="grid grid-cols-2 gap-6" style={stagger(active, 3)}>
        <div className="text-center px-4 py-3 rounded-xl bg-white/5 border border-white/5">
          <p className="text-2xl font-bold text-[var(--color-gold)]" style={TNUM}>
            {data.uniqueTickersTraded}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mt-1" style={MONO}>
            Tickers Traded
          </p>
        </div>
        {data.mostActiveTradingDay && (
          <div className="text-center px-4 py-3 rounded-xl bg-white/5 border border-white/5">
            <p className="text-2xl font-bold text-[var(--color-gold)]" style={TNUM}>
              {data.mostActiveTradingDay.trades}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mt-1" style={MONO}>
              Busiest Day
            </p>
          </div>
        )}
      </div>
      {data.mostActiveTradingDay && (
        <p className="mt-4 text-xs text-[var(--color-text-muted)]"
           style={{ ...stagger(active, 4), ...MONO }}>
          Peak activity: {new Date(data.mostActiveTradingDay.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      )}
      <CardBranding />
    </div>
  );
}

function TaxSavingsCard({ data, active }: { data: WrappedData; active: boolean }) {
  const animVal = useCountUp(data.taxSavings, active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(184,145,74,0.15), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-6"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Helm Saved You
      </p>
      <div className="text-[clamp(3rem,10vw,6rem)] font-bold tracking-tight text-[var(--color-gold)] leading-none mb-4"
           style={{ ...stagger(active, 1), ...TNUM }}>
        ${fmt(Math.round(animVal))}
      </div>
      <p className="text-lg text-[var(--color-text-secondary)]"
         style={stagger(active, 2)}>
        in tax-loss harvesting
      </p>
      <div className="mt-8 px-5 py-3 rounded-xl border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)]"
           style={stagger(active, 3)}>
        <p className="text-xs text-[var(--color-gold)]" style={MONO}>
          That&apos;s money back in your pocket
        </p>
      </div>
      <CardBranding shareText={`Helm saved me $${fmt(data.taxSavings)} in tax-loss harvesting this ${data.periodLabel.toLowerCase()}`} />
    </div>
  );
}

function HealthScoreCard({ data, active }: { data: WrappedData; active: boolean }) {
  const { start, end, change } = data.healthScoreTrend;
  const improved = change > 0;
  const animEnd = useCountUp(end ?? 0, active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 70% 70%, rgba(34,211,238,0.1), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-6"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Financial Health Score
      </p>
      {start !== null && end !== null && start !== end ? (
        <>
          <div className="flex items-center gap-6 mb-6" style={stagger(active, 1)}>
            <div className="text-center">
              <p className="text-[var(--color-text-muted)] text-xs mb-2" style={MONO}>Start</p>
              <div className="text-[clamp(2.5rem,8vw,4.5rem)] font-bold text-[var(--color-text-secondary)]"
                   style={TNUM}>
                {start}
              </div>
            </div>
            <div className="text-3xl text-[var(--color-text-muted)]">&rarr;</div>
            <div className="text-center">
              <p className="text-[var(--color-text-muted)] text-xs mb-2" style={MONO}>Now</p>
              <div className={cn(
                'text-[clamp(2.5rem,8vw,4.5rem)] font-bold',
                improved ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
              )} style={TNUM}>
                {Math.round(animEnd)}
              </div>
            </div>
          </div>
          <div className={cn(
            'text-xl font-semibold',
            improved ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
          )} style={stagger(active, 2)}>
            {improved ? '+' : ''}{change} points
          </div>
        </>
      ) : (
        <div className="text-[clamp(3rem,10vw,5.5rem)] font-bold tracking-tight text-[var(--color-gold)] leading-none"
             style={{ ...stagger(active, 1), ...TNUM }}>
          {Math.round(animEnd) || (end ?? start ?? '—')}
        </div>
      )}
      <CardBranding />
    </div>
  );
}

function PersonalityCard({ data, active }: { data: WrappedData; active: boolean }) {
  const p = data.investorPersonality;

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 40% 40%, rgba(184,145,74,0.12), transparent 50%), radial-gradient(ellipse at 60% 70%, rgba(168,85,247,0.1), transparent 50%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-2"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Your Investor DNA
      </p>
      <p className="text-xs text-[var(--color-gold)] mb-8"
         style={{ ...stagger(active, 0), ...MONO }}>
        Based on your {data.periodLabel.toLowerCase()} activity
      </p>
      <div className="text-[clamp(2rem,7vw,3.5rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight mb-6"
           style={{
             ...stagger(active, 1),
             textShadow: '0 0 40px rgba(184,145,74,0.3)',
           }}>
        {p.title}
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-sm mb-8"
         style={stagger(active, 2)}>
        {p.description}
      </p>
      <div className="flex items-center gap-2" style={stagger(active, 3)}>
        {p.traits.map((trait) => (
          <span
            key={trait}
            className="px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border"
            style={{
              ...MONO,
              color: 'var(--color-gold)',
              borderColor: 'rgba(184,145,74,0.3)',
              background: 'rgba(184,145,74,0.08)',
            }}
          >
            {trait}
          </span>
        ))}
      </div>
      <CardBranding shareText={`My investor personality: ${p.title}\n\n"${p.description}"\n\nTraits: ${p.traits.join(' / ')}`} />
    </div>
  );
}

function SummaryCard({ data, active }: { data: WrappedData; active: boolean }) {
  const [copied, setCopied] = useState(false);

  const highlights: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Return', value: fmtPct(data.totalReturn.pct), accent: data.totalReturn.pct > 0 },
    data.bestPosition ? { label: 'MVP', value: data.bestPosition.ticker, accent: true } : null,
    data.spyComparison.beat !== null ? { label: 'vs S&P', value: data.spyComparison.beat ? 'Beat it' : 'Trailed', accent: data.spyComparison.beat } : null,
    data.taxSavings > 0 ? { label: 'Tax Saved', value: `$${fmt(data.taxSavings)}`, accent: true } : null,
    data.totalDividends > 0 ? { label: 'Dividends', value: `$${fmt(data.totalDividends)}` } : null,
    { label: 'Personality', value: data.investorPersonality.title.replace('The ', '') },
  ].filter(Boolean) as { label: string; value: string; accent?: boolean }[];

  const buildShareText = () => {
    const lines = [
      `My ${data.periodLabel} investing wrapped:`,
      '',
      `${fmtPct(data.totalReturn.pct)} return (${fmtDollars(data.totalReturn.dollars)})`,
    ];
    if (data.bestPosition) lines.push(`MVP: $${data.bestPosition.ticker} (+${data.bestPosition.returnPct.toFixed(0)}%)`);
    if (data.spyComparison.beat) lines.push('Beat the S&P 500');
    if (data.taxSavings > 0) lines.push(`Tax savings: $${fmt(data.taxSavings)}`);
    if (data.totalDividends > 0) lines.push(`Dividends: $${fmt(data.totalDividends)}`);
    lines.push(`Personality: ${data.investorPersonality.title}`);
    lines.push('', 'Get yours → helmterminal.dev');
    return lines.join('\n');
  };

  const handleShareX = (e: React.MouseEvent) => {
    e.stopPropagation();
    shareToX(buildShareText());
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(buildShareText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shared = await nativeShare(buildShareText());
    if (!shared) shareToX(buildShareText());
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 80%, rgba(184,145,74,0.1), transparent 70%)' }} />
      <div style={stagger(active, 0)}>
        <HelmMark size={36} />
      </div>
      <p className="uppercase text-[var(--color-gold)] mt-4 mb-6"
         style={{ ...stagger(active, 1), ...EYEBROW }}>
        {data.periodLabel} Recap
      </p>

      <div className="w-full max-w-xs grid grid-cols-2 gap-2.5 mb-8">
        {highlights.map((h, i) => (
          <div
            key={h.label}
            className="text-center px-3 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            style={stagger(active, i + 2)}
          >
            <p className="text-sm font-bold mb-0.5"
               style={{ ...TNUM, color: h.accent ? 'var(--color-gold)' : 'var(--color-text-primary)' }}>
              {h.value}
            </p>
            <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider" style={MONO}>
              {h.label}
            </p>
          </div>
        ))}
      </div>

      {/* Share actions */}
      <div className="flex flex-col items-center gap-3" style={stagger(active, highlights.length + 2)}>
        <button
          onClick={handleNativeShare}
          className="flex items-center gap-2.5 px-8 py-3.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black font-semibold rounded-lg transition-colors text-sm"
        >
          <Share2 className="w-4 h-4" />
          Share Your Wrapped
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShareX}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors"
            style={{ ...MONO, fontSize: '11px' }}
          >
            Post on X
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors"
            style={{ ...MONO, fontSize: '11px' }}
          >
            {copied ? <><Check className="w-3 h-3 text-[var(--color-positive)]" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
          </button>
        </div>
      </div>

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
      <style>{`
        @keyframes loading-ring {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div className="relative">
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-gold)] w-24 h-24 -m-5"
             style={{ animation: 'loading-ring 1.5s linear infinite' }} />
        <HelmMark size={56} />
      </div>
      <p className="text-[var(--color-text-muted)] text-sm mt-10" style={MONO}>
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
  const [confettiKey, setConfettiKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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

  // Build cards dynamically
  const cards = useMemo<CardType[]>(() => {
    if (!data) return [];
    const c: CardType[] = ['intro'];
    if (data.netWorthChange.change !== 0) c.push('netWorth');
    c.push('return');
    if (data.bestPosition) c.push('best');
    if (data.spyComparison.beat !== null || data.spyComparison.userReturn !== 0) c.push('spy');
    if (data.worstPosition) c.push('worst');
    if (data.sectorBreakdown.length > 0) c.push('sectors');
    if (data.topHoldings.length > 0) c.push('topHoldings');
    if (data.totalDividends > 0) c.push('dividends');
    if (data.tradeCount > 0) c.push('trading');
    if (data.taxSavings > 0) c.push('tax');
    if (data.healthScoreTrend.start !== null || data.healthScoreTrend.end !== null) c.push('health');
    c.push('personality');
    c.push('summary');
    return c;
  }, [data]);

  // Determine if current card should show confetti
  const showConfetti = useMemo(() => {
    if (!data || cards.length === 0) return false;
    const type = cards[currentCard];
    return (
      type === 'best' ||
      type === 'personality' ||
      (type === 'return' && data.totalReturn.pct > 0) ||
      (type === 'spy' && data.spyComparison.beat === true)
    );
  }, [cards, currentCard, data]);

  // Trigger confetti remount on card change
  useEffect(() => {
    if (showConfetti) setConfettiKey(k => k + 1);
  }, [currentCard]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation
  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= cards.length) return;
    setCurrentCard(index);
  }, [cards.length]);

  const next = useCallback(() => goTo(currentCard + 1), [currentCard, goTo]);
  const prev = useCallback(() => goTo(currentCard - 1), [currentCard, goTo]);

  // Keyboard
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

  // Click zones
  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) prev();
    else next();
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

  function renderCard(type: CardType, active: boolean) {
    switch (type) {
      case 'intro':        return <IntroCard data={data!} active={active} />;
      case 'netWorth':     return <NetWorthCard data={data!} active={active} />;
      case 'return':       return <ReturnCard data={data!} active={active} />;
      case 'best':         return <BestTradeCard data={data!} active={active} />;
      case 'spy':          return <SpyComparisonCard data={data!} active={active} />;
      case 'worst':        return <WorstTradeCard data={data!} active={active} />;
      case 'sectors':      return <SectorBreakdownCard data={data!} active={active} />;
      case 'topHoldings':  return <TopHoldingsCard data={data!} active={active} />;
      case 'dividends':    return <DividendCard data={data!} active={active} />;
      case 'trading':      return <TradingActivityCard data={data!} active={active} />;
      case 'tax':          return <TaxSavingsCard data={data!} active={active} />;
      case 'health':       return <HealthScoreCard data={data!} active={active} />;
      case 'personality':  return <PersonalityCard data={data!} active={active} />;
      case 'summary':      return <SummaryCard data={data!} active={active} />;
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
            style={MONO}
          >
            {p === 'quarter' ? 'Quarter' : 'Year'}
          </button>
        ))}
      </div>

      {/* Confetti overlay — skip when user prefers reduced motion */}
      {showConfetti && !reduceMotion && <Confetti key={confettiKey} />}

      {/* Card content */}
      <div className="absolute inset-0 pt-20">
        {cards.map((type, i) => (
          <div
            key={`${type}-${i}`}
            className={cn(
              'absolute inset-0',
              !reduceMotion && 'transition-all duration-500 ease-out',
              i === currentCard
                ? 'opacity-100 scale-100 translate-x-0'
                : i < currentCard
                  ? 'opacity-0 scale-95 -translate-x-8 pointer-events-none'
                  : 'opacity-0 scale-95 translate-x-8 pointer-events-none',
            )}
          >
            {renderCard(type, i === currentCard)}
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
           style={MONO}>
        {currentCard + 1} / {cards.length}
      </div>
    </div>
  );
}
