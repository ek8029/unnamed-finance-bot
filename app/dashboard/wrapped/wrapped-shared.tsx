'use client';

import { useState, useEffect } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { cn } from '@/lib/utils';

// ── Types ──

export interface WrappedPosition {
  ticker: string;
  name: string;
  returnPct: number;
  returnDollars: number;
  value: number;
}

export interface InvestorPersonality {
  type: string;
  title: string;
  description: string;
  traits: string[];
}

export interface WrappedData {
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

export type CardType =
  | 'intro' | 'netWorth' | 'return' | 'best' | 'spy'
  | 'worst' | 'sectors' | 'topHoldings' | 'dividends'
  | 'trading' | 'tax' | 'health' | 'personality' | 'summary';

// ── Helpers ──

export function fmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
export function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}
export function fmtDollars(n: number): string {
  return `${n >= 0 ? '+' : '-'}$${fmt(Math.abs(n))}`;
}

export const TNUM: React.CSSProperties = { fontFeatureSettings: "'tnum' 1" };
export const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
export const EYEBROW: React.CSSProperties = { ...MONO, fontSize: '11px', letterSpacing: '0.25em' };

// ── Stagger entrance animation ──

export function stagger(active: boolean, index: number, reduceMotion = false): React.CSSProperties {
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

export function useCountUp(end: number, active: boolean, duration = 1400) {
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

export function Confetti() {
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

export function shareToX(text: string) {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function nativeShare(text: string) {
  if (navigator.share) {
    await navigator.share({ text });
    return true;
  }
  return false;
}

export function CardShareButton({ text }: { text: string }) {
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

export function CardBranding({ shareText }: { shareText?: string }) {
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

export function ProgressBar({ total, current }: { total: number; current: number }) {
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

// ── Loading State ──

export function LoadingState() {
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
