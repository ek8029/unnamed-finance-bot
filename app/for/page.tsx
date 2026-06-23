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
              href="/analyze"
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Analyze
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

      <div className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        {/* Hero */}
        <header className="mb-12 text-center">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Built for You</div>
          <h1 className="font-sans font-bold text-[34px] md:text-[44px] tracking-tight leading-[1.08] mb-5">
            Financial intelligence, tailored to your world
          </h1>
          <p className="text-[18px] md:text-[20px] leading-[1.55] text-[var(--color-text-secondary)] max-w-xl mx-auto">
            Helm adapts to your financial complexity. Whether you hold RSUs, manage angel portfolios,
            or just want one place to see everything.
          </p>
        </header>

        {/* Segment Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SEGMENTS.map((seg) => {
            const Icon = seg.icon;
            return (
              <Link
                key={seg.href}
                href={seg.href}
                className="group sovereign-card rounded p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[var(--color-gold)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors mb-1">
                      {seg.title}
                    </h2>
                    <p className="type-eyebrow text-[var(--color-text-muted)] mb-2.5 normal-case tracking-[0.04em]">
                      {seg.subtitle}
                    </p>
                    <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed">
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
        <section className="sovereign-card rounded p-6 md:p-8 text-center mt-12">
          <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-2">
            Ready to take the helm?
          </h2>
          <p className="text-[15px] text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            Institutional-grade financial intelligence. Free to start.
          </p>
          <Link
            href="/signup"
            className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-xs uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
          >
            Sign Up Free
          </Link>
        </section>
      </div>

      <LegalFooter />
    </main>
  );
}
