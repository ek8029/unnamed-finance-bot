import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { LegalFooter } from '@/components/legal-footer';
import { Code2, Rocket, TrendingUp, Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Helm Terminal -- Built for Your Financial World',
  description:
    'Institutional-grade financial intelligence for engineers, founders, self-directed investors, and high-net-worth individuals.',
  openGraph: {
    title: 'Built for Your Financial World | Helm Terminal',
    description: 'Institutional-grade financial intelligence for every type of investor.',
    url: 'https://helmterminal.dev/for',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  alternates: { canonical: 'https://helmterminal.dev/for' },
};

const SEGMENTS = [
  {
    href: '/for/engineers',
    icon: Code2,
    title: 'Engineers',
    subtitle: 'RSU tracking, concentration alerts, multi-account sync',
    description:
      'You optimize systems for a living. Helm applies that same rigor to your portfolio with automated monitoring and intelligence.',
  },
  {
    href: '/for/founders',
    icon: Rocket,
    title: 'Founders',
    subtitle: 'Equity events, angel investments, daily briefs',
    description:
      'You raised capital for your company. Helm raises the bar on managing your personal finances with zero active management.',
  },
  {
    href: '/for/investors',
    icon: TrendingUp,
    title: 'Self-Directed Investors',
    subtitle: '500+ ticker analysis, portfolio tracking, tax intelligence',
    description:
      'AI-powered stock analysis, real-time data, and actionable insights for every position you own.',
  },
  {
    href: '/for/high-net-worth',
    icon: Building2,
    title: 'High-Net-Worth Individuals',
    subtitle: 'Multi-account aggregation, personalized intelligence',
    description:
      'Your advisor charges 1% AUM. Helm gives you institutional-grade analysis at a fraction of the cost.',
  },
];

export default function ForHubPage() {
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
              href="/analyze"
              className="text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Analyze
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

      <main className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-14">
          <p
            className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-3"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Built for You
          </p>
          <h1 className="text-[32px] sm:text-[42px] font-bold text-[var(--color-text-primary)] leading-tight mb-4">
            Financial intelligence,<br className="hidden sm:block" /> tailored to your world
          </h1>
          <p className="text-[17px] text-[var(--color-text-secondary)] max-w-lg mx-auto">
            Helm adapts to your financial complexity. Whether you hold RSUs, manage angel portfolios,
            or just want one place to see everything.
          </p>
        </div>

        {/* Segment Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SEGMENTS.map((seg) => {
            const Icon = seg.icon;
            return (
              <Link
                key={seg.href}
                href={seg.href}
                className="group border border-[var(--color-border-base)] rounded-lg p-6 hover:border-[var(--color-gold)]/40 hover:bg-white/[0.02] transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-gold)]/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[var(--color-gold)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[17px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors mb-1">
                      {seg.title}
                    </h2>
                    <p
                      className="text-[11px] text-[var(--color-text-muted)] mb-2.5"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {seg.subtitle}
                    </p>
                    <p className="text-[17px] text-[var(--color-text-secondary)] leading-relaxed">
                      {seg.description}
                    </p>
                  </div>
                  <span className="text-[var(--color-text-muted)] group-hover:text-[var(--color-gold)] transition-colors text-[20px] mt-1 shrink-0">
                    &rarr;
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* CTA */}
        <section className="text-center mt-16 py-10 border-t border-[var(--color-border-subtle)]">
          <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">
            Ready to take the helm?
          </h2>
          <p className="text-[18px] text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            Institutional-grade financial intelligence. Free to start.
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
