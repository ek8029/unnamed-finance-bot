import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { LegalFooter } from '@/components/legal-footer';
import { Shield, Activity, Layers, Bell } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Institutional Analysis Without the Institutional Price | Helm Terminal',
  description:
    'Your advisor charges 1% AUM. Helm delivers real-time portfolio intelligence, AI-powered analysis, and multi-account aggregation for a fraction of the cost.',
  openGraph: {
    title: 'Institutional Analysis Without the Institutional Price | Helm Terminal',
    description: 'Your advisor charges 1% AUM. Helm charges $4.99/month.',
    url: 'https://helmterminal.dev/for/high-net-worth',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  alternates: { canonical: 'https://helmterminal.dev/for/high-net-worth' },
};

const PAIN_POINTS = [
  'Paying 1% AUM to an advisor who sends quarterly PDF reports you could generate yourself',
  'No real-time visibility into what is happening across your portfolio between advisor calls',
  'Generic asset allocation advice that does not account for your specific tax situation or liquidity needs',
  'Multiple custodians, accounts, and asset classes with no unified view',
];

const FEATURES = [
  {
    icon: Activity,
    title: 'Real-Time Intelligence',
    description:
      'Live market data, AI-generated verdicts, and proactive alerts. Know what is happening in your portfolio before your advisor does.',
  },
  {
    icon: Bell,
    title: 'Personalized Daily Brief',
    description:
      'Every morning, a concise briefing tailored to your holdings. Macro moves, earnings impacts, dividend changes, and concentration warnings.',
  },
  {
    icon: Layers,
    title: 'Multi-Account Aggregation',
    description:
      'See every account in one place -- brokerages, IRAs, 401(k)s, trusts, banks, and crypto. Plaid-secured, read-only access.',
  },
  {
    icon: Shield,
    title: 'Institutional-Grade Security',
    description:
      'Bank-level encryption, read-only account access via Plaid, and row-level security on all data. We never store credentials and never execute trades.',
  },
];

export default function HighNetWorthPage() {
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
            For High-Net-Worth Individuals
          </p>
          <h1 className="text-[28px] sm:text-[40px] font-bold text-[var(--color-text-primary)] leading-tight mb-4">
            Your advisor charges 1% AUM.<br className="hidden sm:block" />
            Helm charges $4.99/month.
          </h1>
          <p className="text-[17px] text-[var(--color-text-secondary)] max-w-lg mx-auto">
            Institutional-grade portfolio intelligence without the institutional price.
            Real-time monitoring, AI analysis, and a daily brief tailored to your holdings.
          </p>
        </div>

        {/* Cost Comparison */}
        <section className="mb-14">
          <div className="border border-[var(--color-border-base)] rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 bg-white/[0.03] border-b border-[var(--color-border-subtle)]">
              <div className="px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                Feature
              </div>
              <div className="px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)] text-center" style={{ fontFamily: 'var(--font-mono)' }}>
                Traditional Advisor
              </div>
              <div className="px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-[var(--color-gold)] text-center" style={{ fontFamily: 'var(--font-mono)' }}>
                Helm Terminal
              </div>
            </div>
            {[
              { feature: 'Annual cost ($1M AUM)', advisor: '$10,000+', helm: '$179.88' },
              { feature: 'Portfolio updates', advisor: 'Quarterly PDF', helm: 'Real-time dashboard' },
              { feature: 'Stock analysis', advisor: 'Generic models', helm: 'AI-powered, per-ticker' },
              { feature: 'Tax optimization', advisor: 'Annual review', helm: 'Continuous monitoring' },
              { feature: 'Alert latency', advisor: 'Days to weeks', helm: 'Same-day' },
              { feature: 'Account aggregation', advisor: 'Manual statements', helm: 'Automated via Plaid' },
            ].map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 border-b border-[var(--color-border-subtle)] last:border-b-0 ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
              >
                <div className="px-4 py-2.5 text-[17px] text-[var(--color-text-secondary)]">{row.feature}</div>
                <div className="px-4 py-2.5 text-[17px] text-[var(--color-text-muted)] text-center">{row.advisor}</div>
                <div className="px-4 py-2.5 text-[17px] text-[var(--color-text-primary)] text-center font-medium">{row.helm}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Pain Points */}
        <section className="mb-14">
          <h2
            className="text-[17px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-5"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            The Wealth Management Gap
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
            What You Get
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

        {/* Security Note */}
        <section className="mb-14 text-center py-8 border-y border-[var(--color-border-subtle)]">
          <p
            className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-3"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Security First
          </p>
          <p className="text-[18px] text-[var(--color-text-secondary)] max-w-lg mx-auto leading-relaxed">
            Helm uses Plaid for bank-level encrypted, read-only account access. We never store your bank credentials,
            never execute trades, and never share your data. Your financial information is yours.
          </p>
          <Link
            href="/security"
            className="inline-block mt-3 text-[12px] text-[var(--color-gold)] hover:underline"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Read our security practices &rarr;
          </Link>
        </section>

        {/* CTA */}
        <section className="text-center py-10">
          <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">
            See what your advisor is not showing you
          </h2>
          <p className="text-[18px] text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            Start with the free tier. Connect your accounts and see your portfolio like never before.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="px-6 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[17px] font-semibold rounded transition-colors"
            >
              Sign Up Free
            </Link>
            <Link
              href="/pricing"
              className="px-5 py-2.5 border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-[17px] font-medium rounded transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
