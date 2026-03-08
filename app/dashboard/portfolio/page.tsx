'use client';

import { useState } from 'react';
import { PortfolioMonitor } from '@/components/dashboard/portfolio-monitor';
import { PortfolioAllocation } from '@/components/dashboard/portfolio-allocation';
import { mockHoldings, mockPortfolioAllocation } from '@/lib/mock-data';
import { TrendingUp, TrendingDown, DollarSign, PieChart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency } from '@/lib/utils';

export default function PortfolioPage() {
  const totalValue = mockHoldings.reduce((sum, holding) => sum + holding.total_value, 0);
  const totalDayChange = mockHoldings.reduce(
    (sum, holding) => sum + (holding.total_value * holding.day_change_percentage) / 100,
    0
  );
  const dayChangePercentage = (totalDayChange / totalValue) * 100;

  type RangeKey = '1M' | '3M' | '6M' | 'YTD';
  type PerformancePoint = { label: string; value: number };

  const performanceSeries: Record<RangeKey, PerformancePoint[]> = {
    '1M': [
      { label: '4w ago', value: totalValue * 0.95 },
      { label: '3w ago', value: totalValue * 0.97 },
      { label: '2w ago', value: totalValue * 0.99 },
      { label: '1w ago', value: totalValue * 1.01 },
      { label: 'Today', value: totalValue },
    ],
    '3M': [
      { label: '3m ago', value: totalValue * 0.9 },
      { label: '2m ago', value: totalValue * 0.94 },
      { label: '1m ago', value: totalValue * 0.97 },
      { label: '2w ago', value: totalValue * 0.99 },
      { label: 'Today', value: totalValue },
    ],
    '6M': [
      { label: '6m ago', value: totalValue * 0.82 },
      { label: '4m ago', value: totalValue * 0.88 },
      { label: '3m ago', value: totalValue * 0.92 },
      { label: '2m ago', value: totalValue * 0.96 },
      { label: 'Today', value: totalValue },
    ],
    YTD: [
      { label: 'Jan', value: totalValue * 0.84 },
      { label: 'Mar', value: totalValue * 0.9 },
      { label: 'May', value: totalValue * 0.96 },
      { label: 'Jul', value: totalValue * 1.02 },
      { label: 'Today', value: totalValue },
    ],
  };
  const [range, setRange] = useState<RangeKey>('3M');

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="type-h1">Portfolio</h1>
        <p className="type-body text-[var(--color-text-secondary)]">
          Track your investments, allocation, and performance
        </p>
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
            <CardTitle className="type-data text-2xl">
              {formatCurrency(totalValue)}
            </CardTitle>
            <p className="type-mono text-[var(--color-text-secondary)] mt-1">{mockHoldings.length} holdings</p>
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
              {mockHoldings.sort((a, b) => b.portfolio_allocation - a.portfolio_allocation)[0]?.ticker}
            </CardTitle>
            <p className="type-mono text-[var(--color-text-secondary)] mt-1">
              {mockHoldings.sort((a, b) => b.portfolio_allocation - a.portfolio_allocation)[0]?.portfolio_allocation}% of portfolio
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
              {mockHoldings.sort((a, b) => b.day_change_percentage - a.day_change_percentage)[0]?.ticker}
            </CardTitle>
            <p className="type-mono text-[var(--color-positive)] mt-1">
              +{mockHoldings.sort((a, b) => b.day_change_percentage - a.day_change_percentage)[0]?.day_change_percentage}%
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
                  fontFamily="var(--font-jetbrains-mono)"
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(Number(value) / 1000).toFixed(0)}k`}
                  fontFamily="var(--font-jetbrains-mono)"
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
                    fontFamily: 'var(--font-jetbrains-mono)',
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
          <PortfolioMonitor holdings={mockHoldings} />
        </div>

        {/* Right Column - Allocation Chart */}
        <div className="space-y-6">
          <PortfolioAllocation allocation={mockPortfolioAllocation} />

          {/* Asset Class Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Asset Class Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: 'Equities', value: 262958.5, percentage: 82.6 },
                { name: 'ETFs', value: 100684, percentage: 31.7 },
                { name: 'Crypto', value: 44105, percentage: 13.9 },
              ].map((asset) => (
                <div key={asset.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="type-label text-[var(--color-text-secondary)]">{asset.name}</span>
                    <span className="type-mono text-[var(--color-text-primary)]">{asset.percentage}%</span>
                  </div>
                  <div className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-full h-1.5">
                    <div
                      className="bg-[var(--color-gold)] h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${asset.percentage}%` }}
                    />
                  </div>
                  <div className="type-mono text-[var(--color-text-muted)]">
                    {formatCurrency(asset.value)}
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
                { label: '1 Month Return', value: '+5.2%', color: 'text-[var(--color-positive)]' },
                { label: '3 Month Return', value: '+12.8%', color: 'text-[var(--color-positive)]' },
                { label: 'YTD Return', value: '+18.3%', color: 'text-[var(--color-positive)]' },
                { label: 'Sharpe Ratio', value: '1.42', color: 'text-[var(--color-text-primary)]' },
                { label: 'Beta', value: '1.15', color: 'text-[var(--color-text-primary)]' },
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
