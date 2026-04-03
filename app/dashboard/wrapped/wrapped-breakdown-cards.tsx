'use client';

import {
  type WrappedData,
  fmt,
  TNUM, MONO, EYEBROW,
  stagger, useCountUp,
  CardBranding,
} from './wrapped-shared';

export function SectorBreakdownCard({ data, active }: { data: WrappedData; active: boolean }) {
  const maxPct = Math.max(...data.sectorBreakdown.map(s => s.pct));

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-4 sm:px-8 overflow-hidden">
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

export function TopHoldingsCard({ data, active }: { data: WrappedData; active: boolean }) {
  const maxVal = data.topHoldings.length > 0 ? data.topHoldings[0].value : 1;

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-4 sm:px-8 overflow-hidden">
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

export function DividendCard({ data, active }: { data: WrappedData; active: boolean }) {
  const animVal = useCountUp(data.totalDividends, active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-4 sm:px-8 overflow-hidden">
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

export function TradingActivityCard({ data, active }: { data: WrappedData; active: boolean }) {
  const animTrades = useCountUp(data.tradeCount, active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-4 sm:px-8 overflow-hidden">
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

export function TaxSavingsCard({ data, active }: { data: WrappedData; active: boolean }) {
  const animVal = useCountUp(data.taxSavings, active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-4 sm:px-8 overflow-hidden">
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
