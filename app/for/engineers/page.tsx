import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { LegalFooter } from '@/components/legal-footer';
import { RefreshCw, ShieldAlert, Calculator, BarChart3 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'RSU Portfolio Tracker for Software Engineers | Helm Terminal',
  description:
    'RSU tracking, concentration alerts, tax-loss harvesting, and multi-account sync. Built by an engineer, for engineers who optimize everything except their portfolio.',
  openGraph: {
    title: 'RSU Portfolio Tracker for Software Engineers | Helm Terminal',
    description: 'You optimize systems for a living. Why is your portfolio still a spreadsheet?',
    url: 'https://helmterminal.dev/for/engineers',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  alternates: { canonical: 'https://helmterminal.dev/for/engineers' },
};

const PAIN_POINTS = [
  'RSU vesting schedules scattered across brokerage PDFs and equity management platforms',
  'Concentrated positions in employer stock with no automated alerting when it drifts',
  'Multiple accounts across brokerages, 401(k)s, and crypto exchanges with no single pane of glass',
  'Tax-loss harvesting opportunities invisible without active manual monitoring',
];

const FEATURES = [
  {
    icon: RefreshCw,
    title: 'Auto-Sync Everything',
    description:
      'Plaid-powered account aggregation pulls balances, holdings, and transactions from every brokerage, bank, and retirement account. No CSV uploads.',
  },
  {
    icon: ShieldAlert,
    title: 'Concentration Alerts',
    description:
      'Helm flags when a single position exceeds your threshold. Get notified before your employer stock becomes 40% of your net worth.',
  },
  {
    icon: Calculator,
    title: 'Tax-Loss Harvesting',
    description:
      'Automated detection of tax-loss harvesting opportunities across your portfolio. See unrealized losses and estimated tax savings in real time.',
  },
  {
    icon: BarChart3,
    title: 'AI-Powered Daily Brief',
    description:
      'Every morning, Helm tells you what changed in your portfolio and why it matters. Earnings surprises, dividend announcements, analyst upgrades -- all in one feed.',
  },
];

export default function EngineersPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />

      {/* Nav */}
      <nav className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/for"
              className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Solutions
            </Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        {/* Hero */}
        <header className="mb-14 text-center">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">For Engineers</div>
          <h1 className="font-sans font-bold text-[30px] md:text-[42px] tracking-tight leading-[1.08] mb-5">
            You optimize systems for a living. Why is your portfolio still a spreadsheet?
          </h1>
          <p className="text-[18px] md:text-[20px] leading-[1.55] text-[var(--color-text-secondary)] max-w-xl mx-auto">
            Helm brings the same rigor you apply to production systems to your financial infrastructure.
            Automated monitoring, intelligent alerts, and zero manual reconciliation.
          </p>
        </header>

        {/* Pain Points */}
        <section className="mb-14">
          <h2 className="type-eyebrow text-[var(--color-gold)] mb-5">Sound Familiar?</h2>
          <div className="space-y-3">
            {PAIN_POINTS.map((point, i) => (
              <div
                key={i}
                className="flex items-start gap-3 sovereign-card rounded px-5 py-3.5"
              >
                <span className="text-[#F87171] text-[15px] mt-0.5 shrink-0 font-mono">!!</span>
                <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-14">
          <h2 className="type-eyebrow text-[var(--color-gold)] mb-6">How Helm Fixes It</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="sovereign-card rounded p-5">
                  <div className="w-9 h-9 rounded bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center mb-3">
                    <Icon className="w-4.5 h-4.5 text-[var(--color-gold)]" />
                  </div>
                  <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] mb-1.5">
                    {feat.title}
                  </h3>
                  <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Social Proof */}
        <section className="mb-14 text-center py-8 border-y border-[var(--color-border-subtle)]">
          <blockquote className="text-[18px] italic text-[var(--color-text-secondary)] leading-relaxed max-w-lg mx-auto mb-3">
            &ldquo;I built Helm because I was tired of checking 4 different apps to understand my own financial picture.
            Engineers deserve infrastructure-grade tools for their money.&rdquo;
          </blockquote>
          <p className="type-eyebrow text-[var(--color-text-muted)]">
            -- Built by an engineer, for engineers
          </p>
        </section>

        {/* CTA */}
        <section className="sovereign-card rounded p-6 md:p-8 text-center">
          <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-2">
            Stop manually reconciling. Start monitoring.
          </h2>
          <p className="text-[15px] text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            Free tier includes portfolio sync, daily briefs, and AI analysis for 500+ tickers.
          </p>
          <Link
            href="/signup"
            className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
          >
            Sign Up Free
          </Link>
        </section>
      </article>

      <LegalFooter />
    </main>
  );
}
