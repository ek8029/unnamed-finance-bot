import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { analyzeStock } from '@/lib/analyze-stock';
import { INDEXABLE_TICKERS } from '@/lib/indexable-tickers';

// Daily revalidation; reads the shared analysis_cache only (allowGenerate=false),
// so these pages never trigger a fresh AI generation or extra API cost.
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ ticker: string }>;
}

function clean(ticker: string): string {
  return ticker.toUpperCase().replace(/[^A-Z]/g, '');
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker } = await params;
  const symbol = clean(ticker);
  const { analysis } = await analyzeStock(symbol, false);

  if (!analysis) {
    return { title: `${symbol} Thesis Risks | Helm Terminal`, robots: { index: false, follow: true } };
  }

  const title = `What Could Invalidate the ${symbol} Thesis | Helm Terminal`;
  const description = `The ${analysis.companyName} (${symbol}) bull thesis and the specific risks that could break it. ${analysis.bearCase}`.slice(0, 158);

  return {
    title,
    description,
    openGraph: {
      title: `What Could Invalidate the ${symbol} Thesis`,
      description,
      url: `https://helmterminal.dev/thesis-risks/${symbol}`,
      siteName: 'Helm Terminal',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `What Could Invalidate the ${symbol} Thesis`,
      description,
    },
    alternates: { canonical: `https://helmterminal.dev/thesis-risks/${symbol}` },
    robots: INDEXABLE_TICKERS.has(symbol)
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function ThesisRisksPage({ params }: PageProps) {
  const { ticker } = await params;
  const symbol = clean(ticker);
  if (!symbol || symbol.length > 5) notFound();

  const { analysis, computedAt } = await analyzeStock(symbol, false);

  // No cached analysis available: send the reader to the live analysis page
  // rather than render a thin or empty page.
  if (!analysis) {
    return (
      <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-[22px] font-bold mb-3">No thesis snapshot for {symbol} yet</h1>
          <p className="text-[var(--color-text-secondary)] text-[15px] mb-6">Run a fresh analysis to generate the bull case and its risks.</p>
          <Link href={`/analyze/${symbol}`} className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded hover:brightness-110 transition-all">Analyze {symbol}</Link>
        </div>
      </main>
    );
  }

  const updated = computedAt
    ? new Date(computedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const faqs = [
    {
      q: `What could invalidate the ${symbol} thesis?`,
      a: `The main risks to the ${analysis.companyName} thesis: ${analysis.bearCase}`,
    },
    {
      q: `What is the bull case for ${symbol}?`,
      a: analysis.bullCase,
    },
    {
      q: `How do I know when the ${symbol} thesis is broken?`,
      a: `A ${symbol} thesis is broken when the specific reasons you own it are contradicted by a filing, an earnings result, or a material news event, not merely when the price falls. Decide what would break each reason before you buy, then watch SEC filings and earnings against it.`,
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `What Could Invalidate the ${symbol} Thesis`,
      description: `The ${analysis.companyName} (${symbol}) bull thesis and the specific risks that could break it.`,
      datePublished: computedAt || '2026-06-17',
      dateModified: computedAt || '2026-06-17',
      author: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      url: `https://helmterminal.dev/thesis-risks/${symbol}`,
      about: { '@type': 'Corporation', name: analysis.companyName, tickerSymbol: symbol },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
        { '@type': 'ListItem', position: 2, name: 'Thesis Monitoring', item: 'https://helmterminal.dev/thesis-monitoring' },
        { '@type': 'ListItem', position: 3, name: `${symbol} Thesis Risks`, item: `https://helmterminal.dev/thesis-risks/${symbol}` },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] relative overflow-hidden">
      <CinematicBg />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="relative z-10 border-b border-[var(--color-border-base)]">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HelmMark size={28} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href={`/analyze/${symbol}`} className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">{symbol} Analysis</Link>
            <Link href="/thesis-monitoring" className="text-[15px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Thesis Monitoring</Link>
            <Link href="/signup" className="px-4 py-1.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Sign up</Link>
          </div>
        </div>
      </nav>

      <article className="relative z-10 container mx-auto px-6 pt-12 pb-24 max-w-3xl">
        <header className="mb-8">
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Thesis Risks</div>
          <h1 className="font-sans font-bold text-[30px] md:text-[40px] tracking-tight leading-[1.1] mb-4">
            What could invalidate the {symbol} thesis
          </h1>
          <p className="text-[16px] leading-[1.55] text-[var(--color-text-secondary)]">
            If you own {analysis.companyName} ({symbol}), the question that matters is not where the price is. It is which of your reasons could break, and what would prove it. Here is the bull case and the specific risks that would invalidate it.
          </p>
        </header>

        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          {/* Bull thesis */}
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">The {symbol} bull thesis</h2>
            <p>{analysis.bullCase}</p>
          </section>

          {/* What could break it */}
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">What could break it</h2>
            <div className="sovereign-card rounded p-5 border-l-2 border-[var(--color-gold)]">
              <p className="text-[var(--color-text-primary)]">{analysis.bearCase}</p>
            </div>
          </section>

          {/* Snapshot */}
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">Where it stands now</h2>
            <p>{analysis.summary}</p>
          </section>

          {/* How to monitor */}
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">How to monitor the {symbol} thesis</h2>
            <p className="mb-3">
              Knowing the risks is step one. The harder part is noticing when one actually fires, because the evidence lives in SEC filings and earnings calls, not in the price you check every day. The discipline is simple: write down the reasons you own {symbol}, decide what would break each one, then watch the primary sources against that list.
            </p>
            <p>
              That is what Helm does automatically. You write the pillars behind {symbol}, and Helm scores filings, earnings, news, and price against each one, then tells you with a dated, verbatim citation when a reason weakens or breaks. Read more on <Link href="/thesis-monitoring" className="text-[var(--color-gold)] hover:underline">how thesis monitoring works</Link>.
            </p>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-5">Common questions</h2>
            <div className="space-y-6">
              {faqs.map((f) => (
                <div key={f.q}>
                  <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] mb-1.5">{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="sovereign-card rounded p-6 md:p-8 text-center">
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-2">Track the {symbol} thesis, not just the price.</h2>
            <p className="mb-5 max-w-xl mx-auto">Helm watches the reasons behind {symbol} against live filings and earnings, and tells you when one breaks. Free to start.</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/signup" className="px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Take the helm</Link>
              <Link href={`/analyze/${symbol}`} className="px-5 py-2.5 border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-colors">Full {symbol} analysis</Link>
            </div>
          </section>

          {updated && (
            <p className="text-[13px] text-[var(--color-text-muted)]">Thesis snapshot last computed {updated}. Sources: SEC EDGAR, market data, news.</p>
          )}
          <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border-subtle)] pt-6">
            This content is for educational purposes only and does not constitute financial, tax, or investment advice. The bull and bear cases describe arguments some investors cite, not recommendations. Helm Terminal is not a registered investment advisor.
          </p>
        </div>
      </article>

      <LegalFooter />
    </main>
  );
}
