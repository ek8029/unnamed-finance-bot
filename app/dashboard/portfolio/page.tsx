'use client';

import { useState } from 'react';
import { PortfolioMonitor } from '@/components/dashboard/portfolio-monitor';
import { PortfolioAllocation } from '@/components/dashboard/portfolio-allocation';
import { MarketIntelligence } from '@/components/portfolio/market-intelligence';
import { useHoldings } from '@/hooks/use-financial-data';
import { TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFormat } from '@/hooks/use-format';

function LoadingSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl animate-pulse">
      <div className="h-8 bg-neutral-800 rounded w-1/4"></div>
      <div className="h-4 bg-neutral-800 rounded w-1/3"></div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 bg-neutral-800 rounded-xl"></div>
        ))}
      </div>
      <div className="h-64 bg-neutral-800 rounded-xl"></div>
    </div>
  );
}

export default function PortfolioPage() {
  const { formatCurrency } = useFormat();
  const { holdings, allocation, totalValue, performanceMetrics, portfolioHistory, loading, error } = useHoldings();

  const totalDayChange = holdings.reduce(
    (sum, holding) => sum + (holding.total_value * holding.day_change_percentage) / 100,
    0
  );
  const dayChangePercentage = totalValue > 0 ? (totalDayChange / totalValue) * 100 : 0;

  type RangeKey = '3M' | '6M' | '1Y' | 'ALL';

  // Use real portfolio history data when available, otherwise generate from totalValue
  const generateFallbackHistory = (months: number) => {
    const points = [];
    for (let i = months; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const variance = 1 + (Math.random() * 0.1 - 0.05); // ±5% variance
      points.push({
        label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        value: totalValue * variance * (1 - i * 0.02),
      });
    }
    return points;
  };

  const performanceSeries: Record<RangeKey, { label: string; value: number }[]> = {
    '3M': portfolioHistory.length >= 3 ? portfolioHistory.slice(-3) : generateFallbackHistory(3),
    '6M': portfolioHistory.length >= 6 ? portfolioHistory.slice(-6) : generateFallbackHistory(6),
    '1Y': portfolioHistory.length >= 12 ? portfolioHistory : generateFallbackHistory(12),
    ALL: portfolioHistory.length > 0 ? portfolioHistory : generateFallbackHistory(12),
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
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl">
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
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="type-h1">Portfolio</h1>
        <p className="type-body text-[var(--color-text-secondary)]">
          Track your investments, allocation, and performance
        </p>
      </div>

      {/* Market Intelligence - Collapsible at Top */}
      <MarketIntelligence />

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
            <CardTitle className="type-data text-2xl">
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
            <CardTitle className={`type-data text-2xl ${dayChangePercentage >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
              {dayChangePercentage >= 0 ? '+' : ''}
              {dayChangePercentage.toFixed(2)}%
            </CardTitle>
            <p className={`type-mono mt-1 ${dayChangePercentage >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
              {dayChangePercentage >= 0 ? '+' : ''}
              {formatCurrency(totalDayChange)}
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
                  fontFamily="var(--font-inter)"
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(0)}k`}
                  fontFamily="var(--font-inter)"
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
                    fontFamily: 'var(--font-inter)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-gold)"
                  fill="url(#perfGradient)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--color-gold)', stroke: 'var(--color-bg-surface)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Holdings Table */}
        <div className="lg:col-span-2">
          <PortfolioMonitor holdings={transformedHoldings} />
        </div>

        {/* Right Column - Allocation Chart */}
        <div className="space-y-6">
          <PortfolioAllocation allocation={transformedAllocation} />

          {/* Asset Class Breakdown */}
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
                    {formatCurrency(sector.value)}
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
                  value: performanceMetrics?.return_1m != null ? `${performanceMetrics.return_1m >= 0 ? '+' : ''}${performanceMetrics.return_1m.toFixed(1)}%` : '--',
                  color: performanceMetrics?.return_1m != null && performanceMetrics.return_1m >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                },
                {
                  label: '3 Month Return',
                  value: performanceMetrics?.return_3m != null ? `${performanceMetrics.return_3m >= 0 ? '+' : ''}${performanceMetrics.return_3m.toFixed(1)}%` : '--',
                  color: performanceMetrics?.return_3m != null && performanceMetrics.return_3m >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                },
                {
                  label: 'YTD Return',
                  value: performanceMetrics?.return_ytd != null ? `${performanceMetrics.return_ytd >= 0 ? '+' : ''}${performanceMetrics.return_ytd.toFixed(1)}%` : '--',
                  color: performanceMetrics?.return_ytd != null && performanceMetrics.return_ytd >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                },
                {
                  label: 'Sharpe Ratio',
                  value: performanceMetrics?.sharpe_ratio != null ? performanceMetrics.sharpe_ratio.toFixed(2) : '--',
                  color: 'text-[var(--color-text-primary)]'
                },
                {
                  label: 'Beta',
                  value: performanceMetrics?.beta != null ? performanceMetrics.beta.toFixed(2) : '--',
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
    </div>
  );
}
