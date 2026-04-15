'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, DollarSign, TrendingDown, Shield, Calculator, Mail, Check, ChevronDown } from 'lucide-react';

/* ── Tax bracket data (2026 federal) ── */

const FEDERAL_BRACKETS = [
  { label: '10%', rate: 0.10, single: '$0 – $11,925' },
  { label: '12%', rate: 0.12, single: '$11,926 – $48,475' },
  { label: '22%', rate: 0.22, single: '$48,476 – $103,350' },
  { label: '24%', rate: 0.24, single: '$103,351 – $197,300' },
  { label: '32%', rate: 0.32, single: '$197,301 – $250,525' },
  { label: '35%', rate: 0.35, single: '$250,526 – $626,350' },
  { label: '37%', rate: 0.37, single: '$626,351+' },
];

const LTCG_RATES = [
  { label: '0%', rate: 0.00 },
  { label: '15%', rate: 0.15 },
  { label: '20%', rate: 0.20 },
];

const STATE_RATES = [
  { label: 'No state tax', rate: 0 },
  { label: '~3% (e.g. PA, IN, ND)', rate: 0.03 },
  { label: '~5% (e.g. CO, IL, MA)', rate: 0.05 },
  { label: '~7% (e.g. MN, WI, SC)', rate: 0.07 },
  { label: '~9% (e.g. NJ, OR, NY)', rate: 0.09 },
  { label: '~11%+ (e.g. CA, HI)', rate: 0.11 },
];

/* ── Helpers ── */

function formatDollars(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function parseDollarInput(s: string): number {
  return Math.max(0, parseFloat(s.replace(/[^0-9.]/g, '')) || 0);
}

/* ── Component ── */

export function TLHCalculator() {
  // Inputs
  const [portfolioSize, setPortfolioSize] = useState('250000');
  const [unrealizedLosses, setUnrealizedLosses] = useState('15000');
  const [federalBracketIdx, setFederalBracketIdx] = useState(3); // 24%
  const [ltcgRateIdx, setLtcgRateIdx] = useState(1); // 15%
  const [stateRateIdx, setStateRateIdx] = useState(0); // no state
  const [shortTermPct, setShortTermPct] = useState(30); // 30% short-term

  // Email gate state
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);

  // Calculation
  const results = useMemo(() => {
    const losses = parseDollarInput(unrealizedLosses);
    const portfolio = parseDollarInput(portfolioSize);
    const fedRate = FEDERAL_BRACKETS[federalBracketIdx].rate;
    const ltcgRate = LTCG_RATES[ltcgRateIdx].rate;
    const stateRate = STATE_RATES[stateRateIdx].rate;
    const stPct = shortTermPct / 100;
    const ltPct = 1 - stPct;

    const stLosses = losses * stPct;
    const ltLosses = losses * ltPct;

    // Short-term losses offset at ordinary income rate
    const stSavings = stLosses * (fedRate + stateRate);
    // Long-term losses offset at LTCG rate
    const ltSavings = ltLosses * (ltcgRate + stateRate);

    const totalAnnualSavings = stSavings + ltSavings;

    // $3,000 ordinary income deduction (if losses exceed gains)
    const ordinaryDeduction = Math.min(3000, losses) * fedRate;

    // 5-year projection (conservative: assume similar harvesting each year)
    const fiveYearSavings = totalAnnualSavings * 5;

    // Helm Pro cost comparison
    const helmProAnnual = 14.99 * 12;
    const netSavingsAfterHelm = totalAnnualSavings - helmProAnnual;
    const roi = helmProAnnual > 0 ? (totalAnnualSavings / helmProAnnual) * 100 : 0;

    // Loss as % of portfolio
    const lossPct = portfolio > 0 ? (losses / portfolio) * 100 : 0;

    return {
      losses,
      portfolio,
      stLosses,
      ltLosses,
      stSavings,
      ltSavings,
      totalAnnualSavings,
      ordinaryDeduction,
      fiveYearSavings,
      helmProAnnual,
      netSavingsAfterHelm,
      roi,
      lossPct,
      fedRate,
      ltcgRate,
      stateRate,
    };
  }, [portfolioSize, unrealizedLosses, federalBracketIdx, ltcgRateIdx, stateRateIdx, shortTermPct]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setEmailLoading(true);
    setEmailError('');
    try {
      const res = await fetch('/api/pro-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'tlh-calculator' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.code === 'DUPLICATE') {
          setEmailSubmitted(true);
          setShowDetailedBreakdown(true);
          return;
        }
        throw new Error(body.error || 'Failed to save');
      }
      setEmailSubmitted(true);
      setShowDetailedBreakdown(true);
    } catch {
      setEmailError('Something went wrong. Try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <section className="container mx-auto px-6 py-12 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-gold)]/5 border border-[var(--color-gold)]/15 mb-4">
          <Calculator className="w-3.5 h-3.5 text-[var(--color-gold)]" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-gold)]">Free Tool</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Tax-Loss Harvesting Calculator
        </h1>
        <p className="text-sm md:text-base text-[var(--color-text-muted)] max-w-lg mx-auto">
          Enter your portfolio details to see how much you could save annually through tax-loss harvesting.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* LEFT — Inputs (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="sovereign-card rounded-lg p-6 space-y-5">
            {/* Portfolio Size */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Total taxable portfolio value
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={portfolioSize}
                  onChange={(e) => setPortfolioSize(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full pl-9 pr-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors font-mono text-base"
                  placeholder="250,000"
                />
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] mt-1 font-mono">
                Only taxable accounts — 401(k), IRA, Roth are tax-advantaged and don&apos;t qualify.
              </div>
            </div>

            {/* Unrealized Losses */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Estimated unrealized losses
              </label>
              <div className="relative">
                <TrendingDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-negative)]" />
                <input
                  type="text"
                  value={unrealizedLosses}
                  onChange={(e) => setUnrealizedLosses(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full pl-9 pr-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors font-mono text-base"
                  placeholder="15,000"
                />
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] mt-1 font-mono">
                Total losses across all positions currently underwater. Not sure? Check your brokerage.
              </div>
            </div>

            {/* Federal bracket */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Federal tax bracket
              </label>
              <div className="relative">
                <select
                  value={federalBracketIdx}
                  onChange={(e) => setFederalBracketIdx(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors text-sm appearance-none cursor-pointer"
                >
                  {FEDERAL_BRACKETS.map((b, i) => (
                    <option key={i} value={i}>{b.label} — Single {b.single}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
              </div>
            </div>

            {/* LTCG rate */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                Long-term capital gains rate
              </label>
              <div className="flex gap-2">
                {LTCG_RATES.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setLtcgRateIdx(i)}
                    className={`flex-1 py-2.5 rounded border text-sm font-mono font-bold transition-colors cursor-pointer ${
                      i === ltcgRateIdx
                        ? 'border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] text-[var(--color-gold)]'
                        : 'border-[var(--color-border-base)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* State rate */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                State tax rate
              </label>
              <div className="relative">
                <select
                  value={stateRateIdx}
                  onChange={(e) => setStateRateIdx(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors text-sm appearance-none cursor-pointer"
                >
                  {STATE_RATES.map((s, i) => (
                    <option key={i} value={i}>{s.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
              </div>
            </div>

            {/* Short-term % slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Short-term vs long-term losses
                </label>
                <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                  {shortTermPct}% ST / {100 - shortTermPct}% LT
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={shortTermPct}
                onChange={(e) => setShortTermPct(Number(e.target.value))}
                className="w-full accent-[var(--color-gold)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-[var(--color-text-muted)] mt-1">
                <span>All long-term</span>
                <span>All short-term</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Results (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Headline savings — always visible */}
          <div className="sovereign-card gradient-border rounded-lg p-6 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, var(--color-gold), rgba(230,185,77,0.3), transparent)' }} />
            <div className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
              Estimated annual tax savings
            </div>
            <div className="text-4xl md:text-5xl font-bold font-mono text-[var(--color-gold)] glow-gold mb-1">
              {formatDollars(results.totalAnnualSavings)}
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)] font-mono">
              from {formatDollars(results.losses)} in harvestable losses
            </div>
          </div>

          {/* Quick stats — always visible */}
          <div className="grid grid-cols-2 gap-3">
            <div className="sovereign-card rounded-lg p-4 text-center">
              <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">5-Year Projection</div>
              <div className="text-lg font-bold font-mono text-[var(--color-text-primary)]">{formatDollars(results.fiveYearSavings)}</div>
            </div>
            <div className="sovereign-card rounded-lg p-4 text-center">
              <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Loss % of Portfolio</div>
              <div className="text-lg font-bold font-mono text-[var(--color-text-primary)]">{results.lossPct.toFixed(1)}%</div>
            </div>
          </div>

          {/* Email gate OR detailed breakdown */}
          {!showDetailedBreakdown ? (
            <div className="sovereign-card rounded-lg p-6 space-y-4">
              <div className="text-sm font-bold text-[var(--color-text-primary)]">
                Get your full TLH breakdown
              </div>
              <ul className="space-y-2 text-[12px] text-[var(--color-text-muted)]">
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-[var(--color-gold)] shrink-0" />Short-term vs long-term savings split</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-[var(--color-gold)] shrink-0" />Federal + state tax impact</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-[var(--color-gold)] shrink-0" />Helm Pro ROI comparison</li>
              </ul>
              <form onSubmit={handleEmailSubmit} className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors text-sm"
                  />
                </div>
                {emailError && <div className="text-xs text-[var(--color-negative)]">{emailError}</div>}
                <button
                  type="submit"
                  disabled={emailLoading}
                  className="w-full py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-sm rounded transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {emailLoading ? 'Saving…' : 'Show Full Breakdown'}
                </button>
              </form>
              <div className="text-[10px] text-[var(--color-text-muted)] text-center font-mono">
                No spam. Unsubscribe anytime.
              </div>
            </div>
          ) : (
            <div className="sovereign-card rounded-lg p-6 space-y-4">
              {emailSubmitted && (
                <div className="flex items-center gap-2 text-xs text-[var(--color-positive)] mb-2">
                  <Check className="w-3.5 h-3.5" />
                  Breakdown unlocked
                </div>
              )}

              <div className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Detailed Breakdown</div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Short-term losses ({shortTermPct}%)</span>
                  <span className="font-mono text-[var(--color-text-primary)]">{formatDollars(results.stLosses)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">ST tax savings ({(results.fedRate * 100).toFixed(0)}% + {(results.stateRate * 100).toFixed(0)}% state)</span>
                  <span className="font-mono text-[var(--color-positive)]">{formatDollars(results.stSavings)}</span>
                </div>
                <div className="h-px bg-[var(--color-border-subtle)]" />
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Long-term losses ({100 - shortTermPct}%)</span>
                  <span className="font-mono text-[var(--color-text-primary)]">{formatDollars(results.ltLosses)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">LT tax savings ({(results.ltcgRate * 100).toFixed(0)}% + {(results.stateRate * 100).toFixed(0)}% state)</span>
                  <span className="font-mono text-[var(--color-positive)]">{formatDollars(results.ltSavings)}</span>
                </div>
                <div className="h-px bg-[var(--color-border-subtle)]" />
                <div className="flex justify-between font-bold">
                  <span className="text-[var(--color-text-primary)]">Total annual savings</span>
                  <span className="font-mono text-[var(--color-gold)]">{formatDollars(results.totalAnnualSavings)}</span>
                </div>
              </div>

              {/* Helm Pro ROI */}
              <div className="mt-4 rounded border border-[var(--color-gold)]/20 bg-[var(--color-gold)]/[0.03] p-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-gold)]">Helm Pro ROI</div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Helm Pro cost</span>
                  <span className="font-mono text-[var(--color-text-primary)]">{formatDollars(results.helmProAnnual)}/yr</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Your estimated TLH savings</span>
                  <span className="font-mono text-[var(--color-positive)]">{formatDollars(results.totalAnnualSavings)}/yr</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-[var(--color-text-primary)]">Net savings after Helm Pro</span>
                  <span className={`font-mono ${results.netSavingsAfterHelm >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                    {formatDollars(results.netSavingsAfterHelm)}/yr
                  </span>
                </div>
                <div className="text-[10px] font-mono text-[var(--color-text-muted)]">
                  {results.roi.toFixed(0)}% return on your Helm Pro subscription
                </div>
              </div>

              {/* CTA */}
              <Link
                href="/signup"
                className="flex items-center justify-center gap-2 w-full py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-sm rounded transition-colors cursor-pointer mt-4"
              >
                Start Helm Pro — automate your TLH
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 text-[10px] text-[var(--color-text-muted)] leading-relaxed">
            <Shield className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              This calculator provides estimates only and does not constitute tax or investment advice. Consult a tax professional for your specific situation. Tax rates are approximate for 2026.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
