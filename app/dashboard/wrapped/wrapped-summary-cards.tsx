'use client';

import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HelmMark } from '@/components/helm-mark';
import {
  type WrappedData,
  fmt, fmtPct, fmtDollars,
  TNUM, MONO, EYEBROW,
  stagger, useCountUp,
  shareToX, nativeShare,
  CardBranding,
} from './wrapped-shared';

export function HealthScoreCard({ data, active }: { data: WrappedData; active: boolean }) {
  const { start, end, change } = data.healthScoreTrend;
  const improved = change > 0;
  const animEnd = useCountUp(end ?? 0, active);

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-4 sm:px-8 overflow-hidden">
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
              <p className="text-[var(--color-text-muted)] text-[13px] mb-2" style={MONO}>Start</p>
              <div className="text-[clamp(2.5rem,8vw,4.5rem)] font-bold text-[var(--color-text-secondary)]"
                   style={TNUM}>
                {start}
              </div>
            </div>
            <div className="text-3xl text-[var(--color-text-muted)]">&rarr;</div>
            <div className="text-center">
              <p className="text-[var(--color-text-muted)] text-[13px] mb-2" style={MONO}>Now</p>
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
          {Math.round(animEnd) || (end ?? start ?? '\u2014')}
        </div>
      )}
      <CardBranding />
    </div>
  );
}

export function PersonalityCard({ data, active }: { data: WrappedData; active: boolean }) {
  const p = data.investorPersonality;

  return (
    <div className="relative flex flex-col items-center justify-center h-full text-center px-4 sm:px-8 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at 40% 40%, rgba(184,145,74,0.12), transparent 50%), radial-gradient(ellipse at 60% 70%, rgba(168,85,247,0.1), transparent 50%)' }} />
      <p className="uppercase text-[var(--color-text-muted)] mb-2"
         style={{ ...stagger(active, 0), ...EYEBROW }}>
        Your Investor DNA
      </p>
      <p className="text-[13px] text-[var(--color-gold)] mb-8"
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
      <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed max-w-sm mb-8"
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

export function SummaryCard({ data, active }: { data: WrappedData; active: boolean }) {
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
    lines.push('', 'Get yours \u2192 helmterminal.dev');
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
    <div className="relative flex flex-col items-center justify-center h-full px-4 sm:px-8 overflow-hidden">
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
            <p className="text-[15px] font-bold mb-0.5"
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
          className="flex items-center gap-2.5 px-8 py-3.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black font-semibold rounded-lg transition-colors text-[15px]"
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
