'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Search, Loader2, Shield, Clock, Zap, TrendingUp, Eye, Target } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { InteractiveGrid, StaggerText, CountUp, FadeIn, ScrollTypingLine, TerminalBlock } from '@/app/landing-effects';
import type { Segment } from '@/app/landing-effects';
import { HeroAnalysisDemo } from './hero-analysis-demo';
import type { DemoAnalysis } from '@/lib/demo-tickers';

/* ─── Static data ───────────────────────────────────────────────────────── */

const TICKER_CHIPS = ['AAPL', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'MSFT', 'JPM'];

const g = 'text-[var(--color-positive)]';
const a = 'text-[var(--color-gold)]';
const m = 'text-[var(--color-text-muted)]';
const d = 'text-[var(--color-text-muted)] opacity-50';

const securityChecks: Segment[][] = [
  [{ text: '✓ ', cls: g }, { text: 'read-only access', cls: `${a} font-semibold` }, { text: '       — cannot move money or execute trades', cls: m }],
  [{ text: '✓ ', cls: g }, { text: 'AES-256 encryption', cls: `${a} font-semibold` }, { text: '     — bank-level, in transit + at rest', cls: m }],
  [{ text: '✓ ', cls: g }, { text: 'plaid infrastructure', cls: `${a} font-semibold` }, { text: '    — same provider as ', cls: m }, { text: 'Venmo, Robinhood, Coinbase', cls: d }],
  [{ text: '✓ ', cls: g }, { text: 'zero data selling', cls: `${a} font-semibold` }, { text: '      — your data is never sold or shared. ', cls: m }, { text: 'ever.', cls: 'text-[var(--color-text-primary)] font-semibold' }],
  [{ text: '✓ ', cls: g }, { text: 'full data deletion', cls: `${a} font-semibold` }, { text: '     — delete everything, anytime, no questions', cls: m }],
];

/* ─── Shared animation config ─────────────────────────────────────────── */

const sectionReveal = {
  initial: { opacity: 0, y: 32 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  viewport: { once: true, margin: '-80px' as const },
};

/* ─── Inline search component ─────────────────────────────────────────── */

function HeroSearch() {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = ticker.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (clean && clean.length <= 5) {
      setLoading(true);
      router.push(`/analyze/${clean}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md">
      <div className="flex-1 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Enter any US ticker"
          maxLength={5}
          disabled={loading}
          className="w-full pl-10 pr-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors text-sm tracking-wider disabled:opacity-60"
          style={{ fontFamily: 'var(--font-mono)' }}
        />
      </div>
      <button
        type="submit"
        disabled={!ticker.trim() || loading}
        className="px-8 py-3 bg-[var(--color-gold)] hover:brightness-110 hover:shadow-[0_0_32px_-4px_rgba(230,185,77,0.5)] hover:scale-[1.02] active:scale-[0.98] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded shadow-[0_8px_24px_rgba(230,185,77,0.25)] transition-all duration-150 ease-out disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap cursor-pointer"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Analyze'}
      </button>
    </form>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

interface HomeContentProps {
  demoAnalyses: DemoAnalysis[];
}

export default function HomeContent({ demoAnalyses }: HomeContentProps) {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 600], [1, 0]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div
      className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] overflow-x-hidden"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(230,185,77,0.03), transparent)' }}
    >
      {/* ── Custom keyframes ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sonar { 0% { transform: translate(-50%,-50%) scale(0.3); opacity:0.15; } 100% { transform: translate(-50%,-50%) scale(2.5); opacity:0; } }
        @keyframes glow-breathe { 0%,100% { text-shadow: 0 0 40px rgba(230,185,77,0.3), 0 0 80px rgba(230,185,77,0.1); } 50% { text-shadow: 0 0 60px rgba(230,185,77,0.5), 0 0 120px rgba(230,185,77,0.2); } }
        @keyframes rotate-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .glow-breathe { animation: glow-breathe 3s ease-in-out infinite; }
        @keyframes cta-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.015); } }
      ` }} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Helm Terminal',
        description: 'AI-powered financial intelligence platform for individual investors. Free stock analysis, portfolio tracking, and market insights.',
        url: 'https://helmterminal.dev', applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }) }} />

      {/* ── Ambient layers ── */}
      <InteractiveGrid />
      <div className="fixed top-[20%] left-[10%] w-[500px] h-[500px] rounded-full pointer-events-none z-0 opacity-[0.03] blur-[120px] bg-[var(--color-gold)] will-change-transform" />
      <div className="fixed bottom-[15%] right-[10%] w-[400px] h-[400px] rounded-full pointer-events-none z-0 opacity-[0.02] blur-[100px] bg-[var(--color-positive)] will-change-transform" />

      {/* Sonar pulses */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="absolute left-1/2 top-1/2 w-[300px] h-[300px] rounded-full border border-[var(--color-gold)] opacity-0 pointer-events-none z-[1]" style={{ animation: `sonar 5s ${i * 1.6}s ease-out infinite` }} />
      ))}

      {/* ═══ STICKY NAV ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-500 ${scrolled ? 'bg-[rgba(10,10,10,0.85)] backdrop-blur-xl border-white/[0.06]' : 'bg-transparent border-transparent'}`}>
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[{ label: 'Analyze', href: '/analyze' }, { label: 'Pricing', href: '/pricing' }].map((item) => (
              <Link key={item.label} href={item.href} className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">{item.label}</Link>
            ))}
          </div>
          <Link href="/signup" className="px-5 py-2 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_30px_rgba(230,185,77,0.35)]">
            Access Terminal
          </Link>
        </div>
      </nav>

      <main>

      {/* ════════════════════════════════════════════════════════════════════
          HERO — asymmetric split: copy left, product showcase right
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-24 pb-16">
        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#0A0A0A_80%)] z-[1]" />
        <div className="absolute top-[40%] left-[30%] w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(230,185,77,0.06),transparent_60%)] z-[1]" />

        {/* Rotating helm beams */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1] overflow-hidden opacity-50">
          <div className="w-[1200px] h-[1200px] will-change-transform" style={{ animation: 'rotate-slow 120s linear infinite' }}>
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <div key={angle} className="absolute top-1/2 left-1/2 w-[600px] h-[1px] origin-left" style={{ transform: `rotate(${angle}deg)`, background: 'linear-gradient(to right, rgba(230,185,77,0.04), transparent)' }} />
            ))}
          </div>
        </div>

        {/* Logo watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-[1] overflow-hidden">
          <div className="opacity-[0.025] will-change-transform" style={{ animation: 'rotate-slow 180s linear infinite reverse' }}>
            <HelmMark size={1200} variant="mono" className="text-[var(--color-gold)] w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] md:w-[800px] md:h-[800px] lg:w-[1200px] lg:h-[1200px]" />
          </div>
        </div>

        {/* ── Hero content: asymmetric split ── */}
        <motion.div className="relative z-[2] w-full max-w-7xl mx-auto px-6" style={{ opacity: heroOpacity }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* LEFT — copy + search */}
            <div className="space-y-8">
              {/* Eyebrow */}
              <FadeIn delay={200}>
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--color-gold)]">
                  Free AI Stock Analysis — No Signup
                </div>
              </FadeIn>

              {/* H1 */}
              <FadeIn delay={400}>
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[3.75rem] xl:text-7xl font-bold tracking-tight leading-[1.08]">
                  Institutional-grade analysis{' '}
                  <span className="text-[var(--color-text-secondary)]">for every US stock.</span>
                </h1>
              </FadeIn>

              {/* Subhead */}
              <FadeIn delay={600}>
                <p className="text-base md:text-lg text-[var(--color-text-muted)] leading-relaxed max-w-lg">
                  Transparent methodology. Real-time data. Zero paywall on the core product.
                </p>
              </FadeIn>

              {/* Brand tagline */}
              <FadeIn delay={700}>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  Steer. Don&apos;t drift. <span className="text-[var(--color-gold)] glow-breathe">Take the Helm.</span>
                </div>
              </FadeIn>

              {/* Search */}
              <FadeIn delay={800}>
                <div className="space-y-4">
                  <HeroSearch />
                  {/* Ticker chips — staggered */}
                  <motion.div
                    className="flex flex-wrap gap-2"
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.05, delayChildren: 1.0 } } }}
                  >
                    {TICKER_CHIPS.map((t) => (
                      <motion.div
                        key={t}
                        variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <Link
                          href={`/analyze/${t}`}
                          className="block px-3 py-1.5 text-[11px] font-mono font-bold tracking-wider bg-white/[0.03] border border-white/[0.06] rounded hover:border-[var(--color-gold)]/40 hover:text-[var(--color-gold)] hover:shadow-[0_0_16px_rgba(230,185,77,0.1)] hover:scale-[1.03] transition-all duration-150 text-[var(--color-text-muted)] cursor-pointer"
                        >
                          {t}
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              </FadeIn>
            </div>

            {/* RIGHT — product showcase */}
            <FadeIn delay={600} direction="none">
              <div className="lg:pl-4">
                <HeroAnalysisDemo analyses={demoAnalyses} />
              </div>
            </FadeIn>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 6, 0] }}
          transition={{ opacity: { delay: 2, duration: 0.5 }, y: { delay: 2, duration: 2.5, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <svg width="14" height="42" viewBox="0 0 14 42" fill="none">
            <line x1="7" y1="0" x2="7" y2="34" stroke="rgba(230,185,77,0.3)" strokeWidth="1" />
            <path d="M2 30 L7 38 L12 30" stroke="rgba(230,185,77,0.4)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SOCIAL PROOF STRIP
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-y border-white/[0.06] bg-[rgba(10,10,10,0.6)] backdrop-blur-sm">
        <div className="container mx-auto px-6 py-5">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
            <span><span className="text-[var(--color-text-primary)] font-bold">510+</span> stocks analyzed</span>
            <span className="hidden sm:inline text-white/10">|</span>
            <span>AI-powered verdicts with <span className="text-[var(--color-gold)]">full source transparency</span></span>
            <span className="hidden sm:inline text-white/10">|</span>
            <span>Featured on <span className="text-[var(--color-text-primary)] font-bold">Hacker News</span></span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION A — "See the reasoning, not just the score."
          ════════════════════════════════════════════════════════════════════ */}
      <motion.section className="relative z-10 py-28 md:py-36" {...sectionReveal}>
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Text */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-gold)]/5 border border-[var(--color-gold)]/15">
                <Eye className="w-3.5 h-3.5 text-[var(--color-gold)]" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-gold)]">Transparent Analysis</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.12]">
                See the reasoning,<br />
                <span className="text-[var(--color-text-muted)]">not just the score.</span>
              </h2>
              <p className="text-sm md:text-base text-[var(--color-text-muted)] leading-relaxed max-w-md">
                Every Helm analysis includes the bull case, bear case, key metrics, and recent headlines — with the methodology version and data sources shown on every page.
              </p>
              <Link href="/analyze/NVDA" className="inline-flex items-center gap-2 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors group font-medium">
                See an example analysis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Visual — methodology panel mockup */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0C0C0C] overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Methodology</div>
                <div className="space-y-2">
                  {['Finnhub real-time market data', 'GPT-4o-mini analysis engine', 'Refreshed every 15 min during market hours', '5-point sentiment scoring'].map((item, i) => (
                    <motion.div
                      key={item}
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}
                      viewport={{ once: true }}
                    >
                      <span className="w-1 h-1 rounded-full bg-[var(--color-gold)]" />
                      <span className="text-[12px] text-[var(--color-text-secondary)]">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 gap-3">
                <div className="rounded bg-[var(--color-positive)]/[0.04] border border-[var(--color-positive)]/15 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3 h-3 text-[var(--color-positive)]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-positive)]">Bull Case</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">Strong data center demand, AI inference leadership, expanding margins…</p>
                </div>
                <div className="rounded bg-[var(--color-negative)]/[0.04] border border-[var(--color-negative)]/15 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="w-3 h-3 text-[var(--color-negative)]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-negative)]">Bear Case</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">Elevated valuation multiples, cyclical semiconductor risk, customer concentration…</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Gold divider */}
      <div className="relative z-10 flex justify-center">
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-20" />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION B — "Your portfolio, actually understood."
          ════════════════════════════════════════════════════════════════════ */}
      <motion.section className="relative z-10 py-28 md:py-36" {...sectionReveal}>
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Visual — dashboard mockup */}
            <div className="order-2 lg:order-1 rounded-xl border border-white/[0.08] bg-[#0C0C0C] overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                </div>
                <span className="ml-2 text-[10px] font-mono text-[var(--color-text-muted)]">helm terminal — dashboard</span>
              </div>
              <div className="p-5 space-y-4">
                {/* Stat cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Net Worth', value: '$1,247,000', color: 'text-[var(--color-gold)]', sub: '+2.4% this month', subColor: 'text-[var(--color-positive)]' },
                    { label: 'Actions', value: '3', color: '', sub: '2 high priority', subColor: 'text-[var(--color-gold)]' },
                    { label: 'Tax Savings', value: '$2,400', color: 'text-[var(--color-positive)]', sub: 'YTD estimated', subColor: 'text-[var(--color-text-muted)]' },
                  ].map((card) => (
                    <div key={card.label} className="bg-white/[0.03] rounded-lg p-3">
                      <div className="text-[9px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-mono mb-1">{card.label}</div>
                      <div className={`font-mono font-bold text-base md:text-lg ${card.color} truncate`}>{card.value}</div>
                      <div className={`text-[10px] font-mono mt-0.5 ${card.subColor}`}>{card.sub}</div>
                    </div>
                  ))}
                </div>
                {/* Chart */}
                <div className="bg-white/[0.02] rounded-lg p-3 h-28 relative overflow-hidden">
                  <div className="text-[8px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-mono mb-2">Net Worth — 12 Months</div>
                  <svg viewBox="0 0 400 70" className="w-full h-full" preserveAspectRatio="none">
                    <path d="M0,60 C30,55 60,50 100,44 C140,38 170,42 200,34 C230,26 260,30 300,20 C330,14 360,10 400,5 L400,70 L0,70 Z" fill="url(#dashGrad)" />
                    <path d="M0,60 C30,55 60,50 100,44 C140,38 170,42 200,34 C230,26 260,30 300,20 C330,14 360,10 400,5" fill="none" stroke="var(--color-gold)" strokeWidth="1.5" />
                    <circle cx="400" cy="5" r="2" fill="var(--color-gold)" />
                    <defs><linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(230,185,77,0.1)" /><stop offset="100%" stopColor="rgba(230,185,77,0)" /></linearGradient></defs>
                  </svg>
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="order-1 lg:order-2 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-gold)]/5 border border-[var(--color-gold)]/15">
                <Shield className="w-3.5 h-3.5 text-[var(--color-gold)]" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-gold)]">Portfolio Intelligence</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.12]">
                Your portfolio,<br />
                <span className="text-[var(--color-text-muted)]">actually understood.</span>
              </h2>
              <p className="text-sm md:text-base text-[var(--color-text-muted)] leading-relaxed max-w-md">
                Connect your brokerage via Plaid. Helm runs 7 intelligence engines across your positions — concentration risk, tax-loss harvesting, earnings exposure, and more.
              </p>
              <div className="space-y-2">
                {['Automated tax-loss detection', 'Real-time earnings alerts', 'Cash flow anomaly detection'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <Zap className="w-3.5 h-3.5 text-[var(--color-gold)] shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <Link href="/signup" className="inline-flex items-center gap-2 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors group font-medium">
                Connect your portfolio
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Gold divider */}
      <div className="relative z-10 flex justify-center">
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-20" />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION C — Security + Trust
          ════════════════════════════════════════════════════════════════════ */}
      <motion.section className="relative z-10 py-28 md:py-36" {...sectionReveal}>
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center space-y-6 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.12]">
              Bank-level security.<br />
              <span className="text-[var(--color-text-muted)]">Zero data selling. Ever.</span>
            </h2>
          </div>
          <div className="max-w-3xl mx-auto">
            <FadeIn delay={150}>
              <TerminalBlock command="$ helm security --verify">
                <div className="space-y-2.5">
                  {securityChecks.map((segs, i) => (<div key={i}><ScrollTypingLine segments={segs} delay={i * 500} speed={18} /></div>))}
                </div>
                <FadeIn delay={2800} direction="none">
                  <div className="mt-4 text-xs text-[var(--color-text-muted)]">All checks passed. System secure. <span className="text-[var(--color-positive)]">●</span></div>
                </FadeIn>
              </TerminalBlock>
            </FadeIn>
          </div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════════════════
          SECTION D — Pricing Teaser
          ════════════════════════════════════════════════════════════════════ */}
      <motion.section className="relative z-10 py-28 border-t border-white/[0.04]" {...sectionReveal}>
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6 mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              No paywall on what matters.
            </h2>
            <p className="text-sm md:text-base text-[var(--color-text-muted)] max-w-lg mx-auto">
              Stock analysis is free, forever. Upgrade for portfolio intelligence, tax optimization, and earnings alerts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { name: 'Free', price: '$0', desc: 'AI stock analysis for any US ticker', highlight: false },
              { name: 'Pro', price: '$14.99/mo', desc: 'Portfolio sync, TLH, earnings intelligence', highlight: true },
              { name: 'Lifetime', price: '$299', desc: 'Everything in Pro. Pay once, own forever.', highlight: false },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-lg p-5 text-center space-y-3 border transition-colors ${
                  plan.highlight
                    ? 'border-[var(--color-gold)]/30 bg-[var(--color-gold)]/[0.03] shadow-[0_0_40px_rgba(230,185,77,0.05)]'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{plan.name}</div>
                <div className={`text-2xl font-bold font-mono ${plan.highlight ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-primary)]'}`}>{plan.price}</div>
                <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">{plan.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link href="/pricing" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              See full pricing comparison →
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════════════════
          FINAL CTA
          ════════════════════════════════════════════════════════════════════ */}
      <motion.section
        className="relative z-10 py-28 md:py-36"
        {...sectionReveal}
        style={{ backgroundImage: 'radial-gradient(ellipse 60% 40% at 50% 60%, rgba(230,185,77,0.04), transparent)' }}
      >
        <div className="max-w-xl mx-auto text-center px-6">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Start analyzing.
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-10 font-mono">
            free. no signup. any US ticker.
          </p>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-3 px-12 py-4 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-sm uppercase tracking-[0.2em] rounded shadow-[0_8px_32px_rgba(230,185,77,0.3)] hover:brightness-110 hover:shadow-[0_8px_48px_rgba(230,185,77,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 ease-out cursor-pointer"
            style={{ animation: 'cta-breathe 4s ease-in-out infinite' }}
          >
            Analyze any stock free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </motion.section>

      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative z-10 border-t border-white/[0.06] py-8">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <HelmMark size={16} />
              <span className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)] font-mono">&copy; {new Date().getFullYear()} Helm Terminal</span>
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
                  <a key={link.href} href={link.href} className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors font-mono">{link.label}</a>
                ) : (
                  <Link key={link.href} href={link.href} className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors font-mono">{link.label}</Link>
                ),
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
