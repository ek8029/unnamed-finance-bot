import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { LegalFooter } from '@/components/legal-footer';
import { Newspaper, Brain, Eye, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Financial Intelligence for Founders | Helm Terminal',
  description:
    'You raised capital for your company. Who is managing yours? Helm monitors your portfolio, angel investments, and equity events so you can focus on building.',
  openGraph: {
    title: 'Financial Intelligence for Founders | Helm Terminal',
    description: 'You raised capital for your company. Who is managing yours?',
    url: 'https://helmterminal.dev/for/founders',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  alternates: { canonical: 'https://helmterminal.dev/for/founders' },
};

const PAIN_POINTS = [
  'Equity events, SAFEs, and angel investments tracked in a messy spreadsheet nobody maintains',
  'No time to actively manage personal finances when you are running a company 80 hours a week',
  'Missing earnings surprises, dividend changes, and analyst downgrades on positions you hold',
  'Advisor wants 1% AUM but gives generic quarterly reports you could generate yourself',
];

const FEATURES = [
  {
    icon: Newspaper,
    title: 'Daily Brief',
    description:
      'Every morning, Helm delivers a concise briefing: what moved in your portfolio, macro signals, and actions to consider. Read it in 2 minutes over coffee.',
  },
  {
    icon: Brain,
    title: 'AI Stock Analysis',
    description:
      'Deep analysis for 500+ tickers with bull/bear cases, valuation metrics, and opinionated verdicts. Due diligence in seconds, not hours.',
  },
  {
    icon: Eye,
    title: 'Automated Monitoring',
    description:
      'Helm watches your holdings 24/7. Concentration drift, earnings surprises, unusual volume -- you get notified only when it matters.',
  },
  {
    icon: Zap,
    title: 'Actions Inbox',
    description:
      'Prioritized list of what changed in your portfolio: tax-loss-harvest windows, concentration shifts, dividend events.',
  },
];

export default function FoundersPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] bg-depth flex flex-col relative overflow-hidden">
      <CinematicBg />

      {/* Nav */}
      <header className="relative z-10 glass-nav">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 h-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={24} />
            <span className="text-[17px] font-bold tracking-tight uppercase">Helm</span>
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
            For Founders
          </p>
          <h1 className="text-[28px] sm:text-[40px] font-bold text-[var(--color-text-primary)] leading-tight mb-4">
            You raised capital for your company.<br className="hidden sm:block" />
            Who&apos;s managing yours?
          </h1>
          <p className="text-[17px] text-[var(--color-text-secondary)] max-w-lg mx-auto">
            Building a company is a full-time obsession. Helm monitors your personal portfolio
            so your finances don&apos;t become the thing that falls through the cracks.
          </p>
        </div>

        {/* Pain Points */}
        <section className="mb-14">
          <h2
            className="text-[17px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-5"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            The Founder Problem
          </h2>
          <div className="space-y-3">
            {PAIN_POINTS.map((point, i) => (
              <div
                key={i}
                className="flex items-start gap-3 border border-[var(--color-border-base)] rounded-lg px-5 py-3.5"
              >
                <span className="text-red-400 text-[18px] mt-0.5 shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                  !!
                </span>
                <p className="text-[17px] text-[var(--color-text-secondary)] leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mb-14">
          <h2
            className="text-[17px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-6"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Helm Does the Work
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
                  <h3 className="text-[17px] font-semibold text-[var(--color-text-primary)] mb-1.5">
                    {feat.title}
                  </h3>
                  <p className="text-[17px] text-[var(--color-text-secondary)] leading-relaxed">
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
            &ldquo;As a founder, I needed something that would just tell me what matters in my portfolio this week
            without me having to dig. Helm is exactly that.&rdquo;
          </blockquote>
          <p className="text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
            -- Built for founders who ship fast and delegate everything else
          </p>
        </section>

        {/* CTA */}
        <section className="text-center py-10">
          <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">
            Your company has a dashboard. Your money should too.
          </h2>
          <p className="text-[18px] text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            Free tier includes portfolio sync, daily briefs, and AI analysis. Set up in under 3 minutes.
          </p>
          <Link
            href="/signup"
            className="inline-block px-6 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[17px] font-semibold rounded transition-colors"
          >
            Sign Up Free
          </Link>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
