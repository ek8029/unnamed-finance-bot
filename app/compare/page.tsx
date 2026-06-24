import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { LegalFooter } from '@/components/legal-footer';
import { CompareSearch } from './compare-search';

export const metadata: Metadata = {
  title: 'Stock Comparison Tool -- Compare Any Two Stocks | Helm Terminal',
  description:
    'Compare stocks side by side with AI-powered analysis. Price, P/E, market cap, margins, dividends, and verdicts for every US-listed stock.',
  openGraph: {
    title: 'Stock Comparison Tool | Helm Terminal',
    description: 'Compare any two stocks side by side with AI verdicts.',
    url: 'https://helmterminal.dev/compare',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  alternates: { canonical: 'https://helmterminal.dev/compare' },
};

const POPULAR_COMPARISONS = [
  { pair: 'AAPL-vs-MSFT', label: 'Apple vs Microsoft', category: 'Tech Giants' },
  { pair: 'GOOGL-vs-META', label: 'Alphabet vs Meta', category: 'Tech Giants' },
  { pair: 'AMZN-vs-GOOGL', label: 'Amazon vs Alphabet', category: 'Tech Giants' },
  { pair: 'NVDA-vs-AMD', label: 'NVIDIA vs AMD', category: 'Semiconductors' },
  { pair: 'TSLA-vs-RIVN', label: 'Tesla vs Rivian', category: 'EVs' },
  { pair: 'JPM-vs-GS', label: 'JPMorgan vs Goldman Sachs', category: 'Financials' },
  { pair: 'VOO-vs-VTI', label: 'VOO vs VTI', category: 'ETFs' },
  { pair: 'SPY-vs-QQQ', label: 'SPY vs QQQ', category: 'ETFs' },
  { pair: 'NFLX-vs-DIS', label: 'Netflix vs Disney', category: 'Entertainment' },
  { pair: 'CRM-vs-ADBE', label: 'Salesforce vs Adobe', category: 'Enterprise SaaS' },
];

export default function CompareIndexPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] flex flex-col relative overflow-hidden">
      <CinematicBg />

      {/* Nav */}
      <header className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/analyze"
              className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Analyze
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <p className="type-eyebrow text-[var(--color-gold)] mb-3">
            Stock Comparison
          </p>
          <h1 className="text-[34px] sm:text-[46px] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.08] mb-4">
            Compare Any Two Stocks
          </h1>
          <p className="text-[15px] text-[var(--color-text-secondary)] max-w-lg mx-auto">
            Side-by-side fundamentals, valuation, and AI-powered verdicts. Enter two tickers to get started.
          </p>
        </div>

        {/* Search */}
        <CompareSearch />

        {/* Popular Comparisons */}
        <section className="mt-14">
          <h2 className="type-eyebrow text-[var(--color-gold)] mb-6 text-center">
            Popular Comparisons
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {POPULAR_COMPARISONS.map((comp) => (
              <Link
                key={comp.pair}
                href={`/compare/${comp.pair}`}
                className="group sovereign-card rounded px-5 py-4 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors">
                      {comp.label}
                    </p>
                    <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                      {comp.category}
                    </p>
                  </div>
                  <span className="text-[var(--color-text-muted)] group-hover:text-[var(--color-gold)] transition-colors text-[18px]">
                    &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="sovereign-card rounded text-center mt-16 p-8 md:p-10">
          <h2 className="text-[24px] font-bold text-[var(--color-text-primary)] mb-3">
            Want AI analysis for your whole portfolio?
          </h2>
          <p className="text-[15px] text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            Helm Terminal monitors your holdings and tells you what matters this week.
          </p>
          <Link
            href="/signup"
            className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
          >
            Sign Up Free
          </Link>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
