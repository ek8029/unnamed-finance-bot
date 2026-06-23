'use client';

import { cn } from '@/lib/utils';
import {
  type WrappedData,
  fmt, fmtPct,
  TNUM, MONO, EYEBROW,
  stagger, useCountUp,
  CardBranding,
} from './wrapped-shared';

export function BestTradeCard({ data, active }: { data: WrappedData; active: boolean }) {
  const pos = data.bestPosition!;
  const animPct = useCountUp(pos.returnPct, active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-4 sm:px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(52,211,153,0.15), transparent 70%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-2"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Your MVP
      </p>
      <p className="text-[15px] text-[var(--color-gold)] mb-6"
         style={{ ...stagger(active, 0), ...MONO }}>
        Best Performing Position
      </p>
      <div className="text-[clamp(3rem,10vw,6rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-2"
           style={stagger(active, 1)}>
        {pos.ticker}
      </div>
      <p className="text-[15px] text-[var(--color-text-secondary)] mb-6"
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
        <span className="text-[13px] text-[var(--color-positive)]" style={MONO}>
          Position value: ${fmt(pos.value)}
        </span>
      </div>
      <CardBranding shareText={`My MVP this ${data.periodLabel.toLowerCase()}: $${pos.ticker} (+${pos.returnPct.toFixed(0)}%)`} />
    </div>
  );
}

export function SpyComparisonCard({ data, active }: { data: WrappedData; active: boolean }) {
  const beat = data.spyComparison.beat;
  const diff = data.spyComparison.spyReturn != null
    ? Math.abs(data.spyComparison.userReturn - data.spyComparison.spyReturn)
    : 0;

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-4 sm:px-8 overflow-hidden">
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
          <p className="text-[15px] text-[var(--color-text-muted)]" style={stagger(active, 3)}>
            Your return vs SPY&apos;s {data.spyComparison.spyReturn != null ? fmtPct(data.spyComparison.spyReturn) : 'N/A'}
          </p>
        </>
      ) : (
        <>
          <div className="text-[clamp(2rem,7vw,3.5rem)] font-bold tracking-tight text-[var(--color-text-primary)] leading-none mb-4"
               style={{ ...stagger(active, 1), ...TNUM }}>
            {fmtPct(data.spyComparison.userReturn)}
          </div>
          <p className="text-[15px] text-[var(--color-text-muted)]" style={stagger(active, 2)}>
            Your portfolio return
          </p>
        </>
      )}
      <div className="mt-8 grid grid-cols-2 gap-8" style={stagger(active, 4)}>
        <div className="text-center">
          <p className="text-[13px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1" style={MONO}>You</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]" style={TNUM}>
            {fmtPct(data.spyComparison.userReturn)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[13px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1" style={MONO}>S&P 500</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]" style={TNUM}>
            {data.spyComparison.spyReturn != null ? fmtPct(data.spyComparison.spyReturn) : '\u2014'}
          </p>
        </div>
      </div>
      <CardBranding shareText={beat ? `I beat the S&P 500 this ${data.periodLabel.toLowerCase()}. ${fmtPct(data.spyComparison.userReturn)} vs ${fmtPct(data.spyComparison.spyReturn!)}` : undefined} />
    </div>
  );
}

export function WorstTradeCard({ data, active }: { data: WrappedData; active: boolean }) {
  const pos = data.worstPosition!;

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-4 sm:px-8 overflow-hidden">
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
      <p className="text-[15px] text-[var(--color-text-secondary)] mb-6"
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
      <p className="mt-6 text-[13px] text-[var(--color-text-muted)] max-w-xs"
         style={{ ...stagger(active, 5), ...MONO }}>
        Every portfolio has them — it&apos;s how you respond that matters
      </p>
      <CardBranding />
    </div>
  );
}
