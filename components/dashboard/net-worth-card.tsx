'use client';

import { useEffect, useState } from 'react';
import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { useFormat } from '@/hooks/use-format';
import { NetWorthDataPoint } from '@/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface NetWorthCardProps {
  currentNetWorth: number;
  netWorthHistory: NetWorthDataPoint[];
}

export function NetWorthCard({ currentNetWorth, netWorthHistory }: NetWorthCardProps) {
  const { formatCurrency } = useFormat();

  const previousNetWorth = netWorthHistory[netWorthHistory.length - 2]?.value || 0;
  const change = currentNetWorth - previousNetWorth;
  const changePercentage = (change / previousNetWorth) * 100;
  const isPositiveChange = change >= 0;

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timeout);
  }, []);

  // Calculate proper Y-axis domain with padding
  const values = netWorthHistory.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const padding = (maxVal - minVal) * 0.15;
  const yMin = Math.floor((minVal - padding) / 10000) * 10000;
  const yMax = Math.ceil((maxVal + padding) / 10000) * 10000;

  return (
    <DataPanel variant="chart" elevation="hover" className="h-full">
      <DataPanelHeader>
        <div className="flex items-center justify-between">
          <DataPanelTitle>Net Worth</DataPanelTitle>
          <div className="flex items-center gap-1.5 type-label text-xs">
            {isPositiveChange ? (
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-positive)]" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-[var(--color-negative)]" />
            )}
            <span className={`font-tabular ${isPositiveChange ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
              {isPositiveChange ? '+' : ''}{changePercentage.toFixed(1)}%
            </span>
            <span className="text-[var(--color-text-muted)]">from last month</span>
          </div>
        </div>
      </DataPanelHeader>
      <DataPanelContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-[240px] w-full" />
            <div className="flex justify-between items-center">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Top: Large Chart */}
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthHistory} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
                  <defs>
                    <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    stroke="var(--color-text-muted)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    fontFamily="var(--font-jetbrains-mono)"
                    interval={2}
                    tick={{ dy: 6 }}
                  />
                  <YAxis
                    stroke="var(--color-text-muted)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    fontFamily="var(--font-jetbrains-mono)"
                    domain={[yMin, yMax]}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), 'Net Worth']}
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
                    strokeWidth={2}
                    fill="url(#netWorthGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--color-gold)', stroke: 'var(--color-bg-surface)', strokeWidth: 2 }}
                    animationDuration={1000}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom: Large Metric Display */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border-subtle)]">
              <div>
                <div className="type-data text-3xl font-tabular text-[var(--color-text-primary)]">
                  {formatCurrency(currentNetWorth)}
                </div>
                <div className="type-label text-[var(--color-text-secondary)] mt-1">Total Net Worth</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-tabular text-sm font-medium ${isPositiveChange ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`} style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                  {isPositiveChange ? '+' : ''}{formatCurrency(change)}
                </span>
                <span className="type-mono text-[var(--color-text-muted)]">this month</span>
              </div>
            </div>
          </div>
        )}
      </DataPanelContent>
    </DataPanel>
  );
}
