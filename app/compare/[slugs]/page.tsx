import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { analyzeStock } from '@/lib/analyze-stock';
import { isCanonicalPair, isCuratedPair } from '@/lib/comparison-pairs';
import { getFullTickerData, type TickerData } from '@/lib/financial-data';
import { SiteNav } from '@/components/site-nav';
import { ArrowLeft, ArrowUpRight, ArrowRight } from 'lucide-react';
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
  return `$${val.toLocaleString('en-US')}`;
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
    robots: isCanonicalPair(ticker1, ticker2)
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

/* ── Page ── */

export default async function ComparePage({ params }: Props) {
  const { slugs } = await params;
  const parsed = parseSlugs(slugs);

  if (!parsed) notFound();

  const { ticker1, ticker2 } = parsed;

  // Cost guard: an arbitrary pair may serve from cache but never pay for a
  // fresh generation, so crawling /compare/ANY-vs-ANY costs nothing. Both
  // analyses come back null for an uncached arbitrary pair, which falls
  // through to the notFound() below.
  const allowGenerate = isCuratedPair(ticker1, ticker2);

  // Analyses first, and bail before touching the market-data vendor. Fetching
  // all four together meant an arbitrary pair still spent two Finnhub calls on
  // a page that was about to 404, which is the same drain as the generation
  // itself, just cheaper per hit.
  const [result1, result2] = await Promise.all([
    analyzeStock(ticker1, allowGenerate),
    analyzeStock(ticker2, allowGenerate),
  ]);

  const a1 = result1.analysis;
  const a2 = result2.analysis;

  if (!a1 && !a2) notFound();

  const [td1, td2] = await Promise.all([
    getFullTickerData(ticker1),
    getFullTickerData(ticker2),
  ]);

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
    <div className="helm-discovery helm-comparison">
      <CompareGate />
      <SiteNav />

      <main id="main-content" className="helm-discovery-width helm-comparison-content">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* H1 */}
        <header className="helm-comparison-heading">
          <Link href="/compare" className="helm-comparison-back"><ArrowLeft size={15} /> All comparisons</Link>
          <p className="helm-kicker">STOCK COMPARISON</p>
          <h1>
            {name1} vs {name2}
          </h1>
          <p className="helm-discovery-description">
            Side-by-side fundamentals, valuation, and AI summaries for both tickers.
          </p>
          <nav className="helm-comparison-jump" aria-label="Comparison sections">
            <a href="#metrics">Key metrics <ArrowRight size={14} /></a>
            {a1 && a2 && <a href="#investment-cases">Bull &amp; bear cases <ArrowRight size={14} /></a>}
            <a href="#questions">Questions <ArrowRight size={14} /></a>
          </nav>
        </header>

        {/* Verdict Cards */}
        {a1 && a2 && (
          <div className="helm-comparison-verdicts">
            <VerdictCard ticker={ticker1} name={name1} analysis={a1} />
            <VerdictCard ticker={ticker2} name={name2} analysis={a2} />
          </div>
        )}

        {/* Side-by-side comparison table */}
        <section id="metrics" className="helm-comparison-section">
          <div className="helm-discovery-section-line"><h2>Key metrics</h2><span>THE NUMBERS, SIDE BY SIDE</span></div>
          <table className="helm-comparison-table">
            <caption className="sr-only">Financial metrics for {ticker1} and {ticker2}</caption>
            <thead><tr><th scope="col">Metric</th><th scope="col">{ticker1}</th><th scope="col">{ticker2}</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.ticker1}</td><td>{row.ticker2}</td></tr>)}</tbody>
          </table>
        </section>

        {/* Bull / Bear Cases */}
        {a1 && a2 && (
          <section id="investment-cases" className="helm-comparison-section">
            <div className="helm-discovery-section-line"><h2>Bull &amp; bear cases</h2><span>WEIGH BOTH SIDES</span></div>
            <div className="helm-comparison-cases">
              <CaseCard ticker={ticker1} bullCase={a1.bullCase} bearCase={a1.bearCase} />
              <CaseCard ticker={ticker2} bullCase={a2.bullCase} bearCase={a2.bearCase} />
            </div>
          </section>
        )}

        {/* FAQ Section */}
        <section id="questions" className="helm-comparison-section helm-comparison-faq">
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
        <section className="helm-discovery-next">
          <div>
            <p className="helm-kicker">RESEARCH IS JUST THE BEGINNING</p>
            <h2>Put the comparison in context.</h2>
            <p>Bring your holdings into Helm for portfolio intelligence, daily briefs, and thesis monitoring. Start with one position.</p>
            <div className="helm-comparison-full-links">
              <Link href={`/analyze/${ticker1}`} className="helm-text-link">Full {ticker1} analysis <ArrowUpRight size={16} /></Link>
              <Link href={`/analyze/${ticker2}`} className="helm-text-link">Full {ticker2} analysis <ArrowUpRight size={16} /></Link>
            </div>
          </div>
          <div className="helm-discovery-next-actions">
            <Link href="/signup" className="helm-button">Build my portfolio view <ArrowRight size={17} /></Link>
            <span>Free to start. No card required.</span>
          </div>
        </section>

        {/* Disclaimer */}
        <p className="text-[12px] italic text-[var(--color-text-muted)] text-center mt-6 max-w-2xl mx-auto">
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
    <article className={`helm-comparison-verdict ${verdictBg(analysis.verdict)}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p
            className="text-[12px] uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {ticker}
          </p>
          <p className="text-[16px] font-semibold text-[var(--color-text-primary)]">{name}</p>
        </div>
        <span className={`text-[15px] font-bold ${verdictColor(analysis.verdict)}`} style={{ fontFamily: 'var(--font-mono)' }}>
          {label}
        </span>
      </div>
      <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed mb-3">
        {analysis.summary}
      </p>
      <p className="text-[13px] text-[var(--color-text-secondary)] italic">
        {analysis.recommendation}
      </p>
    </article>
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
    <article className="helm-comparison-case space-y-5">
      <p
        className="text-[13px] uppercase tracking-[0.2em] text-[var(--color-text-primary)] font-semibold"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {ticker}
      </p>
      <div>
        <p className="text-[12px] uppercase tracking-[0.15em] text-emerald-400 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
          Bull Case
        </p>
        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">{bullCase}</p>
      </div>
      <div>
        <p className="text-[12px] uppercase tracking-[0.15em] text-red-400 mb-1.5" style={{ fontFamily: 'var(--font-mono)' }}>
          Bear Case
        </p>
        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">{bearCase}</p>
      </div>
    </article>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{q}</h3>
      <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">{a}</p>
    </div>
  );
}
