'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { Menu, X } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import type { TickerTapeItem } from '@/lib/ticker-tape';
import { useLivePrices } from '@/hooks/use-live-prices';
import { PriceFlash } from '@/components/price-flash';
import HeroBlock from './hero-block';

/* ─── Props ─────────────────────────────────────────────────────────────── */

interface LatestCatch {
  ticker: string;
  company: string;
  verdict: string;
  pillarClaim?: string | null;
  verbatimCite: string;
  sourceLabel: string;
  dateISO: string;
  dateLabel: string;
}

interface HomeContentProps {
  demoAnalyses: unknown[];
  tickerTape: TickerTapeItem[];
  latestCatch?: LatestCatch | null;
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
    // Crypto is named because it is genuinely supported (its own asset class,
    // its own filter in the terminal) and appeared nowhere in the marketing
    // copy, so anyone holding it had to assume it was equities only.
    cap: <><b className="text-[var(--color-gold)]">$1,270,020</b> net worth <Dot /> equities, ETFs and crypto <Dot /> reconciled nightly across every account</>,
    ambient: 'rgba(230,185,77,0.16)',
  },
  {
    img: '/product/thesis.png',
    eyebrow: 'Thesis monitoring',
    head: <>The agent watches <em>why</em> you bought. Not just the price.</>,
    cap: <>Every pillar tracked against primary sources <Dot /> the agent flags the morning one <b className="text-[var(--color-negative-text)]">weakens</b>, filing attached</>,
    ambient: 'rgba(230,185,77,0.15)',
  },
  {
    img: '/product/exposure.png',
    eyebrow: 'True exposure',
    head: <>See what you actually own. <em>Through every ETF.</em></>,
    cap: <><b>71</b> positions <Dot /> 8 sectors <Dot /> indirect ETF exposure surfaced <Dot /> filter by equities, ETFs, crypto or cash</>,
    ambient: 'rgba(230,185,77,0.15)',
  },
  {
    img: '/product/brief.png',
    eyebrow: 'The Daily Brief',
    head: <>The agent files a brief on <em>your</em> portfolio. Every morning.</>,
    cap: <>Delivered <b>9:15 AM ET</b> <Dot /> what moved, what matters, what&rsquo;s next</>,
    ambient: 'rgba(124,167,232,0.13)',
  },
  {
    img: '/product/actions.png',
    eyebrow: 'Actions',
    head: <>The agent ranks every decision by <em>what it&rsquo;s worth</em>.</>,
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

// Compare points at the head-to-head roundup. The comparison cluster
// (/best-thesis-trackers, /mythesis-alternative, /vela-alternative,
// /usethesis-alternative) was reachable only from search, so a visitor already
// weighing Helm against something else found no path to the page written for
// exactly that question, and the cluster earned no internal links from the
// site's highest-authority page.
const NAV_LINKS = [
  { label: 'Analyze', href: '/analyze' },
  { label: 'The Masthead', href: '/masthead' },
  { label: 'Compare', href: '/best-thesis-trackers' },
  { label: 'Pricing', href: '#pricing' },
];

/* ─── Pricing ───────────────────────────────────────────────────────────── */

// Pro leads and is the wider column. Two equal boxes made neither read as the
// answer, which is what the three-tier layout was hiding.
// The badge says "Recommended", not "Most popular". Free has vastly more users
// than Pro, so "most popular" would be false, and an unverifiable claim about
// other people is the one kind of proof this site does not use.
//
// `anchor` puts the comparison where the price is, rather than leaving it to
// the section header. The figure is arithmetic on a stated fee, not a
// competitor's advertised price, so it cannot go stale.
const TIERS = [
  { name: 'Pro', price: '$20', priceSuffix: '/mo', sub: 'Free for 14 days, card required', anchor: 'A 1% advisory fee on a $1M book is $10,000 a year. This is $240.', badge: 'Recommended', features: ['Everything in Free', 'Thesis monitoring with cited evidence', 'Twelve months of history on day one', 'Tax center with TLH', 'Earnings exposure', 'Conviction-led tailored brief'], cta: 'Start free trial', featured: true },
  { name: 'Free', price: '$0', priceSuffix: ' forever', sub: 'No card, no expiry', anchor: null, badge: null, features: ['Full terminal access', 'AI analysis, any US ticker', 'Connected brokerages', 'Daily brief', 'Actions inbox', 'Portfolio Wrapped'], cta: 'Open the terminal', featured: false },
];

/* ─── The four surfaces ─────────────────────────────────────────────────── */

// Order is deliberate and thesis is last. Every other surface applies to the
// whole book; thesis applies to the single names in it. Leading with it is
// what makes the product read as narrower than it is.
const SURFACES = [
  {
    name: 'Exposure',
    lead: 'What you actually own, through every ETF and fund.',
    detail: 'Concentration, sector weight, and the single names hiding inside your index positions.',
  },
  {
    name: 'Taxes',
    lead: 'Harvestable losses, and the wash-sale windows around them.',
    detail: 'Lot level, across every linked account at once. Arithmetic, not a model.',
  },
  {
    name: 'Earnings',
    lead: 'What reports next, and how much of your book it touches.',
    detail: 'Exposure to the print before it lands, not a calendar you have to read.',
  },
  {
    name: 'Thesis',
    lead: 'The reasons you bought, checked against the filing.',
    detail: 'Every pillar tested against primary sources, with the dated line that moved it.',
  },
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

/**
 * The 26px gold bar that sits left of every section eyebrow, drawn rather than
 * printed. Transform-only, so it stays on the compositor, and it inherits
 * useReveal's reduced-motion check: with reduce set, inView is true from the
 * first frame and the bar is simply there.
 *
 * Deliberately only on section eyebrows. Every hairline on the page animating
 * at once stops being a quiet touch and becomes a light show.
 */
function EyebrowRule() {
  const { ref, inView } = useReveal(1);
  return (
    <div
      ref={ref}
      aria-hidden
      className="w-[26px] h-px bg-[var(--color-gold)] shrink-0"
      style={{
        transform: inView ? 'scaleX(1)' : 'scaleX(0)',
        transformOrigin: 'left',
        transition: 'transform 0.55s cubic-bezier(0.16,1,0.3,1)',
      }}
    />
  );
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

export default function HomeContent({ tickerTape, latestCatch }: HomeContentProps) {
  const router = useRouter();
  const [activeScene, setActiveScene] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [railVisible, setRailVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // tickerInput / submitAnalyze lived here for the old ANALYZE section. The
  // hero owns that input now, so they went with it.

  // Live overlay for the ticker tape: poll the public quotes endpoint
  // every 60s. Non-whitelisted (trending) tickers keep their SSR values.
  const tapeSymbols = useMemo(() => tickerTape.map((t) => t.symbol), [tickerTape]);
  const { quotes: liveTapeQuotes } = useLivePrices(tapeSymbols, 60_000, '/api/market/quotes/public');
  const liveTape = useMemo(() => tickerTape.map((t) => {
    const q = liveTapeQuotes[t.symbol];
    if (!q) return t;
    return {
      ...t,
      price: q.price.toFixed(2),
      change: q.dayChangePct != null ? `${q.dayChangePct >= 0 ? '+' : ''}${q.dayChangePct.toFixed(2)}%` : t.change,
      positive: q.dayChangePct != null ? q.dayChangePct >= 0 : t.positive,
    };
  }), [tickerTape, liveTapeQuotes]);

  // Detect reduced motion preference
  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Scroll-driven scene engine.
  //
  // The measuring is rAF-throttled: getBoundingClientRect forces a synchronous
  // layout, and running it on every scroll event meant one forced reflow per
  // event during the one part of the page that asks people to scroll slowly.
  // Coalescing to one read per frame gives the same result for a fraction of
  // the work, and setState is a no-op when the scene has not changed.
  useEffect(() => {
    let frame = 0;

    function measure() {
      frame = 0;
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

    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    measure();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // The manual preloader that used to live here fetched the raw PNGs, which
  // bypassed image optimisation entirely and pulled ~2MB before first scroll.
  // next/image handles this now: priority on the first scene, lazy on the rest.

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
      {liveTape.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[61] overflow-hidden border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)] h-[32px] max-sm:hidden" aria-hidden="true">
          <div className="tape-track inline-flex items-center h-full whitespace-nowrap animate-tape-scroll">
            {[...liveTape, ...liveTape, ...liveTape].map((t, i) => (
              <span key={`${t.symbol}-${i}`} className="inline-flex items-center gap-2.5 px-6 font-[family-name:var(--font-mono)] text-[12px]">
                <span className="text-[var(--color-gold)] font-bold tracking-[0.04em]">{t.symbol}</span>
                <span className="text-[var(--color-text-primary)] tabular-nums"><PriceFlash value={Number(t.price)}>{t.price}</PriceFlash></span>
                <span className={`tabular-nums font-medium ${t.positive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative-text)]'}`}>{t.change}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── NAV ── */}
      <nav className="fixed top-0 sm:top-[32px] left-0 right-0 z-[60] h-[60px] flex items-center justify-between px-10 max-sm:px-5 pointer-events-none" style={{ background: 'linear-gradient(to bottom, var(--color-bg-base), transparent)' }}>
        <Link href="/" className="flex items-center gap-[10px] font-bold tracking-[0.03em] uppercase text-[15px] pointer-events-auto">
          <HelmMark size={22} />
          Helm
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8 pointer-events-auto">
          {NAV_LINKS.map((link) => (
            /* py-3 -my-3 lifts the hit area from 18px to 44px without moving
               the text or changing the nav's rhythm */
            <Link key={link.label} href={link.href} className="py-3 -my-3 font-[family-name:var(--font-mono)] text-[12px] tracking-[0.14em] uppercase text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4 pointer-events-auto">
          <Link href="/signup" onClick={() => posthog.capture('home_cta_clicked', { cta: 'nav_signup' })} className="font-[family-name:var(--font-mono)] text-[10px] font-bold tracking-[0.16em] uppercase text-black bg-[var(--color-gold)] px-4 py-[9px] rounded-[5px] hover:bg-[var(--color-gold-hi)] transition-colors">
            Open terminal &rarr;
          </Link>
          {/* Mobile hamburger */}
          <button
            className="md:hidden w-11 h-11 -mr-2 grid place-items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
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
            <Link key={link.label} href={link.href} onClick={() => setMobileMenuOpen(false)} className="block py-3 text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              {link.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            Log in
          </Link>
        </div>
      )}

      <main>
      {/* ── HERO ── */}
      {/* The standalone ANALYZE ANY TICKER section that used to sit here is
          gone: the hero carries the ticker input now, so keeping it would ask
          the same thing twice within one scroll. */}
      <HeroBlock
        latestCatch={latestCatch ?? null}
        onAnalyze={(t) => posthog.capture('home_cta_clicked', { cta: 'hero_scan', ticker: t })}
      />

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
            <div className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.26em] uppercase text-[var(--color-gold)] mb-4">
              {scene.eyebrow}
            </div>
            <h2 className="text-[clamp(1.625rem,3.6vw,3.25rem)] font-bold tracking-[-0.035em] leading-[1.05] max-w-[18ch] mx-auto [&_em]:not-italic [&_em]:font-bold [&_em]:text-[var(--color-gold)]">
              {scene.head}
            </h2>
          </div>

          {/* The MacBook */}
          <div className="relative z-[2] flex justify-center items-center py-3" style={{ perspective: '2400px' }}>
            <div className="w-[min(1360px,95vw,104vh)]" style={{ transform: 'rotateX(9deg)', transformOrigin: 'center 65%' }}>
              <div className="relative rounded-[clamp(12px,1.5vw,22px)] p-[1.6%] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_60px_120px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.05),0_0_90px_rgba(230,185,77,0.05)]" style={{ background: 'linear-gradient(160deg,var(--device-body-hi),var(--device-body-lo))' }}>
                <span className="absolute top-[0.7%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--device-camera)] shadow-[0_0_0_2px_var(--device-camera-ring)]" />
                <div className="relative rounded-[clamp(5px,0.7vw,9px)] overflow-hidden aspect-video bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                  {/* next/image so the 3600px source is negotiated down to
                      AVIF/WebP at the width actually on screen. The raw PNG is
                      about 1MB; this lands under 100KB for the same pixels. */}
                  <Image
                    key={`shot-${activeScene}`}
                    src={scene.img}
                    alt={SCENE_ALT[scene.eyebrow] || `Helm ${scene.eyebrow} view`}
                    fill
                    sizes="(max-width: 1024px) 100vw, min(1360px, 95vw, 104vh)"
                    quality={82}
                    priority={activeScene === 0}
                    className={`object-cover object-top ${reducedMotion ? '' : 'animate-[scenePop_0.3s_cubic-bezier(0.22,1,0.36,1)_both]'}`}
                  />
                  <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_60px_rgba(0,0,0,0.4)]" />
                </div>
              </div>
              <div className="relative w-[106%] mx-auto h-[clamp(9px,1.15vw,17px)] rounded-b-[clamp(8px,1vw,14px)] shadow-[0_34px_44px_rgba(0,0,0,0.55)]" style={{ background: 'linear-gradient(var(--device-base-hi),var(--device-base-lo) 62%)' }}>
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[rgba(0,0,0,0.55)]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[13%] h-[46%] rounded-b-[7px]" style={{ background: 'linear-gradient(var(--device-notch-hi),var(--device-notch-lo))' }} />
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
              <div className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.26em] uppercase text-[var(--color-gold)] mb-3">{s.eyebrow}</div>
              <h2 className="text-2xl font-bold tracking-[-0.025em] leading-[1.1] [&_em]:not-italic [&_em]:font-bold [&_em]:text-[var(--color-gold)]">
                {s.head}
              </h2>
            </div>
            <div className="rounded-lg overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
              <Image
                src={s.img}
                alt={SCENE_ALT[s.eyebrow] || `Helm ${s.eyebrow} view`}
                width={3600}
                height={2025}
                /* these cards only render below md, so cap the candidate width
                   rather than letting 100vw reach for the 3600 entry */
                sizes="(max-width: 1024px) 100vw, 1024px"
                quality={78}
                loading="lazy"
                className="w-full h-auto block"
              />
            </div>
            <div className="font-[family-name:var(--font-mono)] text-[13px] tracking-[0.04em] text-[var(--color-text-muted)] mt-4 text-center flex gap-2 items-center flex-wrap justify-center [&_b]:text-[var(--color-text-primary)]">
              {s.cap}
            </div>
          </Reveal>
        ))}
      </section>

      {/* ── Scene progress rail (right edge, desktop only) ── */}
      {railVisible && (
        <div className="fixed right-[26px] top-1/2 -translate-y-1/2 z-40 flex-col gap-3.5 hidden md:flex" role="navigation" aria-label="Product tour scenes">
          {SCENES.map((s, i) => (
            /* the dot stays 9px; the button around it is 44px so it can
               actually be hit. It was a 9x9 target before. */
            <button
              key={i}
              onClick={() => scrollToScene(i)}
              aria-label={`Go to ${s.eyebrow}`}
              className="w-11 h-11 -my-[17.5px] grid place-items-center bg-transparent border-0 cursor-pointer"
            >
              <span
                className={`w-[9px] h-[9px] rounded-full transition-all ${i === activeScene ? 'bg-[var(--color-gold)] shadow-[0_0_12px_rgba(230,185,77,0.7)]' : 'bg-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.4)]'}`}
              />
            </button>
          ))}
        </div>
      )}

      {/* ── TRANSPARENCY RECEIPT ── */}
      <section className="py-[120px] max-sm:py-16 max-w-[1240px] mx-auto px-10 max-sm:px-5">
        <Reveal>
          <div className="max-w-[720px] mb-16">
            <div className="flex items-center gap-3.5 mb-5 font-[family-name:var(--font-mono)] text-[12px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
              <EyebrowRule />
              Transparency
            </div>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.035em] leading-[1.05]">
              Built to be <em className="not-italic font-bold text-[var(--color-gold)]">second-guessed.</em>
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
                <span className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.1em] text-[var(--color-text-muted)]">Conviction <b className="text-[var(--color-positive)]">High &middot; 82/100</b></span>
              </div>
              <div className="p-5">
                {[
                  { tag: 'Bull', text: 'Data-center revenue +154% YoY; Blackwell ramp ahead of guidance per Q1 FY26 call.' },
                  { tag: 'Bear', text: 'Forward P/E 38x prices in flawless execution; customer concentration in top 4 hyperscalers.' },
                  { tag: 'Risk', text: 'Export-control exposure flagged in latest 10-Q risk factors.' },
                ].map((row) => (
                  <div key={row.tag} className="flex gap-3 py-3 border-b border-[var(--color-border-subtle)] last:border-b-0 text-[15px] text-[var(--color-text-muted)] items-start">
                    <span className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.14em] uppercase text-[var(--color-gold)] border border-[var(--color-gold-border)] px-2 py-1 rounded-[3px] whitespace-nowrap">{row.tag}</span>
                    <span>{row.text}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3.5 bg-[var(--color-bg-surface)] border-t border-[var(--color-border-base)] font-[family-name:var(--font-mono)] text-[10px] tracking-[0.08em] text-[var(--color-text-muted)] flex gap-2 flex-wrap">
                <b className="text-[var(--color-text-secondary)]">Sources:</b> SEC 10-Q (filed May 28) &middot; Finazon EOD &middot; SEC EDGAR fundamentals &middot; generated 2h ago
              </div>
            </div>
            {/* Copy */}
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.18em] uppercase text-[var(--color-gold)] mb-4">How it earns trust</div>
              <h3 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.025em] leading-[1.12] mb-4">Cited, timestamped, falsifiable.</h3>
              <p className="text-base leading-relaxed text-[var(--color-text-muted)] max-w-[440px] mb-5">
                Helm never hands you a verdict without showing its work. Pull up any bull or bear case and you&rsquo;ll see the exact filing line, the data vendor, and a conviction score that goes on the record.
              </p>
              <ul className="flex flex-col gap-3 list-none">
                {['Primary sources linked inline (SEC EDGAR, Finazon)', 'Staleness shown, so you always know how fresh it is', 'Not investment advice, and never pretends to be'].map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] text-[var(--color-text-primary)] items-start">
                    <span className="text-[var(--color-gold)] font-[family-name:var(--font-mono)]">&rarr;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── REAL CITED CATCH STRIP (shown, not told) ── */}
      {latestCatch && (() => {
        const broke = String(latestCatch.verdict).toLowerCase().includes('contradict');
        const verdictLabel = broke ? 'Broke' : 'Held';
        return (
          <section className="max-w-[1240px] mx-auto px-10 max-sm:px-5 pb-[120px] max-sm:pb-16 -mt-[60px] max-sm:-mt-8">
            <Reveal>
              <div className="border border-[var(--color-border-base)] rounded-[10px] bg-[var(--color-bg-surface)] overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--color-border-base)] font-[family-name:var(--font-mono)] text-[10px] tracking-[0.16em] uppercase text-[var(--color-text-muted)] flex-wrap">
                  <span className="w-[7px] h-[7px] rounded-full bg-[var(--color-gold)] shadow-[0_0_10px_var(--color-gold)]" />
                  What the agent caught
                  <span className="ml-auto text-[var(--color-text-secondary)]">{latestCatch.sourceLabel} &middot; {latestCatch.dateLabel}</span>
                </div>
                <div className="p-8 max-sm:p-5 grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-7 max-sm:gap-5 items-start">
                  <div className="flex items-center gap-3 lg:flex-col lg:items-start">
                    <span className="font-[family-name:var(--font-mono)] font-bold text-[var(--color-gold)] tracking-[0.06em] text-[19px]">{latestCatch.ticker}</span>
                    <span className={`font-[family-name:var(--font-mono)] text-[10px] tracking-[0.14em] uppercase border px-2 py-1 rounded-[3px] whitespace-nowrap ${broke ? 'text-[var(--color-negative-text)] border-[rgba(248,113,113,0.3)]' : 'text-[var(--color-positive)] border-[rgba(74,222,128,0.3)]'}`}>{verdictLabel}</span>
                  </div>
                  <div>
                    {/* the cited extract is evidence, so it is set like the one
                        in the hero: page sans, medium weight, no flourish */}
                    <blockquote className="text-[clamp(1.0625rem,1.7vw,1.375rem)] leading-snug text-[var(--color-text-primary)] font-medium tracking-[-0.015em]">
                      &ldquo;{latestCatch.verbatimCite}&rdquo;
                    </blockquote>
                    <div className="mt-4 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em] text-[var(--color-text-muted)]">
                      {latestCatch.company} &middot; {latestCatch.sourceLabel} &middot; {latestCatch.dateLabel}
                    </div>
                    <div className="mt-1.5 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.06em] text-[var(--color-text-muted)]">
                      Filed by the Helm agent &middot; {latestCatch.dateLabel}
                    </div>
                    <Link
                      href="/masthead"
                      onClick={() => posthog.capture('home_cta_clicked', { cta: 'catch_strip' })}
                      className="inline-flex items-center gap-1.5 mt-5 font-[family-name:var(--font-mono)] text-[12px] font-bold tracking-[0.12em] uppercase text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors min-h-[44px]"
                    >
                      See the full record &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </section>
        );
      })()}

      {/* ── SECURITY — Permission panel ── */}
      <section className="py-[120px] max-sm:py-16 max-w-[1240px] mx-auto px-10 max-sm:px-5">
        <Reveal>
          <div className="max-w-[720px] mb-16">
            <div className="flex items-center gap-3.5 mb-5 font-[family-name:var(--font-mono)] text-[12px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
              <EyebrowRule />
              Security
            </div>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.035em] leading-[1.05]">
              Read-only by design. <em className="not-italic font-bold text-[var(--color-gold)]">We can&rsquo;t touch your money.</em>
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
                <div className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.14em] uppercase text-[var(--color-positive)] mb-4 flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-[5px] bg-[rgba(74,222,128,0.12)] border border-[rgba(74,222,128,0.3)] text-[var(--color-positive)] inline-flex items-center justify-center text-[13px] font-[family-name:var(--font-mono)]">&#10003;</span>
                  Granted &middot; read-only
                </div>
                <ul className="list-none m-0 p-0">
                  {['Account balances', 'Holdings and positions', 'Cost basis and tax lots', 'Transaction history'].map((item) => (
                    <li key={item} className="text-base py-3 border-b border-[var(--color-border-subtle)] last:border-b-0 flex items-center gap-3 text-[var(--color-text-primary)]">
                      <span className="font-[family-name:var(--font-mono)] text-[15px] w-4 text-[var(--color-positive)]">&#10003;</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-8 max-sm:p-5 border-t md:border-t-0 border-[var(--color-border-base)]">
                <div className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.14em] uppercase text-[var(--color-negative-text)] mb-4 flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-[5px] bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.28)] text-[var(--color-negative-text)] inline-flex items-center justify-center text-[13px] font-[family-name:var(--font-mono)]">&#10007;</span>
                  Never granted
                </div>
                <ul className="list-none m-0 p-0">
                  {['Place or cancel trades', 'Move or transfer money', 'Withdraw funds', 'Change account settings'].map((item) => (
                    <li key={item} className="text-base py-3 border-b border-[var(--color-border-subtle)] last:border-b-0 flex items-center gap-3 text-[var(--color-text-muted)]">
                      <span className="font-[family-name:var(--font-mono)] text-[15px] w-4 text-[var(--color-negative-text)]">&#10007;</span>
                      <span className="relative"><span className="absolute left-0 right-0 top-[54%] h-px bg-[rgba(248,113,113,0.35)]" />{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[var(--color-border-base)] bg-[var(--color-bg-surface)] font-[family-name:var(--font-mono)] text-[12px] tracking-[0.03em] text-[var(--color-text-muted)] leading-relaxed">
              Credentials are tokenized by Plaid and <b className="text-[var(--color-text-secondary)]">never stored by Helm</b> &middot; encrypted AES-256 at rest, TLS 1.3 in transit &middot; unlink any account in one click and request full deletion anytime.
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── THE FOUR SURFACES (sticky stack) ──
          Sits between the stage and the ask on purpose. The stage shows the
          product; this states what the four surfaces are, at equal weight,
          immediately before the price.

          It is here to fix a positioning problem structurally rather than by
          rewording: listed vertically, thesis reads as the product and the
          other three read as supporting features. Stacked, each one holds the
          viewport in turn and they land equal.

          Pure CSS position:sticky. No scroll listener, no JavaScript, and it
          degrades to four ordinary stacked cards wherever sticky is not
          supported. Offsets shrink on small viewports, where four cards at the
          desktop offset would crowd the top of the screen. */}
      <section className="py-[120px] max-sm:py-16 max-w-[1240px] mx-auto px-10 max-sm:px-5">
        <Reveal>
          <div className="flex items-center gap-3.5 mb-5 font-[family-name:var(--font-mono)] text-[12px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
            <EyebrowRule />
            What the agent covers
          </div>
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.035em] leading-[1.05] max-w-[20ch]">
            Four surfaces. <em className="not-italic font-bold text-[var(--color-gold)]">One book.</em>
          </h2>
        </Reveal>

        <div className="relative mt-14 max-w-[840px]">
          {SURFACES.map((s, i) => (
            <div
              key={s.name}
              className="sticky rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-inset)] p-9 max-sm:p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.55)]"
              style={{
                top: `calc(var(--stack-top, 96px) + ${i} * var(--stack-step, 16px))`,
                // The last card carries no trailing margin. With one, the
                // section ended on a stretch of empty black between the stack
                // releasing and the pricing header arriving.
                marginBottom: i === SURFACES.length - 1 ? 0 : 22,
              }}
            >
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] text-[var(--color-gold)]">
                0{i + 1}
              </div>
              <div className="mt-3 text-[clamp(1.5rem,2.6vw,1.95rem)] font-bold tracking-[-0.025em]">{s.name}</div>
              <p className="mt-2.5 mb-0 max-w-[54ch] text-[clamp(0.95rem,1.4vw,1.08rem)] leading-[1.5]">{s.lead}</p>
              <p className="mt-2 mb-0 max-w-[56ch] text-[14px] leading-[1.6] text-[var(--color-text-secondary)]">{s.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-[120px] max-sm:py-16 max-w-[1240px] mx-auto px-10 max-sm:px-5">
        <Reveal>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-10">
            <div>
              <div className="flex items-center gap-3.5 mb-5 font-[family-name:var(--font-mono)] text-[12px] font-medium tracking-[0.22em] uppercase text-[var(--color-gold)]">
                <EyebrowRule />
                Pricing
              </div>
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.035em] leading-[1.05]">
                One product. <em className="not-italic font-bold text-[var(--color-gold)]">Zero percent of AUM.</em>
              </h2>
            </div>
          </div>
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-[1.15fr_0.85fr] gap-3 max-w-[880px] items-start">
            {TIERS.map((tier) => (
              <div key={tier.name} className={`relative p-8 max-sm:p-6 border rounded-lg transition-all hover:border-[var(--color-gold-border)] hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.5)] ${tier.featured ? 'border-[var(--color-gold-border)] bg-[linear-gradient(180deg,rgba(230,185,77,0.05),rgba(230,185,77,0.01))] shadow-[0_20px_50px_rgba(230,185,77,0.10)]' : 'border-[var(--color-border-base)] bg-[var(--color-bg-surface)]'}`}>
                {tier.badge && (
                  <span className="absolute -top-2.5 right-6 font-[family-name:var(--font-mono)] text-[9px] font-bold tracking-[0.18em] uppercase px-2.5 py-1 rounded-full bg-[var(--color-gold)] text-black">
                    {tier.badge}
                  </span>
                )}
                <div className={`font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase mb-4 ${tier.featured ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'}`}>{tier.name}</div>
                <div className="text-[2.75rem] max-sm:text-[2.25rem] font-bold tracking-[-0.03em] leading-none">
                  {tier.price}{tier.priceSuffix && <small className="text-base text-[var(--color-text-muted)] font-medium">{tier.priceSuffix}</small>}
                </div>
                <div className="font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)] mt-2 tracking-[0.06em]">{tier.sub}</div>
                {tier.anchor && (
                  <p className="text-[13px] leading-[1.5] text-[var(--color-text-secondary)] mt-2.5 mb-0 max-w-[34ch]">{tier.anchor}</p>
                )}
                <ul className="mt-5 pt-5 border-t border-[var(--color-border-base)] flex flex-col gap-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2 text-[15px] text-[var(--color-text-muted)] leading-snug">
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
        <div className="relative font-[family-name:var(--font-mono)] text-[13px] tracking-[0.3em] uppercase text-[var(--color-text-muted)] mb-6">
          Steer. Don&rsquo;t drift.
        </div>
        <h2 className="relative text-[clamp(3rem,9vw,8rem)] font-bold leading-[0.94] tracking-[-0.05em]">
          Take the <em className="not-italic font-bold text-[var(--color-gold)]">HELM.</em>
        </h2>
        <p className="relative mt-6 text-[clamp(1rem,1.7vw,1.25rem)] text-[var(--color-text-muted)] max-w-[480px] leading-relaxed">
          Link your first account in two minutes. Read-only, no card. See your real exposure, your first brief, your first action.
        </p>
        <div className="relative flex gap-3.5 mt-10 flex-wrap justify-center">
          <Link href="/signup" onClick={() => posthog.capture('home_cta_clicked', { cta: 'outro_primary_signup' })} className="font-[family-name:var(--font-mono)] text-[13px] font-bold tracking-[0.16em] uppercase px-7 py-4 rounded-[5px] bg-[var(--color-gold)] text-black shadow-[0_6px_22px_rgba(230,185,77,0.22)] hover:bg-[var(--color-gold-hi)] transition-all min-h-[44px] flex items-center">
            Open the terminal &rarr;
          </Link>
          <Link href="/analyze" onClick={() => posthog.capture('home_cta_clicked', { cta: 'outro_secondary_analyze' })} className="font-[family-name:var(--font-mono)] text-[13px] font-bold tracking-[0.16em] uppercase px-7 py-4 rounded-[5px] border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:border-[rgba(255,255,255,0.28)] transition-all min-h-[44px] flex items-center">
            Analyze a ticker
          </Link>
        </div>
        {/* The data-safety objection is answered thoroughly further up the page,
            by the permission table. The other objection a solo-founder product
            gets is "will this still be here next year", and the honest answer
            to it lived only on /about, three clicks from the button people
            actually press. */}
        <p className="relative mt-8 text-[13px] leading-[1.6] text-[var(--color-text-secondary)] max-w-[440px]">
          Run by one person, on purpose. Your data is exportable and{' '}
          <Link href="/data-deletion" className="underline decoration-[var(--color-border-strong)] underline-offset-2 hover:text-[var(--color-text-primary)] transition-colors">
            deletable in one click
          </Link>
          , whatever happens to Helm.{' '}
          <Link href="/about" className="underline decoration-[var(--color-border-strong)] underline-offset-2 hover:text-[var(--color-text-primary)] transition-colors">
            Who builds it
          </Link>
          .
        </p>
      </section>

      {/* ── SEO CONTENT ── */}
      <section className="border-t border-[var(--color-border-subtle)] py-12 md:py-16">
        <div className="max-w-3xl mx-auto px-10 max-sm:px-5">
          <p className="text-[15px] md:text-base leading-relaxed text-[var(--color-text-secondary)]" id="what-is-helm">
            <strong className="text-[var(--color-text-primary)]">Helm Terminal</strong> is a free,
            institutional-grade financial intelligence platform for individual investors.
            It aggregates brokerage and bank accounts via Plaid (read-only), runs
            deterministic rule-based analysis over your full portfolio, and surfaces
            actionable insights: tax-loss harvesting opportunities with wash-sale
            detection, concentration risk alerts, earnings exposure, and cash flow
            changes. Its flagship capability is <strong className="text-[var(--color-text-primary)]">thesis monitoring</strong>: you write the reasons (the &ldquo;pillars&rdquo;) you own each stock, and Helm&rsquo;s agent watches those reasons against SEC filings, earnings, and news, then flags you when one weakens, the failure mode known as thesis drift, citing the exact dated filing. It covers any US-listed stock or ETF on NYSE, NASDAQ, or AMEX.
            Most features are free. Pro is $20/mo.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--color-border-subtle)] py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-10 max-sm:px-5">
          <div className="flex items-center gap-3 mb-6 md:mb-8">
            <span className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-gold)] tracking-wider">&sect; 00</span>
            <span className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted)] tracking-wider">Guides &amp; Tools</span>
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
                <div className="text-[15px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors mb-1">{item.title}</div>
                <div className="text-[15px] text-[var(--color-text-muted)]">{item.desc}</div>
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
              { '@type': 'Question', name: 'What is Helm Terminal?', acceptedAnswer: { '@type': 'Answer', text: 'Helm Terminal is a free, institutional-grade financial intelligence platform for individual investors. It aggregates brokerage and bank accounts via Plaid, runs deterministic rule-based analysis over your portfolio, and surfaces actionable insights like tax-loss harvesting opportunities, concentration risk, earnings exposure, and cash flow changes. Its flagship capability is thesis monitoring: it tracks the specific reasons you own each stock against live SEC filings and news, and alerts you when your reasoning weakens or breaks (thesis drift), citing the exact dated source.' } },
              { '@type': 'Question', name: 'What tool tells me when my investment thesis breaks?', acceptedAnswer: { '@type': 'Answer', text: 'Helm Terminal does this through thesis monitoring. You write the pillars behind each position, and Helm\'s agent watches them against SEC filings, earnings, and news, then alerts you with a verbatim, dated citation the moment a pillar weakens or breaks (thesis drift). It is live and shipped, not a waitlist.' } },
              { '@type': 'Question', name: 'What is an agentic portfolio terminal?', acceptedAnswer: { '@type': 'Answer', text: 'An agentic portfolio terminal continuously watches your whole portfolio on your behalf, the exposure, the taxes, and the reasons behind each position, and surfaces what changed and what to do, instead of just charting what you own. Helm Terminal is an agentic terminal: an AI analyst on every position, monitoring each thesis against primary sources.' } },
              { '@type': 'Question', name: 'Is Helm Terminal free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Helm Terminal offers a free tier that includes AI stock analysis, a full portfolio dashboard with Plaid sync, net worth tracking, daily brief, and an actions inbox. Pro at $20/month adds thesis monitoring with cited evidence, the agent, the Thesis Builder, the factor lens, earnings exposure tracking, and the tax center.' } },
              { '@type': 'Question', name: 'Is Helm Terminal safe to use with my financial accounts?', acceptedAnswer: { '@type': 'Answer', text: 'Helm Terminal connects to your accounts through Plaid, a bank-grade financial data provider. The connection is read-only. Helm can never move money, execute trades, or modify your accounts. All data is encrypted in transit (TLS 1.3) and at rest (AES-256).' } },
            ],
          }),
        }}
      />

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[var(--color-border-base)] bg-[var(--color-bg-inset)] pt-16 pb-10">
        <div className="max-w-[1240px] mx-auto px-10 max-sm:px-5">
          <div className="grid grid-cols-2 max-sm:grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.15fr_1fr] gap-x-8 gap-y-12 max-sm:gap-8">
            <div className="col-span-2 max-sm:col-span-1 lg:col-span-1">
              <Link href="/" className="flex items-center gap-3 font-bold tracking-[0.02em] uppercase text-base">
                <HelmMark size={24} /> Helm
              </Link>
              <p className="text-[15px] text-[var(--color-text-muted)] leading-relaxed mt-5 max-w-[300px]">Steer. Don&rsquo;t drift. Take the HELM.</p>
              {/* was #555, a hard-coded grey that measured 2.72:1 on the page
                  background. The token measures 6.3:1 and is the same grey used
                  for every other piece of fine print. */}
              <p className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-text-secondary)] mt-3">Helm is not a registered investment advisor. Information is for educational purposes only.</p>
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Product</div>
              {[['Terminal', '/dashboard'], ['Analyze', '/analyze'], ['Pricing', '/pricing'], ['Brief', '/brief']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-[15px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Tools</div>
              {[['TLH Calculator', '/tools/tlh-calculator'], ['RSU Calculator', '/tools/rsu-calculator'], ['Compare', '/compare']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-[15px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Company</div>
              {[['About', '/about'], ['Security', '/security'], ['Blog', '/blog'], ['Contact', '/contact']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-[15px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Compare</div>
              {[['Thesis trackers', '/best-thesis-trackers'], ['vs MyThesis', '/mythesis-alternative'], ['vs Vela', '/vela-alternative'], ['vs UseThesis', '/usethesis-alternative'], ['What is thesis monitoring', '/thesis-monitoring']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-[15px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
              ))}
            </div>
            <div>
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.18em] uppercase text-[var(--color-text-muted)] mb-4">Legal</div>
              {/* Data Deletion pointed at /contact, but /data-deletion exists and
                  is the page this label promises. */}
              {[['Privacy', '/privacy'], ['Terms', '/terms'], ['Data Deletion', '/data-deletion']].map(([l, h]) => (
                <Link key={l} href={h} className="block text-[15px] text-[var(--color-text-secondary)] py-1.5 hover:text-[var(--color-text-primary)] transition-colors">{l}</Link>
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
