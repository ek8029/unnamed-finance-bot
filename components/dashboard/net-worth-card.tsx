'use client';

import { useEffect, useState } from 'react';
import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { useFormat } from '@/hooks/use-format';
import { useCountUp } from '@/hooks/use-count-up';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { NetWorthDataPoint } from '@/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface NetWorthCardProps {
  currentNetWorth: number;
  netWorthHistory: NetWorthDataPoint[];
  changePercentage?: number | null;
}

export function NetWorthCard({ currentNetWorth, netWorthHistory, changePercentage: apiChangePct }: NetWorthCardProps) {
  const { formatCurrency } = useFormat();
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  const previousNetWorth = netWorthHistory.length >= 2 ? (netWorthHistory[netWorthHistory.length - 2]?.value || 0) : 0;
  const change = currentNetWorth - previousNetWorth;
  const changePercentage = apiChangePct ?? (previousNetWorth !== 0 ? (change / previousNetWorth) * 100 : 0);
  const isPositiveChange = change >= 0;

  const animatedNetWorth = useCountUp(currentNetWorth, 800, 0, 100);
  const animatedChange = useCountUp(Math.abs(change), 800, 0, 200);

  // Calculate proper Y-axis domain with padding
  const values = netWorthHistory.length > 0 ? netWorthHistory.map(d => d.value) : [0];
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;
  const padding = range > 0 ? range * 0.15 : 1000;
  const yMin = Math.floor((minVal - padding) / 10000) * 10000;
  const yMax = Math.ceil((maxVal + padding) / 10000) * 10000;

  return (
    <div
      ref={ref}
      className="transition-[opacity,transform,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] h-full"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        filter: isVisible ? 'blur(0px)' : 'blur(4px)',
      }}
    >
      <DataPanel variant="chart" accent="brass" className="h-full">
        <DataPanelHeader>
          <div className="flex items-center justify-between">
            <DataPanelTitle>Net Worth</DataPanelTitle>
            <div className="flex items-center gap-1.5 type-label text-xs">
              {isPositiveChange ? (
                <TrendingUp className="h-3.5 w-3.5 text-[var(--color-positive)]" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-[var(--color-negative)]" aria-hidden="true" />
              )}
              <span className="sr-only">{isPositiveChange ? 'Increased' : 'Decreased'}</span>
              <span className={`font-tabular ${isPositiveChange ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                {isPositiveChange ? '+' : ''}{changePercentage.toFixed(1)}%
              </span>
              <span className="text-[var(--color-text-muted)] whitespace-nowrap">from last month</span>
            </div>
          </div>
        </DataPanelHeader>
        <DataPanelContent>
          <div className="space-y-4">
            {/* Top: Large Chart */}
            <div className="h-[200px] md:h-[280px]" role="img" aria-label={`Net worth trend: ${netWorthHistory.length} months of data, currently ${formatCurrency(currentNetWorth)}`}>
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
                    fontFamily="var(--font-mono)"
                    interval={0}
                    tick={{ dy: 6 }}
                  />
                  <YAxis
                    stroke="var(--color-text-muted)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    fontFamily="var(--font-mono)"
                    domain={[yMin, yMax]}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), 'Net Worth']}
                    contentStyle={{
                      backgroundColor: 'var(--color-bg-elevated, #131313)',
                      border: '1px solid var(--color-border-base, rgba(255,255,255,0.06))',
                      borderRadius: '4px',
                      color: 'var(--color-text-primary)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
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
                    strokeWidth={2}
                    fill="url(#netWorthGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--color-gold)', stroke: 'var(--color-bg-surface)', strokeWidth: 2 }}
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom: Large Metric Display */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-subtle)]">
              <div>
                <div className="type-statement font-tabular text-[var(--color-text-primary)] glow-gold">
                  {formatCurrency(isVisible ? animatedNetWorth : currentNetWorth)}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-gold-hi)] font-mono mt-1">Total Net Worth</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-tabular text-sm font-medium ${isPositiveChange ? 'text-[var(--color-positive)] glow-positive' : 'text-[var(--color-negative)] glow-negative'}`}>
                  {isPositiveChange ? '+' : '-'}{formatCurrency(isVisible ? animatedChange : Math.abs(change))}
                </span>
                <span className="type-mono text-[var(--color-text-muted)]">this month</span>
              </div>
            </div>
          </div>
        </DataPanelContent>
      </DataPanel>
    </div>
  );
}
