import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { analyzeStock } from '@/lib/analyze-stock';
import { getFullTickerData } from '@/lib/financial-data';
import { AnalysisTerminal } from './analysis-terminal';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';

interface Props {
  params: Promise<{ ticker: string }>;
}

/** Truncate to a meta-description-friendly length without breaking mid-word. */
function truncateForMeta(text: string, max = 155): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const sliced = clean.slice(0, max);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? sliced.slice(0, lastSpace) : sliced) + '…';
}

/** Human-readable relative time for freshness display ("3 minutes ago"). */
function relativeTime(iso: string | null): string {
  if (!iso) return 'moments ago';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');

  if (!symbol || symbol.length > 5) {
    return { title: 'Ticker not found — Helm Terminal' };
  }

  // Call analyzeStock for both metadata and page body — it's cached, so the
  // second call in the page component is free.
  const { analysis, computedAt } = await analyzeStock(symbol);

  if (!analysis) {
    return {
      title: `${symbol} — Ticker not found | Helm Terminal`,
      description: `We couldn't find data for ${symbol}. Helm covers US-listed stocks and ETFs.`,
      alternates: { canonical: `https://helmterminal.dev/analyze/${symbol}` },
    };
  }

  // Dynamic description from real analysis — every ticker gets unique meta
  const dynamicDesc = truncateForMeta(
    `${analysis.companyName} (${symbol}) — ${analysis.summary} ${analysis.recommendation}`,
  );

  return {
    title: `${symbol} Stock Analysis — ${analysis.companyName} | Helm Terminal`,
    description: dynamicDesc,
    openGraph: {
      title: `${symbol} — ${analysis.companyName} Analysis`,
      description: dynamicDesc,
      url: `https://helmterminal.dev/analyze/${symbol}`,
      siteName: 'Helm Terminal',
      type: 'article',
      publishedTime: computedAt || undefined,
      modifiedTime: computedAt || undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${symbol} — ${analysis.companyName} Analysis`,
      description: dynamicDesc,
    },
    alternates: {
      canonical: `https://helmterminal.dev/analyze/${symbol}`,
    },
    other: {
      'article:published_time': computedAt || '',
      'article:modified_time': computedAt || '',
    },
  };
}

export default async function TickerAnalysisPage({ params }: Props) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');

  if (!symbol || symbol.length > 5) {
    notFound();
  }

  const [{ analysis, computedAt, dataSources, methodologyVersion }, tickerData] = await Promise.all([
    analyzeStock(symbol),
    getFullTickerData(symbol),
  ]);

  if (!analysis) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] bg-depth flex flex-col relative overflow-hidden">
        <CinematicBg />
        <AnalysisNav />
        <main className="relative z-10 flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-5 max-w-md">
            <div className="type-h1 text-[var(--color-text-primary)]">Ticker not found</div>
            <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">
              We couldn&apos;t find data for <span className="font-bold text-[var(--color-text-primary)]">{symbol}</span>.
              Helm currently covers US-listed stocks and ETFs (NYSE, NASDAQ, AMEX). International stocks, mutual funds, and OTC securities are not yet supported.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="/analyze"
                className="px-5 py-2 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[13px] font-semibold rounded transition-colors"
              >
                Try another ticker
              </a>
              <a
                href="/analyze/AAPL"
                className="px-5 py-2 border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-[13px] font-medium rounded transition-colors"
              >
                See an example (AAPL)
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const computedAtIso = computedAt || new Date().toISOString();
  const relTime = relativeTime(computedAtIso);
  const verdictLabel = analysis.verdict.charAt(0).toUpperCase() + analysis.verdict.slice(1);

  // Prompt-shaped FAQ using REAL analysis data — matches what users type
  // into ChatGPT/Claude/Perplexity so Helm becomes a cited source
  const faqs = [
    {
      question: `Is ${symbol} a buy right now?`,
      answer: `Helm's AI rates ${symbol} as ${verdictLabel}. ${analysis.recommendation}`,
    },
    {
      question: `What are the main risks of holding ${symbol}?`,
      answer: analysis.bearCase,
    },
    {
      question: `What are the opportunities for ${symbol}?`,
      answer: analysis.bullCase,
    },
    {
      question: `What does Helm's AI say about ${symbol}?`,
      answer: analysis.summary,
    },
    {
      question: `What is ${analysis.companyName}'s current outlook?`,
      answer: `${analysis.summary} Our overall verdict is ${verdictLabel}.`,
    },
    {
      question: `Where can I get free AI analysis for ${symbol}?`,
      answer: `Helm Terminal offers free AI-powered stock analysis for ${symbol} at helmterminal.dev/analyze/${symbol}, updated continuously during US market hours. No signup required.`,
    },
  ];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'AnalysisNewsArticle',
      headline: `${analysis.companyName} (${symbol}) Stock Analysis`,
      description: analysis.summary,
      author: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      publisher: {
        '@type': 'Organization',
        name: 'Helm Terminal',
        url: 'https://helmterminal.dev',
        logo: { '@type': 'ImageObject', url: 'https://helmterminal.dev/icon' },
      },
      datePublished: computedAtIso,
      dateModified: computedAtIso,
      mainEntityOfPage: `https://helmterminal.dev/analyze/${symbol}`,
      about: {
        '@type': 'Corporation',
        name: analysis.companyName,
        tickerSymbol: symbol,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://helmterminal.dev' },
        { '@type': 'ListItem', position: 2, name: 'Stock Analysis', item: 'https://helmterminal.dev/analyze' },
        { '@type': 'ListItem', position: 3, name: `${symbol} Analysis`, item: `https://helmterminal.dev/analyze/${symbol}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] bg-depth flex flex-col relative overflow-hidden">
      <CinematicBg />
      <AnalysisNav />

      <main className="relative z-10 flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        {/* Answer-first H1 — matches LLM prompt patterns */}
        <h1 className="sr-only">
          {symbol} Stock Analysis — {analysis.companyName}. Helm&apos;s AI verdict: {verdictLabel}. {analysis.recommendation}
        </h1>

        {/* Bloomberg-style 3-pane terminal */}
        <AnalysisTerminal
          analysis={analysis}
          tickerData={tickerData}
          ticker={symbol}
          computedAt={computedAtIso}
          dataSources={dataSources}
          methodologyVersion={methodologyVersion}
        />

        {/* Answer-first Q&A section — extractable by LLMs */}
        <section className="mt-8 space-y-6 border-t border-[var(--color-border-subtle)] pt-6 max-w-3xl mx-auto">
          <h2 className="type-h2 text-[var(--color-text-primary)]">Common questions about {symbol}</h2>
          {faqs.map((f, i) => (
            <div key={i} className="space-y-1.5">
              <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">{f.question}</h3>
              <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">{f.answer}</p>
            </div>
          ))}
        </section>

        {/* Methodology + data provenance (YMYL / E-E-A-T) */}
        <section className="mt-8 border-t border-[var(--color-border-subtle)] pt-6 max-w-3xl mx-auto">
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center justify-between text-[13px] font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-gold)] transition-colors">
              <span>How this analysis is computed</span>
              <span className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform" aria-hidden="true">&#9662;</span>
            </summary>
            <div className="mt-4 space-y-3 text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
              <div>
                <dt className="inline font-semibold text-[var(--color-text-primary)]">Computed: </dt>
                <dd className="inline">
                  <time dateTime={computedAtIso}>{new Date(computedAtIso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} ET</time>
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold text-[var(--color-text-primary)]">Data sources: </dt>
                <dd className="inline">{dataSources.join(', ')}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-[var(--color-text-primary)]">Pipeline version: </dt>
                <dd className="inline">Helm AI {methodologyVersion}</dd>
              </div>
              <p>
                Helm&apos;s analysis is generated by an AI model from live market data. It identifies risk signals, opportunities, and key metrics based on current fundamentals, recent price action, and analyst consensus. It does not execute trades, issue certified investment advice, or predict future prices.
              </p>
              <p className="text-[11px] italic text-[var(--color-text-muted)]">
                Not financial advice. Informational use only. AI-generated content may contain errors. Consult a licensed financial advisor before making investment decisions. Helm Terminal is not registered as an investment advisor.
              </p>
            </div>
          </details>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[var(--color-border-subtle)] py-6">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span className="type-eyebrow text-[var(--color-text-muted)]">helmterminal.dev</span>
          <div className="flex gap-4">
            <a href="/privacy" className="type-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">Privacy</a>
            <a href="/terms" className="type-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AnalysisNav() {
  return (
    <header className="relative z-10 glass-nav">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <HelmMark size={24} />
          <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
        </a>
        <div className="flex items-center gap-4">
          <a
            href="/analyze"
            className="text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Analyze
          </a>
          <a
            href="/signup"
            className="px-4 py-1.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[12px] font-semibold rounded transition-colors"
          >
            Get Started
          </a>
        </div>
      </div>
    </header>
  );
}
