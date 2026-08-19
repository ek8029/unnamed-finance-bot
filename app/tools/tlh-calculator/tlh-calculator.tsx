'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { ArrowRight, Shield, Mail, Check, ChevronRight, RotateCcw } from 'lucide-react';

/* ── Data ── */

const BRACKETS = [
  { label: '10%', rate: 0.10 },
  { label: '12%', rate: 0.12 },
  { label: '22%', rate: 0.22 },
  { label: '24%', rate: 0.24 },
  { label: '32%', rate: 0.32 },
  { label: '35%', rate: 0.35 },
  { label: '37%', rate: 0.37 },
];

const STATES = [
  { label: 'No state tax', rate: 0 },
  { label: '~3%', rate: 0.03 },
  { label: '~5%', rate: 0.05 },
  { label: '~7%', rate: 0.07 },
  { label: '~9%', rate: 0.09 },
  { label: '~11%+', rate: 0.11 },
];

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

/* ── Animated counter for the big reveal ── */
function CountUpValue({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => { if (ref.current) ref.current.textContent = fmt(v); },
    });
    return () => controls.stop();
  }, [value]);
  return <span ref={ref} className={className} style={style}>{fmt(0)}</span>;
}

/* ── Main ── */

export function TLHCalculator() {
  const searchParams = useSearchParams();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<'input' | 'results'>('input');

  const [portfolio, setPortfolio] = useState(searchParams.get('portfolio') || '');
  const [losses, setLosses] = useState(searchParams.get('losses') || '');
  const [bracketIdx, setBracketIdx] = useState(3);
  const [stateIdx, setStateIdx] = useState(0);
  const [stPct, setStPct] = useState(30);
  const [gains, setGains] = useState(searchParams.get('gains') || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [email, setEmail] = useState('');
  const [emailDone, setEmailDone] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailErr, setEmailErr] = useState('');

  const pVal = Math.max(0, parseFloat(portfolio.replace(/\D/g, '')) || 0);
  const lVal = Math.max(0, parseFloat(losses.replace(/\D/g, '')) || 0);
  const gVal = Math.max(0, parseFloat(gains.replace(/\D/g, '')) || 0);

  const r = useMemo(() => {
    const fed = BRACKETS[bracketIdx].rate;
    const state = STATES[stateIdx].rate;
    const ltcg = fed <= 0.12 ? 0 : fed >= 0.37 ? 0.20 : 0.15;
    const stL = lVal * (stPct / 100);
    const ltL = lVal * (1 - stPct / 100);
    // Step 1: Losses offset gains dollar-for-dollar (no cap)
    const gainsOffset = Math.min(lVal, gVal);
    const gainsOffsetSavings = gainsOffset * (fed + state);

    // Step 2: Remaining losses hit $3,000/yr ordinary income deduction cap
    const CAP = 3000;
    const excessLoss = Math.max(0, lVal - gVal);
    const deductibleY1 = Math.min(excessLoss, CAP);
    const ordinaryDeductionSavings = deductibleY1 * (fed + state);

    // Total year-1 savings
    const total = gainsOffsetSavings + ordinaryDeductionSavings;

    // Carryforward: excess beyond gains + $3K deduction
    const carryforward = Math.max(0, excessLoss - CAP);
    const yearsToExhaust = carryforward > 0 ? Math.ceil(carryforward / CAP) + 1 : 0;

    // 5-year projection
    const futureYearSavings = Math.min(carryforward, CAP * 4) * (fed + state);
    const fiveYear = total + futureYearSavings;

    // Breakdown for display
    const stS = stL * (fed + state);
    const ltS = ltL * (ltcg + state);

    const helmCost = 20 * 12;
    return {
      stL, ltL, stS, ltS,
      total, gainsOffset, gainsOffsetSavings, ordinaryDeductionSavings,
      carryforward, yearsToExhaust, fiveYear,
      helmCost,
      net: total - helmCost,
      roi: helmCost > 0 ? (total / helmCost) * 100 : 0,
      lossPct: pVal > 0 ? (lVal / pVal) * 100 : 0,
      fed, ltcg, state,
    };
  }, [portfolio, losses, gains, bracketIdx, stateIdx, stPct, pVal, lVal, gVal]);

  const canGo = pVal > 0 && lVal > 0;

  const doCalc = () => {
    if (!canGo) return;
    setStep('results');
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const doEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = email.trim();
    if (!t || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) { setEmailErr('Enter a valid email.'); return; }
    setEmailLoading(true); setEmailErr('');
    try {
      const res = await fetch('/api/pro-waitlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: t, source: 'tlh-calculator' }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); if (b.code === 'DUPLICATE') { setEmailDone(true); return; } throw new Error(); }
      setEmailDone(true);
    } catch { setEmailErr('Something went wrong.'); } finally { setEmailLoading(false); }
  };

  return (
    <div className="relative z-10 min-h-[80vh]">
      <section className="relative container mx-auto px-6 pt-16 pb-20 max-w-xl">

        {/* ── Header ── */}
        <div className="mb-12">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Tax-Loss Harvesting Calculator</div>
          <h1 className="font-sans font-bold text-[30px] sm:text-[36px] md:text-[44px] tracking-tight leading-[1.08] mb-3">
            How much could<br />
            <span className="text-[var(--color-gold)]">tax-loss harvesting</span><br />
            save you?
          </h1>
          <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed">
            30 seconds. Two numbers. Real math.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'input' ? (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* ── Primary inputs — large, breathing room ── */}
              <div className="space-y-8 mb-8">
                <InputField
                  label="What's your taxable portfolio worth?"
                  hint="401(k), IRA, Roth don't count — taxable accounts only."
                  value={portfolio}
                  onChange={setPortfolio}
                  placeholder="250,000"
                />
                <InputField
                  label="How much are you down across all positions?"
                  hint="Total unrealized losses across all underwater positions."
                  value={losses}
                  onChange={setLosses}
                  placeholder="15,000"
                  belowHint={
                    <Link href="/signup" className="inline-flex items-center gap-1 text-[13px] text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors mt-1">
                      Not sure? Connect your brokerage — Helm calculates it for you <ArrowRight className="w-3 h-3" />
                    </Link>
                  }
                />

                <InputField
                  label="Realized capital gains this year?"
                  hint="Gains from selling winners in 2026. Enter $0 if none or unsure."
                  value={gains}
                  onChange={setGains}
                  placeholder="0"
                />

                {/* Bracket — pill selector */}
                <div>
                  <div className="type-label text-[var(--color-text-secondary)] mb-3">Federal tax bracket</div>
                  <div className="flex flex-wrap gap-2">
                    {BRACKETS.map((b, i) => (
                      <button
                        key={i}
                        onClick={() => setBracketIdx(i)}
                        className={`px-4 py-2 rounded text-[15px] font-mono font-semibold transition-all duration-150 cursor-pointer border ${
                          i === bracketIdx
                            ? 'bg-[var(--color-gold)] border-[var(--color-gold)] text-[var(--color-bg-base)]'
                            : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-base)] text-[var(--color-text-muted)] hover:border-[var(--color-gold-border)] hover:text-[var(--color-text-secondary)]'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Advanced — collapsed ── */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer mb-6"
              >
                <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${showAdvanced ? 'rotate-90' : ''}`} />
                <span>State tax &amp; holding period</span>
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-6 pb-8 border-t border-[var(--color-border-subtle)] pt-6">
                      {/* State */}
                      <div>
                        <div className="type-label text-[var(--color-text-secondary)] mb-3">State tax rate</div>
                        <div className="flex flex-wrap gap-2">
                          {STATES.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => setStateIdx(i)}
                              className={`px-3 py-1.5 rounded text-[13px] font-mono transition-all duration-150 cursor-pointer border ${
                                i === stateIdx
                                  ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border-[var(--color-border-strong)]'
                                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border-transparent hover:border-[var(--color-border-base)]'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* ST/LT slider */}
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="type-label text-[var(--color-text-secondary)]">Holding period mix</span>
                          <span className="text-[13px] font-mono text-[var(--color-text-muted)]">{stPct}% short / {100 - stPct}% long</span>
                        </div>
                        <input type="range" min={0} max={100} step={5} value={stPct} onChange={(e) => setStPct(Number(e.target.value))}
                          className="w-full accent-[var(--color-gold)] cursor-pointer h-1" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── CTA ── */}
              <motion.button
                onClick={doCalc}
                disabled={!canGo}
                whileHover={canGo ? { scale: 1.01 } : {}}
                whileTap={canGo ? { scale: 0.98 } : {}}
                className="group w-full flex items-center justify-center gap-3 py-4 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all duration-200 hover:brightness-110 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
              >
                Show me the math
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
            </motion.div>
          ) : (
            /* ════════════════════════════════════════════════
               RESULTS — the dramatic reveal
               ════════════════════════════════════════════════ */
            <motion.div
              key="results"
              ref={resultsRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* ── The number — massive, centered, unmissable ── */}
              <motion.div
                className="text-center py-12 mb-10"
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              >
                <div className="type-eyebrow text-[var(--color-text-muted)] mb-4">
                  Estimated annual tax savings
                </div>
                <CountUpValue
                  value={r.total}
                  className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-sans text-[var(--color-gold)] leading-none"
                  style={{ fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}
                />
                <motion.div
                  className="text-[15px] text-[var(--color-text-muted)] mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <span>from {fmt(lVal)} in losses · {r.lossPct.toFixed(1)}% of your portfolio</span>
                  {r.carryforward > 0 && (
                    <span className="block text-[13px] mt-1">
                      {fmt(r.gainsOffset)} offsets gains directly · {fmt(r.carryforward)} carries forward at $3,000/yr
                    </span>
                  )}
                </motion.div>
              </motion.div>

              {/* ── Secondary metrics — staggered reveal ── */}
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-3 mb-10"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.6 } } }}
              >
                {[
                  { label: '5-Year Savings', value: fmt(r.fiveYear) },
                  { label: 'Gains Offset', value: fmt(r.gainsOffset) },
                  { label: 'Carryforward', value: r.carryforward > 0 ? fmt(r.carryforward) : 'None' },
                ].map((m) => (
                  <motion.div
                    key={m.label}
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                    className="text-center py-4 border-b border-[var(--color-border-subtle)] first:border-r last:border-l border-r-[var(--color-border-subtle)] border-l-[var(--color-border-subtle)]"
                  >
                    <div className="type-data-label mb-1.5">{m.label}</div>
                    <div className="type-data-sm text-[var(--color-text-primary)]">{m.value}</div>
                  </motion.div>
                ))}
              </motion.div>

              {/* ── Breakdown — clean table ── */}
              <motion.div
                className="mb-8"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <div className="type-data-label mb-4">Breakdown</div>
                <div className="space-y-3 text-[15px]">
                  {r.gainsOffset > 0 && (
                    <>
                      <Row left="Losses offsetting gains (no cap)" right={fmt(r.gainsOffset)} />
                      <Row left={`→ Tax saved at ${((r.fed + r.state) * 100).toFixed(0)}%`} right={fmt(r.gainsOffsetSavings)} rightColor="text-[var(--color-positive)]" />
                      <div className="h-px bg-[var(--color-border-subtle)]" />
                    </>
                  )}
                  {r.ordinaryDeductionSavings > 0 && (
                    <>
                      <Row left="$3,000 ordinary income deduction" right={fmt(Math.min(lVal - gVal, 3000))} />
                      <Row left={`→ Tax saved at ${((r.fed + r.state) * 100).toFixed(0)}%`} right={fmt(r.ordinaryDeductionSavings)} rightColor="text-[var(--color-positive)]" />
                      <div className="h-px bg-[var(--color-border-subtle)]" />
                    </>
                  )}
                  {r.carryforward > 0 && (
                    <>
                      <Row left="Carryforward to future years" right={fmt(r.carryforward)} />
                      <Row left={`→ Deductible at $3,000/yr (${r.yearsToExhaust - 1} more yrs)`} right="" rightColor="text-[var(--color-text-muted)]" />
                      <div className="h-px bg-[var(--color-border-subtle)]" />
                    </>
                  )}
                  <Row left="Year 1 tax savings" right={fmt(r.total)} rightColor="text-[var(--color-gold)]" bold />
                </div>
              </motion.div>

              {/* ── Helm Pro ROI — the pitch ── */}
              <motion.div
                className="sovereign-card rounded border-l-2 border-l-[var(--color-gold)] p-5 mb-8"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
              >
                <div className="type-data-label text-[var(--color-gold)] mb-4">What if this was automated?</div>
                <div className="space-y-2.5 text-[15px]">
                  <Row left="Your TLH savings" right={`${fmt(r.total)}/yr`} rightColor="text-[var(--color-positive)]" />
                  <Row left="Helm Pro" right={`${fmt(r.helmCost)}/yr`} />
                  <div className="h-px bg-[var(--color-gold-border)]" />
                  <Row left="Net after Helm" right={`${fmt(r.net)}/yr`} rightColor={r.net >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'} bold />
                </div>
                <div className="text-[13px] font-mono text-[var(--color-text-muted)] mt-3">
                  {r.roi.toFixed(0)}% return on your subscription. Helm scans your brokerage daily.
                </div>
              </motion.div>

              {/* ── Email capture — quarterly reminder ── */}
              <motion.div
                className="mb-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.3 }}
              >
                {!emailDone ? (
                  <div className="sovereign-card rounded p-5">
                    <div className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">Get quarterly TLH reminders</div>
                    <p className="text-[13px] text-[var(--color-text-muted)] mb-4">A nudge each quarter to check for harvesting opportunities — when it matters most.</p>
                    <form onSubmit={doEmail} className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailErr(''); }}
                          placeholder="you@example.com" aria-label="Email for TLH reminders"
                          className="w-full pl-9 pr-3 py-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[15px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors" />
                      </div>
                      <button type="submit" disabled={emailLoading}
                        className="px-5 py-2.5 border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap">
                        {emailLoading ? '...' : 'Subscribe'}
                      </button>
                    </form>
                    {emailErr && <p className="text-[13px] text-[var(--color-negative-text)] mt-1.5">{emailErr}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[15px] text-[var(--color-positive)]">
                    <Check className="w-4 h-4" /> Quarterly reminders set. Check your inbox.
                  </div>
                )}
              </motion.div>

              {/* ── CTAs ── */}
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
              >
                <Link href="/signup"
                  className="flex items-center justify-center gap-2.5 w-full py-4 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded hover:brightness-110 transition-all cursor-pointer">
                  Start Helm Pro — automate your TLH <ArrowRight className="w-4 h-4" />
                </Link>
                <div className="flex gap-3">
                  <button onClick={() => { setStep('input'); setShowAdvanced(false); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-[15px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-base)] rounded transition-colors cursor-pointer">
                    <RotateCcw className="w-3.5 h-3.5" /> Recalculate
                  </button>
                  <Link href="/analyze"
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-[15px] text-[var(--color-text-secondary)] hover:text-[var(--color-gold)] border border-[var(--color-border-base)] hover:border-[var(--color-gold-border)] rounded transition-colors cursor-pointer">
                    Try stock analysis <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </motion.div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 text-[13px] text-[var(--color-text-muted)] leading-relaxed mt-8">
                <Shield className="w-3 h-3 shrink-0 mt-0.5" />
                <span>Estimates only. Not tax or investment advice. Consult a qualified tax professional. Rates approximate for 2026.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

/* ── Subcomponents ── */

function InputField({ label, hint, value, onChange, placeholder, belowHint }: {
  label: string; hint: string; value: string; onChange: (v: string) => void; placeholder: string; belowHint?: React.ReactNode;
}) {
  const display = value ? Number(value).toLocaleString('en-US') : '';
  return (
    <div>
      <label className="block text-[15px] font-medium text-[var(--color-text-primary)] mb-2">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[var(--color-text-muted)] font-mono">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors font-mono text-2xl"
        />
      </div>
      <p className="text-[13px] text-[var(--color-text-muted)] mt-1.5">{hint}</p>
      {belowHint}
    </div>
  );
}

function Row({ left, right, rightColor, bold }: { left: string; right: string; rightColor?: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline ${bold ? 'font-semibold' : ''}`}>
      <span className={bold ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}>{left}</span>
      <span className={`font-mono ${rightColor || 'text-[var(--color-text-primary)]'}`}>{right}</span>
    </div>
  );
}
