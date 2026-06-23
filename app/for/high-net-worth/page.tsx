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
    title: 'Bloomberg Alternative for Advisors and HNW Investors | Helm Terminal',
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
      'Live market data, AI-generated analysis, and proactive alerts. Know what is happening in your portfolio before your advisor does.',
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
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Solutions
            </Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        {/* Hero */}
        <header className="mb-14 text-center">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">For High-Net-Worth Individuals</div>
          <h1 className="font-sans font-bold text-[30px] md:text-[42px] tracking-tight leading-[1.08] mb-5">
            Your advisor charges 1% AUM. Helm charges $4.99/month.
          </h1>
          <p className="text-[18px] md:text-[20px] leading-[1.55] text-[var(--color-text-secondary)] max-w-xl mx-auto">
            Institutional-grade portfolio intelligence without the institutional price.
            Real-time monitoring, AI analysis, and a daily brief tailored to your holdings.
          </p>
        </header>

        {/* Cost Comparison */}
        <section className="mb-14">
          <div className="overflow-x-auto sovereign-card rounded">
            <table className="w-full text-[15px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border-base)]">
                  <th className="px-4 py-3 type-eyebrow text-[var(--color-text-muted)] font-normal">Feature</th>
                  <th className="px-4 py-3 type-eyebrow text-[var(--color-text-muted)] font-normal text-center">Traditional Advisor</th>
                  <th className="px-4 py-3 type-eyebrow text-[var(--color-gold)] font-normal text-center">Helm Terminal</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Annual cost ($1M AUM)', advisor: '$10,000+', helm: '$179.88' },
                  { feature: 'Portfolio updates', advisor: 'Quarterly PDF', helm: 'Real-time dashboard' },
                  { feature: 'Stock analysis', advisor: 'Generic models', helm: 'AI-powered, per-ticker' },
                  { feature: 'Tax optimization', advisor: 'Annual review', helm: 'Continuous monitoring' },
                  { feature: 'Alert latency', advisor: 'Days to weeks', helm: 'Same-day' },
                  { feature: 'Account aggregation', advisor: 'Manual statements', helm: 'Automated via Plaid' },
                ].map((row) => (
                  <tr key={row.feature} className="border-b border-[var(--color-border-subtle)] last:border-0">
                    <td className="px-4 py-2.5 text-[var(--color-text-primary)] font-medium">{row.feature}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-muted)] text-center">{row.advisor}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-primary)] text-center font-medium">{row.helm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pain Points */}
        <section className="mb-14">
          <h2 className="type-eyebrow text-[var(--color-gold)] mb-5">The Wealth Management Gap</h2>
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
          <h2 className="type-eyebrow text-[var(--color-gold)] mb-6">What You Get</h2>
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

        {/* Security Note */}
        <section className="mb-14 text-center py-8 border-y border-[var(--color-border-subtle)]">
          <div className="type-eyebrow text-[var(--color-gold)] mb-3">Security First</div>
          <p className="text-[16px] text-[var(--color-text-secondary)] max-w-lg mx-auto leading-relaxed">
            Helm uses Plaid for bank-level encrypted, read-only account access. We never store your bank credentials,
            never execute trades, and never share your data. Your financial information is yours.
          </p>
          <Link
            href="/security"
            className="inline-block mt-3 type-eyebrow text-[var(--color-gold)] hover:underline"
          >
            Read our security practices &rarr;
          </Link>
        </section>

        {/* CTA */}
        <section className="sovereign-card rounded p-6 md:p-8 text-center">
          <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-2">
            See what your advisor is not showing you
          </h2>
          <p className="text-[15px] text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            Start with the free tier. Connect your accounts and see your portfolio like never before.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
            >
              Sign Up Free
            </Link>
            <Link
              href="/pricing"
              className="px-5 py-2.5 border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-colors"
            >
              View Pricing
            </Link>
          </div>
        </section>
      </article>

      <LegalFooter />
    </main>
  );
}
