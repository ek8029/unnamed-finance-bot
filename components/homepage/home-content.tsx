'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import type { TickerTapeItem } from '@/lib/ticker-tape';

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface HomeContentProps {
  demoAnalyses: unknown[];
  tickerTape: TickerTapeItem[];
}

/* ─── Scenes for the pinned MacBook stage ───────────────────────────────── */

const SCENE_ALT: Record<string, string> = {
  Overview: 'Helm dashboard showing $1.27M net worth across linked brokerage accounts with sector allocation and market movers',
  'True exposure': 'Portfolio view showing 71 positions across 8 sectors with indirect ETF exposure breakdown',
  'The Daily Brief': 'AI-generated morning brief analyzing overnight portfolio changes with market context',
  Actions: 'Prioritized actions inbox showing tax savings opportunities ranked by dollar impact',
  'Tax center': 'Tax intelligence dashboard showing $23,380 in harvestable losses with quarterly breakdown',
};

const SCENES = [
  {
    img: '/product/overview.png',
    eyebrow: 'Overview',
    head: <>Everything you own. <em>One number,</em> fully explained.</>,
    cap: <><b className="text-[var(--color-gold)]">$1,270,020</b> net worth <Dot /> reconciled nightly across every account</>,
    ambient: 'rgba(230,185,77,0.16)',
  },
  {
    img: '/product/exposure.png',
    eyebrow: 'True exposure',
    head: <>See what you actually own. <em>Through every ETF.</em></>,
    cap: <><b>71</b> positions <Dot /> 8 sectors <Dot /> indirect ETF exposure surfaced</>,
    ambient: 'rgba(230,185,77,0.15)',
  },
  {
    img: '/product/brief.png',
    eyebrow: 'The Daily Brief',
    head: <>A brief written about <em>your</em> portfolio. Every morning.</>,
    cap: <>Delivered <b>9:15 AM ET</b> <Dot /> what moved, what matters, what&rsquo;s next</>,
    ambient: 'rgba(124,167,232,0.13)',
  },
  {
    img: '/product/actions.png',
    eyebrow: 'Actions',
    head: <>Every decision, <em>ranked</em> by what it&rsquo;s worth.</>,
    cap: <><b>14</b> open actions <Dot /> top opportunity <b className="text-[var(--color-positive)]">$960</b> in tax savings</>,
    ambient: 'rgba(230,185,77,0.15)',
  },
  {
    img: '/product/taxes.png',
    eyebrow: 'Tax center',
    head: <>Tax intelligence that works <em>all year.</em> Not just in April.</>,
    cap: <><b className="text-[var(--color-positive)]">$23,380</b> in harvestable losses <Dot /> flagged automatically</>,
    ambient: 'rgba(74,222,128,0.14)',
  },
];

function Dot() {
  return <span className="inline-block w-1 h-1 rounded-full bg-[var(--color-text-muted)] mx-1 align-middle" />;
}

/* ─── Nav links ─────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { label: 'Analyze', href: '/analyze' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'Security', href: '/security' },
];

/* ─── Pricing ───────────────────────────────────────────────────────────── */

const TIERS = [
  { name: 'Free', price: '$0', sub: 'Forever, no card', features: ['Full terminal access', 'AI analysis, any US ticker', 'Connected brokerages', 'Daily brief', 'Actions inbox'], cta: 'Start free', featured: false },
  { name: 'Founding Member', price: '$4.99', priceSuffix: '/mo', sub: 'Locked forever, 50 spots', features: ['Everything in Free', 'Tax-loss harvesting', 'Earnings exposure', 'Annual Wrapped', 'Founding badge'], cta: 'Claim founding rate', featured: true, chip: 'Limited' },
  { name: 'Pro Annual', price: '$119', priceSuffix: '/yr', sub: '$9.92/mo, save 34%', features: ['Everything in Founding', '2 months free', 'Locked annual rate', 'Early beta access', 'Priority support'], cta: 'Go Pro', featured: false },
  { name: 'Lifetime', price: '$249', sub: 'One-time, never billed again', features: ['All Pro, forever', 'Founding-member badge', 'Direct line to the team', 'Early access to tools', 'Never billed again'], cta: 'Claim a seat', featured: false },
];

/* ─── Reveal hook ───────────────────────────────────────────────────────── */

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.unobserve(el); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, inView } = useReveal();
  return (
    <div ref={ref} style={inView ? { opacity: 1, transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)' } : { opacity: 0, transform: 'translateY(26px)', transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1)' }} className={className}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HomeContent({ tickerTape }: HomeContentProps) {
  const [activeScene, setActiveScene] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [railVisible, setRailVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Detect reduced motion preference
  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Scroll-driven scene engine
  useEffect(() => {
    function onScroll() {
      const wrap = stageRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const total = wrap.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -rect.top / total));
      const idx = Math.min(SCENES.length - 1, Math.floor(p * SCENES.length));
      setActiveScene(idx);
      const inView = rect.top < window.innerHeight * 0.5 && rect.bottom > window.innerHeight * 0.5;
      setRailVisible(inView);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Preload first 2 scenes eagerly, rest after first interaction
  useEffect(() => {
    SCENES.slice(0, 2).forEach(s => { const img = new Image(); img.src = s.img; });
    const preloadRest = () => {
      SCENES.slice(2).forEach(s => { const img = new Image(); img.src = s.img; });
      window.removeEventListener('scroll', preloadRest);
    };
    window.addEventListener('scroll', preloadRest, { once: true, passive: true });
    return () => window.removeEventListener('scroll', preloadRest);
  }, []);

  const scene = SCENES[activeScene];

  function scrollToScene(i: number) {
    const wrap = stageRef.current;
    if (!wrap) return;
    const total = wrap.offsetHeight - window.innerHeight;
    window.scrollTo({ top: wrap.offsetTop + ((i + 0.5) / SCENES.length) * total, behavior: 'smooth' });
  }

  const motionClass = reducedMotion ? '' : 'animate-[rise_0.95s_cubic-bezier(0.22,1,0.36,1)_both]';
  const motionStyle = (delay: number) => reducedMotion ? {} : { animationDelay: `${delay}s` };

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">

      {/* ── TICKER TAPE (topmost) ── */}
      {tickerTape.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[61] overflow-hidden border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] h-[32px] max-sm:hidden" aria-hidden="true">
          <div className="tape-track inline-flex items-center h-full whitespace-nowrap animate-tape-scroll">
            {[...tickerTape, ...tickerTape, ...tickerTape].map((t, i) => (
              <span key={`${t.symbol}-${i}`} className="inline-flex items-center gap-2.5 px-6 font-[family-name:var(--font-mono)] text-[11px]">
                <span className="text-[var(--color-gold)] font-bold tracking-[0.04em]">{t.symbol}</span>
                <span className="text-[var(--color-text-primary)] tabular-nums">{t.price}</span>
                <span className={`tabular-nums font-medium ${t.positive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'}`}>{t.change}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── NAV ── */}
      <nav className="fixed top-0 sm:top-[32px] left-0 right-0 z-[60] h-[60px] flex items-center justify-between px-10 max-sm:px-5 pointer-events-none" style={{ background: 'linear-gradient(to bottom, var(--color-bg-base), transparent)' }}>
        <Link href="/" className="flex items-center gap-[10px] font-bold tracking-[0.03em] uppercase text-sm pointer-events-auto">
          <HelmMark size={22} />
          Helm
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8 pointer-events-auto">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.14em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4 pointer-events-auto">
          <Link href="/signup" className="font-[family-name:var(--font-mono)] text-[10px] font-bold tracking-[0.16em] uppercase text-black bg-[var(--color-gold)] px-4 py-[9px] rounded-[5px] hover:bg-[var(--color-gold-hi)] transition-colors">
            Open terminal &rarr;
          </Link>
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed top-[60px] left-0 right-0 z-[59] bg-[var(--color-bg-base)]/95 backdrop-blur-xl border-b border-[var(--color-border-base)] px-5 pb-4 pt-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} href={link.href} onClick={() => setMobileMenuOpen(false)} className="block py-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              {link.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            Log in
          </Link>
        </div>
      )}

      <main>
      {/* ── INTRO (full viewport) ── */}
      <section className="h-screen flex flex-col items-center justify-center text-center relative px-10 max-sm:px-5 overflow-hidden">
        {/* Gold glow */}
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[700px] max-w-[120vw] pointer-events-none bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,rgba(230,185,77,0.12),transparent_64%)]" />

        <div className={`relative font-[family-name:var(--font-mono)] text-xs tracking-[0.34em] uppercase text-[var(--color-gold)] mb-6 ${motionClass}`} style={motionStyle(0.15)}>
          Portfolio intelligence
        </div>

        <p className={`relative text-[var(--color-text-muted)] font-semibold text-[clamp(1rem,1.7vw,1.3rem)] tracking-[0.005em] mb-5 ${motionClass}`} style={motionStyle(0.3)}>
          This is your money, understood.
        </p>

        {/* The three beats */}
        <h1 className="relative flex flex-col items-center gap-[0.02em]">
          {['What moved', 'What matters', "What\u2019s next"].map((text, i) => (
            <span
              key={text}
              className={`font-extrabold tracking-[-0.05em] leading-[0.96] text-[clamp(2.75rem,10vw,9.125rem)] ${motionClass} ${i === 1 ? 'text-[var(--color-gold)]' : ''}`}
              style={motionStyle(0.42 + i * 0.2)}
            >
              {text}<i className="font-[family-name:var(--font-display-serif)] italic font-normal text-[var(--color-gold)]">.</i>
            </span>
          ))}
        </h1>

        <p className={`relative mt-8 text-[clamp(0.938rem,1.55vw,1.188rem)] text-[var(--color-text-muted)] max-w-[500px] leading-relaxed ${motionClass}`} style={motionStyle(1.05)}>
          A terminal that reads your real holdings and tells you what to do next. <b className="text-[var(--color-text-primary)] font-semibold">Not another tracker.</b>
        </p>

        {/* CTAs */}
        <div className={`relative flex gap-3.5 mt-8 flex-wrap justify-center ${motionClass}`} style={motionStyle(1.15)}>
          <Link href="/signup" className="font-[family-name:var(--font-mono)] text-[11px] font-bold tracking-[0.16em] uppercase px-6 py-3 rounded-[5px] bg-[var(--color-gold)] text-black shadow-[0_6px_22px_rgba(230,185,77,0.22)] hover:bg-[var(--color-gold-hi)] transition-all min-h-[44px] flex items-center">
            Open the terminal &rarr;
          </Link>
          <Link href="/brief" className="font-[family-name:var(--font-mono)] text-[11px] font-bold tracking-[0.16em] uppercase px-6 py-3 rounded-[5px] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[rgba(255,255,255,0.28)] transition-all min-h-[44px] flex items-center">
            Read today&rsquo;s brief
          </Link>
        </div>

        {/* Scroll cue */}
        {!reducedMotion && (
          <div className={`absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.22em] uppercase text-[var(--color-text-muted)] ${motionClass}`} style={motionStyle(1)}>
            <span>Scroll</span>
            <div className="w-px h-10 bg-gradient-to-b from-[var(--color-gold)] to-transparent relative overflow-hidden">
              <div className="absolute top-[-50%] left-0 w-px h-[50%] bg-[var(--color-gold)] animate-[cue_1.8s_cubic-bezier(0.22,1,0.36,1)_infinite]" />
            </div>
          </div>
        )}
      </section>

      {/* ── PINNED MACBOOK STAGE (320vh scroll distance, desktop only) ── */}
      <section ref={stageRef} className="relative hidden md:block" style={{ height: '250vh' }}>
        <div className="sticky top-[92px] h-[calc(100vh-92px)] overflow-hidden grid grid-rows-[1fr_auto_1fr] items-center">
          {/* Ambient backlight */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[900px] max-w-[130vw] blur-[70px] opacity-50 rounded-full pointer-events-none transition-[background] duration-500"
            style={{ background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${scene.ambient}, transparent 64%)` }}
          />

          {/* Scene headline */}
          <div className="relative z-[3] text-center px-10 pb-2.5 self-end" key={`head-${activeScene}`} style={reducedMotion ? {} : { animation: 'riseUp 0.7s cubic-bezier(0.22,1,0.36,1) both' }}>
            <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.26em] uppercase text-[var(--color-gold)] mb-4">
              {scene.eyebrow}
            </div>
            <h2 className="text-[clamp(1.625rem,3.6vw,3.25rem)] font-bold tracking-[-0.035em] leading-[1.05] max-w-[18ch] mx-auto [&_em]:font-[family-name:var(--font-display-serif)] [&_em]:italic [&_em]:font-normal [&_em]:text-[var(--color-gold)]">
              {scene.head}
            </h2>
          </div>

          {/* The MacBook */}
          <div className="relative z-[2] flex justify-center items-center py-5" style={{ perspective: '2400px' }}>
            <div className="w-[min(1360px,95vw,132vh)]" style={{ transform: 'rotateX(9deg)', transformOrigin: 'center 65%' }}>
              <div className="relative rounded-[clamp(12px,1.5vw,22px)] p-[1.6%] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_60px_120px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.05),0_0_90px_rgba(230,185,77,0.05)]" style={{ background: 'linear-gradient(160deg,#26262a,#0d0d0f)' }}>
                <span className="absolute top-[0.7%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#0a0a0a] shadow-[0_0_0_2px_#1a1a1c]" />
                <div className="relative rounded-[clamp(5px,0.7vw,9px)] overflow-hidden aspect-video bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={`shot-${activeScene}`}
                    src={scene.img}
                    alt={SCENE_ALT[scene.eyebrow] || `Helm ${scene.eyebrow} view`}
                    className={`absolute inset-0 w-full h-full object-cover object-top ${reducedMotion ? '' : 'animate-[scenePop_0.3s_cubic-bezier(0.22,1,0.36,1)_both]'}`}
                  />
                  <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_60px_rgba(0,0,0,0.4)]" />
                </div>
              </div>
              <div className="relative w-[106%] mx-auto h-[clamp(9px,1.15vw,17px)] rounded-b-[clamp(8px,1vw,14px)] shadow-[0_34px_44px_rgba(0,0,0,0.55)]" style={{ background: 'linear-gradient(#43434a,#141416 62%)' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[rgba(0,0,0,0.55)]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[13%] h-[46%] rounded-b-[7px]" style={{ background: 'linear-gradient(#0c0c0d,#1c1c1f)' }} />
              </div>
            </div>
          </div>

          {/* Scene caption */}
          <div className="relative z-[3] text-center px-10 pt-2.5 self-start" key={`cap-${activeScene}`} style={reducedMotion ? {} : { animation: 'riseUp 0.7s cubic-bezier(0.22,1,0.36,1) both' }}>
            <div className="font-[family-name:var(--font-mono)] text-[clamp(11px,1.15vw,14px)] tracking-[0.04em] text-[var(--color-text-muted)] flex gap-3.5 items-center flex-wrap justify-center [&_b]:text-[var(--color-text-primary)]">
              {scene.cap}
            </div>
          </div>
        </div>
      </section>

      {/* ── MOBILE SCENE CARDS (stacked, replaces sticky stage) ── */}
      <section className="md:hidden py-16 px-5 space-y-16">
        {SCENES.map((s) => (
          <Reveal key={s.eyebrow}>
            <div className="text-center mb-6">
              <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.26em] uppercase text-[var(--color-gold)] mb-3">{s.eyebrow}</div>
              <h2 className="text-2xl font-bold tracking-[-0.025em] leading-[1.1] [&_em]:font-[family-name:var(--font-display-serif)] [&_em]:italic [&_em]:font-normal [&_em]:text-[var(--color-gold)]">
                {s.head}
              </h2>
            </div>
            <div className="rounded-lg overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.img} alt={SCENE_ALT[s.eyebrow] || `Helm ${s.eyebrow} view`} className="w-full block" loading="lazy" />
            </div>
            <div className="font-[family-name:var(--font-mono)] text-xs tracking-[0.04em] text-[var(--color-text-muted)] mt-4 text-center flex gap-2 items-center flex-wrap justify-center [&_b]:text-[var(--color-text-primary)]">
              {s.cap}
            </div>
          </Reveal>
        ))}
      </section>

      {/* ── Scene progress rail (right edge, desktop only) ── */}
      {railVisible && (
        <div className="fixed right-[26px] top-1/2 -translate-y-1/2 z-40 flex-col gap-3.5 hidden md:flex" role="navigation" aria-label="Product tour scenes">
          {SCENES.map((s, i) => (
            <button
              key={i}
              onClick={() => scrollToScene(i)}
              aria-label={`Go to ${s.eyebrow}`}
              className={`w-[9px] h-[9px] rounded-full border-0 cursor-pointer transition-all ${i === activeScene ? 'bg-[var(--color-gold)] shadow-[0_0_12px_rgba(230,185,77,0.7)]' : 'bg-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.4)]'}`}
            />
          ))}
        </div>
      )}

      {/* ── TRANSPARENCY RECEIPT ── */}
      <section className="py-[120px] max-sm:py-16 max-w-[1240px] mx-auto px-10 max-sm:px-5">
        <Reveal>
          <div className="max-w-[720px] mb-16">
            <div className="flex items-center gap-3.5 mb-5 font-[family-name:var(--font-mono)] text-[11px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
              <span className="w-[26px] h-px bg-[var(--color-gold)]" />
              Transparency
            </div>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.035em] leading-[1.05]">
              Built to be <em className="font-[family-name:var(--font-display-serif)] italic font-normal text-[var(--color-gold)]">second-guessed.</em>
            </h2>
            <p className="text-[1.0625rem] leading-relaxed text-[var(--color-text-muted)] mt-5 max-w-[560px]">
              AI you can audit. Each take cites the filing, the data provider, and the moment it was generated, so you can check Helm&rsquo;s work, not just trust it.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-[72px] max-sm:gap-10 items-center">
            {/* Verdict card */}
            <div className="border border-[var(--color-border-base)] rounded-[10px] bg-[var(--color-bg-surface)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-base)] flex-wrap gap-2">
                <span className="font-[family-name:var(--font-mono)] font-bold text-[var(--color-gold)] tracking-[0.06em] text-[15px]">NVDA &middot; NVIDIA</span>
                <span className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.1em] text-[var(--color-text-muted)]">Conviction <b className="text-[var(--color-positive)]">High &middot; 82/100</b></span>
              </div>
              <div className="p-5">
                {[
                  { tag: 'Bull', text: 'Data-center revenue +154% YoY; Blackwell ramp ahead of guidance per Q1 FY26 call.' },
                  { tag: 'Bear', text: 'Forward P/E 38x prices in flawless execution; customer concentration in top 4 hyperscalers.' },
                  { tag: 'Risk', text: 'Export-control exposure flagged in latest 10-Q risk factors.' },
                ].map((row) => (
                  <div key={row.tag} className="flex gap-3 py-3 border-b border-[var(--color-border-subtle)] last:border-b-0 text-sm text-[var(--color-text-muted)] items-start">
                    <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.14em] uppercase text-[var(--color-gold)] border border-[var(--color-gold-border)] px-2 py-1 rounded-[3px] whitespace-nowrap">{row.tag}</span>
                    <span>{row.text}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3.5 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-base)] font-[family-name:var(--font-mono)] text-[10px] tracking-[0.08em] text-[var(--color-text-muted)] flex gap-2 flex-wrap">
                <b className="text-[var(--color-text-secondary)]">Sources:</b> SEC 10-Q (filed May 28) &middot; Polygon EOD &middot; Finnhub estimates &middot; generated 2h ago
              </div>
            </div>
            {/* Copy */}
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.18em] uppercase text-[var(--color-gold)] mb-4">How it earns trust</div>
              <h3 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.025em] leading-[1.12] mb-4">Cited, timestamped, falsifiable.</h3>
              <p className="text-base leading-relaxed text-[var(--color-text-muted)] max-w-[440px] mb-5">
                Helm never hands you a verdict without showing its work. Pull up any bull or bear case and you&rsquo;ll see the exact filing line, the data vendor, and a conviction score that goes on the record.
              </p>
              <ul className="flex flex-col gap-3 list-none">
                {['Primary sources linked inline (SEC, Polygon, Finnhub)', 'Staleness shown, so you always know how fresh it is', 'Not investment advice, and never pretends to be'].map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-[var(--color-text-primary)] items-start">
                    <span className="text-[var(--color-gold)] font-[family-name:var(--font-mono)]">&rarr;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── SECURITY — Permission panel ── */}
      <section className="py-[120px] max-sm:py-16 max-w-[1240px] mx-auto px-10 max-sm:px-5">
        <Reveal>
          <div className="max-w-[720px] mb-16">
            <div className="flex items-center gap-3.5 mb-5 font-[family-name:var(--font-mono)] text-[11px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
              <span className="w-[26px] h-px bg-[var(--color-gold)]" />
              Security
            </div>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.035em] leading-[1.05]">
              Read-only by design. <em className="font-[family-name:var(--font-display-serif)] italic font-normal text-[var(--color-gold)]">We can&rsquo;t touch your money.</em>
            </h2>
            <p className="text-[1.0625rem] leading-relaxed text-[var(--color-text-muted)] mt-5 max-w-[560px]">
              Helm links to your brokerages through Plaid. Here is exactly what that connection can and cannot do, enforced at the protocol level, not promised in a policy.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <div className="border border-[var(--color-border-base)] rounded-[10px] bg-[var(--color-bg-surface)] overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[var(--color-border-base)] bg-[var(--color-bg-surface)] font-[family-name:var(--font-mono)] text-[10px] tracking-[0.16em] uppercase text-[var(--color-text-muted)] flex-wrap">
              <span className="w-[7px] h-[7px] rounded-full bg-[var(--color-positive)] shadow-[0_0_10px_var(--color-positive)]" />
              Connection scope &middot; Plaid &middot; helm-terminal
              <span className="ml-auto hidden sm:inline">access token &middot; revocable</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-8 max-sm:p-5 md:border-r border-[var(--color-border-base)]">
                <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.14em] uppercase text-[var(--color-positive)] mb-4 flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-[5px] bg-[rgba(74,222,128,0.12)] border border-[rgba(74,222,128,0.3)] text-[var(--color-positive)] inline-flex items-center justify-center text-xs font-[family-name:var(--font-mono)]">&#10003;</span>
                  Granted &middot; read-only
                </div>
                <ul className="list-none m-0 p-0">
                  {['Account balances', 'Holdings and positions', 'Cost basis and tax lots', 'Transaction history'].map((item) => (
                    <li key={item} className="text-base py-3 border-b border-[var(--color-border-subtle)] last:border-b-0 flex items-center gap-3 text-[var(--color-text-primary)]">
                      <span className="font-[family-name:var(--font-mono)] text-sm w-4 text-[var(--color-positive)]">&#10003;</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-8 max-sm:p-5 border-t md:border-t-0 border-[var(--color-border-base)]">
                <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.14em] uppercase text-[var(--color-negative-text)] mb-4 flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-[5px] bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.28)] text-[var(--color-negative-text)] inline-flex items-center justify-center text-xs font-[family-name:var(--font-mono)]">&#10007;</span>
                  Never granted
                </div>
                <ul className="list-none m-0 p-0">
                  {['Place or cancel trades', 'Move or transfer money', 'Withdraw funds', 'Change account settings'].map((item) => (
                    <li key={item} className="text-base py-3 border-b border-[var(--color-border-subtle)] last:border-b-0 flex items-center gap-3 text-[var(--color-text-muted)]">
                      <span className="font-[family-name:var(--font-mono)] text-sm w-4 text-[var(--color-negative-text)]">&#10007;</span>
                      <span className="relative"><span className="absolute left-0 right-0 top-[54%] h-px bg-[rgba(248,113,113,0.35)]" />{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[var(--color-border-base)] bg-[var(--color-bg-surface)] font-[family-name:var(--font-mono)] text-[11px] tracking-[0.03em] text-[var(--color-text-muted)] leading-relaxed">
              Credentials are tokenized by Plaid and <b className="text-[var(--color-text-secondary)]">never stored by Helm</b> &middot; encrypted AES-256 at rest, TLS 1.3 in transit &middot; unlink any account in one click and request full deletion anytime.
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-[120px] max-sm:py-16 max-w-[1240px] mx-auto px-10 max-sm:px-5">
        <Reveal>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-10">
            <div>
              <div className="flex items-center gap-3.5 mb-5 font-[family-name:var(--font-mono)] text-[11px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
                <span className="w-[26px] h-px bg-[var(--color-gold)]" />
                Pricing
              </div>
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.035em] leading-[1.05]">
                Four tiers. <em className="font-[family-name:var(--font-display-serif)] italic font-normal text-[var(--color-gold)]">Zero percent of AUM.</em>
              </h2>
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)] tracking-[0.08em] text-right max-w-[300px]">
              Founding rate: 20 of 50 spots claimed
              <div className="h-0.5 bg-[var(--color-border-base)] mt-3 relative">
                <span className="absolute inset-0 w-[40%] bg-[var(--color-gold)]" />
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TIERS.map((tier) => (
              <div key={tier.name} className={`relative p-8 max-sm:p-6 border rounded-lg transition-all hover:border-[var(--color-gold-border)] hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.5)] ${tier.featured ? 'border-[var(--color-gold-border)] bg-[linear-gradient(180deg,rgba(230,185,77,0.05),rgba(230,185,77,0.01))] lg:-translate-y-2 lg:scale-[1.03] lg:shadow-[0_20px_50px_rgba(230,185,77,0.12)]' : 'border-[var(--color-border-base)] bg-[var(--color-bg-surface)]'}`}>
                {tier.chip && <span className="absolute -top-2.5 left-8 px-2.5 py-1 bg-[var(--color-gold)] text-black font-[family-name:var(--font-mono)] text-[9px] font-bold tracking-[0.18em] uppercase rounded-[3px]">{tier.chip}</span>}
                <div className={`font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase mb-4 ${tier.featured ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'}`}>{tier.name}</div>
                <div className="text-[2.75rem] max-sm:text-[2.25rem] font-bold tracking-[-0.03em] leading-none">
                  {tier.price}{tier.priceSuffix && <small className="text-base text-[var(--color-text-muted)] font-medium">{tier.priceSuffix}</small>}
                </div>
                <div className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)] mt-2 tracking-[0.06em]">{tier.sub}</div>
                <ul className="mt-5 pt-5 border-t border-[var(--color-border-base)] flex flex-col gap-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm text-[var(--color-text-muted)] leading-snug">
                      <span className="text-[var(--color-gold)] font-[family-name:var(--font-mono)]">&#10003;</span>{f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className={`block w-full mt-6 py-3 rounded-[5px] font-[family-name:var(--font-mono)] text-[10px] font-bold tracking-[0.16em] uppercase text-center transition-all min-h-[44px] flex items-center justify-center ${tier.featured ? 'bg-[var(--color-gold)] text-black border border-[var(--color-gold)] shadow-[0_8px_24px_rgba(230,185,77,0.25)] hover:bg-[var(--color-gold-hi)]' : 'bg-transparent text-[var(--color-text-primary)] border border-[var(--color-border-strong)] hover:border-[rgba(255,255,255,0.3)]'}`}>
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── OUTRO (full viewport) ── */}
      <section className="h-screen max-sm:h-auto max-sm:py-24 flex flex-col items-center justify-center text-center relative px-10 max-sm:px-5 overflow-hidden">
        <div className="absolute bottom-[-160px] left-1/2 -translate-x-1/2 w-[1000px] h-[560px] max-w-[120vw] pointer-events-none bg-[radial-gradient(ellipse_50%_50%_at_50%_100%,rgba(230,185,77,0.13),transparent_66%)]" />
        <div className="relative font-[family-name:var(--font-mono)] text-xs tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-6">
          Steer. Don&rsquo;t drift.
        </div>
        <h2 className="relative text-[clamp(3rem,9vw,8rem)] font-bold leading-[0.94] tracking-[-0.05em]">
          Take the <em className="font-[family-name:var(--font-display-serif)] italic font-normal text-[var(--color-gold)]">HELM.</em>
        </h2>
        <p className="relative mt-6 text-[clamp(1rem,1.7vw,1.25rem)] text-[var(--color-text-muted)] max-w-[480px] leading-relaxed">
          Link your first account in two minutes. Read-only, no card. See your real exposure, your first brief, your first action.
        </p>
        <div className="relative flex gap-3.5 mt-10 flex-wrap justify-center">
          <Link href="/signup" className="font-[family-name:var(--font-mono)] text-xs font-bold tracking-[0.16em] uppercase px-7 py-4 rounded-[5px] bg-[var(--color-gold)] text-black shadow-[0_6px_22px_rgba(230,185,77,0.22)] hover:bg-[var(--color-gold-hi)] transition-all min-h-[44px] flex items-center">
            Open the terminal &rarr;
          </Link>
          <Link href="/analyze" className="font-[family-name:var(--font-mono)] text-xs font-bold tracking-[0.16em] uppercase px-7 py-4 rounded-[5px] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[rgba(255,255,255,0.28)] transition-all min-h-[44px] flex items-center">
            Analyze a ticker
          </Link>
        </div>
      </section>

      {/* ── SEO CONTENT ── */}
      <section className="border-t border-[var(--color-border-subtle)] py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-10 max-sm:px-5">
          <p className="text-sm md:text-base leading-relaxed text-[var(--color-text-secondary)]" id="what-is-helm">
            <strong className="text-[var(--color-text-primary)]">Helm Terminal</strong> is a free,
            institutional-grade financial intelligence platform for individual investors.
            It aggregates brokerage and bank accounts via Plaid (read-only), runs
            deterministic rule-based analysis over your full portfolio, and surfaces
            actionable insights: tax-loss harvesting opportunities with wash-sale
            detection, concentration risk alerts, earnings exposure, and cash flow
            changes. It covers any US-listed stock or ETF on NYSE, NASDAQ, or AMEX.
            Most features are free. Pro plans start at $4.99/month.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--color-border-subtle)] py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-10 max-sm:px-5">
          <div className="flex items-center gap-3 mb-6 md:mb-8">
            <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-gold)] tracking-wider">&sect; 00</span>
            <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-text-muted)] tracking-wider">Guides &amp; Tools</span>
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
              <Link key={item.href} href={item.href} className="group p-5 border border-[var(--color-border-subtle)] rounded-md hover:border-[var(--color-gold-border)] transition-colors">
                <div className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors mb-1">{item.title}</div>
                <div className="text-sm text-[var(--color-text-muted)]">{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              { '@type': 'Question', name: 'What is Helm Terminal?', acceptedAnswer: { '@type': 'Answer', text: 'Helm Terminal is a free, institutional-grade financial intelligence platform for individual investors. It aggregates brokerage and bank accounts via Plaid, runs deterministic rule-based analysis over your portfolio, and surfaces actionable insights like tax-loss harvesting opportunities, concentration risk, earnings exposure, and cash flow changes.' } },
              { '@type': 'Question', name: 'Is Helm Terminal free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Helm Terminal offers a free tier that includes AI stock analysis, a full portfolio dashboard with Plaid sync, net worth tracking, daily brief, and an actions inbox. Pro plans starting at $4.99/month add tax-loss harvesting with wash-sale detection, earnings exposure tracking, and unlimited analyses.' } },
              { '@type': 'Question', name: 'Is Helm Terminal safe to use with my financial accounts?', acceptedAnswer: { '@type': 'Answer', text: 'Helm Terminal connects to your accounts through Plaid, a bank-grade financial data provider. The connection is read-only. Helm can never move money, execute trades, or modify your accounts. All data is encrypted in transit (TLS 1.3) and at rest (AES-256).' } },
            ],
          }),
        }}
      />

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--color-border-base)] bg-[var(--color-bg-inset)] pt-16 pb-10">
        <div className="max-w-[1240px] mx-auto px-10 max-sm:px-5">
          <div className="grid grid-cols-2 max-sm:grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-12 max-sm:gap-8">
            <div className="col-span-2 max-sm:col-span-1 lg:col-span-1">
              <Link href="/" className="flex items-center gap-3 font-bold tracking-[0.02em] uppercase text-base">
                <HelmMark size={24} /> Helm
              </Link>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mt-5 max-w-[300px]">Steer. Don&rsquo;t drift. Take the HELM.</p>
              <p className="font-[family-name:var(--font-mono)] text-[10px] text-[#555] mt-3">Helm is not a registered investment advisor. Information is for educational purposes only.</p>
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Product</div>
              {[['Terminal', '/dashboard'], ['Analyze', '/analyze'], ['Pricing', '/pricing'], ['Brief', '/brief']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-sm text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Tools</div>
              {[['TLH Calculator', '/tools/tlh-calculator'], ['RSU Calculator', '/tools/rsu-calculator'], ['Compare', '/compare']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-sm text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Company</div>
              {[['About', '/about'], ['Security', '/security'], ['Blog', '/blog'], ['Contact', '/contact']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-sm text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Legal</div>
              {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Data Deletion', '/contact']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-sm text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-between mt-14 pt-6 border-t border-[var(--color-border-subtle)] font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-[var(--color-text-muted)]">
            <div>&copy; 2026 Helm Terminal, Inc.</div>
            <div>&bull; All systems operational</div>
          </div>
        </div>
      </footer>

    </div>
  );
}
