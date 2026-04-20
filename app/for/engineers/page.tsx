import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { LegalFooter } from '@/components/legal-footer';
import { RefreshCw, ShieldAlert, Calculator, BarChart3 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Portfolio Intelligence for Engineers | Helm Terminal',
  description:
    'RSU tracking, concentration alerts, tax-loss harvesting, and multi-account sync. Built by an engineer, for engineers who optimize everything except their portfolio.',
  openGraph: {
    title: 'Portfolio Intelligence for Engineers | Helm Terminal',
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
    <div className="min-h-screen bg-[var(--color-bg-base)] bg-depth flex flex-col relative overflow-hidden">
      <CinematicBg />

      {/* Nav */}
      <header className="relative z-10 glass-nav">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 h-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={24} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/for"
              className="text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Solutions
            </Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[12px] font-semibold rounded transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-[960px] mx-auto px-3 sm:px-4 lg:px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-14">
          <p
            className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-3"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            For Engineers
          </p>
          <h1 className="text-[28px] sm:text-[40px] font-bold text-[var(--color-text-primary)] leading-tight mb-4">
            You optimize systems for a living.<br className="hidden sm:block" />
            Why is your portfolio still a spreadsheet?
          </h1>
          <p className="text-[15px] text-[var(--color-text-secondary)] max-w-lg mx-auto">
            Helm brings the same rigor you apply to production systems to your financial infrastructure.
            Automated monitoring, intelligent alerts, and zero manual reconciliation.
          </p>
        </div>

        {/* Pain Points */}
        <section className="mb-14">
          <h2
            className="text-[13px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-5"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Sound Familiar?
          </h2>
          <div className="space-y-3">
            {PAIN_POINTS.map((point, i) => (
              <div
                key={i}
                className="flex items-start gap-3 border border-[var(--color-border-base)] rounded-lg px-5 py-3.5"
              >
                <span className="text-red-400 text-[14px] mt-0.5 shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                  !!
                </span>
                <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-14">
          <h2
            className="text-[13px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-6"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            How Helm Fixes It
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="border border-[var(--color-border-base)] rounded-lg p-5"
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-gold)]/10 flex items-center justify-center mb-3">
                    <Icon className="w-4.5 h-4.5 text-[var(--color-gold)]" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1.5">
                    {feat.title}
                  </h3>
                  <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Social Proof */}
        <section className="mb-14 text-center py-8 border-y border-[var(--color-border-subtle)]">
          <blockquote className="text-[16px] italic text-[var(--color-text-secondary)] leading-relaxed max-w-lg mx-auto mb-3">
            &ldquo;I built Helm because I was tired of checking 4 different apps to understand my own financial picture.
            Engineers deserve infrastructure-grade tools for their money.&rdquo;
          </blockquote>
          <p className="text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
            -- Built by an engineer, for engineers
          </p>
        </section>

        {/* CTA */}
        <section className="text-center py-10">
          <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">
            Stop manually reconciling. Start monitoring.
          </h2>
          <p className="text-[14px] text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            Free tier includes portfolio sync, daily briefs, and AI analysis for 150+ tickers.
          </p>
          <Link
            href="/signup"
            className="inline-block px-6 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[13px] font-semibold rounded transition-colors"
          >
            Sign Up Free
          </Link>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
