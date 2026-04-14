'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, animate, useReducedMotion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ArrowRight, ChevronRight } from 'lucide-react';
import type { DemoAnalysis } from '@/lib/demo-tickers';

const CYCLE_INTERVAL = 10000;

/* ── Animated number counter ── */
function AnimatedValue({ value }: { value: string }) {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (prefersReduced || !ref.current) return;
    const numMatch = value.match(/([$]?)([\d,.]+)(%?)/);
    if (!numMatch) return;
    const target = parseFloat(numMatch[2].replace(/,/g, ''));
    if (isNaN(target)) return;

    const prefix = numMatch[1];
    const suffix = numMatch[3];
    const hasCommas = numMatch[2].includes(',');
    const decimals = numMatch[2].includes('.') ? numMatch[2].split('.')[1].length : 0;

    const controls = animate(0, target, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (v) => {
        if (!ref.current) return;
        let formatted = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString();
        if (hasCommas) formatted = Number(formatted).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        ref.current.textContent = `${prefix}${formatted}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [value, prefersReduced]);

  return <span ref={ref}>{value}</span>;
}

/* ── Verdict badge ── */
function VerdictBadge({ verdict }: { verdict: string }) {
  const configs: Record<string, { icon: typeof TrendingUp; color: string; border: string; bg: string; label: string }> = {
    bullish: { icon: TrendingUp, color: 'text-[var(--color-positive)]', border: 'border-[var(--color-positive)]/30', bg: 'bg-[var(--color-positive)]/5', label: 'Bullish' },
    bearish: { icon: TrendingDown, color: 'text-[var(--color-negative)]', border: 'border-[var(--color-negative)]/30', bg: 'bg-[var(--color-negative)]/5', label: 'Bearish' },
    neutral: { icon: Minus, color: 'text-[var(--color-text-muted)]', border: 'border-[var(--color-border-base)]', bg: 'bg-white/[0.03]', label: 'Neutral' },
  };
  const config = configs[verdict] || configs.neutral;
  const Icon = config.icon;
  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider border ${config.color} ${config.border} ${config.bg}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </motion.span>
  );
}

/* ── Full product showcase ── */
export function HeroAnalysisDemo({ analyses }: { analyses: DemoAnalysis[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReduced = useReducedMotion();

  const advance = useCallback(() => {
    setActiveIndex((i) => (i + 1) % analyses.length);
  }, [analyses.length]);

  useEffect(() => {
    if (analyses.length <= 1) return;
    const id = setInterval(advance, CYCLE_INTERVAL);
    return () => clearInterval(id);
  }, [advance, analyses.length]);

  if (!analyses.length) return null;

  const fadeVariants = prefersReduced
    ? { initial: {}, animate: {}, exit: {} }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 } };

  return (
    <div className="relative w-full">
      {/* Browser chrome frame */}
      <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#0C0C0C] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.7),0_0_80px_rgba(230,185,77,0.04)]">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-0.5 rounded bg-white/[0.04] text-[10px] font-mono text-[var(--color-text-muted)]">
              helmterminal.dev/analyze/{analyses[activeIndex].ticker.toLowerCase()}
            </div>
          </div>
          {/* Ticker tabs */}
          <div className="hidden sm:flex gap-1">
            {analyses.map((a, i) => (
              <button
                key={a.ticker}
                onClick={() => setActiveIndex(i)}
                className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded transition-all duration-150 ${
                  i === activeIndex
                    ? 'text-[var(--color-gold)] bg-[var(--color-gold)]/10'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                {a.ticker}
              </button>
            ))}
          </div>
        </div>

        {/* Analysis content — cross-fade */}
        <div className="min-h-[420px] sm:min-h-[480px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={analyses[activeIndex].ticker}
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <ShowcaseContent
                ticker={analyses[activeIndex].ticker}
                analysis={analyses[activeIndex].analysis}
                computedAt={analyses[activeIndex].computedAt}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── Full showcase content ── */
function ShowcaseContent({ ticker, analysis, computedAt }: { ticker: string; analysis: DemoAnalysis['analysis']; computedAt: string }) {
  const metrics = (analysis.metrics || []).slice(0, 6);
  const news = (analysis.newsHighlights || []).slice(0, 2);
  const age = computedAt ? formatAge(computedAt) : '';

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Header — ticker + verdict + timestamp */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-mono font-bold text-xl text-[var(--color-text-primary)]">{ticker}</div>
            {analysis.companyName && (
              <div className="text-[11px] text-[var(--color-text-muted)]">{analysis.companyName}</div>
            )}
          </div>
          <VerdictBadge verdict={analysis.verdict} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)] animate-pulse shadow-[0_0_6px_rgba(74,222,128,0.5)]" />
          <span className="text-[9px] font-mono text-[var(--color-text-muted)]">{age}</span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-[0.8rem] text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">{analysis.summary}</p>

      {/* Bull / Bear cases */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {analysis.bullCase && (
          <div className="rounded border border-[var(--color-positive)]/15 bg-[var(--color-positive)]/[0.03] px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3 h-3 text-[var(--color-positive)]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-positive)]">Bull Case</span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed line-clamp-2">{analysis.bullCase}</p>
          </div>
        )}
        {analysis.bearCase && (
          <div className="rounded border border-[var(--color-negative)]/15 bg-[var(--color-negative)]/[0.03] px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3 h-3 text-[var(--color-negative)]" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-negative)]">Bear Case</span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed line-clamp-2">{analysis.bearCase}</p>
          </div>
        )}
      </div>

      {/* Metrics grid — 3 or 6 */}
      {metrics.length > 0 && (
        <div className={`grid ${metrics.length > 3 ? 'grid-cols-3 sm:grid-cols-3' : 'grid-cols-3'} gap-2`}>
          {metrics.map((met, i) => (
            <div key={i} className="rounded bg-white/[0.02] border border-white/[0.04] px-2.5 py-2 text-center">
              <div className="text-[8px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5 truncate">{met.label}</div>
              <div className="font-mono font-bold text-xs text-[var(--color-text-primary)]">
                <AnimatedValue value={met.value} />
              </div>
              {met.change && (
                <div className={`text-[9px] font-mono ${met.change.startsWith('+') || met.change.startsWith('↑') ? 'text-[var(--color-positive)]' : met.change.startsWith('-') || met.change.startsWith('↓') ? 'text-[var(--color-negative)]' : 'text-[var(--color-text-muted)]'}`}>
                  {met.change}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* News headlines */}
      {news.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Recent Headlines</div>
          {news.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0"
                style={{ background: item.sentiment === 'positive' ? 'var(--color-positive)' : item.sentiment === 'negative' ? 'var(--color-negative)' : 'var(--color-text-muted)' }}
              />
              <p className="text-[11px] text-[var(--color-text-muted)] leading-snug line-clamp-1">{item.headline}</p>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <Link
        href={`/analyze/${ticker}`}
        className="flex items-center justify-center gap-2 py-2.5 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 text-xs font-mono uppercase tracking-wider text-[var(--color-gold)] hover:bg-[var(--color-gold)]/5 transition-colors border-t border-white/[0.06] group"
      >
        See full analysis
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}

function formatAge(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
