'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Search, Loader2, Check, ChevronDown } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { InteractiveGrid, FadeIn } from '@/app/landing-effects';
import { HeroAnalysisDemo } from './hero-analysis-demo';
import type { DemoAnalysis } from '@/lib/demo-tickers';
import type { TickerTapeItem } from '@/lib/ticker-tape';

/* ─── Static data ───────────────────────────────────────────────────────── */

const TICKER_CHIPS = ['AAPL', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'MSFT'];

const NAV_LINKS = [
  { label: 'Analyze', href: '/analyze' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Tools', href: '#', children: [
    { label: 'Stock Analyzer', href: '/analyze', desc: 'AI-powered stock analysis' },
    { label: 'Stock Comparison', href: '/compare', desc: 'Side-by-side ticker comparison' },
    { label: 'TLH Calculator', href: '/tools/tlh-calculator', desc: 'Tax-loss harvesting estimator' },
    { label: 'RSU Calculator', href: '/tools/rsu-calculator', desc: 'RSU vesting & tax estimator' },
  ]},
  { label: 'About', href: '#', children: [
    { label: 'About Helm', href: '/about', desc: 'Our story and philosophy' },
    { label: 'Blog', href: '/blog', desc: 'Guides and investment insights' },
    { label: 'Security', href: '/security', desc: 'How we protect your data' },
  ]},
];

const TERMINAL_FEATURES = [
  {
    num: '01',
    title: 'Connected portfolio',
    desc: 'Link every brokerage and bank via Plaid. Positions, balances, and transactions sync automatically.',
  },
  {
    num: '02',
    title: 'AI analysis, any US ticker',
    desc: 'Institutional-grade analysis on any NYSE or NASDAQ stock. Valuation, technicals, sentiment, risk -- one command.',
  },
  {
    num: '03',
    title: 'Daily brief',
    desc: 'A morning briefing that tells you what changed overnight: earnings exposure, dividend dates, allocation drift.',
  },
  {
    num: '04',
    title: 'Actions inbox',
    desc: 'Tax-loss harvesting opportunities, rebalancing signals, and concentration warnings surfaced automatically.',
  },
  {
    num: '05',
    title: 'Net worth across accounts',
    desc: 'Aggregate view across every account. Positions, cash, credit -- one number, one dashboard.',
  },
];

const FREE_FEATURES = [
  'Link up to 3 accounts',
  'AI analysis, 5 per day',
  'Daily brief',
  'Actions inbox',
  'Net worth dashboard',
  'Portfolio allocation view',
];

const PRO_FEATURES = [
  'Unlimited accounts',
  'Unlimited AI analyses',
  'Priority data refresh',
  'Earnings calendar',
  'Dividend tracker',
  'Tax-loss harvesting engine',
  'Concentration alerts',
  'CSV / PDF export',
];

const LIFETIME_FEATURES = [
  'Everything in Pro',
  'Lifetime access, one payment',
  'Locked-in pricing forever',
  'Early access to new features',
  'Priority support',
];

const FOOTER_PRODUCT = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'AI Analysis', href: '/analyze' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Security', href: '/security' },
  { label: 'Changelog', href: '/blog' },
];

const FOOTER_TOOLS = [
  { label: 'Stock Analyzer', href: '/analyze' },
  { label: 'Stock Comparison', href: '/compare' },
  { label: 'TLH Calculator', href: '/tools/tlh-calculator' },
];

const FOOTER_COMPANY = [
  { label: 'About', href: '/about' },
  { label: 'Twitter / X', href: 'https://x.com/helmterminal' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/helmfintech' },
  { label: 'Blog', href: '/blog' },
  { label: 'helmterminal@gmail.com', href: 'mailto:helmterminal@gmail.com' },
];

const FOOTER_LEGAL = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Disclaimer', href: '/disclaimer' },
];

/* ─── Animation configs ─────────────────────────────────────────────────── */

const sectionReveal = {
  initial: { opacity: 0, y: 48 } as const,
  whileInView: { opacity: 1, y: 0 } as const,
  viewport: { once: true, amount: 0.15 as const },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
};

/* ─── Inline HeroSearch ─────────────────────────────────────────────────── */

function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ticker = query.trim().toUpperCase();
    if (!ticker) return;
    setLoading(true);
    router.push(`/analyze/${ticker}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row md:items-stretch w-full max-w-md gap-2 md:gap-0">
      <div className="relative flex-1">
        <Search className="absolute left-4 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          placeholder="Enter ticker..."
          className="w-full h-12 md:h-11 pl-11 md:pl-10 pr-4 md:pr-3 bg-[var(--color-bg-base)] border border-[var(--color-border-strong)] md:border-[var(--color-border-base)] rounded-xl md:rounded-l-md md:rounded-r-none font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)]/40 transition-colors"
          maxLength={10}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !query.trim()}
        className="h-12 md:h-11 px-5 bg-[var(--color-gold)] text-black font-mono text-[12px] md:text-xs font-bold md:font-semibold tracking-[0.2em] md:tracking-wider uppercase rounded-xl md:rounded-l-none md:rounded-r-md hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 whitespace-nowrap"
        style={{ boxShadow: '0 6px 18px rgba(230,185,77,0.25)' }}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <>
            ANALYZE
            <ArrowRight className="w-3.5 h-3.5" />
          </>
        )}
      </button>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HomeContent
   ═══════════════════════════════════════════════════════════════════════════ */

function InlineSignup() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      router.push('/signup');
      return;
    }
    setSubmitting(true);
    router.push(`/signup?email=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@email.com"
        className="flex-1 px-4 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)] rounded-lg text-[14px] text-[var(--color-text-primary)]placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)]/50 transition-colors min-w-0"
      />
      <button
        type="submit"
        disabled={submitting}
        className="px-5 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-black text-[13px] font-bold rounded-lg transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5"
      >
        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
        Start free
      </button>
    </form>
  );
}

function ToolsDropdown({ items }: { items: { label: string; href: string; desc: string }[] }) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open && focusIdx >= 0) itemRefs.current[focusIdx]?.focus();
  }, [open, focusIdx]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setFocusIdx(-1); return; }
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault(); setOpen(true); setFocusIdx(0); return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx((i) => Math.max(i - 1, 0)); }
  }

  return (
    <div className="relative" ref={ref} onKeyDown={handleKeyDown}>
      <button
        onClick={() => { setOpen(!open); if (!open) setFocusIdx(0); }}
        aria-expanded={open}
        aria-haspopup="true"
        className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1"
      >
        Tools
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" aria-label="Tools" className="absolute top-full left-0 mt-2 w-[240px] bg-[var(--color-bg-base)] border border-[var(--color-border-base)] rounded-lg shadow-2xl py-2 z-50">
          {items.map((item, i) => (
            <Link
              key={item.label}
              href={item.href}
              ref={(el) => { itemRefs.current[i] = el; }}
              role="menuitem"
              tabIndex={focusIdx === i ? 0 : -1}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 hover:bg-[var(--color-bg-elevated)] focus:bg-[var(--color-bg-elevated)] transition-colors outline-none"
            >
              <div className="text-[13px] text-[var(--color-text-secondary)] font-medium">{item.label}</div>
              <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{item.desc}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomeContent({ demoAnalyses, tickerTape = [] }: { demoAnalyses: DemoAnalysis[]; tickerTape?: TickerTapeItem[] }) {
  const router = useRouter();
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 80], [0, 1]);
  const [navOpacity, setNavOpacity] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    return navBg.on('change', (v) => setNavOpacity(v));
  }, [navBg]);

  // Tripled ticker array for seamless CSS loop
  const tickerItems = [...tickerTape, ...tickerTape, ...tickerTape];

  return (
    <>
      {/* ── Ticker tape animation keyframes ── */}
      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
      `}</style>

      <InteractiveGrid />

      {/* ════════════════════════════════════════════════════════════════════
          NAV — Sticky glass
          ════════════════════════════════════════════════════════════════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div
          className="absolute inset-0 border-b border-[var(--color-border-subtle)] transition-opacity duration-300"
          style={{
            opacity: navOpacity,
            backgroundColor: `rgba(10,10,10,${navOpacity * 0.78})`,
            backdropFilter: `blur(20px) saturate(1.4)`,
            WebkitBackdropFilter: `blur(20px) saturate(1.4)`,
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 md:gap-2.5 group">
            <HelmMark size={20} className="md:w-7 md:h-7" />
            <span className="font-bold text-[13px] md:text-sm tracking-[0.12em] text-[var(--color-text-primary)] uppercase group-hover:text-[var(--color-text-primary)] transition-colors">
              HELM
            </span>
          </Link>

          {/* Center: Nav links — hidden on mobile */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              'children' in link && link.children ? (
                <ToolsDropdown key={link.label} items={link.children} />
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {link.label}
                </Link>
              )
            ))}
          </div>

          {/* Right: Auth actions */}
          <div className="flex items-center gap-3 md:gap-4">
            <Link
              href="/signup"
              className="font-mono text-[10px] md:text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Sign up
            </Link>
            <Link
              href="/signup"
              className="h-8 md:h-9 px-3.5 md:px-5 rounded-full bg-[var(--color-gold)] text-black font-mono text-[9px] md:text-[13px] font-bold md:font-semibold flex items-center gap-1 md:gap-1.5 hover:brightness-110 transition-all tracking-wide md:tracking-normal"
            >
              <span className="md:hidden">Open</span>
              <span className="hidden md:inline">Open terminal</span>
              <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden ml-3 p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              {mobileMenuOpen ? (
                <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <>
                  <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="3" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden border-b border-[var(--color-border-subtle)] bg-[#080808]/95 backdrop-blur-xl px-6 pb-4 pt-2"
          >
            {NAV_LINKS.map((link) => (
              'children' in link && link.children ? (
                <div key={link.label}>
                  <span className="block py-2.5 text-sm text-[var(--color-text-muted)] font-medium">{link.label}</span>
                  {link.children.map((child: { label: string; href: string; desc: string }) => (
                    <Link
                      key={child.label}
                      href={child.href}
                      className="block py-2 pl-4 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : (
              <Link
                key={link.label}
                href={link.href}
                className="block py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
              )
            ))}
            <Link
              href="/signup"
              className="block py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign up
            </Link>
          </motion.div>
        )}
      </nav>

      {/* ════════════════════════════════════════════════════════════════════
          TICKER TAPE — directly under nav, hidden on mobile
          ════════════════════════════════════════════════════════════════════ */}
      <div
        className="fixed top-14 md:top-16 left-0 right-0 z-40 bg-[#080808] border-b border-[var(--color-border-subtle)] overflow-hidden"
        style={{ height: '30px' }}
      >
        <div
          className="flex items-center h-full whitespace-nowrap"
          style={{ animation: 'tickerScroll 60s linear infinite', width: 'max-content', willChange: 'transform' }}
        >
          {tickerItems.map((t, i) => (
            <div
              key={`${t.symbol}-${i}`}
              className="flex items-center gap-2 px-5 font-mono"
              style={{ fontSize: '11px' }}
            >
              <span className="text-[var(--color-gold)] font-semibold">{t.symbol}</span>
              <span className="text-[var(--color-text-secondary)]">{t.price}</span>
              <span className={t.positive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}>
                {t.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Spacer: push content below fixed nav + ticker */}
      {/* Spacer: nav height (56px mobile / 64px desktop) + ticker (30px) */}
      <div className="h-[calc(3.5rem+30px)] md:h-[calc(4rem+30px)]" />

      <main className="relative z-10">

        {/* ══════════════════════════════════════════════════════════════════
            HERO SECTION
            ══════════════════════════════════════════════════════════════════ */}
        <section className="relative pt-10 pb-10 md:pt-[120px] md:pb-[100px] overflow-hidden">
          {/* Ambient glow blobs — hidden on mobile for perf */}
          <div
            className="absolute top-20 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[120px] pointer-events-none hidden md:block"
            style={{ background: 'radial-gradient(circle, var(--color-gold), transparent 70%)' }}
          />
          <div
            className="absolute bottom-10 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[100px] pointer-events-none hidden md:block"
            style={{ background: 'radial-gradient(circle, #22c55e, transparent 70%)' }}
          />

          <div className="max-w-7xl mx-auto px-5 md:px-6">
            {/* Eyebrow */}
            <FadeIn delay={0}>
              <div className="flex items-center gap-3 mb-6 md:mb-10">
                <div className="w-6 md:w-8 h-px bg-[var(--color-gold)]" />
                <span className="font-mono text-[9px] md:text-[10px] tracking-[0.2em] text-[var(--color-gold)] uppercase">
                  The Investment Terminal
                </span>
              </div>
            </FadeIn>

            {/* Massive headline */}
            <FadeIn delay={100}>
              <h1 className="text-[48px] md:text-[clamp(48px,10vw,120px)] font-bold leading-[1.04] tracking-[-0.04em] text-[var(--color-text-primary)] mb-8 md:mb-16">
                See your portfolio<br />
                the way{' '}
                <span
                  className="text-[var(--color-gold)] italic"
                  style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}
                >
                  hedge funds
                </span>
                <br />
                see theirs.
              </h1>
            </FadeIn>

            {/* Two-column sub-hero */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-0">
              {/* LEFT: Live label + search + ticker chips */}
              <FadeIn delay={250} className="pr-0 lg:pr-12">
                <div className="flex items-center gap-2 mb-5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] uppercase">
                    Live &middot; Free for anyone
                  </span>
                </div>

                <div className="mb-6">
                  <HeroSearch />
                </div>

                <div className="flex flex-wrap gap-1.5 md:gap-2 mt-4 md:mt-0">
                  {TICKER_CHIPS.map((ticker) => (
                    <button
                      key={ticker}
                      onClick={() => router.push(`/analyze/${ticker}`)}
                      className="px-2.5 md:px-3.5 py-1.5 rounded-full border border-[var(--color-border-base)] text-[var(--color-text-muted)] font-mono text-[10px] md:text-xs hover:border-[var(--color-gold)]/30 hover:text-[var(--color-gold)] transition-all"
                    >
                      {ticker}
                    </button>
                  ))}
                </div>
              </FadeIn>

              {/* RIGHT: Copy block with left border */}
              <FadeIn delay={400} className="lg:border-l lg:border-[var(--color-border-base)] lg:pl-12">
                <p className="text-[15px] leading-[1.55] text-[var(--color-text-muted)] md:text-[var(--color-text-secondary)] mb-4 max-w-[340px] md:max-w-none">
                  AI stock analysis, tax-loss harvesting, earnings exposure, portfolio
                  intelligence — the tools Wall Street pays $24,000 a year for.
                </p>
                <p className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-6 mt-3.5 md:mt-0">
                  Most of it is free.
                </p>

                {/* Inline signup — email capture without leaving page */}
                <InlineSignup />
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            DEFINITION BLOCK — citable by AI search engines
            ══════════════════════════════════════════════════════════════════ */}
        <section className="py-12 md:py-16 border-t border-[var(--color-border-subtle)]">
          <div className="max-w-3xl mx-auto px-5 md:px-6">
            <p className="text-[14px] md:text-[15px] leading-relaxed text-[var(--color-text-secondary)]" id="what-is-helm">
              <strong className="text-[var(--color-text-primary)]">Helm Terminal</strong> is a free,
              institutional-grade financial intelligence platform for individual investors.
              It aggregates brokerage and bank accounts via Plaid (read-only), runs
              deterministic rule-based analysis over your full portfolio, and surfaces
              actionable insights — tax-loss harvesting opportunities with wash-sale
              detection, concentration risk alerts, earnings exposure, and cash flow
              changes. It covers any US-listed stock or ETF on NYSE, NASDAQ, or AMEX.
              Most features are free. Pro plans start at $14.99/month.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            FAQPage schema — homepage only (removed from layout.tsx)
            ══════════════════════════════════════════════════════════════════ */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                { '@type': 'Question', name: 'What is Helm Terminal?', acceptedAnswer: { '@type': 'Answer', text: 'Helm Terminal is a free, institutional-grade financial intelligence platform for individual investors. It aggregates brokerage and bank accounts via Plaid, runs deterministic rule-based analysis over your portfolio, and surfaces actionable insights like tax-loss harvesting opportunities, concentration risk, earnings exposure, and cash flow changes. It covers any US-listed stock or ETF on NYSE, NASDAQ, or AMEX.' } },
                { '@type': 'Question', name: 'Is Helm Terminal free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Helm Terminal offers a free tier that includes AI stock analysis (5 per day), a full portfolio dashboard with Plaid sync, net worth tracking, cash flow overview, concentration risk analysis, sector allocation, and an actions inbox. Pro plans starting at $14.99/month add tax-loss harvesting with wash-sale detection, earnings exposure tracking, and unlimited analyses.' } },
                { '@type': 'Question', name: 'How does Helm Terminal compare to Bloomberg Terminal?', acceptedAnswer: { '@type': 'Answer', text: 'Bloomberg Terminal costs approximately $24,000 per year and is designed for institutional traders. Helm Terminal provides a subset of similar capabilities — portfolio analysis, real-time market data, AI-powered stock analysis, and risk alerts — for individual investors, starting at $0.' } },
                { '@type': 'Question', name: 'Is Helm Terminal safe to use with my financial accounts?', acceptedAnswer: { '@type': 'Answer', text: 'Helm Terminal connects to your accounts through Plaid, a bank-grade financial data provider used by Venmo, Coinbase, and thousands of other apps. The connection is read-only — Helm can never move money, execute trades, or modify your accounts. All data is encrypted in transit (TLS 1.3) and at rest, with row-level security in the database.' } },
                { '@type': 'Question', name: 'What data sources does Helm Terminal use?', acceptedAnswer: { '@type': 'Answer', text: 'Helm Terminal uses Finnhub for real-time stock quotes, Polygon.io for historical prices, dividends, and splits, and Plaid for account aggregation. AI stock analysis pages use GPT-4o-mini for narrative interpretation of structured financial data, clearly labeled as AI-generated.' } },
              ],
            }),
          }}
        />

        {/* ══════════════════════════════════════════════════════════════════
            FEATURED GUIDES — passes PageRank to blog posts
            ══════════════════════════════════════════════════════════════════ */}
        <section className="py-12 md:py-16 border-t border-[var(--color-border-subtle)]">
          <div className="max-w-7xl mx-auto px-5 md:px-6">
            <div className="flex items-center gap-3 mb-6 md:mb-8">
              <span className="font-mono text-xs text-[var(--color-gold)] tracking-wider">
                &sect; 00
              </span>
              <span className="font-mono text-xs text-[var(--color-text-muted)] tracking-wider">
                — Guides &amp; Tools
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: 'Bloomberg Terminal Alternatives', desc: 'Honest comparison of 7 tools for retail investors', href: '/blog/best-bloomberg-terminal-alternatives' },
                { title: 'Tax-Loss Harvesting Guide', desc: 'Wash-sale rules, ETF swap pairs, worked examples', href: '/blog/tax-loss-harvesting-guide' },
                { title: 'RSU Tax Strategies', desc: 'The withholding gap, vesting schedules, sell-to-cover', href: '/blog/rsu-tax-strategies' },
                { title: 'TLH Calculator', desc: 'Estimate annual tax savings from loss harvesting', href: '/tools/tlh-calculator' },
                { title: 'RSU Vesting Calculator', desc: 'Vesting timeline, tax liability, concentration risk', href: '/tools/rsu-calculator' },
                { title: 'Earnings Concentration Risk', desc: 'When 40% of your portfolio reports in one week', href: '/blog/portfolio-earnings-concentration-risk' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group p-5 border border-[var(--color-border-subtle)] rounded-md hover:border-[var(--color-gold)]/20 transition-colors"
                >
                  <div className="text-[14px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors mb-1">
                    {item.title}
                  </div>
                  <div className="text-[13px] text-[var(--color-text-muted)]">
                    {item.desc}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            INSIDE THE TERMINAL — section 01
            ══════════════════════════════════════════════════════════════════ */}
        <motion.section
          id="product"
          className="py-16 md:py-32 border-t border-[var(--color-border-subtle)]"
          {...sectionReveal}
        >
          <div className="max-w-7xl mx-auto px-5 md:px-6">
            {/* Section eyebrow */}
            <FadeIn>
              <div className="flex items-center gap-3 mb-8 md:mb-16">
                <span className="font-mono text-xs text-[var(--color-gold)] tracking-wider">
                  &sect; 01
                </span>
                <span className="font-mono text-xs text-[var(--color-text-muted)] tracking-wider">
                  — Inside
                </span>
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
              {/* LEFT: Sticky headline + description */}
              <FadeIn className="lg:sticky lg:top-32 lg:self-start">
                <h2 className="text-[28px] md:text-[clamp(32px,4vw,52px)] font-bold leading-[1.1] tracking-tight text-[var(--color-text-primary)] mb-4 md:mb-6">
                  The full terminal.<br />
                  <span className="text-[var(--color-gold)]">Free.</span>
                </h2>
                <p className="text-[14px] md:text-[15px] leading-relaxed text-[var(--color-text-muted)] max-w-md">
                  Everything you need to understand your portfolio, track your net worth,
                  and make better decisions — without paying for a Bloomberg seat.
                </p>
              </FadeIn>

              {/* RIGHT: Numbered feature rows */}
              <div className="space-y-0">
                {TERMINAL_FEATURES.map((feature, idx) => (
                  <FadeIn key={feature.num} delay={idx * 100}>
                    <div className="group py-5 md:py-8 border-t border-[var(--color-border-subtle)] last:border-b cursor-default">
                      <div className="grid grid-cols-[30px_1fr_16px] md:flex md:items-start gap-2 md:gap-5">
                        <span className="font-mono text-[10px] md:text-sm text-[var(--color-gold)] mt-1 shrink-0 md:w-6">
                          {feature.num}
                        </span>
                        <div className="flex-1">
                          <h3 className="text-[17px] md:text-[clamp(18px,2vw,24px)] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors mb-1 md:mb-2">
                            {feature.title}
                          </h3>
                          <p className="text-[13px] md:text-sm text-[var(--color-text-muted)] leading-relaxed">
                            {feature.desc}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-gold)] group-hover:translate-x-1 transition-all mt-1 shrink-0" />
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════════════
            PULL QUOTE — section 02
            ══════════════════════════════════════════════════════════════════ */}
        <motion.section
          className="bg-[#080808] border-y border-[var(--color-border-subtle)] py-16 md:py-32"
          {...sectionReveal}
        >
          <div className="max-w-5xl mx-auto px-5 md:px-6">
            <FadeIn>
              <div className="flex items-center gap-3 mb-8 md:mb-16">
                <span className="font-mono text-xs text-[var(--color-gold)] tracking-wider">
                  &sect; 02
                </span>
                <span className="font-mono text-xs text-[var(--color-text-muted)] tracking-wider">
                  — On method
                </span>
              </div>
            </FadeIn>

            <FadeIn delay={150}>
              <blockquote
                className="text-[24px] md:text-[clamp(28px,5vw,56px)] leading-[1.15] tracking-tight mb-6 md:mb-10 italic text-[var(--color-text-primary)]"
                style={{ fontFamily: '"Source Serif Pro", Georgia, serif' }}
              >
                No black boxes. Every analysis shows the model, the sources,
                and the{' '}
                <span className="not-italic font-semibold text-[var(--color-gold)]" style={{ fontFamily: 'inherit' }}>
                  conviction score
                </span>
                . If we can&apos;t show our work, we don&apos;t
                show the answer.
              </blockquote>
            </FadeIn>

            <FadeIn delay={300}>
              <div className="flex items-center gap-3 mt-6 md:mt-0">
                <div className="w-8 h-px bg-white/20" />
                <span className="font-mono text-[10px] md:text-xs text-[var(--color-text-muted)] tracking-[0.14em] md:tracking-wider uppercase">
                  Helm design principle
                </span>
              </div>
            </FadeIn>
          </div>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════════════
            BUILT FOR — ICP segment selector
            ══════════════════════════════════════════════════════════════════ */}
        <motion.section
          className="py-16 md:py-24 border-b border-[var(--color-border-subtle)]"
          {...sectionReveal}
        >
          <div className="max-w-7xl mx-auto px-5 md:px-6">
            <FadeIn>
              <div className="text-center mb-16">
                <span className="font-mono text-xs text-[var(--color-text-muted)] tracking-wider">— Built for</span>
                <h2 className="text-[clamp(28px,3.5vw,44px)] font-bold leading-[1.1] tracking-tight text-[var(--color-text-primary)]mt-4">
                  One platform. Every type of investor.
                </h2>
              </div>
            </FadeIn>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Engineers', desc: 'RSU vesting, concentrated positions, multi-account chaos.', href: '/for/engineers', icon: '⌘' },
                { title: 'Founders', desc: 'Equity events, angel checks, zero time to manage it all.', href: '/for/founders', icon: '◆' },
                { title: 'Self-Directed', desc: '5 tools stitched together. One terminal to replace them.', href: '/for/investors', icon: '◈' },
                { title: 'High Net Worth', desc: 'Your advisor charges 1% AUM. Helm charges $14.99/mo.', href: '/for/high-net-worth', icon: '◉' },
              ].map((segment, i) => (
                <FadeIn key={segment.title} delay={i * 80}>
                  <Link
                    href={segment.href}
                    className="block p-6 rounded-lg border border-[var(--color-border-subtle)] bg-white/[0.02] hover:border-[var(--color-gold)]/30 hover:bg-[var(--color-gold)]/[0.03] transition-all group"
                  >
                    <span className="text-2xl mb-3 block">{segment.icon}</span>
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)]group-hover:text-[var(--color-gold)] transition-colors mb-2">{segment.title}</h3>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{segment.desc}</p>
                    <span className="inline-block mt-4 text-xs font-mono text-[var(--color-gold)] tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">Learn more →</span>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════════════
            PRICING — section 03
            ══════════════════════════════════════════════════════════════════ */}
        <motion.section
          id="pricing"
          className="py-16 md:py-32 border-b border-[var(--color-border-subtle)]"
          {...sectionReveal}
        >
          <div className="max-w-7xl mx-auto px-5 md:px-6">
            {/* Eyebrow */}
            <FadeIn>
              <div className="flex items-center gap-3 mb-8 md:mb-16">
                <span className="font-mono text-xs text-[var(--color-gold)] tracking-wider">
                  &sect; 03
                </span>
                <span className="font-mono text-xs text-[var(--color-text-muted)] tracking-wider">
                  — Pricing
                </span>
              </div>
            </FadeIn>

            {/* Header row: headline left, lifetime bar right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-16">
              <FadeIn>
                <h2 className="text-[clamp(32px,4vw,52px)] font-bold leading-[1.1] tracking-tight text-white">
                  Three tiers.<br />
                  No upsell mazes.
                </h2>
              </FadeIn>

              <FadeIn delay={100} className="flex items-end">
                <div className="w-full max-w-sm lg:ml-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] md:text-xs text-[var(--color-text-muted)]">Lifetime seats</span>
                    <span className="font-mono text-[10px] md:text-xs text-[var(--color-gold)]">147 / 200 claimed</span>
                  </div>
                  <div className="h-1 md:h-1.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--color-gold)] rounded-full transition-all"
                      style={{ width: '73.5%' }}
                    />
                  </div>
                </div>
              </FadeIn>
            </div>

            {/* Pricing cards — 1-col mobile, 2-col sm, 4-col lg */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="list" aria-label="Pricing plans">

              {/* ── Free ── */}
              <FadeIn delay={0}>
                <div role="listitem" aria-label="Free plan" className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-[14px] md:rounded-md p-5 md:p-7 flex flex-col h-full">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Free</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl md:text-3xl font-bold text-white">$0</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Forever. No card required.</p>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {FREE_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-[var(--color-gold)] mt-0.5 shrink-0" />
                        <span className="text-[12px] md:text-sm text-[var(--color-text-muted)]">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="w-full h-10 border border-[var(--color-border-strong)] rounded-md text-sm text-white/70 hover:text-[var(--color-text-primary)] hover:border-white/20 transition-all flex items-center justify-center"
                  >
                    Start free
                  </Link>
                </div>
              </FadeIn>

              {/* ── Pro Monthly ── */}
              <FadeIn delay={80}>
                <div role="listitem" aria-label="Pro Monthly plan" className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-[14px] md:rounded-md p-5 md:p-7 flex flex-col h-full">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Pro Monthly</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl md:text-3xl font-bold text-white">$14.99</span>
                      <span className="text-sm text-[var(--color-text-muted)]">/mo</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Cancel anytime.</p>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {PRO_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-[var(--color-gold)] mt-0.5 shrink-0" />
                        <span className="text-[12px] md:text-sm text-[var(--color-text-muted)]">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="w-full h-10 border border-[var(--color-border-strong)] rounded-md text-sm text-white/70 hover:text-[var(--color-text-primary)] hover:border-white/20 transition-all flex items-center justify-center"
                  >
                    Start monthly
                  </Link>
                </div>
              </FadeIn>

              {/* ── Pro Annual — FEATURED ── */}
              <FadeIn delay={160}>
                <div
                  role="listitem"
                  aria-label="Pro Annual plan — best value"
                  className="border rounded-[14px] md:rounded-md p-5 md:p-7 flex flex-col h-full relative"
                  style={{
                    borderColor: 'rgba(230,185,77,0.35)',
                    background: 'linear-gradient(180deg, rgba(230,185,77,0.06) 0%, var(--color-bg-surface) 40%)',
                  }}
                >
                  {/* Best value badge */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-[var(--color-gold)] text-black font-mono text-[10px] font-bold tracking-wider rounded-full uppercase whitespace-nowrap">
                      Best Value
                    </span>
                  </div>
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Pro Annual</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl md:text-3xl font-bold text-white">$119</span>
                      <span className="text-sm text-[var(--color-text-muted)]">/yr</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      $9.92/mo &middot; Save 34%
                    </p>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {PRO_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-[var(--color-gold)] mt-0.5 shrink-0" />
                        <span className="text-[12px] md:text-sm text-[var(--color-text-muted)]">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="w-full h-10 bg-[var(--color-gold)] rounded-md text-sm text-black font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-1.5"
                    style={{ boxShadow: '0 6px 18px rgba(230,185,77,0.25)' }}
                  >
                    Go Pro
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </FadeIn>

              {/* ── Lifetime ── */}
              <FadeIn delay={240}>
                <div role="listitem" aria-label="Lifetime plan" className="bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-[14px] md:rounded-md p-5 md:p-7 flex flex-col h-full">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Lifetime</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl md:text-3xl font-bold text-white">$249</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">One-time. 53 seats left.</p>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {LIFETIME_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check className="w-3.5 h-3.5 text-[var(--color-gold)] mt-0.5 shrink-0" />
                        <span className="text-[12px] md:text-sm text-[var(--color-text-muted)]">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="w-full h-10 border border-[var(--color-border-strong)] rounded-md text-sm text-white/70 hover:text-[var(--color-text-primary)] hover:border-white/20 transition-all flex items-center justify-center"
                  >
                    Claim a seat
                  </Link>
                </div>
              </FadeIn>
            </div>
          </div>
        </motion.section>

        {/* ══════════════════════════════════════════════════════════════════
            FOOTER
            ══════════════════════════════════════════════════════════════════ */}
        <footer className="bg-[#080808] border-t border-[var(--color-border-subtle)] pt-12 md:pt-20 pb-6 md:pb-8">
          <div className="max-w-7xl mx-auto px-5 md:px-6">
            {/* 5-column footer grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 md:gap-10 mb-10 md:mb-16">
              {/* Brand column */}
              <div className="col-span-2 sm:col-span-3 lg:col-span-1">
                <Link href="/" className="flex items-center gap-2 md:gap-2.5 mb-3 md:mb-4">
                  <HelmMark size={20} className="md:w-6 md:h-6" />
                  <span className="font-semibold text-sm tracking-[0.12em] text-[var(--color-text-primary)]">
                    HELM
                  </span>
                </Link>
                <p className="text-[12px] md:text-xs text-[var(--color-text-muted)] leading-relaxed mb-3 md:mb-4 max-w-[200px]">
                  Steer. Don&apos;t drift. Take the Helm.
                </p>
                <p className="font-mono text-[9px] md:text-[10px] leading-relaxed max-w-[220px]" style={{ color: '#5a5a5a' }}>
                  Helm is not a financial advisor. All data is provided for informational
                  purposes only.
                </p>
              </div>

              {/* Product */}
              <div>
                <h4 className="font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-4">
                  Product
                </h4>
                <ul className="space-y-2.5">
                  {FOOTER_PRODUCT.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]/70 transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tools */}
              <div>
                <h4 className="font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-4">
                  Tools
                </h4>
                <ul className="space-y-2.5">
                  {FOOTER_TOOLS.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]/70 transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-4">
                  Company
                </h4>
                <ul className="space-y-2.5">
                  {FOOTER_COMPANY.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]/70 transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="font-mono text-[11px] tracking-wider text-[var(--color-text-muted)] uppercase mb-4">
                  Legal
                </h4>
                <ul className="space-y-2.5">
                  {FOOTER_LEGAL.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]/70 transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-[var(--color-border-subtle)] pt-5 md:pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4">
              <p className="font-mono text-[9px] md:text-[11px] text-[var(--color-text-muted)]">
                &copy; {new Date().getFullYear()} Helm
              </p>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="font-mono text-[9px] md:text-[11px] text-[var(--color-text-muted)]">
                  99.98% uptime
                </span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
