'use client';

import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { formatCurrency } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

interface CashFlowDataPoint {
  month: string;
  income: number;
  expenses: number;
  netFlow: number;
}

interface CashFlowTrendProps {
  data: CashFlowDataPoint[];
}

export function CashFlowTrend({ data }: CashFlowTrendProps) {
  const currentMonth = data[data.length - 1];
  const previousMonth = data[data.length - 2];
  const flowChange = currentMonth.netFlow - previousMonth.netFlow;
  const flowChangePercent = (flowChange / previousMonth.netFlow) * 100;
  const isPositive = flowChange > 0;

  // Calculate 3-month average
  const recentThreeMonths = data.slice(-3);
  const avgNetFlow = recentThreeMonths.reduce((sum, d) => sum + d.netFlow, 0) / 3;

  return (
    <DataPanel variant="chart" elevation="hover">
      <DataPanelHeader>
        <div className="flex items-center justify-between">
          <DataPanelTitle>Cash Flow</DataPanelTitle>
          <div className="flex items-center gap-1.5 type-label text-xs">
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-positive)]" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-[var(--color-negative)]" />
            )}
            <span className={isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}>
              {isPositive ? '+' : ''}{flowChangePercent.toFixed(1)}%
            </span>
            <span className="text-[var(--color-text-muted)]">vs last month</span>
          </div>
        </div>
      </DataPanelHeader>
      <DataPanelContent>
        {/* Multi-Metric Display */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Net Flow */}
          <div>
            <div className="type-caption text-[var(--color-text-secondary)] mb-1">Net Flow</div>
            <div className="type-data text-xl font-tabular text-[var(--color-text-primary)]">
              {formatCurrency(currentMonth.netFlow)}
            </div>
          </div>

          {/* Income */}
          <div>
            <div className="type-caption text-[var(--color-text-secondary)] mb-1">Income</div>
            <div className="type-data text-xl font-tabular text-[var(--color-positive)]">
              {formatCurrency(currentMonth.income)}
            </div>
          </div>

          {/* Expenses */}
          <div>
            <div className="type-caption text-[var(--color-text-secondary)] mb-1">Expenses</div>
            <div className="type-data text-xl font-tabular text-[var(--color-negative)]">
              {formatCurrency(currentMonth.expenses)}
            </div>
          </div>
        </div>

        {/* 3-Month Average */}
        <div className="flex items-center gap-2 mb-3 p-2 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)]">
          <div className="type-caption text-[var(--color-text-secondary)]">3-Mo Avg</div>
          <ArrowRight className="h-3 w-3 text-[var(--color-text-muted)]" />
          <div className="type-label font-tabular text-[var(--color-text-primary)]">
            {formatCurrency(avgNetFlow)}
          </div>
        </div>

        {/* Trend Chart */}
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="netFlowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                stroke="var(--color-text-secondary)"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                fontFamily="var(--font-jetbrains-mono)"
              />
              <YAxis
                stroke="var(--color-text-secondary)"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                fontFamily="var(--font-jetbrains-mono)"
              />
              <Tooltip
                formatter={(value) => {
                  if (typeof value === 'number') {
                    return formatCurrency(value);
                  }
                  return '';
                }}
                contentStyle={{
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-base)',
                  borderRadius: '4px',
                  color: 'var(--color-text-primary)',
                  fontSize: '11px',
                }}
                labelStyle={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '10px',
                  fontFamily: 'var(--font-jetbrains-mono)',
                }}
              />
              <Area
                type="monotone"
                dataKey="netFlow"
                stroke="var(--color-gold)"
                strokeWidth={2}
                fill="url(#netFlowGradient)"
                animationDuration={800}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </DataPanelContent>
    </DataPanel>
  );
}
