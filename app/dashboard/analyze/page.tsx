import { TickerSearch } from '@/app/analyze/ticker-search';

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM'];

export default function DashboardAnalyzePage() {
  return (
    <div className="px-4 sm:px-6 py-10 max-w-xl mx-auto space-y-6">
      <div className="space-y-3 text-center">
        <div className="type-eyebrow text-[var(--color-gold)]">Stock Analysis</div>
        <h1 className="type-display text-[var(--color-text-primary)]">
          Analyze a ticker
        </h1>
        <p className="type-body text-[var(--color-text-secondary)] max-w-lg mx-auto">
          AI-powered reports with real-time pricing, financial metrics, analyst consensus, earnings data, and news sentiment.
        </p>
      </div>

      <div className="sovereign-card rounded p-5">
        <TickerSearch basePath="/dashboard/analyze" />
      </div>

      <div className="space-y-2 text-center">
        <div className="type-eyebrow text-[var(--color-text-muted)]">Popular</div>
        <div className="flex flex-wrap justify-center gap-2">
          {POPULAR_TICKERS.map((ticker) => (
            <a
              key={ticker}
              href={`/dashboard/analyze/${ticker}`}
              className="px-4 py-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {ticker}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
