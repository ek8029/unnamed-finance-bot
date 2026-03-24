'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  PieChart,
  LineChart,
  Zap,
  Lock,
  Eye,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import {
  InteractiveGrid,
  StaggerText,
  TiltCard,
  CountUp,
  TypingText,
  FadeIn,
} from './effects';

/* ─── Static data ───────────────────────────────────────────────────────── */

const comparisons = [
  { feature: 'Market Data', legacy: '15-min delay', helm: 'Real-time' },
  { feature: 'Portfolio Analysis', legacy: 'Generic screeners', helm: 'Your positions' },
  { feature: 'Tax Optimization', legacy: 'Manual spreadsheets', helm: 'Automated detection' },
  { feature: 'Risk Alerts', legacy: 'Email newsletters', helm: 'Prioritized inbox' },
  { feature: 'Annual Cost', legacy: '$2,000 – $24,000', helm: 'Free to start' },
  { feature: 'Time to Value', legacy: 'Days to weeks', helm: 'Under 2 minutes' },
];

const features = [
  {
    icon: PieChart,
    iconColor: 'text-[var(--color-gold)]',
    glowColor: 'rgba(230,185,77,0.15)',
    title: 'Portfolio Intelligence',
    desc: 'Concentration risk, sector exposure, and performance attribution across all your positions. Know exactly where your money sits.',
    metric: 'AAPL 34%',
    metricLabel: 'above 25% threshold',
    metricColor: 'text-[var(--color-warning)]',
  },
  {
    icon: LineChart,
    iconColor: 'text-[var(--color-positive)]',
    glowColor: 'rgba(74,222,128,0.15)',
    title: 'Tax-Loss Engine',
    desc: 'Automated harvesting detection, wash-sale compliance, and estimated savings — updated daily across your portfolio.',
    metric: '$2,400',
    metricLabel: 'harvestable losses',
    metricColor: 'text-[var(--color-positive)]',
  },
  {
    icon: Zap,
    iconColor: 'text-[var(--color-warning)]',
    glowColor: 'rgba(251,191,36,0.15)',
    title: 'Actions Inbox',
    desc: 'Prioritized, data-backed alerts for earnings events, risk threshold breaches, and cash flow anomalies.',
    metric: '3 actions',
    metricLabel: 'this week',
    metricColor: 'text-[var(--color-text-primary)]',
  },
];

const trustBadges = [
  { Icon: Lock, text: 'Bank-level encryption' },
  { Icon: Eye, text: 'Read-only access' },
  { Icon: Shield, text: 'Your data is never sold' },
];

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function LandingTestPage() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -150]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[var(--color-text-primary)] overflow-x-hidden">
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
        className="fixed top-[15%] left-[5%] w-[600px] h-[600px] rounded-full pointer-events-none z-0 opacity-[0.04] blur-[150px] bg-[var(--color-gold)]"
        style={{ animation: 'drift-a 25s ease-in-out infinite' }}
      />
      <div
        className="fixed bottom-[10%] right-[5%] w-[500px] h-[500px] rounded-full pointer-events-none z-0 opacity-[0.025] blur-[120px] bg-[var(--color-positive)]"
        style={{ animation: 'drift-b 30s ease-in-out infinite' }}
      />

      {/* ════════════════════════════════════════════════════════════════════
          STICKY NAV
          ════════════════════════════════════════════════════════════════════ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[rgba(10,10,10,0.85)] backdrop-blur-xl border-b border-white/[0.06]'
            : 'bg-transparent'
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
            className="px-5 py-2 bg-[var(--color-gold)] text-[#0A0A0A] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all hover:bg-[var(--color-gold-hi)] hover:shadow-[0_0_30px_rgba(230,185,77,0.35)]"
          >
            Access Terminal
          </Link>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════
          HERO
          ════════════════════════════════════════════════════════════════════ */}
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
            className="w-[900px] h-[900px]"
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
            className="opacity-[0.04]"
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
          {/* Three-line stagger headline */}
          <div className="text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] font-black uppercase tracking-tighter leading-[0.88] mb-8">
            <StaggerText text="YOUR WEALTH." delay={300} className="block" />
            <StaggerText text="YOUR RULES." delay={700} className="block" />
            <StaggerText
              text="YOUR HELM."
              delay={1100}
              goldWord="HELM"
              glowClass="glow-breathe"
              className="block"
            />
          </div>

          <FadeIn delay={2000}>
            <p className="text-sm md:text-base text-[var(--color-text-secondary)] max-w-xl mx-auto mb-10 font-mono leading-relaxed">
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
                className="group relative px-10 py-3.5 bg-[var(--color-gold)] text-[#0A0A0A] font-bold text-sm uppercase tracking-[0.2em] rounded transition-all hover:bg-[var(--color-gold-hi)] hover:shadow-[0_0_50px_rgba(230,185,77,0.4)] overflow-hidden"
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

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[2]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 8, 0] }}
          transition={{
            opacity: { delay: 4, duration: 0.5 },
            y: { delay: 4, duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <div className="w-6 h-10 border border-[var(--color-border-base)] rounded-full flex justify-center pt-2">
            <motion.div
              className="w-1 h-2 bg-[var(--color-gold)] rounded-full"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
          </div>
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
              <CountUp
                end={393830}
                formatter={(v) => `$${Math.round(v).toLocaleString()}`}
                duration={2500}
                className="font-mono font-bold text-lg md:text-xl"
              />
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
          COMMAND GRID
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 py-28">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)] font-mono mb-3">
                The Command Center
              </div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
                Three systems. One financial picture.
              </h2>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((card, i) => (
              <FadeIn key={card.title} delay={i * 150}>
                <TiltCard className="h-full">
                  <div className="h-full bg-[var(--color-bg-surface)] border border-white/[0.06] rounded-lg p-6 flex flex-col hover:border-[rgba(230,185,77,0.15)] transition-colors duration-500">
                    <div className="relative w-12 h-12 rounded-lg bg-[var(--color-bg-elevated)] border border-white/[0.06] flex items-center justify-center mb-5">
                      <div
                        className="absolute inset-0 rounded-lg blur-xl"
                        style={{ background: card.glowColor }}
                      />
                      <card.icon className={`w-5 h-5 ${card.iconColor} relative z-10`} />
                    </div>

                    <h3 className="text-lg font-bold tracking-tight mb-2">{card.title}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-6 flex-1">
                      {card.desc}
                    </p>

                    <div className="pt-4 border-t border-white/[0.04] flex items-baseline gap-2">
                      <span className={`font-mono font-bold text-lg ${card.metricColor}`}>
                        {card.metric}
                      </span>
                      <span className="font-mono text-xs text-[var(--color-text-muted)]">
                        {card.metricLabel}
                      </span>
                    </div>
                  </div>
                </TiltCard>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Gold divider */}
      <div className="relative z-10 flex justify-center mb-28">
        <div className="w-24 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent opacity-20" />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          BENCHMARK TABLE
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 pb-28">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="text-center mb-12">
              <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)] font-mono mb-3">
                The Benchmark
              </div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
                Legacy tools weren&apos;t built for this.
              </h2>
            </div>
          </FadeIn>

          <FadeIn delay={150}>
            <div className="bg-[var(--color-bg-surface)] border border-white/[0.06] rounded-lg overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left p-4 text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] font-mono font-normal w-[35%]">
                      Capability
                    </th>
                    <th className="p-4 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] font-mono font-normal">
                      Legacy Tools
                    </th>
                    <th className="p-4 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--color-gold)] font-mono font-normal bg-[rgba(230,185,77,0.04)] border-l border-[rgba(230,185,77,0.1)]">
                      Helm Terminal
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono text-sm">
                  {comparisons.map((row) => (
                    <tr
                      key={row.feature}
                      className="border-b border-white/[0.03] last:border-0 group"
                    >
                      <td className="p-4 text-[var(--color-text-secondary)]">{row.feature}</td>
                      <td className="p-4 text-center text-[var(--color-text-muted)]">{row.legacy}</td>
                      <td className="p-4 text-center text-[var(--color-gold)] font-medium bg-[rgba(230,185,77,0.04)] border-l border-[rgba(230,185,77,0.1)] group-hover:bg-[rgba(230,185,77,0.07)] transition-colors">
                        {row.helm}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          FINAL CTA
          ════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 container mx-auto px-6 pb-28">
        <FadeIn>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-4">
              Take the{' '}
              <span className="text-[var(--color-gold)] glow-breathe">Helm</span>.
            </h2>
            <p className="text-[var(--color-text-secondary)] mb-8 font-mono text-sm">
              Join the waitlist for early access to institutional-grade financial
              intelligence.
            </p>

            <div className="flex max-w-md mx-auto mb-6">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 bg-[var(--color-bg-elevated)] border border-white/[0.06] rounded-l-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors font-mono"
              />
              <button className="group relative px-6 py-3 bg-[var(--color-gold)] text-[#0A0A0A] font-bold text-xs uppercase tracking-[0.15em] rounded-r-lg hover:bg-[var(--color-gold-hi)] hover:shadow-[0_0_30px_rgba(230,185,77,0.4)] transition-all whitespace-nowrap overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative">Request Access</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {trustBadges.map((item) => (
                <div key={item.text} className="flex items-center gap-1.5">
                  <item.Icon className="w-3 h-3 text-[var(--color-text-muted)]" />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-mono">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          FOOTER
          ════════════════════════════════════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/[0.04] py-6">
        <div className="container mx-auto px-6 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-muted)] font-mono">
            &copy; 2026 Helm Terminal. Encrypted Terminal Access.
          </p>
        </div>
      </footer>
    </div>
  );
}
