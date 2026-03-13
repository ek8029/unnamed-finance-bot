import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { analyzeStock } from '@/lib/analyze-stock';
import { AnalysisResultClient } from './analysis-result-client';

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');

  return {
    title: `${symbol} Stock Analysis — Helm Terminal`,
    description: `Free AI-powered analysis of ${symbol} stock. Real-time pricing, financial metrics, analyst consensus, earnings data, and news sentiment.`,
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
      <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
        <AnalysisNav />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center space-y-4 max-w-md">
            <div className="type-h1 text-[var(--color-text-primary)]">Ticker not found</div>
            <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">
              We couldn&apos;t find data for <span className="font-bold text-[var(--color-text-primary)]">{symbol}</span>.
              Make sure it&apos;s a valid US stock ticker.
            </p>
            <a
              href="/analyze"
              className="inline-block mt-2 px-5 py-2 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[13px] font-semibold rounded-sm transition-colors"
            >
              Try another ticker
            </a>
          </div>
        </main>
      </div>
    );
  }

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${analysis.companyName} (${symbol}) Stock Analysis`,
    description: analysis.summary,
    author: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
    publisher: { '@type': 'Organization', name: 'Helm Terminal', url: 'https://helmterminal.dev' },
    datePublished: new Date().toISOString(),
    mainEntityOfPage: `https://helmterminal.dev/analyze/${symbol}`,
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
      <AnalysisNav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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

      <footer className="border-t border-[var(--color-border-subtle)] py-6">
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
    <header className="border-b border-[var(--color-border-subtle)]">
      <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 56 56" fill="none">
            <path d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94" stroke="#B8914A" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="28" y1="7" x2="28" y2="49" stroke="#E8ECF1" strokeWidth="5" strokeLinecap="round" />
            <line x1="7" y1="28" x2="49" y2="28" stroke="#E8ECF1" strokeWidth="5" strokeLinecap="round" />
            <circle cx="28" cy="28" r="10" fill="#B8914A" />
          </svg>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">Helm Terminal</span>
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
            className="px-4 py-1.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[12px] font-semibold rounded-sm transition-colors"
          >
            Get Started
          </a>
        </div>
      </div>
    </header>
  );
}
