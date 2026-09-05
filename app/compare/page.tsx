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
 *
 * Laid out as a ruled index rather than grids of cards. Five card grids in a
 * row was the shape the first version had, and it read as one section pasted
 * five times. Rules and a sticky category label carry the same content in
 * about half the height and let the eye run down a column of names.
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

/** Left rail for a section: number, label, and a rule that runs to the copy. */
function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <div className="md:sticky md:top-24 md:self-start">
      <div className="flex items-baseline gap-4 md:block">
        <span
          className="text-[11px] tracking-[0.18em] text-[var(--color-gold)] md:block md:mb-3"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {n}
        </span>
        <span
          className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export default function CompareIndexPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] flex flex-col relative overflow-x-clip">
      <CinematicBg />

      <header className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-6">
            <Link
              href="/analyze"
              className="text-[14px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Analyze
            </Link>
            <Link
              href="/app"
              className="hidden sm:inline text-[14px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              iPhone
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[12px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110 active:translate-y-px"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Hero: copy left, index right ── */}
        <section className="pt-16 lg:pt-24 pb-14 grid grid-cols-1 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] gap-12 lg:gap-16 items-start">
          <div>
            <p
              className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-6"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Comparisons
            </p>
            <h1
              className="text-[44px] sm:text-[60px] lg:text-[68px] xl:text-[78px] leading-[0.96] tracking-[-0.025em] text-[var(--color-text-primary)] mb-7 text-balance"
              style={{ fontFamily: 'var(--font-display-serif), Georgia, serif' }}
            >
              Compare two stocks.
              <br />
              Or compare Helm.
            </h1>
            <p className="text-[17px] text-[var(--color-text-secondary)] max-w-[54ch] leading-[1.6]">
              Side by side fundamentals and a written read on any two US-listed tickers, and{' '}
              <span className="text-[var(--color-text-primary)] font-tabular">
                {COMPARISON_ENTRY_COUNT}
              </span>{' '}
              write-ups of the tools people weigh Helm against, priced from the vendor&rsquo;s own page.
            </p>
          </div>

          {/* Index. Doubles as jump nav and as the proof this is not one list
              of thesis trackers. */}
          <nav aria-label="On this page" className="max-w-[460px] lg:max-w-none lg:pt-3">
            <p
              className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] pb-3 border-b border-[var(--color-rule)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              On this page
            </p>
            <a
              href="#stocks"
              className="group flex items-baseline justify-between gap-4 py-3 border-b border-[var(--color-rule)] transition-colors"
            >
              <span className="text-[15px] text-[var(--color-text-secondary)] group-hover:text-[var(--color-gold)] transition-colors">
                Stocks, head to head
              </span>
              <span
                aria-hidden="true"
                className="text-[11px] text-[var(--color-text-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Any pair
              </span>
            </a>
            {COMPARISON_CATEGORIES.map((c) => (
              <a
                key={c.id}
                href={`#${c.id}`}
                className="group flex items-baseline justify-between gap-4 py-3 border-b border-[var(--color-rule)] transition-colors"
              >
                <span className="text-[15px] text-[var(--color-text-secondary)] group-hover:text-[var(--color-gold)] transition-colors">
                  {c.title}
                </span>
                <span
                  aria-hidden="true"
                  className="text-[11px] text-[var(--color-text-muted)] font-tabular"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {c.entries.length}
                </span>
              </a>
            ))}
          </nav>
        </section>

        {/* ── Half one: stock vs stock ── */}
        <section
          id="stocks"
          tabIndex={-1}
          className="scroll-mt-24 border-t border-[var(--color-rule)] pt-12 grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,8fr)] gap-8 md:gap-16"
        >
          <SectionLabel n="01" label="Stocks" />

          <div>
            <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.02em] leading-[1.08] text-[var(--color-text-primary)] mb-3 text-balance">
              Two stocks, side by side
            </h2>
            <p className="text-[15px] text-[var(--color-text-secondary)] max-w-[52ch] leading-[1.65] mb-9">
              Price, valuation, margins, dividends and a written read. Enter any two tickers.
            </p>

            <CompareSearch />

            <p
              className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mt-14 pb-3 border-b border-[var(--color-rule)]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Popular pairs
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 lg:gap-x-12">
              {POPULAR_COMPARISONS.map((comp) => (
                <Link
                  key={comp.pair}
                  href={`/compare/${comp.pair}`}
                  className="group flex items-baseline justify-between gap-5 py-4 border-b border-[var(--color-rule)]"
                >
                  <span className="text-[15px] font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors">
                    {comp.label}
                  </span>
                  <span
                    className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {comp.category}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── Half two: Helm vs the tools ── */}
        <section className="mt-24 lg:mt-32">
          <div className="border-t border-[var(--color-rule)] pt-12 grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,8fr)] gap-8 md:gap-16">
            <SectionLabel n="02" label="Tools" />
            <div>
              <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.02em] leading-[1.08] text-[var(--color-text-primary)] mb-4 text-balance">
                Helm against what you use now
              </h2>
              <p className="text-[16px] text-[var(--color-text-secondary)] max-w-[60ch] leading-[1.65]">
                Helm connects your brokerages and reads the book: what moved, what it costs in tax,
                what reports this week, and whether the reasons you bought still hold. Most people
                arrive holding one of these instead. Prices are verified against the vendor at the
                time of writing.
              </p>
            </div>
          </div>

          {COMPARISON_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              id={cat.id}
              tabIndex={-1}
              className="scroll-mt-24 mt-16 grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,8fr)] gap-6 md:gap-16"
            >
              <div className="md:sticky md:top-24 md:self-start">
                <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-[var(--color-text-primary)] leading-snug mb-3">
                  {cat.title}
                </h3>
                <p className="text-[13px] text-[var(--color-text-secondary)] leading-[1.6] max-w-[38ch]">
                  {cat.standing}
                </p>
              </div>

              <ul>
                {cat.entries.map((entry) => (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      className="group flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-8 py-5 border-t border-[var(--color-rule)]"
                    >
                      <span className="sm:w-[34%] sm:shrink-0 text-[16px] font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors leading-snug">
                        {entry.name}
                      </span>
                      <span className="flex-1 text-[14px] text-[var(--color-text-secondary)] leading-snug">
                        {entry.note}
                      </span>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-[var(--color-text-muted)] group-hover:text-[var(--color-gold)] group-hover:translate-x-0.5 transition-all text-[15px]"
                      >
                        &rarr;
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* ── CTA ── */}
        <section className="mt-24 lg:mt-32 mb-24">
          <div className="border-t border-[var(--color-rule)] pt-14 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              <h2
                className="text-[34px] sm:text-[46px] leading-[1.02] tracking-[-0.02em] text-[var(--color-text-primary)] mb-4 text-balance"
                style={{ fontFamily: 'var(--font-display-serif), Georgia, serif' }}
              >
                The one comparison this page cannot run is yours.
              </h2>
              <p className="text-[16px] text-[var(--color-text-secondary)] max-w-[48ch] leading-[1.6]">
                Connect a brokerage and Helm reads what you actually hold. Free to start.
              </p>
            </div>
            <Link
              href="/signup"
              className="shrink-0 px-7 py-3.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[12px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110 active:translate-y-px"
            >
              Open the terminal
            </Link>
          </div>
        </section>
      </main>

      <LegalFooter />
    </div>
  );
}
