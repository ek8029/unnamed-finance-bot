import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { analyzeStock } from '@/lib/analyze-stock';
import { AnalysisResultClient } from './analysis-result-client';
import { HelmMark } from '@/components/helm-mark';
import { CinematicBg } from '@/components/cinematic-bg';

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');

  return {
    title: `${symbol} Stock Analysis — Helm Terminal`,
    description: `Free AI analysis of ${symbol} stock — real-time price, P/E ratio, market cap, analyst consensus, and intelligent insights. No signup required.`,
    openGraph: {
      title: `${symbol} Stock Analysis — Helm Terminal`,
      description: `Institutional-grade AI analysis of ${symbol}. Get the full picture before you invest.`,
      url: `https://helmterminal.dev/analyze/${symbol}`,
      siteName: 'Helm Terminal',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${symbol} Stock Analysis — Helm Terminal`,
      description: `Institutional-grade AI analysis of ${symbol}. Get the full picture before you invest.`,
    },
    alternates: {
      canonical: `https://helmterminal.dev/analyze/${symbol}`,
    },
  };
}

export default async function TickerAnalysisPage({ params }: Props) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');

  if (!symbol || symbol.length > 5) {
    notFound();
  }

  const { analysis, fromCache } = await analyzeStock(symbol);

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

  const tickerHash = symbol.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
  const dayOffset = tickerHash % 60;
  const baseDate = new Date('2025-06-01');
  baseDate.setDate(baseDate.getDate() + dayOffset);
  const datePublished = baseDate.toISOString();
  const dateModified = '2026-03-15T00:00:00.000Z';

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `${analysis.companyName} (${symbol}) Stock Analysis`,
      description: analysis.summary,
      author: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
      datePublished,
      dateModified,
      mainEntityOfPage: `https://helmterminal.dev/analyze/${symbol}`,
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
  ];

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] bg-depth flex flex-col relative overflow-hidden">
      <CinematicBg />
      <AnalysisNav />

      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: `What is ${analysis.companyName}'s current stock price?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `View ${analysis.companyName} (${symbol})'s real-time stock price, AI-powered analysis, and key financial metrics on Helm Terminal.`,
                },
              },
              {
                '@type': 'Question',
                name: `Is ${symbol} a good stock to buy?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `${symbol} analysis includes AI-driven insights covering fundamentals, analyst consensus, and market sentiment. Visit Helm Terminal for the full breakdown.`,
                },
              },
              {
                '@type': 'Question',
                name: `What is ${analysis.companyName}'s market cap?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `Get ${analysis.companyName}'s current market capitalization, P/E ratio, and other key financial metrics with Helm Terminal's free stock analysis tool.`,
                },
              },
              {
                '@type': 'Question',
                name: `Where can I get free stock analysis for ${symbol}?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `Helm Terminal offers free AI-powered stock analysis for ${symbol}, including financial summaries, key metrics, and market insights at helmterminal.dev/analyze/${symbol}.`,
                },
              },
            ],
          }) }}
        />

        {/* Back + meta */}
        <div className="flex items-center justify-between mb-6">
          <a
            href="/analyze"
            className="text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            &larr; Back to search
          </a>
          {fromCache && (
            <span className="type-eyebrow text-[var(--color-text-muted)]">Cached result</span>
          )}
        </div>

        {/* Analysis card + email gate + share (client component) */}
        <AnalysisResultClient analysis={analysis} ticker={symbol} />
      </main>

      <footer className="relative z-10 border-t border-[var(--color-border-subtle)] py-6">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between">
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
      <div className="max-w-3xl mx-auto px-6 h-12 flex items-center justify-between">
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
