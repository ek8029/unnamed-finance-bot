'use client';

import { useState, useEffect } from 'react';
import { PortfolioMonitor } from '@/components/dashboard/portfolio-monitor';
import { PortfolioAllocation } from '@/components/dashboard/portfolio-allocation';
import { MarketIntelligence } from '@/components/portfolio/market-intelligence';
import { useHoldings } from '@/hooks/use-financial-data';
import { TrendingUp, TrendingDown, DollarSign, PieChart, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFormat } from '@/hooks/use-format';

function LoadingSkeleton() {
  return (
    <div className="container mx-auto p-6 max-w-[1600px] animate-pulse">
      <div className="flex gap-6">
        <div className="flex-1 space-y-6">
          <div className="h-8 bg-neutral-800 rounded w-1/4"></div>
          <div className="h-4 bg-neutral-800 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-neutral-800 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-neutral-800 rounded-xl"></div>
        </div>
        <div className="hidden lg:block w-[420px]">
          <div className="h-[600px] bg-neutral-800 rounded-xl"></div>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const { formatCurrency, formatCurrencyDetailed } = useFormat();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const holdingsData: any = useHoldings();
  const holdings: { id: string; ticker: string; asset_name: string; shares: number; current_price: number; total_value: number; day_change_percentage: number; portfolio_allocation: number; sector?: string; asset_class?: string; cost_basis?: number; unrealised_gain?: number }[] = holdingsData.holdings ?? [];
  const allocation: { name: string; value: number; percentage: number }[] = holdingsData.allocation ?? [];
  const totalValue: number = holdingsData.totalValue ?? 0;
  const performanceMetrics = holdingsData.performanceMetrics ?? null;
  const portfolioHistory: { label: string; value: number; gain_loss: number }[] = holdingsData.portfolioHistory ?? [];
  const loading: boolean = holdingsData.loading ?? true;
  const error: string | null = holdingsData.error ?? null;
  const refreshing: boolean = holdingsData.refreshing ?? false;
  const refreshPrices: (() => Promise<void>) | null = holdingsData.refreshPrices ?? null;
  const lastRefreshed: string | null = holdingsData.lastRefreshed ?? null;

  // Track last refresh timestamp from sessionStorage as fallback
  const [lastRefreshDisplay, setLastRefreshDisplay] = useState<string | null>(null);

  useEffect(() => {
    if (lastRefreshed) {
      // lastRefreshed is already a formatted time string from the hook
      setLastRefreshDisplay(lastRefreshed);
    } else {
      try {
        const stored = sessionStorage.getItem('helm_last_price_refresh');
        if (stored) setLastRefreshDisplay(new Date(Number(stored)).toLocaleTimeString());
      } catch {}
    }
  }, [lastRefreshed]);

  const handleRefreshPrices = async () => {
    if (refreshPrices) {
      await refreshPrices();
    } else {
      // Fallback: call the API directly if hook doesn't provide refreshPrices
      try {
        await fetch('/api/market/prices/refresh', { method: 'POST' });
        const now = new Date().toISOString();
        sessionStorage.setItem('helm_last_price_refresh', now);
        setLastRefreshDisplay(new Date(now).toLocaleTimeString());
        window.location.reload();
      } catch (err) {
        console.error('Failed to refresh prices:', err);
      }
    }
  };

  const totalDayChange = holdings.reduce(
    (sum: number, holding: any) => sum + (holding.total_value * holding.day_change_percentage) / 100,
    0
  );
  const dayChangePercentage = totalValue > 0 ? (totalDayChange / totalValue) * 100 : 0;

  type RangeKey = '3M' | '6M' | '1Y' | 'ALL';

  // Build a single-point fallback from the current total value (no fake data)
  const singlePointFallback = totalValue > 0
    ? [{ label: new Date().toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), value: totalValue }]
    : [];

  // Use real portfolio history data only -- never generate random numbers
  const performanceSeries: Record<RangeKey, { label: string; value: number }[]> = {
    '3M': portfolioHistory.length > 0 ? portfolioHistory.slice(-3) : singlePointFallback,
    '6M': portfolioHistory.length > 0 ? portfolioHistory.slice(-6) : singlePointFallback,
    '1Y': portfolioHistory.length > 0 ? portfolioHistory : singlePointFallback,
    ALL: portfolioHistory.length > 0 ? portfolioHistory : singlePointFallback,
  };
  const [range, setRange] = useState<RangeKey>('6M');

  // Transform holdings to match component expectations (Holding type)
  const transformedHoldings = holdings.map(h => ({
    id: h.id,
    user_id: '', // Not needed for display
    ticker: h.ticker,
    asset_name: h.asset_name,
    shares: h.shares,
    current_price: h.current_price,
    total_value: h.total_value,
    day_change_percentage: h.day_change_percentage,
    portfolio_allocation: h.portfolio_allocation,
    sector: h.sector,
    asset_class: h.asset_class,
    cost_basis: h.cost_basis,
    unrealised_gain: h.unrealised_gain,
  }));

  // Transform allocation for pie chart (PortfolioAllocation type)
  const transformedAllocation = allocation.map(a => ({
    name: a.name,
    value: a.value,
    percentage: a.percentage,
  }));

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-[1600px]">
        <div className="bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20 text-[var(--color-negative)] p-6 rounded-xl">
          <h2 className="font-semibold mb-2">Error loading portfolio</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Get sorted holdings for summary cards
  const sortedByAllocation = [...holdings].sort((a, b) => b.portfolio_allocation - a.portfolio_allocation);
  const sortedByDayChange = [...holdings].sort((a, b) => b.day_change_percentage - a.day_change_percentage);

  return (
    <div className="container mx-auto card-padding max-w-[1600px]">
      <div className="flex gap-density">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0 space-y-density">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div className="space-y-2">
              <h1 className="type-h1">Portfolio</h1>
              <p className="type-body text-[var(--color-text-secondary)]">
                Track your investments, allocation, and performance
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <button
                onClick={handleRefreshPrices}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--color-gold)] hover:brightness-110 text-black rounded-lg transition-colors disabled:opacity-50"
              >
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Refresh Prices
              </button>
              {lastRefreshDisplay && (
                <span className="type-caption text-[var(--color-text-muted)]">
                  Last updated: {lastRefreshDisplay}
                </span>
              )}
            </div>
          </div>

          {/* Portfolio Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <CardDescription>Total Portfolio Value</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="type-data text-3xl">
                  {formatCurrency(totalValue)}
                </CardTitle>
                <p className="type-mono text-[var(--color-text-secondary)] mt-1">{holdings.length} holdings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center space-x-2">
                  {dayChangePercentage >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-[var(--color-positive)]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[var(--color-negative)]" />
                  )}
                  <CardDescription>Today&apos;s Change</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className={`type-data text-3xl ${dayChangePercentage >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                  {dayChangePercentage >= 0 ? '+' : ''}
                  {dayChangePercentage.toFixed(2)}%
                </CardTitle>
                <p className={`type-mono mt-1 ${dayChangePercentage >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                  {dayChangePercentage >= 0 ? '+' : ''}
                  {formatCurrencyDetailed(totalDayChange)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center space-x-2">
                  <PieChart className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <CardDescription>Largest Position</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="type-data text-xl">
                  {sortedByAllocation[0]?.ticker || '-'}
                </CardTitle>
                <p className="type-mono text-[var(--color-text-secondary)] mt-1">
                  {sortedByAllocation[0]?.portfolio_allocation?.toFixed(1) || 0}% of portfolio
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-[var(--color-text-muted)]" />
                  <CardDescription>Best Performer Today</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="type-data text-xl text-[var(--color-positive)]">
                  {sortedByDayChange[0]?.ticker || '-'}
                </CardTitle>
                <p className="type-mono text-[var(--color-positive)] mt-1">
                  +{sortedByDayChange[0]?.day_change_percentage?.toFixed(2) || 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance over time */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="type-h2 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[var(--color-text-muted)]" />
                  Performance over time
                </CardTitle>
                <CardDescription>
                  Portfolio value evolution across selected time range
                </CardDescription>
              </div>
              <div className="flex gap-1">
                {(Object.keys(performanceSeries) as RangeKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setRange(key)}
                    className={`px-2.5 py-1 rounded-md type-caption transition-all duration-200 ${
                      range === key
                        ? 'bg-[var(--color-gold-surface)] text-[var(--color-gold)] border border-[var(--color-gold-border)]'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-base)]'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                {performanceSeries[range].length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="type-body text-[var(--color-text-muted)]">
                      Portfolio history will build as prices update daily
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceSeries[range]} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
                      <defs>
                        <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        stroke="var(--color-text-muted)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        fontFamily="var(--font-mono)"
                      />
                      <YAxis
                        stroke="var(--color-text-muted)"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(0)}k`}
                        fontFamily="var(--font-mono)"
                        width={52}
                      />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value)), 'Portfolio']}
                        contentStyle={{
                          backgroundColor: 'var(--color-bg-elevated)',
                          border: '1px solid var(--color-border-base)',
                          borderRadius: '4px',
                          color: 'var(--color-text-primary)',
                          fontSize: '12px',
                        }}
                        labelStyle={{
                          color: 'var(--color-text-secondary)',
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-gold)"
                        fill="url(#perfGradient)"
                        strokeWidth={2}
                        dot={performanceSeries[range].length <= 2}
                        activeDot={{ r: 4, fill: 'var(--color-gold)', stroke: 'var(--color-bg-surface)', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Holdings Table - full width */}
          <PortfolioMonitor holdings={transformedHoldings} />

          {/* Allocation, Sector Breakdown, Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-density">
            <PortfolioAllocation allocation={transformedAllocation} />

            {/* Sector Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Sector Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {allocation.slice(0, 5).map((sector) => (
                  <div key={sector.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="type-label text-[var(--color-text-secondary)]">{sector.name}</span>
                      <span className="type-mono text-[var(--color-text-primary)]">{sector.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-full h-1.5">
                      <div
                        className="bg-[var(--color-gold)] h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, sector.percentage)}%` }}
                      />
                    </div>
                    <div className="type-mono text-[var(--color-text-muted)]">
                      {formatCurrencyDetailed(sector.value)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  {
                    label: '1 Month Return',
                    value: performanceMetrics?.return_1m != null ? `${performanceMetrics.return_1m >= 0 ? '+' : ''}${performanceMetrics.return_1m.toFixed(1)}%` : 'N/A',
                    color: performanceMetrics?.return_1m != null && performanceMetrics.return_1m >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                  },
                  {
                    label: '3 Month Return',
                    value: performanceMetrics?.return_3m != null ? `${performanceMetrics.return_3m >= 0 ? '+' : ''}${performanceMetrics.return_3m.toFixed(1)}%` : 'N/A',
                    color: performanceMetrics?.return_3m != null && performanceMetrics.return_3m >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                  },
                  {
                    label: 'YTD Return',
                    value: performanceMetrics?.return_ytd != null ? `${performanceMetrics.return_ytd >= 0 ? '+' : ''}${performanceMetrics.return_ytd.toFixed(1)}%` : 'N/A',
                    color: performanceMetrics?.return_ytd != null && performanceMetrics.return_ytd >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                  },
                  {
                    label: 'Sharpe Ratio',
                    value: performanceMetrics?.sharpe_ratio != null ? performanceMetrics.sharpe_ratio.toFixed(2) : 'N/A',
                    color: 'text-[var(--color-text-primary)]'
                  },
                  {
                    label: 'Beta',
                    value: performanceMetrics?.beta != null ? performanceMetrics.beta.toFixed(2) : 'N/A',
                    color: 'text-[var(--color-text-primary)]'
                  },
                ].map((metric) => (
                  <div key={metric.label} className="flex items-center justify-between">
                    <span className="type-label text-[var(--color-text-secondary)]">{metric.label}</span>
                    <span className={`type-mono ${metric.color}`}>{metric.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Sidebar - Market Intelligence Feed */}
        <aside className="hidden lg:block w-[420px] flex-shrink-0">
          <div className="sticky top-20">
            <MarketIntelligence
              holdings={transformedHoldings}
              className="max-h-[calc(100vh-6rem)] flex flex-col"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
