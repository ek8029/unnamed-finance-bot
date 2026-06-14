import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { analyzeStock } from '@/lib/analyze-stock';
import { getFullTickerData, type TickerData } from '@/lib/financial-data';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';
import { LegalFooter } from '@/components/legal-footer';
import { CompareGate } from '@/components/compare-gate';

interface Props {
  params: Promise<{ slugs: string }>;
}

/* ── Slug parsing ── */

function parseSlugs(slug: string): { ticker1: string; ticker2: string } | null {
  const match = slug.match(/^([A-Za-z]{1,5})-vs-([A-Za-z]{1,5})$/);
  if (!match) return null;
  return {
    ticker1: match[1].toUpperCase(),
    ticker2: match[2].toUpperCase(),
  };
}

/* ── Helpers ── */

function fmt(n: number | null | undefined, prefix = '', suffix = ''): string {
  if (n == null) return 'N/A';
  return `${prefix}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
}

function fmtCap(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  const val = n * 1_000_000; // Finnhub stores in millions
  if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  return `$${val.toLocaleString()}`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return 'N/A';
  return `$${n.toFixed(2)}`;
}

function verdictColor(verdict: string): string {
  switch (verdict) {
    case 'bullish': return 'text-emerald-400';
    case 'bearish': return 'text-red-400';
    default: return 'text-[var(--color-gold)]';
  }
}

function verdictBg(verdict: string): string {
  switch (verdict) {
    case 'bullish': return 'bg-emerald-500/10 border-emerald-500/20';
    case 'bearish': return 'bg-red-500/10 border-red-500/20';
    default: return 'bg-[var(--color-gold)]/10 border-[var(--color-gold)]/20';
  }
}

/* ── Metric extraction from TickerData ── */

interface ComparisonRow {
  label: string;
  ticker1: string;
  ticker2: string;
}

function buildComparisonRows(td1: TickerData, td2: TickerData): ComparisonRow[] {
  const m1 = td1.financials?.metric || {};
  const m2 = td2.financials?.metric || {};

  return [
    { label: 'Price', ticker1: fmtPrice(td1.quote?.c), ticker2: fmtPrice(td2.quote?.c) },
    { label: 'Market Cap', ticker1: fmtCap(td1.profile?.marketCapitalization), ticker2: fmtCap(td2.profile?.marketCapitalization) },
    { label: 'P/E Ratio', ticker1: fmt(m1['peBasicExclExtraTTM'] as number | null), ticker2: fmt(m2['peBasicExclExtraTTM'] as number | null) },
    { label: 'EPS Growth (YoY)', ticker1: fmt(m1['epsGrowthTTMYoy'] as number | null, '', '%'), ticker2: fmt(m2['epsGrowthTTMYoy'] as number | null, '', '%') },
    { label: 'Revenue Growth (YoY)', ticker1: fmt(m1['revenueGrowthTTMYoy'] as number | null, '', '%'), ticker2: fmt(m2['revenueGrowthTTMYoy'] as number | null, '', '%') },
    { label: 'ROE', ticker1: fmt(m1['roeTTM'] as number | null, '', '%'), ticker2: fmt(m2['roeTTM'] as number | null, '', '%') },
    { label: 'Gross Margin', ticker1: fmt(m1['grossMarginTTM'] as number | null, '', '%'), ticker2: fmt(m2['grossMarginTTM'] as number | null, '', '%') },
    { label: 'Net Margin', ticker1: fmt(m1['netProfitMarginTTM'] as number | null, '', '%'), ticker2: fmt(m2['netProfitMarginTTM'] as number | null, '', '%') },
    { label: '52W High', ticker1: fmtPrice(m1['52WeekHigh'] as number | null), ticker2: fmtPrice(m2['52WeekHigh'] as number | null) },
    { label: '52W Low', ticker1: fmtPrice(m1['52WeekLow'] as number | null), ticker2: fmtPrice(m2['52WeekLow'] as number | null) },
    { label: 'Dividend Yield', ticker1: fmt(m1['dividendYieldIndicatedAnnual'] as number | null, '', '%'), ticker2: fmt(m2['dividendYieldIndicatedAnnual'] as number | null, '', '%') },
    { label: 'Beta', ticker1: fmt(m1['beta'] as number | null), ticker2: fmt(m2['beta'] as number | null) },
    { label: 'D/E Ratio', ticker1: fmt(m1['debtEquityQuarterly'] as number | null), ticker2: fmt(m2['debtEquityQuarterly'] as number | null) },
    { label: 'Current Ratio', ticker1: fmt(m1['currentRatioQuarterly'] as number | null), ticker2: fmt(m2['currentRatioQuarterly'] as number | null) },
  ];
}

/* ── Metadata ── */

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slugs } = await params;
  const parsed = parseSlugs(slugs);

  if (!parsed) {
    return { title: 'Comparison not found | Helm Terminal' };
  }

  const { ticker1, ticker2 } = parsed;
  const title = `${ticker1} vs ${ticker2} -- Stock Comparison | Helm Terminal`;
  const description = `Side-by-side comparison of ${ticker1} and ${ticker2}. Compare price, P/E ratio, market cap, margins, dividends, and AI summaries. Free on Helm Terminal.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://helmterminal.dev/compare/${ticker1}-vs-${ticker2}`,
      siteName: 'Helm Terminal',
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: `https://helmterminal.dev/compare/${ticker1}-vs-${ticker2}` },
  };
}

/* ── Page ── */

export default async function ComparePage({ params }: Props) {
  const { slugs } = await params;
  const parsed = parseSlugs(slugs);

  if (!parsed) notFound();

  const { ticker1, ticker2 } = parsed;

  // Fetch data for both tickers in parallel
  const [result1, result2, td1, td2] = await Promise.all([
    analyzeStock(ticker1),
    analyzeStock(ticker2),
    getFullTickerData(ticker1),
    getFullTickerData(ticker2),
  ]);

  const a1 = result1.analysis;
  const a2 = result2.analysis;

  if (!a1 && !a2) notFound();

  const name1 = a1?.companyName || td1.profile?.name || ticker1;
  const name2 = a2?.companyName || td2.profile?.name || ticker2;
  const rows = buildComparisonRows(td1, td2);

  /* ── JSON-LD ── */

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'AnalysisNewsArticle',
      headline: `${name1} vs ${name2} — Stock Comparison`,
      description: `Side-by-side comparison of ${ticker1} and ${ticker2}. Compare price, P/E ratio, market cap, margins, dividends, and AI summaries.`,
      articleSection: 'Stock Comparison',
      datePublished: new Date().toISOString(),
      author: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      publisher: {
        '@type': 'Organization',
        name: 'Helm Terminal',
        url: 'https://helmterminal.dev',
        logo: { '@type': 'ImageObject', url: 'https://helmterminal.dev/icon' },
      },
      mainEntityOfPage: `https://helmterminal.dev/compare/${ticker1}-vs-${ticker2}`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
        { '@type': 'ListItem', position: 2, name: 'Compare', item: 'https://helmterminal.dev/compare' },
        { '@type': 'ListItem', position: 3, name: `${ticker1} vs ${ticker2}`, item: `https://helmterminal.dev/compare/${ticker1}-vs-${ticker2}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `How do ${ticker1} and ${ticker2} compare?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: a1 && a2
              ? `${ticker1}: ${a1.summary} ${ticker2}: ${a2.summary}`
              : `Compare ${ticker1} and ${ticker2} fundamentals, valuation, and analyst consensus on Helm Terminal.`,
          },
        },
        {
          '@type': 'Question',
          name: `Which has better growth potential, ${ticker1} or ${ticker2}?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: a1 && a2
              ? `${a1.bullCase} For ${ticker2}: ${a2.bullCase}`
              : `Analyze growth metrics for ${ticker1} and ${ticker2} side by side on Helm Terminal.`,
          },
        },
        {
          '@type': 'Question',
          name: `What are the risks of ${ticker1} vs ${ticker2}?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: a1 && a2
              ? `${ticker1} risks: ${a1.bearCase} ${ticker2} risks: ${a2.bearCase}`
              : `Review risk factors for both ${ticker1} and ${ticker2} on Helm Terminal.`,
          },
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] bg-depth flex flex-col relative overflow-hidden">
      <CompareGate />
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
              href="/compare"
              className="text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Compare
            </Link>
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

      <main className="relative z-10 flex-1 w-full max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 py-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* H1 */}
        <div className="text-center mb-10">
          <p
            className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-gold)] mb-3"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Stock Comparison
          </p>
          <h1 className="text-[28px] sm:text-[36px] font-bold text-[var(--color-text-primary)] leading-tight">
            {name1} vs {name2}
          </h1>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-2 max-w-xl mx-auto">
            Side-by-side fundamentals, valuation, and AI summaries for both tickers.
          </p>
        </div>

        {/* Verdict Cards */}
        {a1 && a2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            <VerdictCard ticker={ticker1} name={name1} analysis={a1} />
            <VerdictCard ticker={ticker2} name={name2} analysis={a2} />
          </div>
        )}

        {/* Side-by-side comparison table */}
        <section className="mb-10">
          <h2
            className="text-[13px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Key Metrics
          </h2>
          <div className="border border-[var(--color-border-base)] rounded-lg overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-3 bg-white/[0.03] border-b border-[var(--color-border-subtle)]">
              <div className="px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                Metric
              </div>
              <div className="px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-primary)] text-center" style={{ fontFamily: 'var(--font-mono)' }}>
                {ticker1}
              </div>
              <div className="px-4 py-3 text-[11px] uppercase tracking-[0.15em] text-[var(--color-text-primary)] text-center" style={{ fontFamily: 'var(--font-mono)' }}>
                {ticker2}
              </div>
            </div>
            {/* Data rows */}
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-3 border-b border-[var(--color-border-subtle)] last:border-b-0 ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}
              >
                <div className="px-4 py-2.5 text-[13px] text-[var(--color-text-secondary)]">
                  {row.label}
                </div>
                <div className="px-4 py-2.5 text-[13px] text-[var(--color-text-primary)] text-center" style={{ fontFamily: 'var(--font-mono)' }}>
                  {row.ticker1}
                </div>
                <div className="px-4 py-2.5 text-[13px] text-[var(--color-text-primary)] text-center" style={{ fontFamily: 'var(--font-mono)' }}>
                  {row.ticker2}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bull / Bear Cases */}
        {a1 && a2 && (
          <section className="mb-10">
            <h2
              className="text-[13px] uppercase tracking-[0.2em] text-[var(--color-gold)] mb-4"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Bull &amp; Bear Cases
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CaseCard ticker={ticker1} bullCase={a1.bullCase} bearCase={a1.bearCase} />
              <CaseCard ticker={ticker2} bullCase={a2.bullCase} bearCase={a2.bearCase} />
            </div>
          </section>
        )}

        {/* FAQ Section */}
        <section className="mb-10 border-t border-[var(--color-border-subtle)] pt-8 max-w-3xl mx-auto">
          <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)] mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-5">
            <FaqItem
              q={`How do ${ticker1} and ${ticker2} compare?`}
              a={a1 && a2
                ? `${name1}: ${a1.summary} ${name2}: ${a2.summary}`
                : `Compare ${ticker1} and ${ticker2} fundamentals, valuation, and analyst consensus on Helm Terminal.`}
            />
            <FaqItem
              q={`Which has better growth potential, ${ticker1} or ${ticker2}?`}
              a={a1 && a2
                ? `${name1}: ${a1.bullCase} ${name2}: ${a2.bullCase}`
                : `Analyze growth metrics for ${ticker1} and ${ticker2} side by side on Helm Terminal.`}
            />
            <FaqItem
              q={`What are the risks of investing in ${ticker1} or ${ticker2}?`}
              a={a1 && a2
                ? `${name1} risks: ${a1.bearCase} ${name2} risks: ${a2.bearCase}`
                : `Review risk factors for both stocks on Helm Terminal.`}
            />
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-10 border-t border-[var(--color-border-subtle)]">
          <h2 className="text-[22px] font-bold text-[var(--color-text-primary)] mb-3">
            Get deeper analysis on Helm Terminal
          </h2>
          <p className="text-[14px] text-[var(--color-text-secondary)] mb-6 max-w-md mx-auto">
            AI-powered portfolio intelligence, daily briefs, and real-time monitoring for every stock you own.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="px-6 py-2.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[13px] font-semibold rounded transition-colors"
            >
              Sign Up Free
            </Link>
            <div className="flex gap-3">
              <Link
                href={`/analyze/${ticker1}`}
                className="px-5 py-2.5 border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-[13px] font-medium rounded transition-colors"
              >
                Full {ticker1} Analysis
              </Link>
              <Link
                href={`/analyze/${ticker2}`}
                className="px-5 py-2.5 border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-[13px] font-medium rounded transition-colors"
              >
                Full {ticker2} Analysis
              </Link>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <p className="text-[11px] italic text-[var(--color-text-muted)] text-center mt-6 max-w-2xl mx-auto">
          Not financial advice. Informational use only. AI-generated content may contain errors.
          Consult a licensed financial advisor before making investment decisions.
        </p>
      </main>

      <LegalFooter />
    </div>
  );
}

/* ── Sub-components ── */

function VerdictCard({
  ticker,
  name,
  analysis,
}: {
  ticker: string;
  name: string;
  analysis: NonNullable<Awaited<ReturnType<typeof analyzeStock>>['analysis']>;
}) {
  const label = analysis.verdict.charAt(0).toUpperCase() + analysis.verdict.slice(1);
  return (
    <div className={`border rounded-lg p-5 ${verdictBg(analysis.verdict)}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {ticker}
          </p>
          <p className="text-[16px] font-semibold text-[var(--color-text-primary)]">{name}</p>
        </div>
        <span className={`text-[14px] font-bold ${verdictColor(analysis.verdict)}`} style={{ fontFamily: 'var(--font-mono)' }}>
          {label}
        </span>
      </div>
      <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed mb-3">
        {analysis.summary}
      </p>
      <p className="text-[12px] text-[var(--color-text-secondary)] italic">
        {analysis.recommendation}
      </p>
    </div>
  );
}

function CaseCard({
  ticker,
  bullCase,
  bearCase,
}: {
  ticker: string;
  bullCase: string;
  bearCase: string;
}) {
  return (
    <div className="border border-[var(--color-border-base)] rounded-lg p-5 space-y-4">
      <p
        className="text-[12px] uppercase tracking-[0.2em] text-[var(--color-text-primary)] font-semibold"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {ticker}
      </p>
      <div>
        <p className="text-[11px] uppercase tracking-[0.15em] text-emerald-400 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
          Bull Case
        </p>
        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">{bullCase}</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.15em] text-red-400 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
          Bear Case
        </p>
        <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">{bearCase}</p>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">{q}</h3>
      <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">{a}</p>
    </div>
  );
}
