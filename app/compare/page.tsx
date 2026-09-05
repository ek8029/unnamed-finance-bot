import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { LegalFooter } from '@/components/legal-footer';
import { CompareSearch } from './compare-search';
import { COMPARISON_CATEGORIES, COMPARISON_ENTRY_COUNT } from '@/lib/comparison-hub';

/**
 * /compare used to be one thing: a ticker versus ticker tool. Meanwhile the
 * homepage nav item labelled "Compare" pointed somewhere else entirely, at
 * /best-thesis-trackers, so the only invitation to compare Helm against
 * anything led to a roundup of thesis monitors.
 *
 * This page is now both halves. Stocks against stocks, which is what the URL
 * has always ranked for and stays first, and Helm against the ~25 tools it
 * actually gets weighed against, of which thesis monitors are one category out
 * of five.
 */

export const metadata: Metadata = {
  title: 'Compare Stocks and Compare Helm | Helm Terminal',
  description:
    'Put any two US-listed stocks side by side, or see how Helm compares against the terminal, tracker, budgeting app or thesis monitor you use now.',
  openGraph: {
    title: 'Compare Stocks and Compare Helm | Helm Terminal',
    description:
      'Any two stocks side by side, plus honest comparisons against the tools people switch from.',
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
              href="/blog"
              className="hidden sm:inline text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Writing
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
        <div className="text-center mb-10">
          <p className="type-eyebrow text-[var(--color-gold)] mb-3">Comparisons</p>
          <h1 className="text-[34px] sm:text-[46px] font-bold tracking-tight text-[var(--color-text-primary)] leading-[1.08] mb-4">
            Compare two stocks. Or compare Helm.
          </h1>
          <p className="text-[15px] text-[var(--color-text-secondary)] max-w-xl mx-auto">
            Side by side fundamentals and an AI verdict for any two US-listed tickers,
            and {COMPARISON_ENTRY_COUNT} honest write-ups of the tools people move to Helm from.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <a
              href="#stocks"
              className="px-4 py-2 rounded border border-[var(--color-border-base)] text-[13px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-gold)] transition-colors"
            >
              Stocks
            </a>
            <a
              href="#tools"
              className="px-4 py-2 rounded border border-[var(--color-border-base)] text-[13px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-gold)] transition-colors"
            >
              Tools
            </a>
          </div>
        </div>

        {/* ── Half one: stock vs stock ── */}
        <section id="stocks" className="scroll-mt-20">
          <div className="border-t border-[var(--color-border-subtle)] pt-10 mb-8">
            <h2 className="text-[24px] font-bold tracking-tight text-[var(--color-text-primary)] mb-2">
              Two stocks, side by side
            </h2>
            <p className="text-[14px] text-[var(--color-text-secondary)] max-w-lg">
              Price, valuation, margins, dividends and a written verdict. Enter any two tickers.
            </p>
          </div>

          <CompareSearch />

          <div className="mt-12">
            <h3 className="type-eyebrow text-[var(--color-gold)] mb-5">Popular pairs</h3>
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
                      <p
                        className="text-[12px] text-[var(--color-text-muted)] mt-0.5"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
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
          </div>
        </section>

        {/* ── Half two: Helm vs the tools ── */}
        <section id="tools" className="scroll-mt-20 mt-20">
          <div className="border-t border-[var(--color-border-subtle)] pt-10 mb-10">
            <h2 className="text-[24px] font-bold tracking-tight text-[var(--color-text-primary)] mb-2">
              Helm against what you use now
            </h2>
            <p className="text-[14px] text-[var(--color-text-secondary)] max-w-2xl">
              Helm connects your brokerages and reads the book: what moved, what it costs in tax,
              what reports this week, and whether the reasons you bought still hold. Most people
              arrive holding one of these instead. Prices are verified against the vendor at the
              time of writing.
            </p>
          </div>

          <div className="space-y-12">
            {COMPARISON_CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <h3 className="text-[17px] font-bold text-[var(--color-text-primary)] mb-1.5">
                  {cat.title}
                </h3>
                <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed max-w-2xl mb-5">
                  {cat.standing}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cat.entries.map((entry) => (
                    <Link
                      key={entry.href}
                      href={entry.href}
                      className="group sovereign-card rounded px-5 py-4 transition-all"
                    >
                      <p className="text-[15px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors">
                        {entry.name}
                      </p>
                      <p className="text-[13px] text-[var(--color-text-muted)] mt-1 leading-snug">
                        {entry.note}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="sovereign-card rounded text-center mt-20 p-8 md:p-10">
          <h2 className="text-[24px] font-bold text-[var(--color-text-primary)] mb-3">
            The comparison that matters is your own book
          </h2>
          <p className="text-[15px] text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            Connect a brokerage and Helm reads what you actually hold. Free to start.
          </p>
          <Link
            href="/signup"
            className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110"
          >
            Open the terminal
          </Link>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
