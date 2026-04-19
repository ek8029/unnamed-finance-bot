import { notFound } from 'next/navigation';
import { analyzeStock } from '@/lib/analyze-stock';
import { getFullTickerData } from '@/lib/financial-data';
import { AnalysisTerminal } from '@/app/analyze/[ticker]/analysis-terminal';

interface Props {
  params: Promise<{ ticker: string }>;
}

export default async function DashboardTickerAnalysisPage({ params }: Props) {
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
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="text-center space-y-5 max-w-md">
          <div className="type-h1 text-[var(--color-text-primary)]">Ticker not found</div>
          <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed">
            We couldn&apos;t find data for <span className="font-bold text-[var(--color-text-primary)]">{symbol}</span>.
            Helm currently covers US-listed stocks and ETFs (NYSE, NASDAQ, AMEX).
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/dashboard/analyze"
              className="px-5 py-2 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] text-[13px] font-semibold rounded transition-colors"
            >
              Try another ticker
            </a>
          </div>
        </div>
      </div>
    );
  }

  const computedAtIso = computedAt || new Date().toISOString();

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
      <AnalysisTerminal
        analysis={analysis}
        tickerData={tickerData}
        ticker={symbol}
        computedAt={computedAtIso}
        dataSources={dataSources}
        methodologyVersion={methodologyVersion}
      />
    </div>
  );
}
