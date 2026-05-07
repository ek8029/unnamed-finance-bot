import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';

export const metadata: Metadata = {
  title: 'About | Helm Terminal',
  description:
    'Helm Terminal was built by Evan to give individual investors the same portfolio intelligence tools that hedge funds use — free and transparent.',
  alternates: {
    canonical: 'https://helmterminal.dev/about',
  },
  openGraph: {
    title: 'About Helm Terminal',
    description:
      'The story behind Helm — institutional-grade financial intelligence, built for individuals.',
    url: 'https://helmterminal.dev/about',
  },
};

const PERSON_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Evan', // TODO: Add full name (first + last) for entity resolution
  jobTitle: 'Founder',
  url: 'https://helmterminal.dev/about',
  // TODO: Add image: 'https://helmterminal.dev/images/evan-headshot.jpg'
  worksFor: {
    '@type': 'Organization',
    name: 'Helm Terminal',
    url: 'https://helmterminal.dev',
  },
  knowsAbout: [
    'Portfolio Analysis',
    'Financial Technology',
    'Tax-Loss Harvesting',
    'Software Engineering',
  ],
  alumniOf: {
    '@type': 'CollegeOrUniversity',
    name: 'The Pennsylvania State University',
  },
  sameAs: [
    // TODO: Replace with PERSONAL profiles (not company profiles)
    // e.g. 'https://www.linkedin.com/in/your-profile',
    // 'https://github.com/your-username',
    // 'https://x.com/your-handle',
  ],
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_SCHEMA) }}
      />

      <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
        {/* Nav */}
        <nav className="border-b border-[var(--color-border-subtle)]">
          <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <HelmMark size={24} />
              <span className="font-semibold text-sm tracking-[0.12em] group-hover:text-[var(--color-gold)] transition-colors">
                HELM
              </span>
            </Link>
            <Link
              href="/signup"
              className="h-9 px-5 rounded-full bg-[var(--color-gold)] text-[var(--color-text-inverse)] text-[13px] font-semibold flex items-center gap-1.5 hover:brightness-110 transition-all"
            >
              Open terminal
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </nav>

        <main className="max-w-3xl mx-auto px-6 py-20">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-px bg-[var(--color-gold)]" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-gold)] uppercase">
              About
            </span>
          </div>

          <h1 className="text-[clamp(32px,5vw,48px)] font-bold leading-[1.1] tracking-tight mb-8">
            Built for investors who want<br />
            to see everything.
          </h1>

          <div className="space-y-6 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
            <p>
              Helm Terminal is an institutional-grade financial intelligence platform built
              for individuals. It gives you the same portfolio visibility that hedge funds
              have — position-level analysis, tax-loss harvesting signals, earnings exposure
              tracking, and a daily brief that tells you what changed and why — without
              the $24,000/year Bloomberg terminal price tag.
            </p>

            <p>
              Most of it is free. No black boxes, no vague AI summaries. Every insight
              shows its data sources, timestamps, and methodology. You can verify
              everything Helm tells you.
            </p>

            <h2 className="text-[var(--color-text-primary)] text-xl font-semibold pt-4">
              The builder
            </h2>

            <p>
              {/* TODO: Expand with full name, specific credentials, professional background */}
              Helm was built by Evan, a software engineer and Penn State alum who got
              frustrated by how fragmented personal finance tools were. Brokerage apps
              show you positions but not risk. Budgeting apps track spending but ignore
              your portfolio. Nothing connected the dots across accounts.
            </p>

            <p>
              So he built Helm — a single command center that aggregates every account
              via Plaid, runs rule-based intelligence over your full financial picture,
              and surfaces the 3-5 things that actually matter each week. No subscriptions
              required for the core experience.
            </p>

            <h2 className="text-[var(--color-text-primary)] text-xl font-semibold pt-4">
              How it works
            </h2>

            <p>
              Helm connects to your brokerage and bank accounts through{' '}
              <a
                href="https://plaid.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-gold)] hover:underline"
              >
                Plaid
              </a>{' '}
              (read-only — Helm can never move money or execute trades). It pulls positions,
              balances, and transactions, then runs a deterministic rule engine that checks
              for concentration risk, tax-loss harvesting opportunities, earnings exposure,
              cash drag, and more. No LLMs in the decision loop — every insight is
              auditable and reproducible.
            </p>

            <p>
              Market data comes from Finnhub (real-time quotes) and Polygon.io (historical
              prices, dividends, splits). Analysis pages use GPT-4o-mini for narrative
              interpretation of structured financial data, clearly labeled as AI-generated.
            </p>

            <h2 className="text-[var(--color-text-primary)] text-xl font-semibold pt-4">
              The philosophy
            </h2>

            <ul className="space-y-3 list-none">
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-sm mt-0.5">01</span>
                <span><strong className="text-[var(--color-text-primary)]">Transparency over polish.</strong> Show the data, the source, the timestamp. Let users verify.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-sm mt-0.5">02</span>
                <span><strong className="text-[var(--color-text-primary)]">Rules before AI.</strong> Deterministic intelligence you can audit. LLMs for narrative, not decisions.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-sm mt-0.5">03</span>
                <span><strong className="text-[var(--color-text-primary)]">Free by default.</strong> Core features stay free. Pro exists for advanced tax and earnings tools.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[var(--color-gold)] font-mono text-sm mt-0.5">04</span>
                <span><strong className="text-[var(--color-text-primary)]">No financial advice.</strong> Helm is informational. It shows you what your data says — you make the decisions.</span>
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="mt-16 pt-8 border-t border-[var(--color-border-subtle)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Link
                href="/signup"
                className="h-11 px-6 rounded-full bg-[var(--color-gold)] text-[var(--color-text-inverse)] text-sm font-semibold flex items-center gap-2 hover:brightness-110 transition-all"
              >
                Open your terminal
                <ArrowRight className="w-4 h-4" />
              </Link>
              <span className="text-sm text-[var(--color-text-muted)]">
                Free forever. No credit card required.
              </span>
            </div>
          </div>
        </main>

        <LegalFooter />
      </div>
    </>
  );
}
