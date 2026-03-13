import type { Metadata } from 'next';
import { TickerSearch } from './ticker-search';

export const metadata: Metadata = {
  title: 'Free Stock Analysis — Helm Terminal',
  description:
    'Get institutional-grade AI stock analysis for any ticker. Real-time data, analyst consensus, earnings, and news — powered by Helm Terminal.',
  openGraph: {
    title: 'Free Stock Analysis — Helm Terminal',
    description:
      'AI-powered stock analysis with real financial data. Instant reports for any publicly traded company.',
    url: 'https://helmterminal.dev/analyze',
    siteName: 'Helm Terminal',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Stock Analysis — Helm Terminal',
    description:
      'AI-powered stock analysis with real financial data. Instant reports for any publicly traded company.',
  },
  alternates: {
    canonical: 'https://helmterminal.dev/analyze',
  },
};

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM'];

export default function AnalyzePage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
      {/* Nav */}
      <header className="border-b border-[var(--color-border-subtle)]">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 56 56" fill="none">
              <path d="M 10.06 39.94 A 22 22 0 1 1 45.94 39.94" stroke="#B8914A" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="28" y1="7" x2="28" y2="49" stroke="#E8ECF1" strokeWidth="5" strokeLinecap="round" />
              <line x1="7" y1="28" x2="49" y2="28" stroke="#E8ECF1" strokeWidth="5" strokeLinecap="round" />
              <circle cx="28" cy="28" r="10" fill="#B8914A" />
            </svg>
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]">Helm Terminal</span>
          </a>
          <a
            href="/signup"
            className="px-4 py-1.5 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[12px] font-semibold rounded-sm transition-colors"
          >
            Get Started
          </a>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="space-y-3">
            <div className="type-eyebrow text-[var(--color-gold)]">Free Stock Analysis</div>
            <h1 className="type-display text-[var(--color-text-primary)]">
              Institutional-grade<br />stock analysis
            </h1>
            <p className="text-[15px] leading-relaxed text-[var(--color-text-secondary)] max-w-lg mx-auto">
              AI-powered reports with real-time pricing, financial metrics, analyst consensus, earnings data, and news sentiment for any publicly traded stock.
            </p>
          </div>

          <TickerSearch />

          <div className="space-y-3">
            <div className="type-eyebrow text-[var(--color-text-muted)]">Popular</div>
            <div className="flex flex-wrap justify-center gap-2">
              {POPULAR_TICKERS.map((ticker) => (
                <a
                  key={ticker}
                  href={`/analyze/${ticker}`}
                  className="px-3 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-sm text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {ticker}
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border-subtle)] py-6">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
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
