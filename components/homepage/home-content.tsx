'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, Shield, Lock, Activity } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import type { DemoAnalysis } from '@/lib/demo-tickers';
import type { TickerTapeItem } from '@/lib/ticker-tape';

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface HomeContentProps {
  demoAnalyses: DemoAnalysis[];
  tickerTape: TickerTapeItem[];
}

/* ─── Nav links ─────────────────────────────────────────────────────────── */

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

/* ─── Pricing tiers ─────────────────────────────────────────────────────── */

const PRICING_TIERS = [
  {
    name: 'Free',
    price: '$0',
    sub: 'Forever, no card',
    features: ['Full terminal access', 'AI analysis, any US ticker', 'Connected brokerages', 'Daily brief', 'Actions inbox'],
    cta: 'Start free',
    featured: false,
  },
  {
    name: 'Founding Member',
    price: '$4.99',
    priceSuffix: '/mo',
    sub: 'Locked forever, 50 spots',
    features: ['Everything in Free', 'Tax-loss harvesting', 'Earnings exposure', 'Annual Wrapped', 'Founding badge'],
    cta: 'Claim founding rate',
    featured: true,
    chip: 'Limited',
  },
  {
    name: 'Pro Monthly',
    price: '$14.99',
    priceSuffix: '/mo',
    sub: 'Cancel anytime',
    features: ['Everything in Free', 'Tax-loss harvesting', 'Earnings exposure', 'Annual Wrapped', 'Priority queue'],
    cta: 'Start monthly',
    featured: false,
  },
  {
    name: 'Pro Annual',
    price: '$119',
    priceSuffix: '/yr',
    sub: '$9.92/mo, save 34%',
    features: ['Everything in Monthly', '2 months free', 'Locked annual rate', 'Early beta access', 'Priority support'],
    cta: 'Go Pro',
    featured: false,
  },
  {
    name: 'Lifetime',
    price: '$249',
    sub: 'One-time, never billed again',
    features: ['All Pro, forever', 'Founding-member badge', 'Direct line to the team', 'Early access to tools', 'Never billed again'],
    cta: 'Claim a seat',
    featured: false,
  },
];

/* ─── Feature showcases ─────────────────────────────────────────────────── */

const SHOWCASES = [
  {
    kicker: 'Portfolio · True exposure',
    title: 'See what you actually own, through every ETF.',
    titleEm: null as string | null,
    titleEnd: '',
    desc: "Your brokerage shows tickers. Helm shows real exposure: it looks through SPY and VTI so you know you're 7% AAPL even when you never bought a share directly.",
    list: ['Direct + indirect exposure for every position', 'Harvestable losses surfaced automatically', '71 positions across 8 sectors, reconciled nightly'],
    img: '/product/portfolio.png',
    url: 'helmterminal.dev/portfolio',
    alt: 'Portfolio true exposure view',
    reverse: false,
  },
  {
    kicker: 'Daily Brief · The Current',
    title: 'A morning brief written about ',
    titleEm: 'your' as string | null,
    titleEnd: ' portfolio.',
    desc: "Not a generic newsfeed. Every morning Helm explains what moved your positions overnight, what's trailing the market, and what to watch, in plain English with the numbers attached.",
    list: ['Personalized to your exact holdings', 'Market movers, sector heat, catalysts ahead', 'AI digest with sources, labeled and never hidden'],
    img: '/product/brief.png',
    url: 'helmterminal.dev/brief',
    alt: 'Daily Brief intelligence digest',
    reverse: true,
  },
  {
    kicker: 'Actions · Ranked by dollar impact',
    title: "An inbox of decisions, sorted by what they're worth.",
    titleEm: null as string | null,
    titleEnd: '',
    desc: 'Idle cash, concentration risk, tax-loss opportunities, wash-sale warnings, each with the dollar figure attached and the reasoning shown. Triage your money like email.',
    list: ['$960 in tax savings, surfaced before you\'d notice', 'Wash-sale risk flagged with IRC citations', 'High / medium / low, never a wall of noise'],
    img: '/product/actions.png',
    url: 'helmterminal.dev/actions',
    alt: 'Actions inbox ranked by dollar impact',
    reverse: false,
  },
];

/* ─── Utility: count-up animation ───────────────────────────────────────── */

function useCountUp(target: number, inView: boolean, duration = 1300) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!inView) return;
    const t0 = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * e));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [inView, target, duration]);

  return value;
}

/* ─── Utility: intersection observer reveal ─────────────────────────────── */

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.unobserve(el); } },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/* ─── Dropdown component ────────────────────────────────────────────────── */

function NavDropdown({ label, items }: { label: string; items: { label: string; href: string; desc: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.14em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-[240px] bg-[var(--color-bg-base)] border border-[var(--color-border-base)] rounded-lg shadow-2xl py-2 z-50">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 hover:bg-[var(--color-bg-surface)] transition-colors"
            >
              <div className="text-[13px] text-[var(--color-text-primary)]">{item.label}</div>
              <div className="text-[11px] text-[var(--color-text-muted)]">{item.desc}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Browser frame component ───────────────────────────────────────────── */

function BrowserFrame({ src, url, alt, className = '' }: { src: string; url: string; alt: string; className?: string }) {
  return (
    <div className={`${className}`}>
      {/* MacBook bezel */}
      <div className="bg-[#1a1a1a] rounded-t-[12px] border border-b-0 border-[#333] pt-[6px] px-[6px]">
        {/* Notch */}
        <div className="flex justify-center mb-[6px]">
          <div className="w-[120px] max-sm:w-[80px] h-[18px] max-sm:h-[14px] bg-[#0e0e0e] rounded-b-[10px] max-sm:rounded-b-[8px] flex items-center justify-center">
            <div className="w-[6px] h-[6px] max-sm:w-[4px] max-sm:h-[4px] rounded-full bg-[#2a2a2a]" />
          </div>
        </div>
        {/* Screen area */}
        <div className="rounded-t-[4px] overflow-hidden">
          {/* Title bar */}
          <div className="flex items-center gap-[7px] max-sm:gap-[5px] px-3.5 max-sm:px-2.5 py-[9px] max-sm:py-[7px] bg-[#131313] border-b border-[rgba(255,255,255,0.04)]">
            <span className="w-[10px] h-[10px] max-sm:w-2 max-sm:h-2 rounded-full bg-[#ff5f57]" />
            <span className="w-[10px] h-[10px] max-sm:w-2 max-sm:h-2 rounded-full bg-[#febc2e]" />
            <span className="w-[10px] h-[10px] max-sm:w-2 max-sm:h-2 rounded-full bg-[#28c840]" />
            <span className="ml-3 flex-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)] tracking-[0.04em] opacity-60 truncate">{url}</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="w-full block" />
        </div>
      </div>
      {/* Bottom chin */}
      <div className="h-[10px] bg-[#1a1a1a] rounded-b-[12px] border border-t-0 border-[#333]" />
    </div>
  );
}

/* ─── Reveal wrapper ────────────────────────────────────────────────────── */

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, inView } = useReveal();
  return (
    <div
      ref={ref}
      style={inView ? { opacity: 1, transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)' } : { opacity: 0, transform: 'translateY(26px)', transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)' }}
      className={className}
    >
      {children}
    </div>
  );
}

/* ─── Proof stat cell ───────────────────────────────────────────────────── */

function ProofCell({ target, prefix = '', comma = false, label, gold = false }: { target: number; prefix?: string; comma?: boolean; label: string; gold?: boolean }) {
  const { ref, inView } = useReveal();
  const value = useCountUp(target, inView);
  const formatted = comma ? value.toLocaleString('en-US') : value.toString();

  return (
    <div ref={ref} className="py-[46px] px-[44px] max-sm:px-0 max-sm:py-8 border-l border-[var(--color-border-base)] first:border-l-0 first:pl-0 max-md:border-l-0 max-md:pl-0 max-md:border-t max-md:first:border-t-0" style={inView ? { opacity: 1, transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)' } : { opacity: 0, transform: 'translateY(26px)', transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)' }}>
      <div className={`text-[48px] max-sm:text-[36px] font-bold tracking-[-0.03em] leading-none tabular-nums ${gold ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-primary)]'}`}>
        {prefix}{formatted}
      </div>
      <div className="mt-4 text-sm text-[var(--color-text-muted)] leading-relaxed max-w-[280px]">{label}</div>
    </div>
  );
}

/* ─── Ticker tape ───────────────────────────────────────────────────────── */

function TickerTape({ items }: { items: TickerTapeItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !trackRef.current) return;

    const interval = setInterval(() => {
      const tapeItems = trackRef.current?.querySelectorAll('[data-tape-item]');
      if (!tapeItems?.length) return;
      const idx = Math.floor(Math.random() * (tapeItems.length / 2));
      const targets = [tapeItems[idx], tapeItems[idx + tapeItems.length / 2]];
      const up = Math.random() > 0.46;
      targets.forEach((el) => {
        if (!el) return;
        el.classList.remove('animate-flash-up', 'animate-flash-dn');
        void (el as HTMLElement).offsetWidth;
        el.classList.add(up ? 'animate-flash-up' : 'animate-flash-dn');
      });
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  if (!items.length) return null;

  const doubled = [...items, ...items];

  return (
    <div className="tape-wrap overflow-hidden border-b border-[var(--color-border-subtle)] bg-[#070707]">
      <div ref={trackRef} className="tape-track inline-flex animate-tape-scroll whitespace-nowrap">
        {doubled.map((item, i) => (
          <span
            key={`${item.symbol}-${i}`}
            data-tape-item
            className="inline-flex gap-2.5 items-center px-[26px] h-10 border-r border-[var(--color-border-subtle)] font-[family-name:var(--font-mono)] text-xs"
          >
            <span className="text-[var(--color-gold)] font-bold tracking-[0.04em]">{item.symbol}</span>
            <span className="text-[var(--color-text-primary)] tabular-nums">{item.price}</span>
            <span className={`tabular-nums ${item.positive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'}`}>
              {item.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomeContent({ tickerTape }: HomeContentProps) {
  // Hero tilt removed — 3D transforms blur images on high-DPI screens

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-[rgba(10,10,10,0.72)] backdrop-blur-[20px] backdrop-saturate-[1.4] border-b border-[var(--color-border-base)]">
        <div className="max-w-[1240px] mx-auto px-10 max-sm:px-5 h-[62px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-[11px] font-bold tracking-[0.02em] uppercase text-[15px]">
            <HelmMark size={24} />
            Helm
          </Link>

          <div className="hidden lg:flex items-center gap-[34px]">
            {NAV_LINKS.map((link) =>
              link.children ? (
                <NavDropdown key={link.label} label={link.label} items={link.children} />
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.14em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          <div className="flex items-center gap-[18px]">
            <Link href="/login" className="hidden sm:block font-[family-name:var(--font-mono)] text-[11px] tracking-[0.14em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] font-bold tracking-[0.16em] uppercase px-[22px] py-[13px] max-sm:px-4 max-sm:py-2.5 rounded-[5px] bg-[var(--color-gold)] text-black shadow-[0_6px_22px_rgba(230,185,77,0.22)] hover:bg-[var(--color-gold-hi)] hover:shadow-[0_10px_30px_rgba(230,185,77,0.34)] transition-all">
              Open terminal &rarr;
            </Link>
          </div>
        </div>
      </nav>

      {/* ── TICKER TAPE ── */}
      <TickerTape items={tickerTape} />

      {/* ── HERO ── */}
      <header className="relative overflow-hidden pt-[104px] max-sm:pt-16 text-center">
        {/* Decorative glow */}
        <div className="absolute left-1/2 -top-20 -translate-x-1/2 w-[1100px] h-[620px] pointer-events-none bg-[radial-gradient(ellipse_50%_50%_at_50%_0%,rgba(230,185,77,0.10),transparent_62%)]" />
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-50 bg-[linear-gradient(var(--color-border-subtle)_1px,transparent_1px),linear-gradient(90deg,var(--color-border-subtle)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_28%,#000_0%,transparent_75%)]" />

        <div className="relative max-w-[1240px] mx-auto px-10 max-sm:px-5">
          <h1 className="text-[clamp(56px,10vw,110px)] font-extrabold leading-[1.0] tracking-[-0.045em] max-w-[1100px] mx-auto">
            What moved.<br />
            <span>What matters.</span><br />
            What&rsquo;s <em className="font-[family-name:var(--font-display-serif)] italic font-normal text-[var(--color-gold)]">next.</em>
          </h1>

          <p className="relative max-w-[600px] mx-auto mt-[30px] text-[19px] max-sm:text-base leading-relaxed text-[var(--color-text-muted)]">
            Helm reads your real holdings and tells you what changed, why it matters, and what to do about it.{' '}
            <b className="text-[var(--color-text-primary)] font-semibold">Portfolio intelligence, not just another tracker.</b>{' '}
            Most of it is free.
          </p>

          <div className="relative flex gap-3.5 justify-center mt-9 flex-wrap">
            <Link href="/signup" className="inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] font-bold tracking-[0.16em] uppercase px-[22px] py-[13px] rounded-[5px] bg-[var(--color-gold)] text-black shadow-[0_6px_22px_rgba(230,185,77,0.22)] hover:bg-[var(--color-gold-hi)] hover:shadow-[0_10px_30px_rgba(230,185,77,0.34)] transition-all">
              Open the terminal &rarr;
            </Link>
            <Link href="/brief" className="inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] font-bold tracking-[0.16em] uppercase px-[22px] py-[13px] rounded-[5px] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[rgba(255,255,255,0.28)] hover:bg-[rgba(255,255,255,0.03)] transition-all">
              Read today&rsquo;s brief
            </Link>
          </div>

          <div className="relative mt-[22px] font-[family-name:var(--font-mono)] text-[11px] tracking-[0.14em] uppercase text-[var(--color-text-muted)] flex gap-2.5 items-center justify-center max-sm:flex-wrap max-sm:text-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-positive)] shadow-[0_0_10px_var(--color-positive)] animate-pulse" />
            Live market data &middot; Read-only brokerage links &middot; No card required
          </div>
        </div>

        {/* Hero screenshot */}
        <div className="relative w-[min(1340px,calc(100vw-48px))] mx-auto mt-16">
          <Reveal>
            <BrowserFrame
              src="/product/overview.png"
              url="helmterminal.dev/overview"
              alt="Helm overview showing net worth across all accounts"
              className="hero-frame"
            />
          </Reveal>
        </div>
      </header>

      {/* ── TRUST STRIP ── */}
      <div className="border-t border-b border-[var(--color-border-base)] mt-24 bg-[#080808]">
        <div className="max-w-[1240px] mx-auto px-10 max-sm:px-5 flex items-center justify-between gap-[30px] max-sm:gap-4 py-[26px] flex-wrap max-sm:justify-center">
          <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] uppercase text-[var(--color-text-muted)] whitespace-nowrap">
            Built on institutional-grade data
          </div>
          <div className="flex gap-[38px] max-sm:gap-4 flex-wrap items-center max-sm:justify-center">
            {['Plaid', 'SEC EDGAR', 'Polygon', 'Finnhub', 'Nasdaq'].map((name) => (
              <span key={name} className="text-[17px] max-sm:text-sm font-bold tracking-[-0.01em] text-[var(--color-text-muted)] opacity-85">{name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── PROOF STATS ── */}
      <div className="border-b border-[var(--color-border-base)] bg-[#080808]">
        <div className="max-w-[1240px] mx-auto px-10 max-sm:px-5 grid grid-cols-1 md:grid-cols-3">
          <ProofCell target={23378} prefix="$" comma gold label="In harvestable losses Helm found that your brokerage never flagged" />
          <ProofCell target={11} label="Tickers you own through ETFs, surfaced as true exposure" />
          <ProofCell target={71} label="Positions reconciled across 8 sectors, every night" />
        </div>
      </div>

      {/* ── FEATURE SHOWCASES ── */}
      <section className="py-[120px] max-sm:py-16 max-w-[1240px] mx-auto px-10 max-sm:px-5">
        <Reveal>
          <div className="max-w-[720px] mb-16">
            <div className="flex items-center gap-3.5 mb-[22px] font-[family-name:var(--font-mono)] text-[11px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
              <span className="w-[26px] h-px bg-[var(--color-gold)]" />
              &#167; 01 &middot; The terminal
            </div>
            <h2 className="text-[clamp(32px,4vw,48px)] font-bold tracking-[-0.035em] leading-[1.05]">
              Everything an analyst does. <span className="text-[var(--color-text-muted)]">For your money.</span>
            </h2>
            <p className="text-[17px] leading-relaxed text-[var(--color-text-muted)] mt-5 max-w-[560px]">
              Connect every account once. Helm reconciles it nightly and turns raw positions into decisions, not another dashboard you have to interpret yourself.
            </p>
          </div>
        </Reveal>

        {SHOWCASES.map((s, i) => (
          <Reveal key={s.kicker}>
            <div className={`py-[76px] max-sm:py-10 ${i > 0 ? 'border-t border-[var(--color-border-subtle)]' : 'pt-2'}`}>
              <div className={`max-w-[780px] mb-11 ${s.reverse ? 'ml-auto' : ''}`}>
                <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-[var(--color-gold)] mb-4">
                  {s.kicker}
                </div>
                <h3 className="text-[clamp(24px,3vw,34px)] font-bold tracking-[-0.025em] leading-[1.1] mb-4">
                  {s.titleEm ? (
                    <>{s.title}<em className="font-[family-name:var(--font-display-serif)] italic font-normal text-[var(--color-gold)]">{s.titleEm}</em>{s.titleEnd}</>
                  ) : s.title}
                </h3>
                <p className="text-base leading-relaxed text-[var(--color-text-muted)] max-w-[560px] mb-5">{s.desc}</p>
                <ul className="flex flex-wrap gap-2.5 gap-x-7 list-none max-sm:flex-col max-sm:gap-2">
                  {s.list.map((item) => (
                    <li key={item} className="flex gap-2.5 text-[13.5px] text-[var(--color-text-muted)] items-center">
                      <span className="text-[var(--color-gold)] font-[family-name:var(--font-mono)]">&rarr;</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="w-[min(1380px,calc(100vw-40px))] max-sm:w-[calc(100vw-32px)] ml-[50%] -translate-x-1/2">
                <BrowserFrame src={s.img} url={s.url} alt={s.alt} />
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ── TRANSPARENCY PULL-QUOTE ── */}
      <div className="border-t border-[var(--color-border-base)] bg-[#070707]">
        <Reveal>
          <div className="max-w-[980px] mx-auto py-[110px] max-sm:py-16 px-10 max-sm:px-5">
            <p className="font-[family-name:var(--font-display-serif)] italic font-normal text-[clamp(28px,4.5vw,46px)] leading-[1.28] tracking-[-0.01em]">
              &ldquo;No black boxes. Every verdict shows the model, the sources, the timestamp, and a{' '}
              <span className="not-italic font-[family-name:var(--font-sans)] font-semibold text-[var(--color-gold)] text-[clamp(26px,4vw,42px)]">conviction score</span>{' '}
              we&rsquo;re willing to be wrong about in public.&rdquo;
            </p>
            <div className="mt-[34px] font-[family-name:var(--font-mono)] text-[11px] tracking-[0.16em] uppercase text-[var(--color-text-muted)]">
              Helm analysis protocol &middot; v3.2
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── TRANSPARENCY RECEIPT ── */}
      <section className="py-[120px] max-sm:py-16 max-w-[1240px] mx-auto px-10 max-sm:px-5">
        <Reveal>
          <div className="max-w-[720px] mb-16">
            <div className="flex items-center gap-3.5 mb-[22px] font-[family-name:var(--font-mono)] text-[11px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
              <span className="w-[26px] h-px bg-[var(--color-gold)]" />
              &#167; 02 &middot; Transparency
            </div>
            <h2 className="text-[clamp(32px,4vw,48px)] font-bold tracking-[-0.035em] leading-[1.05]">
              Every answer comes with <span className="text-[var(--color-text-muted)]">its receipts.</span>
            </h2>
            <p className="text-[17px] leading-relaxed text-[var(--color-text-muted)] mt-5 max-w-[560px]">
              AI you can audit. Each take cites the filing, the data provider, and the moment it was generated, so you can check Helm&rsquo;s work, not just trust it.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-[72px] max-sm:gap-10 items-center mt-[18px]">
            {/* Verdict card */}
            <div className="border border-[var(--color-border-base)] rounded-[10px] bg-[var(--color-bg-surface)] overflow-hidden">
              <div className="flex items-center justify-between px-[22px] py-[18px] border-b border-[var(--color-border-base)] flex-wrap gap-2">
                <span className="font-[family-name:var(--font-mono)] font-bold text-[var(--color-gold)] tracking-[0.06em] text-[15px]">NVDA &middot; NVIDIA</span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.1em] text-[var(--color-text-muted)]">Conviction <b className="text-[var(--color-positive)]">High &middot; 82</b></span>
              </div>
              <div className="p-[22px] space-y-0">
                {[
                  { tag: 'Bull', text: 'Data-center revenue +154% YoY; Blackwell ramp ahead of guidance per Q1 FY26 call.' },
                  { tag: 'Bear', text: 'Forward P/E 38x prices in flawless execution; customer concentration in top 4 hyperscalers.' },
                  { tag: 'Risk', text: 'Export-control exposure flagged in latest 10-Q risk factors.' },
                ].map((row) => (
                  <div key={row.tag} className="flex gap-3 py-[11px] border-b border-[var(--color-border-subtle)] last:border-b-0 text-[13px] text-[var(--color-text-muted)] items-start">
                    <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.14em] uppercase text-[var(--color-gold)] border border-[var(--color-gold-border)] px-[7px] py-[3px] rounded-[3px] whitespace-nowrap">{row.tag}</span>
                    <span>{row.text}</span>
                  </div>
                ))}
              </div>
              <div className="px-[22px] py-3.5 bg-[#0c0c0c] border-t border-[var(--color-border-base)] font-[family-name:var(--font-mono)] text-[10px] tracking-[0.08em] text-[var(--color-text-muted)] flex gap-2 flex-wrap">
                <b className="text-[var(--color-text-secondary)]">Sources:</b> SEC 10-Q (filed May 28) &middot; Polygon EOD &middot; Finnhub estimates &middot; generated 2h ago
              </div>
            </div>

            {/* Copy */}
            <div className="max-w-[780px]">
              <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-[var(--color-gold)] mb-4">How it earns trust</div>
              <h3 className="text-[clamp(24px,3vw,34px)] font-bold tracking-[-0.025em] leading-[1.1] mb-4">Cited, timestamped, falsifiable.</h3>
              <p className="text-base leading-relaxed text-[var(--color-text-muted)] max-w-[480px] mb-4">
                Helm never hands you a verdict without showing its work. Pull up any bull or bear case and you&rsquo;ll see the exact filing line, the data vendor, and a conviction score that goes on the record, refreshed when the facts change, not when it&rsquo;s convenient.
              </p>
              <ul className="flex flex-wrap gap-2.5 gap-x-7 list-none max-sm:flex-col max-sm:gap-2">
                {['Primary sources linked inline (SEC, Polygon, Finnhub)', 'Staleness shown, so you always know how fresh it is', 'Not investment advice, and never pretends to be'].map((item) => (
                  <li key={item} className="flex gap-2.5 text-[13.5px] text-[var(--color-text-muted)] items-center">
                    <span className="text-[var(--color-gold)] font-[family-name:var(--font-mono)]">&rarr;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── SECURITY ── */}
      <section className="py-[120px] max-sm:py-16 max-w-[1240px] mx-auto px-10 max-sm:px-5">
        <Reveal>
          <div className="max-w-[720px] mb-16">
            <div className="flex items-center gap-3.5 mb-[22px] font-[family-name:var(--font-mono)] text-[11px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
              <span className="w-[26px] h-px bg-[var(--color-gold)]" />
              &#167; 03 &middot; Security
            </div>
            <h2 className="text-[clamp(32px,4vw,48px)] font-bold tracking-[-0.035em] leading-[1.05]">
              Read-only by design. <span className="text-[var(--color-text-muted)]">We can&rsquo;t touch your money.</span>
            </h2>
            <p className="text-[17px] leading-relaxed text-[var(--color-text-muted)] mt-5 max-w-[560px]">
              Helm links to your brokerages through Plaid in read-only mode. We see balances and positions to analyze them, never the keys to move a dollar.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {[
              { icon: Shield, title: 'Read-only connections', desc: 'Linked via Plaid with view-only scopes. No trading, no transfers, no withdrawal access, ever.' },
              { icon: Lock, title: 'Encrypted end to end', desc: 'Credentials are tokenized by Plaid and never stored by Helm. Data is encrypted in transit and at rest.' },
              { icon: Activity, title: 'Yours to delete', desc: 'Unlink any account in one click. Request full data deletion and it\'s gone, with no retention games.' },
            ].map((card) => (
              <div key={card.title} className="border border-[var(--color-border-base)] rounded-lg bg-[var(--color-bg-surface)] p-[30px] transition-colors hover:border-[var(--color-gold-border)]">
                <div className="w-[38px] h-[38px] rounded-lg border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] flex items-center justify-center text-[var(--color-gold)] mb-5">
                  <card.icon size={18} strokeWidth={1.8} />
                </div>
                <h4 className="text-base font-bold tracking-[-0.01em] mb-2.5">{card.title}</h4>
                <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">{card.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── PRICING ── */}
      <section className="py-[120px] max-sm:py-16 max-w-[1240px] mx-auto px-10 max-sm:px-5">
        <Reveal>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-10">
            <div className="max-w-[720px]">
              <div className="flex items-center gap-3.5 mb-[22px] font-[family-name:var(--font-mono)] text-[11px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
                <span className="w-[26px] h-px bg-[var(--color-gold)]" />
                &#167; 04 &middot; Pricing
              </div>
              <h2 className="text-[clamp(32px,4vw,48px)] font-bold tracking-[-0.035em] leading-[1.05]">
                Five ways in. <span className="text-[var(--color-text-muted)]">No upsell mazes.</span>
              </h2>
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)] tracking-[0.08em] text-right max-w-[300px]">
              Founding rate limited to 50 spots
              <div className="h-0.5 bg-[var(--color-border-base)] mt-3 relative">
                <span className="absolute inset-0 w-[60%] bg-[var(--color-gold)]" />
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`relative p-[30px] border rounded-lg transition-all hover:border-[var(--color-gold-border)] hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.5)] ${
                  tier.featured
                    ? 'border-[var(--color-gold-border)] bg-[linear-gradient(180deg,rgba(230,185,77,0.05),rgba(230,185,77,0.01))]'
                    : 'border-[var(--color-border-base)] bg-[#0c0c0c]'
                }`}
              >
                {tier.chip && (
                  <span className="absolute -top-2.5 left-[30px] px-2.5 py-1 bg-[var(--color-gold)] text-black font-[family-name:var(--font-mono)] text-[9px] font-bold tracking-[0.18em] uppercase rounded-[3px]">
                    {tier.chip}
                  </span>
                )}
                <div className={`font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase mb-[18px] ${tier.featured ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'}`}>
                  {tier.name}
                </div>
                <div className="text-[44px] max-sm:text-[36px] font-bold tracking-[-0.03em] leading-none">
                  {tier.price}
                  {tier.priceSuffix && <small className="text-[15px] text-[var(--color-text-muted)] font-medium">{tier.priceSuffix}</small>}
                </div>
                <div className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)] mt-2 tracking-[0.06em]">{tier.sub}</div>
                <ul className="mt-[22px] pt-[22px] border-t border-[var(--color-border-base)] flex flex-col gap-[11px]">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-[9px] text-[13px] text-[var(--color-text-muted)] leading-snug">
                      <span className="text-[var(--color-gold)] font-[family-name:var(--font-mono)]">&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block w-full mt-6 py-3 rounded-[5px] font-[family-name:var(--font-mono)] text-[10px] font-bold tracking-[0.16em] uppercase text-center transition-all ${
                    tier.featured
                      ? 'bg-[var(--color-gold)] text-black border border-[var(--color-gold)] shadow-[0_8px_24px_rgba(230,185,77,0.25)] hover:bg-[var(--color-gold-hi)]'
                      : 'bg-transparent text-[var(--color-text-primary)] border border-[var(--color-border-strong)] hover:border-[rgba(255,255,255,0.3)]'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── CLOSING CTA ── */}
      <section className="relative text-center py-[140px] max-sm:py-20 border-t border-[var(--color-border-base)] overflow-hidden">
        <div className="absolute left-1/2 -bottom-[200px] -translate-x-1/2 w-[1000px] h-[500px] bg-[radial-gradient(ellipse_50%_50%_at_50%_100%,rgba(230,185,77,0.10),transparent_65%)] pointer-events-none" />
        <div className="relative max-w-[1240px] mx-auto px-10 max-sm:px-5">
          <h2 className="text-[clamp(44px,6vw,72px)] font-bold tracking-[-0.04em] leading-[1.0]">
            Take the <em className="font-[family-name:var(--font-display-serif)] italic font-normal text-[var(--color-gold)]">HELM.</em>
          </h2>
          <p className="mt-[22px] mx-auto max-w-[480px] text-[var(--color-text-muted)] text-[17px] leading-relaxed">
            Link your first account in two minutes. See your real exposure, your first brief, and your first action. Free.
          </p>
          <div className="flex gap-3.5 justify-center mt-9 flex-wrap">
            <Link href="/signup" className="inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] font-bold tracking-[0.16em] uppercase px-[22px] py-[13px] rounded-[5px] bg-[var(--color-gold)] text-black shadow-[0_6px_22px_rgba(230,185,77,0.22)] hover:bg-[var(--color-gold-hi)] hover:shadow-[0_10px_30px_rgba(230,185,77,0.34)] transition-all">
              Open the terminal &rarr;
            </Link>
            <Link href="/analyze" className="inline-flex items-center gap-2 font-[family-name:var(--font-mono)] text-[11px] font-bold tracking-[0.16em] uppercase px-[22px] py-[13px] rounded-[5px] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[rgba(255,255,255,0.28)] hover:bg-[rgba(255,255,255,0.03)] transition-all">
              Analyze a ticker
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--color-border-base)] bg-[#070707] pt-16 pb-10">
        <div className="max-w-[1240px] mx-auto px-10 max-sm:px-5">
          <div className="grid grid-cols-2 max-sm:grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-12 max-sm:gap-8">
            <div className="col-span-2 max-sm:col-span-1 lg:col-span-1">
              <Link href="/" className="flex items-center gap-[11px] font-bold tracking-[0.02em] uppercase text-[15px]">
                <HelmMark size={24} />
                Helm
              </Link>
              <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed mt-[18px] max-w-[300px]">
                Steer. Don&rsquo;t drift. Take the HELM.
              </p>
              <p className="font-[family-name:var(--font-mono)] text-[10px] text-[#555] mt-3">
                Helm is not a registered investment advisor. Information is for educational purposes only.
              </p>
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Product</div>
              {[['Terminal', '/dashboard'], ['Analyze', '/analyze'], ['Pricing', '/pricing'], ['Changelog', '/blog']].map(([label, href]) => (
                <Link key={label} href={href} className="block text-[13px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{label}</Link>
              ))}
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Tools</div>
              {[['TLH Calculator', '/tools/tlh-calculator'], ['RSU Calculator', '/tools/rsu-calculator'], ['Compare', '/compare']].map(([label, href]) => (
                <Link key={label} href={href} className="block text-[13px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{label}</Link>
              ))}
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Company</div>
              {[['About', '/about'], ['Security', '/security'], ['Blog', '/blog'], ['Contact', '/contact']].map(([label, href]) => (
                <Link key={label} href={href} className="block text-[13px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{label}</Link>
              ))}
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Legal</div>
              {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Data Deletion', '/contact']].map(([label, href]) => (
                <Link key={label} href={href} className="block text-[13px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{label}</Link>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between mt-14 pt-6 border-t border-[var(--color-border-subtle)] font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-[var(--color-text-muted)]">
            <div>&copy; 2026 Helm Terminal, Inc.</div>
            <div>&bull; All systems operational</div>
          </div>
        </div>
      </footer>

      {/* ── CSS for ticker tape animation ── */}
      <style jsx global>{`
        @keyframes tape-scroll {
          to { transform: translateX(-50%); }
        }
        .animate-tape-scroll {
          animation: tape-scroll 60s linear infinite;
        }
        .tape-wrap:hover .tape-track {
          animation-play-state: paused;
        }
        @keyframes flash-up {
          0% { background: rgba(74,222,128,0.16); }
          100% { background: transparent; }
        }
        @keyframes flash-dn {
          0% { background: rgba(248,113,113,0.16); }
          100% { background: transparent; }
        }
        .animate-flash-up { animation: flash-up 0.9s cubic-bezier(0.22,1,0.36,1); }
        .animate-flash-dn { animation: flash-dn 0.9s cubic-bezier(0.22,1,0.36,1); }
        @media (prefers-reduced-motion: reduce) {
          .animate-tape-scroll { animation: none; }
          .animate-flash-up, .animate-flash-dn { animation: none; }
        }
      `}</style>
    </div>
  );
}
