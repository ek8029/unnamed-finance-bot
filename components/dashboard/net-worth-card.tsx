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
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

  return (
    <DataPanel variant="chart" elevation="hover">
      <DataPanelHeader>
        <div className="flex items-center justify-between">
          <DataPanelTitle>Net Worth</DataPanelTitle>
          <div className="flex items-center gap-1.5 type-label text-xs">
            <TrendingUp className="h-3.5 w-3.5 text-helm-positive" />
            <span className="text-helm-positive font-tabular">
              +{changePercentage.toFixed(1)}%
            </span>
            <span className="text-helm-muted">from last month</span>
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
              <Skeleton className="h-[280px] w-full" />
            </div>
          </div>
        ) : (
          // Horizontal Split Layout: Metric (40%) | Chart (60%)
          <div className="flex gap-6 items-center">
            {/* Left: Large Metric Display */}
            <div className="flex-shrink-0">
              <div className="type-data text-4xl font-tabular text-helm-platinum">
                {formatCurrency(currentNetWorth)}
              </div>
              <div className="type-label text-helm-secondary mt-1">Total Net Worth</div>
            </div>

            {/* Right: Expanded Chart */}
            <div className="flex-1 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={netWorthHistory}>
                  <XAxis
                    dataKey="month"
                    stroke="var(--color-text-secondary)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    fontFamily="var(--font-jetbrains-mono)"
                  />
                  <YAxis
                    stroke="var(--color-text-secondary)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    fontFamily="var(--font-jetbrains-mono)"
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{
                      backgroundColor: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-base)',
                      borderRadius: '4px',
                      color: 'var(--color-text-primary)',
                    }}
                    labelStyle={{
                      color: 'var(--color-text-secondary)',
                      fontSize: '11px',
                      fontFamily: 'var(--font-jetbrains-mono)',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-gold)"
                    strokeWidth={2}
                    dot={false}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </DataPanelContent>
    </DataPanel>
  );
}
