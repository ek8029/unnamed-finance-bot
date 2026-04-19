import type { Metadata } from 'next';
import Link from 'next/link';
import { HelmMark } from '@/components/helm-mark';
import { LegalFooter } from '@/components/legal-footer';
import { CinematicBg } from '@/components/cinematic-bg';
import { TickerSearch } from './ticker-search';

export const metadata: Metadata = {
  title: 'Free AI Stock Analysis Tool — Analyze 150+ US Stocks | Helm Terminal',
  description:
    'Get free AI-powered analysis for any US stock. Real-time prices, financial metrics, and intelligent insights for AAPL, TSLA, MSFT, and 150+ more tickers.',
  openGraph: {
    title: 'Free AI Stock Analysis Tool — Analyze 150+ US Stocks | Helm Terminal',
    description:
      'Get free AI-powered analysis for any US stock. Real-time prices, financial metrics, and intelligent insights for AAPL, TSLA, MSFT, and 150+ more tickers.',
    url: 'https://helmterminal.dev/analyze',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free AI Stock Analysis Tool — Analyze 150+ US Stocks | Helm Terminal',
    description:
      'Get free AI-powered analysis for any US stock. Real-time prices, financial metrics, and intelligent insights for AAPL, TSLA, MSFT, and 150+ more tickers.',
  },
  alternates: {
    canonical: 'https://helmterminal.dev/analyze',
  },
};

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM'];

export default function AnalyzePage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] bg-depth flex flex-col relative overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Free AI Stock Analysis Tool — Analyze 150+ US Stocks",
            "description": "Get free AI-powered analysis for any US stock. Real-time prices, financial metrics, and intelligent insights for AAPL, TSLA, MSFT, and 150+ more tickers.",
            "url": "https://helmterminal.dev/analyze",
            "isPartOf": { "@type": "WebSite", "name": "Helm Terminal", "url": "https://helmterminal.dev" },
            "provider": { "@type": "Organization", "name": "Helm Terminal" },
          }),
        }}
      />
      <CinematicBg />
      {/* Nav */}
      <nav className="relative z-10 glass-nav">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2.5">
            <HelmMark size={32} />
            <span className="text-[15px] font-bold tracking-tight uppercase">Helm</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/analyze"
              className="text-sm text-[var(--color-text-primary)] font-medium transition-colors"
            >
              Analyze
            </Link>
            <Link
              href="/login"
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-xl w-full text-center space-y-6">
          <div className="space-y-3">
            <div className="type-eyebrow text-[var(--color-gold)]">Free Stock Analysis</div>
            <h1 className="type-display text-[var(--color-text-primary)]">
              Institutional-grade<br />stock analysis
            </h1>
            <p className="type-body text-[var(--color-text-secondary)] max-w-lg mx-auto">
              AI-powered reports with real-time pricing, financial metrics, analyst consensus, earnings data, and news sentiment.
            </p>
          </div>

          {/* Command palette style search */}
          <div className="sovereign-card rounded p-5">
            <TickerSearch />
          </div>

          <div className="space-y-2">
            <div className="type-eyebrow text-[var(--color-text-muted)]">Popular</div>
            <div className="flex flex-wrap justify-center gap-2">
              {POPULAR_TICKERS.map((ticker) => (
                <a
                  key={ticker}
                  href={`/analyze/${ticker}`}
                  className="px-4 py-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {ticker}
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
