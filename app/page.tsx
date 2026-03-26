'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import {
  InteractiveGrid,
  StaggerText,
  CountUp,
  TypingText,
  FadeIn,
  ScrollTypingLine,
  TerminalBlock,
} from './landing-effects';
import type { Segment } from './landing-effects';

/* ─── Static data ───────────────────────────────────────────────────────── */

const dataRows = [
  {
    metric: 'AAPL 34%',
    metricColor: 'text-[var(--color-warning)]',
    title: 'Portfolio Intelligence',
    desc: 'Concentration risk, sector exposure, and performance attribution across all your positions.',
  },
  {
    metric: '$2,400',
    metricColor: 'text-[var(--color-positive)]',
    title: 'Tax-Loss Engine',
    desc: 'Automated harvesting detection, wash-sale compliance, and estimated tax savings.',
  },
  {
    metric: '3 Actions',
    metricColor: 'text-[var(--color-text-primary)]',
    title: 'Actions Inbox',
    desc: 'Prioritized alerts for earnings events, risk breaches, and cash flow anomalies.',
  },
];

const comparisons = [
  { before: '15-minute delayed data', after: 'Real-time' },
  { before: 'Generic stock screeners', after: 'Your actual positions' },
  { before: 'Manual tax spreadsheets', after: 'Automated detection' },
  { before: 'Email newsletter alerts', after: 'Prioritized inbox' },
  { before: '$2,000 – $24,000 / year', after: 'Free to start' },
  { before: 'Days to weeks of setup', after: 'Under 2 minutes' },
];

const g = 'text-[var(--color-positive)]';
const a = 'text-[var(--color-gold)]';
const m = 'text-[var(--color-text-muted)]';
const d = 'text-[var(--color-text-muted)] opacity-50';

const howItWorks: Segment[][] = [
  [{ text: '→ ', cls: a }, { text: 'helm connect', cls: `${g} font-semibold` }, { text: '  — link bank, brokerage, crypto via Plaid ', cls: m }, { text: '(90s)', cls: d }],
  [{ text: '→ ', cls: a }, { text: 'helm analyze', cls: `${g} font-semibold` }, { text: '  — 7 engines scan positions, tax, risk, cash flow', cls: m }],
  [{ text: '→ ', cls: a }, { text: 'helm act', cls: `${g} font-semibold` }, { text: '     — prioritized actions land in your inbox ', cls: m }, { text: 'daily', cls: a }],
];

const securityChecks: Segment[][] = [
  [{ text: '✓ ', cls: g }, { text: 'read-only access', cls: `${a} font-semibold` }, { text: '       — cannot move money or execute trades', cls: m }],
  [{ text: '✓ ', cls: g }, { text: 'AES-256 encryption', cls: `${a} font-semibold` }, { text: '     — bank-level, in transit + at rest', cls: m }],
  [{ text: '✓ ', cls: g }, { text: 'plaid infrastructure', cls: `${a} font-semibold` }, { text: '    — same provider as ', cls: m }, { text: 'Venmo, Robinhood, Coinbase', cls: d }],
  [{ text: '✓ ', cls: g }, { text: 'zero data selling', cls: `${a} font-semibold` }, { text: '      — your data is never sold or shared. ', cls: m }, { text: 'ever.', cls: 'text-[var(--color-text-primary)] font-semibold' }],
  [{ text: '✓ ', cls: g }, { text: 'full data deletion', cls: `${a} font-semibold` }, { text: '     — delete everything, anytime, no questions', cls: m }],
];

const sessionExcerpts: Segment[][][] = [
  [
    [{ text: '→ ', cls: a }, { text: 'flagged ', cls: m }, { text: '$2,847 tax-loss harvest', cls: `${g} font-semibold` }, { text: ' in VXUS position', cls: d }],
    [{ text: '→ ', cls: a }, { text: 'detected ', cls: m }, { text: '38% concentration', cls: `${a} font-semibold` }, { text: ' in single sector (tech)', cls: d }],
    [{ text: '→ ', cls: a }, { text: 'surfaced ', cls: m }, { text: '$340/mo subscription creep', cls: `${g} font-semibold` }, { text: ' — 3 flagged', cls: d }],
  ],
  [
    [{ text: '→ ', cls: a }, { text: 'identified ', cls: m }, { text: '$1,200 dividend income', cls: `${g} font-semibold` }, { text: ' not accounted for in planning', cls: d }],
    [{ text: '→ ', cls: a }, { text: 'alert: ', cls: 'text-[var(--color-negative)]' }, { text: 'AAPL earnings in 3 days', cls: `${a} font-semibold` }, { text: ' — 34% of portfolio exposed', cls: d }],
  ],
];

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function LandingTestPage() {
  const [scrolled, setScrolled] = useState(false);
  const [totalNetWorth, setTotalNetWorth] = useState(0);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -150]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    fetch('/api/metrics/platform')
      .then((r) => r.json())
      .then((d) => { if (d.totalNetWorth) setTotalNetWorth(d.totalNetWorth); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] overflow-x-hidden">
      {/* ── Custom keyframes ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes sonar {
              0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.2; }
              100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
            }
            @keyframes scanline {
              0% { top: -2%; }
              100% { top: 102%; }
            }
            @keyframes glow-breathe {
              0%, 100% { text-shadow: 0 0 40px rgba(230,185,77,0.3), 0 0 80px rgba(230,185,77,0.1); }
              50% { text-shadow: 0 0 60px rgba(230,185,77,0.5), 0 0 120px rgba(230,185,77,0.2); }
            }
            @keyframes rotate-slow {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes drift-a {
              0%, 100% { transform: translate(0, 0); }
              33% { transform: translate(60px, -40px); }
              66% { transform: translate(-30px, 25px); }
            }
            @keyframes drift-b {
              0%, 100% { transform: translate(0, 0); }
              33% { transform: translate(-50px, 30px); }
              66% { transform: translate(40px, -20px); }
            }
            .glow-breathe { animation: glow-breathe 3s ease-in-out infinite; }
          `,
        }}
      />

      {/* ── Ambient layers ── */}
      <InteractiveGrid />

      {/* Scan line */}
      <div
        className="fixed left-0 right-0 h-px pointer-events-none z-10"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(230,185,77,0.06), transparent)',
          animation: 'scanline 8s linear infinite',
        }}
      />

      {/* Drifting glow orbs */}
      <div
        className="fixed top-[15%] left-[5%] w-[600px] h-[600px] rounded-full pointer-events-none z-0 opacity-[0.04] blur-[150px] bg-[var(--color-gold)] will-change-transform"
        style={{ animation: 'drift-a 25s ease-in-out infinite' }}
      />
      <div
        className="fixed bottom-[10%] right-[5%] w-[500px] h-[500px] rounded-full pointer-events-none z-0 opacity-[0.025] blur-[120px] bg-[var(--color-positive)] will-change-transform"
        style={{ animation: 'drift-b 30s ease-in-out infinite' }}
      />

      {/* ════════════════════════════════════════════════════════════════════
          STICKY NAV
          ════════════════════════════════════════════════════════════════════ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-500 ${
          scrolled
            ? 'bg-[rgba(10,10,10,0.85)] backdrop-blur-xl border-white/[0.06]'
            : 'bg-transparent border-transparent'
        }`}
      >
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">
              Helm
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Terminal', 'Portfolio', 'Intelligence'].map((label) => (
              <Link
                key={label}
                href="/dashboard"
                className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
          <Link
            href="/signup"
            className="px-5 py-2 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-[background-color,box-shadow] duration-200 hover:bg-[var(--color-gold-hi)] hover:shadow-[0_0_30px_rgba(230,185,77,0.35)]"
          >
            Access Terminal
          </Link>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════
          HERO
          ════════════════════════════════════════════════════════════════════ */}
      <main>
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#0A0A0A_75%)] z-[1]" />

        {/* Gold ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] bg-[radial-gradient(ellipse,rgba(230,185,77,0.07),transparent_65%)] z-[1]" />

        {/* Sonar pulses */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 w-[300px] h-[300px] rounded-full border border-[var(--color-gold)] opacity-0 pointer-events-none z-[1]"
            style={{ animation: `sonar 5s ${i * 1.6}s ease-out infinite` }}
          />
        ))}

        {/* Rotating helm beams — 6 spokes like a ship's wheel */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1] overflow-hidden">
          <div
            className="w-[900px] h-[900px] will-change-transform"
            style={{ animation: 'rotate-slow 120s linear infinite' }}
          >
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <div
                key={angle}
                className="absolute top-1/2 left-1/2 w-[450px] h-[1px] origin-left"
                style={{
                  transform: `rotate(${angle}deg)`,
                  background: 'linear-gradient(to right, rgba(230,185,77,0.05), transparent)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Giant logo watermark — slow counter-rotation against helm beams */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-[1]">
          <div
            className="opacity-[0.04] will-change-transform"
            style={{ animation: 'rotate-slow 180s linear infinite reverse' }}
          >
            <HelmMark size={1200} variant="mono" className="text-[var(--color-gold)]" />
          </div>
        </div>

        {/* ── Hero content ── */}
        <motion.div
          className="relative z-[2] text-center px-6 max-w-5xl mx-auto"
          style={{ y: heroY, opacity: heroOpacity }}
        >
          {/* Two-part headline: challenge + answer */}
          <div className="mb-8">
            <div className="text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] font-black uppercase tracking-tighter leading-[0.88]">
              <StaggerText text="STEER." delay={300} className="block" />
              <StaggerText text="DON'T DRIFT." delay={700} className="block" />
            </div>
            <StaggerText
              text="TAKE THE HELM."
              delay={1400}
              goldWord="HELM"
              glowClass="glow-breathe"
              className="block text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-[0.15em] mt-5 text-[var(--color-text-secondary)]"
            />
          </div>

          <FadeIn delay={2000}>
            <p className="text-sm md:text-base text-[var(--color-text-secondary)] max-w-xl mx-auto mb-10 font-mono leading-relaxed min-h-[3em]">
              <TypingText
                text="Real-time portfolio intelligence. Automated tax optimization. Actionable risk detection."
                delay={2200}
                speed={22}
              />
            </p>
          </FadeIn>

          <FadeIn delay={3200}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="group relative px-10 py-3.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-sm uppercase tracking-[0.2em] rounded transition-[background-color,box-shadow] hover:bg-[var(--color-gold-hi)] hover:shadow-[0_0_50px_rgba(230,185,77,0.4)] overflow-hidden"
              >
                {/* Button shimmer */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative">Access Terminal</span>
              </Link>
              <Link
                href="/analyze"
                className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors group"
              >
                <span>Explore the platform</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </FadeIn>
        </motion.div>

        {/* Scroll indicator — slim gold arrow */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[2]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 6, 0] }}
          transition={{
            opacity: { delay: 4, duration: 0.5 },
            y: { delay: 4, duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <svg width="14" height="42" viewBox="0 0 14 42" fill="none">
            <line x1="7" y1="0" x2="7" y2="34" stroke="rgba(230,185,77,0.35)" strokeWidth="1" />
            <path d="M2 30 L7 38 L12 30" stroke="rgba(230,185,77,0.5)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </section>

      {/* Gold divider */}
      <div className="relative z-10 flex justify-center">
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-30" />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          METRICS STRIP
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-y border-white/[0.06] bg-[rgba(10,10,10,0.6)] backdrop-blur-md">
        <div className="container mx-auto px-6 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x md:divide-white/[0.06]">
            <div className="text-center md:text-left md:px-6 first:md:pl-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] font-mono mb-1">
                Net Worth Tracked
              </div>
              {totalNetWorth > 0 ? (
                <CountUp
                  end={totalNetWorth}
                  formatter={(v) => `$${Math.round(v).toLocaleString()}`}
                  duration={2500}
                  className="font-mono font-bold text-lg md:text-xl"
                />
              ) : (
                <span className="font-mono font-bold text-lg md:text-xl text-[var(--color-text-muted)]">&mdash;</span>
              )}
            </div>
            <div className="text-center md:text-left md:px-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] font-mono mb-1">
                Accounts Monitored
              </div>
              <CountUp end={3} duration={1500} className="font-mono font-bold text-lg md:text-xl" />
            </div>
            <div className="text-center md:text-left md:px-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] font-mono mb-1">
                Intelligence Engines
              </div>
              <CountUp end={7} duration={1800} className="font-mono font-bold text-lg md:text-xl" />
            </div>
            <div className="text-center md:text-left md:px-6 last:md:pr-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] font-mono mb-1">
                System Status
              </div>
              <span className="flex items-center justify-center md:justify-start gap-2 font-mono font-bold text-lg md:text-xl text-[var(--color-positive)]">
                <span className="w-2 h-2 rounded-full bg-[var(--color-positive)] animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                OPERATIONAL
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          DASHBOARD PREVIEW — hybrid mockup with live data
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 py-28">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <h2 className="text-center text-2xl md:text-3xl font-bold uppercase tracking-wider mb-12 text-[var(--color-text-secondary)]">
              Your Command Center.
            </h2>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="rounded-xl overflow-hidden border border-[var(--color-gold)]/20 shadow-[0_0_80px_rgba(230,185,77,0.06)]">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03]">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-negative)]/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-positive)]/40" />
                <span className="ml-2 text-[10px] font-mono text-[var(--color-text-muted)]">
                  helm terminal — dashboard
                </span>
              </div>

              {/* Dashboard content */}
              <div className="p-6 bg-[rgba(10,10,10,0.9)]">
                {/* Stat cards row */}
                <div className="grid grid-cols-3 gap-4 mb-5">
                  <div className="bg-white/[0.03] rounded-lg p-4">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-mono mb-1">
                      Net Worth
                    </div>
                    <div className="font-mono font-bold text-xl md:text-2xl text-[var(--color-gold)]">
                      {totalNetWorth > 0 ? (
                        <CountUp
                          end={totalNetWorth}
                          formatter={(v) => `$${Math.round(v).toLocaleString()}`}
                          duration={2000}
                        />
                      ) : (
                        '$—'
                      )}
                    </div>
                    <div className="text-xs text-[var(--color-positive)] font-mono mt-0.5">
                      +2.4% this month
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-4">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-mono mb-1">
                      Actions
                    </div>
                    <div className="font-mono font-bold text-xl md:text-2xl">
                      <CountUp end={3} duration={1500} />
                    </div>
                    <div className="text-xs text-[var(--color-gold)] font-mono mt-0.5">
                      2 high priority
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-4">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-mono mb-1">
                      Tax Savings
                    </div>
                    <div className="font-mono font-bold text-xl md:text-2xl text-[var(--color-positive)]">
                      <CountUp
                        end={2400}
                        formatter={(v) => `$${Math.round(v).toLocaleString()}`}
                        duration={2000}
                      />
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
                      YTD estimated
                    </div>
                  </div>
                </div>

                {/* Net worth chart */}
                <div className="bg-white/[0.02] rounded-lg p-4 h-36 relative overflow-hidden">
                  <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-mono mb-2">
                    Net Worth — 12 Months
                  </div>
                  <svg viewBox="0 0 400 90" className="w-full h-full" preserveAspectRatio="none">
                    {[0, 30, 60, 90].map((y) => (
                      <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                    ))}
                    <path
                      d="M0,78 C30,72 60,65 100,58 C140,51 170,55 200,45 C230,35 260,40 300,28 C330,20 360,15 400,8 L400,90 L0,90 Z"
                      fill="url(#nwGradient)"
                    />
                    <path
                      d="M0,78 C30,72 60,65 100,58 C140,51 170,55 200,45 C230,35 260,40 300,28 C330,20 360,15 400,8"
                      fill="none"
                      stroke="var(--color-gold)"
                      strokeWidth="1.5"
                    />
                    <circle cx="400" cy="8" r="2.5" fill="var(--color-gold)" />
                    <circle cx="400" cy="8" r="5" fill="rgba(230,185,77,0.2)" />
                    <defs>
                      <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(230,185,77,0.12)" />
                        <stop offset="100%" stopColor="rgba(230,185,77,0)" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          WHAT HELM WATCHES — horizontal data rows, not cards
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 py-28">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <h2 className="text-center text-2xl md:text-3xl font-bold uppercase tracking-wider mb-16 text-[var(--color-text-secondary)]">
              What Helm watches.
            </h2>
          </FadeIn>

          <div className="border-t border-white/[0.06]">
            {dataRows.map((row, i) => (
              <FadeIn key={row.title} delay={i * 100}>
                <div className="group flex flex-col md:flex-row md:items-center border-b border-white/[0.06] py-7 px-2 hover:bg-white/[0.015] transition-colors cursor-default">
                  {/* Metric — big, mono, left-aligned */}
                  <div className="md:w-44 shrink-0 mb-2 md:mb-0">
                    <span className={`font-mono font-bold text-2xl md:text-3xl ${row.metricColor}`}>
                      {row.metric}
                    </span>
                  </div>
                  {/* Title */}
                  <div className="md:w-52 shrink-0 mb-1 md:mb-0">
                    <span className="font-bold uppercase tracking-wider text-xs text-[var(--color-text-primary)]">
                      {row.title}
                    </span>
                  </div>
                  {/* Description */}
                  <div className="flex-1">
                    <span className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                      {row.desc}
                    </span>
                  </div>
                  {/* Hover arrow */}
                  <ArrowRight className="hidden md:block w-4 h-4 text-[var(--color-gold)] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-[opacity,transform] ml-6 shrink-0" />
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          HOW IT WORKS — terminal command sequence
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 pb-28">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-center text-2xl md:text-3xl font-bold uppercase tracking-wider mb-12 text-[var(--color-text-secondary)]">
              Get Started.
            </h2>
          </FadeIn>

          <FadeIn delay={150}>
            <TerminalBlock>
              <div className="space-y-3">
                {howItWorks.map((segs, i) => (
                  <div key={i}>
                    <ScrollTypingLine segments={segs} delay={i * 600} speed={20} />
                  </div>
                ))}
              </div>
            </TerminalBlock>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          BEFORE HELM — editorial strikethrough comparison
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 pb-32">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-center text-2xl md:text-3xl font-bold uppercase tracking-wider mb-16 text-[var(--color-text-secondary)]">
              Before Helm.
            </h2>
          </FadeIn>

          <div className="space-y-5">
            {comparisons.map((row, i) => (
              <FadeIn key={row.after} delay={i * 80}>
                <div className="flex items-center gap-4 md:gap-8 font-mono text-sm md:text-base">
                  <span className="flex-1 text-right text-[var(--color-text-muted)] line-through decoration-white/20">
                    {row.before}
                  </span>
                  <span className="text-[var(--color-gold)] text-lg shrink-0">&rarr;</span>
                  <span className="flex-1 text-[var(--color-text-primary)] font-semibold">
                    {row.after}
                  </span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          TRUST & SECURITY — terminal audit log
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 pb-28">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-center text-2xl md:text-3xl font-bold uppercase tracking-wider mb-12 text-[var(--color-text-secondary)]">
              Security.
            </h2>
          </FadeIn>

          <FadeIn delay={150}>
            <TerminalBlock command="$ helm security --verify">
              <div className="space-y-2.5">
                {securityChecks.map((segs, i) => (
                  <div key={i}>
                    <ScrollTypingLine segments={segs} delay={i * 500} speed={18} />
                  </div>
                ))}
              </div>
              <FadeIn delay={2800} direction="none">
                <div className="mt-4 text-xs text-[var(--color-text-muted)]">
                  All checks passed. System secure. <span className="text-[var(--color-positive)]">●</span>
                </div>
              </FadeIn>
            </TerminalBlock>
          </FadeIn>
        </div>
      </section>

      {/* Gold divider between terminal sections */}
      <div className="relative z-10 flex justify-center mb-28">
        <div className="w-24 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-20" />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SOCIAL PROOF — terminal session excerpts
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 pb-28">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-center text-2xl md:text-3xl font-bold uppercase tracking-wider mb-12 text-[var(--color-text-secondary)]">
              What Helm Finds.
            </h2>
          </FadeIn>

          <div className="space-y-4">
            {sessionExcerpts.map((session, si) => (
              <FadeIn key={si} delay={si * 200}>
                <TerminalBlock command="// session — early access user">
                  <div className="space-y-2">
                    {session.map((segs, li) => (
                      <div key={li}>
                        <ScrollTypingLine segments={segs} delay={li * 500} speed={18} />
                      </div>
                    ))}
                  </div>
                </TerminalBlock>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          FINAL CTA — terminal prompt
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 pb-28">
        <FadeIn>
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-10">
              Take the{' '}
              <span className="text-[var(--color-gold)] glow-breathe">Helm</span>.
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
              <Link
                href="/signup"
                className="group relative px-10 py-3.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-sm uppercase tracking-[0.2em] rounded transition-[background-color,box-shadow] hover:bg-[var(--color-gold-hi)] hover:shadow-[0_0_50px_rgba(230,185,77,0.4)] overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative">Get Started Free</span>
              </Link>
              <Link
                href="/analyze"
                className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors group"
              >
                <span>Try free stock analysis</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
            <p className="text-xs font-mono text-[var(--color-text-muted)]">
              free to start. no credit card required.
            </p>
          </div>
        </FadeIn>
      </section>

      </main>

      {/* ════════════════════════════════════════════════════════════════════
          FOOTER
          ════════════════════════════════════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/[0.06] py-8">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <HelmMark size={16} />
              <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)] font-mono">
                &copy; {new Date().getFullYear()} Helm Terminal
              </span>
            </div>
            <div className="flex items-center gap-5">
              {[
                { label: 'Privacy', href: '/privacy' },
                { label: 'Terms', href: '/terms' },
                { label: 'Security', href: '/security' },
                { label: 'Data Deletion', href: '/data-deletion' },
                { label: 'Contact', href: 'mailto:support@helmterminal.dev' },
              ].map((link) =>
                link.href.startsWith('mailto:') ? (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors font-mono"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors font-mono"
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
