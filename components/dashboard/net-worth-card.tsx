'use client';

import { useEffect, useState } from 'react';
import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { formatCurrency } from '@/lib/utils';
import { NetWorthDataPoint } from '@/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface NetWorthCardProps {
  currentNetWorth: number;
  netWorthHistory: NetWorthDataPoint[];
}

export function NetWorthCard({ currentNetWorth, netWorthHistory }: NetWorthCardProps) {
  const previousNetWorth = netWorthHistory[netWorthHistory.length - 2]?.value || 0;
  const change = currentNetWorth - previousNetWorth;
  const changePercentage = (change / previousNetWorth) * 100;

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
    <DataPanel variant="chart" elevation="hover">
      <DataPanelHeader>
        <div className="flex items-center justify-between">
          <DataPanelTitle>Net Worth</DataPanelTitle>
          <div className="flex items-center gap-1.5 type-label text-xs">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--color-positive)]" />
            <span className="text-[var(--color-positive)] font-tabular">
              +{changePercentage.toFixed(1)}%
            </span>
            <span className="text-[var(--color-text-muted)]">from last month</span>
          </div>
        </div>
      </DataPanelHeader>
      <DataPanelContent>
        {isLoading ? (
          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <Skeleton className="h-10 w-40" />
            </div>
            <div className="flex-1">
              <Skeleton className="h-[240px] w-full" />
            </div>
          </div>
        ) : (
          <div className="flex gap-6 items-center">
            {/* Left: Large Metric Display */}
            <div className="flex-shrink-0">
              <div className="type-data text-4xl font-tabular text-[var(--color-text-primary)]">
                {formatCurrency(currentNetWorth)}
              </div>
              <div className="type-label text-[var(--color-text-secondary)] mt-1">Total Net Worth</div>
              <div className="mt-3 flex items-center gap-2">
                <span className="type-mono text-[var(--color-positive)]">
                  +{formatCurrency(change)}
                </span>
                <span className="type-mono text-[var(--color-text-muted)]">this month</span>
              </div>
            </div>

            {/* Right: Chart with proper padding and area fill */}
            <div className="flex-1 h-[240px]">
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
                    interval="preserveStartEnd"
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
          </div>
        )}
      </DataPanelContent>
    </DataPanel>
  );
}
