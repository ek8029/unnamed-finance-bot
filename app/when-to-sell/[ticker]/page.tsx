import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { analyzeStock } from '@/lib/analyze-stock';
import { INDEXABLE_TICKERS } from '@/lib/indexable-tickers';

// Daily revalidation; reads shared analysis_cache only (allowGenerate=false),
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
    return { title: `When to Sell ${symbol} | Helm Terminal`, robots: { index: false, follow: true } };
  }

  const title = `When to Sell ${symbol}: A Thesis-Based Checklist | Helm Terminal`;
  const description = `When to sell ${analysis.companyName} (${symbol}): the signals that mean your thesis broke, not just that the price fell. A sell-discipline checklist for ${symbol} holders.`.slice(0, 158);

  return {
    title,
    description,
    openGraph: {
      title: `When to Sell ${symbol}: A Thesis-Based Checklist`,
      description,
      url: `https://helmterminal.dev/when-to-sell/${symbol}`,
      siteName: 'Helm Terminal',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `When to Sell ${symbol}`,
      description,
    },
    alternates: { canonical: `https://helmterminal.dev/when-to-sell/${symbol}` },
    robots: INDEXABLE_TICKERS.has(symbol)
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function WhenToSellPage({ params }: PageProps) {
  const { ticker } = await params;
  const symbol = clean(ticker);
  if (!symbol || symbol.length > 5) notFound();

  const { analysis } = await analyzeStock(symbol, false);

  if (!analysis) {
    return (
      <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="text-[22px] font-bold mb-3">No snapshot for {symbol} yet</h1>
          <p className="text-[var(--color-text-secondary)] text-[15px] mb-6">Run a fresh analysis to see the bull case and sell signals.</p>
          <Link href={`/analyze/${symbol}`} className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded hover:brightness-110 transition-all">Analyze {symbol}</Link>
        </div>
      </main>
    );
  }

  const faqs = [
    {
      q: `When should I sell ${symbol}?`,
      a: `Sell ${analysis.companyName} when the specific reasons you bought it are contradicted by a filing, an earnings result, or a material news event, not merely when the price falls. A lower price with the thesis intact is a different situation from a broken thesis.`,
    },
    {
      q: `What are the warning signs for ${symbol}?`,
      a: `The main risks to watch: ${analysis.bearCase}`,
    },
    {
      q: `Is a falling ${symbol} price a reason to sell?`,
      a: `Not by itself. Price is not a reason. The question is whether the reasons you own ${symbol} still hold. If they do, a drawdown may be noise; if they do not, the position deserves a fresh decision regardless of price.`,
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `When to Sell ${symbol}: A Thesis-Based Checklist`,
      description: `When to sell ${analysis.companyName} (${symbol}): the signals that mean your thesis broke.`,
      datePublished: '2026-06-17',
      dateModified: '2026-06-17',
      author: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      url: `https://helmterminal.dev/when-to-sell/${symbol}`,
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
        { '@type': 'ListItem', position: 3, name: `When to Sell ${symbol}`, item: `https://helmterminal.dev/when-to-sell/${symbol}` },
      ],
    },
  ];

  const checklist = [
    ['Did a reason break, or just the price?', 'A drawdown with your thesis intact is not a sell signal. A contradicted pillar is.'],
    ['Check the latest filing and earnings', `Read what changed against your reasons for owning ${symbol}, not against the stock chart.`],
    ['Look for the specific risks', `${symbol}'s known risks are below. Watch for any of them turning from possibility into fact.`],
    ['Re-underwrite, do not anchor', `If a reason is gone, decide whether you would buy ${symbol} today on what remains. If not, the position is a hold by inertia.`],
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
          <div className="type-eyebrow text-[var(--color-gold)] mb-4">Sell Discipline</div>
          <h1 className="font-sans font-bold text-[30px] md:text-[40px] tracking-tight leading-[1.1] mb-4">
            When to sell {symbol}
          </h1>
          <p className="text-[16px] leading-[1.55] text-[var(--color-text-secondary)]">
            The honest answer to "when should I sell {analysis.companyName}" is not a price target. It is the moment the reasons you bought it stop being true. Here is a thesis-based checklist for {symbol} holders.
          </p>
        </header>

        <div className="space-y-10 text-[var(--color-text-secondary)] text-[15px] leading-relaxed">
          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-4">The {symbol} sell checklist</h2>
            <ol className="space-y-4">
              {checklist.map(([title, body], i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] text-[var(--color-gold)] font-mono text-[14px] font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <span className="text-[var(--color-text-primary)] font-semibold">{title} </span>
                    <span>{body}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">What you bought {symbol} for</h2>
            <p>{analysis.bullCase}</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">The signals that would break it</h2>
            <div className="sovereign-card rounded p-5 border-l-2 border-[var(--color-gold)]">
              <p className="text-[var(--color-text-primary)]">{analysis.bearCase}</p>
            </div>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">Where {symbol} stands now</h2>
            <p>{analysis.summary}</p>
          </section>

          <section>
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-3">The hard part is noticing</h2>
            <p>
              Everyone agrees you should sell when the reasons change. The problem is that the evidence lives in filings and earnings calls, while you spend your attention on the price. Helm closes that gap: you write the reasons you own {symbol}, and Helm watches the primary sources against them, then tells you with a dated citation when one breaks. See <Link href="/thesis-monitoring" className="text-[var(--color-gold)] hover:underline">how thesis monitoring works</Link>, or read <Link href={`/thesis-risks/${symbol}`} className="text-[var(--color-gold)] hover:underline">what could invalidate the {symbol} thesis</Link>.
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
            <h2 className="text-[21px] font-bold text-[var(--color-text-primary)] mb-2">Know the moment, not the price.</h2>
            <p className="mb-5 max-w-xl mx-auto">Helm tells you, with a dated source, when the {symbol} thesis breaks. Free to start.</p>
            <Link href="/signup" className="inline-block px-5 py-2.5 bg-[var(--color-gold)] text-[var(--color-bg-base)] font-bold text-[13px] uppercase tracking-[0.15em] rounded transition-all hover:brightness-110">Take the helm</Link>
          </section>

          <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border-subtle)] pt-6">
            This content is for educational purposes only and does not constitute financial, tax, or investment advice. Helm Terminal is not a registered investment advisor.
          </p>
        </div>
      </article>

      <LegalFooter />
    </main>
  );
}
