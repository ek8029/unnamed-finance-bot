import { TickerSearch } from '@/app/analyze/ticker-search';

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM'];

export default function DashboardAnalyzePage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <div className="space-y-3">
        <h1 className="type-h1 text-[var(--color-text-primary)]">Analyze</h1>
        <p className="type-body text-[var(--color-text-secondary)]">
          AI-powered reports with real-time pricing, financial metrics, analyst consensus, earnings data, and news sentiment.
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="sovereign-card rounded p-5">
          <TickerSearch basePath="/dashboard/analyze" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="type-eyebrow text-[var(--color-text-muted)]">Popular tickers</div>
        <div className="flex flex-wrap gap-2">
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
