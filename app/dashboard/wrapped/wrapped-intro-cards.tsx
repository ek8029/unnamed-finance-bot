'use client';

import { ChevronRight } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { cn } from '@/lib/utils';
import {
  type WrappedData,
  fmt, fmtPct, fmtDollars,
  TNUM, MONO, EYEBROW,
  stagger, useCountUp,
  CardBranding,
} from './wrapped-shared';

export function IntroCard({ data, active }: { data: WrappedData; active: boolean }) {
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

export function NetWorthCard({ data, active }: { data: WrappedData; active: boolean }) {
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

export function ReturnCard({ data, active }: { data: WrappedData; active: boolean }) {
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
