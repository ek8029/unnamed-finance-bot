'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Search, Loader2, Shield, Eye, Zap, PieChart, DollarSign, Calendar, Gift, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { InteractiveGrid, FadeIn, ScrollTypingLine, TerminalBlock } from '@/app/landing-effects';
import type { Segment } from '@/app/landing-effects';
import { HeroAnalysisDemo } from './hero-analysis-demo';
import type { DemoAnalysis } from '@/lib/demo-tickers';

/* ─── Static data ───────────────────────────────────────────────────────── */

const TICKER_CHIPS = ['AAPL', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'MSFT', 'JPM'];

const g = 'text-[var(--color-positive)]';
const a = 'text-[var(--color-gold)]';
const m = 'text-[var(--color-text-muted)]';

const securityChecks: Segment[][] = [
  [{ text: '✓ ', cls: g }, { text: 'read-only access', cls: `${a} font-semibold` }, { text: '       — cannot move money or execute trades', cls: m }],
  [{ text: '✓ ', cls: g }, { text: 'AES-256 encryption', cls: `${a} font-semibold` }, { text: '     — bank-level, in transit + at rest', cls: m }],
  [{ text: '✓ ', cls: g }, { text: 'plaid infrastructure', cls: `${a} font-semibold` }, { text: '    — same provider as Venmo, Robinhood, Coinbase', cls: m }],
  [{ text: '✓ ', cls: g }, { text: 'zero data selling', cls: `${a} font-semibold` }, { text: '      — your data is never sold or shared. ', cls: m }, { text: 'ever.', cls: 'text-[var(--color-text-primary)] font-semibold' }],
  [{ text: '✓ ', cls: g }, { text: 'full data deletion', cls: `${a} font-semibold` }, { text: '     — delete everything, anytime, no questions', cls: m }],
];

const freeFeatures = [
  { icon: BarChart3, title: 'AI Stock Analysis', body: 'Type any US ticker. Get a full breakdown — verdict, bull case, bear case, key metrics, data sources. No signup, no paywall.' },
  { icon: PieChart, title: 'Portfolio Intelligence', body: 'Connect your brokerage via Plaid. See concentration risk, sector allocation, and net worth across every account in one place.' },
  { icon: Zap, title: 'Actions Inbox', body: 'Not more data — prioritized actions. What needs your attention today, ranked by impact.' },
  { icon: Eye, title: 'Transparent Methodology', body: 'Every analysis shows its data sources, model version, and timestamp. Disagree with the AI — that\u2019s the point.' },
];

const proFeatures = [
  { icon: DollarSign, title: 'Tax-Loss Harvesting', body: 'Scan your brokerage for tax-loss harvesting opportunities with wash-sale rule awareness. Typical saving: $500\u2013$3,000/year.' },
  { icon: Calendar, title: 'Earnings Exposure', body: 'Know when 40% of your holdings report earnings in the same week. Trim positions before concentrated volatility.' },
  { icon: Gift, title: 'Wrapped', body: 'Your year in investing, distilled. Annual summary of gains, losses, best and worst picks, tax implications, and concentration changes.' },
];

/* ─── Shared animation ──────────────────────────────────────────────────── */

const sectionReveal = {
  initial: { opacity: 0, y: 24 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  viewport: { once: true, amount: 0.1 as const },
};

/* ─── Hero search ───────────────────────────────────────────────────────── */

function HeroSearch() {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = ticker.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (clean && clean.length <= 5) { setLoading(true); router.push(`/analyze/${clean}`); }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
          <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="Enter any US ticker" maxLength={5} disabled={loading}
            aria-label="Enter a US stock ticker symbol"
            className="w-full pl-10 pr-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)] transition-colors text-sm tracking-wider disabled:opacity-60"
            style={{ fontFamily: 'var(--font-mono)' }} />
        </div>
        <button type="submit" disabled={!ticker.trim() || loading}
          className="px-8 py-3 bg-[var(--color-gold)] hover:brightness-110 hover:shadow-[0_0_32px_-4px_rgba(230,185,77,0.5)] hover:scale-[1.02] active:scale-[0.98] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded shadow-[0_8px_24px_rgba(230,185,77,0.25)] transition-all duration-150 ease-out disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap cursor-pointer">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Analyze'}
        </button>
      </form>
      <div className="flex items-center gap-3 max-w-md">
        <span className="text-[11px] text-[var(--color-text-muted)]">or</span>
        <Link href="/signup" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors group font-medium">
          Create free account
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function HomeContent({ demoAnalyses }: { demoAnalyses: DemoAnalysis[] }) {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  // On mobile, hero content extends below fold — don't fade it on scroll.
  // On desktop (lg+), fade out as user scrolls past the hero.
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const heroOpacity = useTransform(scrollY, [0, isMobile ? 2000 : 600], [1, isMobile ? 1 : 0]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] overflow-x-hidden"
      style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(230,185,77,0.03), transparent)' }}>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sonar { 0% { transform: translate(-50%,-50%) scale(0.3); opacity:0.15; } 100% { transform: translate(-50%,-50%) scale(2.5); opacity:0; } }
        @keyframes glow-breathe { 0%,100% { text-shadow: 0 0 40px rgba(230,185,77,0.3), 0 0 80px rgba(230,185,77,0.1); } 50% { text-shadow: 0 0 60px rgba(230,185,77,0.5), 0 0 120px rgba(230,185,77,0.2); } }
        @keyframes rotate-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .glow-breathe { animation: glow-breathe 3s ease-in-out infinite; }
        @keyframes cta-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.015); } }
      ` }} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Helm Terminal',
        description: 'AI-powered, institutional-grade financial analysis with portfolio intelligence. Helm Terminal is your personal command center for modern investors. Free to start.',
        url: 'https://helmterminal.dev', applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }) }} />

      {/* ── Ambient ── */}
      <InteractiveGrid />
      <div className="absolute top-[20%] left-[10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] rounded-full pointer-events-none z-0 opacity-[0.03] blur-[120px] bg-[var(--color-gold)] will-change-transform" />
      <div className="absolute bottom-[15%] right-[10%] w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] rounded-full pointer-events-none z-0 opacity-[0.02] blur-[100px] bg-[var(--color-positive)] will-change-transform" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="hidden sm:block absolute left-1/2 top-1/2 w-[300px] h-[300px] rounded-full border border-[var(--color-gold)] opacity-0 pointer-events-none z-[1]" style={{ animation: `sonar 5s ${i * 1.6}s ease-out infinite` }} />
      ))}

      {/* ═══ NAV — Sign in + Sign up for logged-out ═══ */}
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
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-xs uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="px-5 py-2 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_30px_rgba(230,185,77,0.35)]">
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      <main className="overflow-x-hidden">

      {/* ════════════════════════════════════════════════════════════════════════
          HERO — dual positioning: terminal + free
          ════════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-24 pb-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#0A0A0A_80%)] z-[1]" />
        <div className="hidden sm:block absolute top-[40%] left-[30%] w-[800px] h-[600px] bg-[radial-gradient(ellipse,rgba(230,185,77,0.06),transparent_60%)] z-[1]" />

        <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none z-[1] overflow-hidden opacity-50">
          <div className="w-[1200px] h-[1200px] will-change-transform" style={{ animation: 'rotate-slow 120s linear infinite' }}>
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <div key={angle} className="absolute top-1/2 left-1/2 w-[600px] h-[1px] origin-left" style={{ transform: `rotate(${angle}deg)`, background: 'linear-gradient(to right, rgba(230,185,77,0.04), transparent)' }} />
            ))}
          </div>
        </div>

        <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none select-none z-[1] overflow-hidden" aria-hidden="true">
          <div className="opacity-[0.025] will-change-transform" style={{ animation: 'rotate-slow 180s linear infinite reverse' }}>
            <HelmMark size={1200} variant="mono" className="text-[var(--color-gold)] sm:w-[500px] sm:h-[500px] md:w-[800px] md:h-[800px] lg:w-[1200px] lg:h-[1200px]" />
          </div>
        </div>

        {/* Hero content */}
        <motion.div className="relative z-[2] w-full max-w-7xl mx-auto px-6" style={{ opacity: heroOpacity }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* LEFT */}
            <div className="space-y-6">
              <FadeIn delay={200}>
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[var(--color-gold)]">
                  The investment terminal for self-directed investors
                </div>
              </FadeIn>

              <FadeIn delay={400}>
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem] xl:text-[4rem] font-bold tracking-tight leading-[1.1]">
                  See your portfolio{' '}
                  <br className="hidden sm:block" />
                  the way{' '}
                  <span className="whitespace-nowrap bg-gradient-to-r from-[var(--color-gold)] to-[#E8C478] bg-clip-text text-transparent">hedge funds</span>
                  {' '}<br className="hidden sm:block" />
                  see theirs.
                </h1>
              </FadeIn>

              <FadeIn delay={550}>
                <div className="space-y-2 max-w-lg">
                  <p className="text-sm md:text-[15px] text-[var(--color-text-muted)] leading-relaxed">
                    AI stock analysis, tax-loss harvesting, earnings exposure, portfolio intelligence — the tools Wall Street pays <span className="font-mono text-[var(--color-text-secondary)]">$24,000</span> a year for, built for retail investors.
                  </p>
                  <p className="text-sm md:text-[15px] font-semibold text-[var(--color-text-primary)]">
                    Most of it is free.
                  </p>
                </div>
              </FadeIn>

              {/* Value props row */}
              <FadeIn delay={650}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-gold)] mb-0.5">Free</div>
                    <div className="text-[12px] text-[var(--color-text-muted)] leading-snug">Full terminal, any US ticker, no signup</div>
                  </div>
                  <div className="rounded border border-[var(--color-gold)]/20 bg-[var(--color-gold)]/[0.03] px-3 py-2.5">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-gold)] mb-0.5">$14.99/mo</div>
                    <div className="text-[12px] text-[var(--color-text-muted)] leading-snug">Tax-loss harvesting, earnings exposure, wrapped</div>
                  </div>
                  <div className="rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-primary)] mb-0.5">Zero black boxes</div>
                    <div className="text-[12px] text-[var(--color-text-muted)] leading-snug">Every analysis shows its sources and methodology</div>
                  </div>
                </div>
              </FadeIn>

              {/* Tagline — demoted, single color */}
              <FadeIn delay={700}>
                <div className="text-sm uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
                  Steer. Don&apos;t drift. Take the Helm.
                </div>
              </FadeIn>

              {/* Search + signup CTA */}
              <FadeIn delay={800}>
                <HeroSearch />
              </FadeIn>

              {/* Ticker chips */}
              <FadeIn delay={900}>
                <motion.div className="flex flex-wrap gap-2"
                  initial="hidden" animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } } }}>
                  {TICKER_CHIPS.map((t) => (
                    <motion.div key={t}
                      variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                      <Link href={`/analyze/${t}`}
                        className="block px-3 py-2.5 text-[11px] font-mono font-bold tracking-wider bg-white/[0.03] border border-white/[0.06] rounded hover:border-[var(--color-gold)]/40 hover:text-[var(--color-gold)] hover:shadow-[0_0_16px_rgba(230,185,77,0.1)] hover:scale-[1.03] transition-all duration-150 text-[var(--color-text-muted)] cursor-pointer">
                        {t}
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              </FadeIn>
            </div>

            {/* RIGHT — showcase */}
            <FadeIn delay={600} direction="none">
              <div className="lg:pl-4">
                <HeroAnalysisDemo analyses={demoAnalyses} />
              </div>
            </FadeIn>
          </div>
        </motion.div>

        <motion.div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[2]"
          initial={{ opacity: 0 }} animate={{ opacity: 1, y: [0, 6, 0] }}
          transition={{ opacity: { delay: 2, duration: 0.5 }, y: { delay: 2, duration: 2.5, repeat: Infinity, ease: 'easeInOut' } }}>
          <svg width="14" height="42" viewBox="0 0 14 42" fill="none">
            <line x1="7" y1="0" x2="7" y2="34" stroke="rgba(230,185,77,0.3)" strokeWidth="1" />
            <path d="M2 30 L7 38 L12 30" stroke="rgba(230,185,77,0.4)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SOCIAL PROOF STRIP
          ════════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-y border-white/[0.06] bg-[rgba(10,10,10,0.6)] backdrop-blur-sm">
        <div className="container mx-auto px-6 py-5">
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 text-[11px] font-mono uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
            <span><span className="text-[var(--color-text-primary)] font-bold">510+</span> stocks analyzed</span>
            <span className="hidden sm:inline text-white/10">|</span>
            <span>AI-powered verdicts with <span className="text-[var(--color-gold)]">full source transparency</span></span>
            <span className="hidden sm:inline text-white/10">|</span>
            <span><span className="text-[var(--color-text-primary)] font-bold">7</span> intelligence engines monitoring your portfolio</span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 1 — "The full terminal. Free." (FREE features)
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.section className="relative z-10 py-16 sm:py-24 md:py-36" {...sectionReveal}>
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center space-y-3 mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.12]">
                The full terminal. <span className="text-[var(--color-gold)]">Free.</span>
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] max-w-lg mx-auto">
                Everything you need to manage a self-directed portfolio, no subscription required.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {freeFeatures.map((feat, i) => (
                <motion.div key={feat.title}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-6 hover:border-[var(--color-gold)]/20 hover:bg-[var(--color-gold)]/[0.02] transition-colors"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  viewport={{ once: true }}>
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-lg bg-[var(--color-gold)]/5 border border-[var(--color-gold)]/15 flex items-center justify-center shrink-0">
                      <feat.icon className="w-4 h-4 text-[var(--color-gold)]" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{feat.title}</div>
                      <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">{feat.body}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Divider */}
      <div className="relative z-10 flex justify-center">
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-20" />
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 2 — "Upgrade when you're ready." (PRO features)
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.section className="relative z-10 py-16 sm:py-24 md:py-36" {...sectionReveal}>
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center space-y-3 mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.12]">
                Upgrade when you&apos;re ready.
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] max-w-lg mx-auto">
                Pro unlocks three advanced features for investors who want more. <span className="font-mono text-[var(--color-text-secondary)]">$14.99/mo</span> or <span className="font-mono text-[var(--color-text-secondary)]">$119/yr</span>.
                <br />
                <Link href="/tools/tlh-calculator" className="text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors">Estimate your TLH savings →</Link>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {proFeatures.map((feat, i) => (
                <motion.div key={feat.title}
                  className="relative rounded-lg border border-[var(--color-gold)]/15 bg-[var(--color-gold)]/[0.02] p-6 hover:border-[var(--color-gold)]/30 hover:shadow-[0_0_30px_rgba(230,185,77,0.04)] transition-all"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  viewport={{ once: true }}>
                  {/* PRO tag */}
                  <div className="absolute top-3 right-3 text-[8px] font-mono font-bold uppercase tracking-wider text-[var(--color-gold)] bg-[var(--color-gold)]/10 px-1.5 py-0.5 rounded">PRO</div>
                  <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-lg bg-[var(--color-gold)]/5 border border-[var(--color-gold)]/15 flex items-center justify-center mb-3">
                    <feat.icon className="w-4 h-4 text-[var(--color-gold)]" aria-hidden="true" />
                  </div>
                  <div className="text-sm font-bold text-[var(--color-text-primary)] mb-1.5">{feat.title}</div>
                  <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">{feat.body}</p>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link href="/pricing"
                className="inline-flex items-center gap-2 px-8 py-3 border border-[var(--color-gold)]/30 text-[var(--color-gold)] font-bold text-xs uppercase tracking-[0.15em] rounded hover:bg-[var(--color-gold)]/5 hover:border-[var(--color-gold)]/50 transition-all duration-150 cursor-pointer">
                See Pro features <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Divider */}
      <div className="relative z-10 flex justify-center">
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-20" />
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 3 — "See the reasoning." (Transparency / methodology)
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.section className="relative z-10 py-16 sm:py-24 md:py-36" {...sectionReveal}>
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.12]">
                See the reasoning,<br />
                <span className="text-[var(--color-text-muted)]">not just the score.</span>
              </h2>
              <p className="text-sm md:text-base text-[var(--color-text-muted)] leading-relaxed max-w-md">
                Every Helm analysis shows its data sources, model version, and timestamp. No black boxes. No &ldquo;7/10&rdquo; ratings with no explanation. You can disagree with the AI — that&rsquo;s the point.
              </p>
              <Link href="/analyze/NVDA" className="inline-flex items-center gap-2 text-sm text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors group font-medium">
                See an example analysis <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0C0C0C] overflow-hidden shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Methodology</div>
                <div className="space-y-2">
                  {['Finnhub real-time market data', 'GPT-4o-mini analysis engine', 'Refreshed every 15 min during market hours', '5-point sentiment scoring'].map((item, i) => (
                    <motion.div key={item} className="flex items-center gap-2"
                      initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.4 }} viewport={{ once: true }}>
                      <span className="w-1 h-1 rounded-full bg-[var(--color-gold)]" />
                      <span className="text-[13px] text-[var(--color-text-secondary)]">{item}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded bg-[var(--color-positive)]/[0.04] border border-[var(--color-positive)]/15 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="w-3 h-3 text-[var(--color-positive)]" aria-hidden="true" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-positive)]">Bull Case</span>
                  </div>
                  <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">Strong data center demand, AI inference leadership, expanding margins…</p>
                </div>
                <div className="rounded bg-[var(--color-negative)]/[0.04] border border-[var(--color-negative)]/15 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingDown className="w-3 h-3 text-[var(--color-negative)]" aria-hidden="true" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-negative)]">Bear Case</span>
                  </div>
                  <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed">Elevated valuation multiples, cyclical semiconductor risk, customer concentration…</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Divider */}
      <div className="relative z-10 flex justify-center">
        <div className="w-32 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-20" />
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 4 — Security
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.section className="relative z-10 py-16 sm:py-24 md:py-36" {...sectionReveal}>
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
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

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 5 — Pricing teaser
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.section className="relative z-10 py-16 sm:py-24 md:py-28 border-t border-white/[0.04]" {...sectionReveal}>
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center space-y-3 mb-14">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Most of Helm is free.
            </h2>
            <p className="text-sm md:text-base text-[var(--color-text-muted)] max-w-lg mx-auto">
              The terminal is free. The advanced tools cost <span className="font-mono">$14.99/mo</span>.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { name: 'Free', price: '$0', desc: 'AI stock analysis, portfolio intelligence, brokerage sync, actions inbox, net worth tracking.', highlight: false, cta: 'Start free', href: '/analyze' },
              { name: 'Pro', price: '$14.99/mo', desc: 'Tax-loss harvesting, earnings exposure tracking, wrapped annual summary.', highlight: true, cta: 'Upgrade to Pro', href: '/pricing' },
              { name: 'Lifetime', price: '$249', desc: 'Everything in Pro. Pay once, own forever. Limited to 200 seats.', highlight: false, cta: 'Claim lifetime', href: '/pricing' },
            ].map((plan) => (
              <div key={plan.name} className={`rounded-lg p-5 text-center space-y-3 border transition-colors ${plan.highlight ? 'border-[var(--color-gold)]/30 bg-[var(--color-gold)]/[0.03] shadow-[0_0_40px_rgba(230,185,77,0.05)]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{plan.name}</div>
                <div className={`text-2xl font-bold font-mono ${plan.highlight ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-primary)]'}`}>{plan.price}</div>
                <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">{plan.desc}</p>
                <Link href={plan.href} className={`inline-block text-[11px] font-bold uppercase tracking-wider px-4 py-1.5 rounded transition-colors ${plan.highlight ? 'bg-[var(--color-gold)] text-[var(--color-bg-base)] hover:brightness-110' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-white/[0.06] hover:border-white/[0.12]'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">See full pricing comparison →</Link>
          </div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════════════════════
          SECTION 6 — Final CTA
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.section className="relative z-10 py-16 sm:py-24 md:py-36" {...sectionReveal}
        style={{ backgroundImage: 'radial-gradient(ellipse 60% 40% at 50% 60%, rgba(230,185,77,0.04), transparent)' }}>
        <div className="max-w-xl mx-auto text-center px-6">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Stop drifting. <span className="text-[var(--color-gold)]">Start steering.</span>
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-10">
            Connect your brokerage when you&apos;re ready to unlock the full terminal.
          </p>
          <Link href="/analyze"
            className="inline-flex items-center gap-3 px-8 sm:px-12 py-3 sm:py-4 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-sm uppercase tracking-[0.2em] rounded shadow-[0_8px_32px_rgba(230,185,77,0.3)] hover:brightness-110 hover:shadow-[0_8px_48px_rgba(230,185,77,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 ease-out cursor-pointer"
            style={{ animation: 'cta-breathe 4s ease-in-out infinite' }}>
            Analyze your first stock free <ArrowRight className="w-4 h-4" />
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
