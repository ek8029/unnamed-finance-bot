'use client';

import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { useFormat } from '@/hooks/use-format';
import { AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { ResponsiveContainer } from '@/components/charts/responsive-container';
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
  const { formatCurrency } = useFormat();

  if (!data || data.length === 0) {
    return null;
  }

  const currentMonth = data[data.length - 1];
  const previousMonth = data.length >= 2 ? data[data.length - 2] : null;
  const flowChange = previousMonth ? currentMonth.netFlow - previousMonth.netFlow : 0;
  const flowChangePercent = previousMonth && previousMonth.netFlow !== 0
    ? (flowChange / previousMonth.netFlow) * 100
    : 0;
  const isPositive = flowChange > 0;

  // Calculate 3-month average
  const recentThreeMonths = data.slice(-3);
  const avgNetFlow = recentThreeMonths.reduce((sum, d) => sum + d.netFlow, 0) / recentThreeMonths.length;

  return (
    <DataPanel variant="chart">
      <DataPanelHeader className="!pt-3 !pb-1.5">
        <div className="flex items-center justify-between">
          <DataPanelTitle>Cash Flow</DataPanelTitle>
          <div className="flex items-center gap-1.5 type-label text-[13px]">
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-positive)]" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-[var(--color-negative)]" aria-hidden="true" />
            )}
            <span className="sr-only">{isPositive ? 'Increased' : 'Decreased'}</span>
            <span className={isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}>
              {isPositive ? '+' : ''}{flowChangePercent.toFixed(1)}%
            </span>
            <span className="text-[var(--color-text-muted)]">vs last month</span>
          </div>
        </div>
      </DataPanelHeader>
      <DataPanelContent>
        {/* Multi-Metric Display */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
          <div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono mb-0.5">Net Flow</div>
            <div className="text-[15px] sm:text-xl font-bold font-tabular text-[var(--color-text-primary)]">
              {formatCurrency(currentMonth.netFlow)}
            </div>
          </div>
          <div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono mb-0.5">Income</div>
            <div className="text-[15px] sm:text-xl font-bold font-tabular text-[var(--color-positive)]">
              {formatCurrency(currentMonth.income)}
            </div>
          </div>
          <div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono mb-0.5">Expenses</div>
            <div className="text-[15px] sm:text-xl font-bold font-tabular text-[var(--color-negative)]">
              {formatCurrency(currentMonth.expenses)}
            </div>
          </div>
        </div>

        {/* 3-Month Average */}
        <div className="flex items-center gap-2 mb-3 p-2 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)]">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono">3-Mo Avg</div>
          <ArrowRight className="h-3 w-3 text-[var(--color-text-muted)]" aria-hidden="true" />
          <div className="type-label font-tabular text-[var(--color-text-primary)]">
            {formatCurrency(avgNetFlow)}
          </div>
        </div>

        {/* Trend Chart */}
        <div className="h-[100px] md:h-[120px]" role="img" aria-label={`Cash flow trend: ${data.length} months of data, current net flow ${formatCurrency(currentMonth.netFlow)}`}>
          <ResponsiveContainer width="100%" height="100%" minHeight={100}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="netFlowGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                stroke="var(--color-text-muted)"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                fontFamily="var(--font-mono)"
              />
              <YAxis
                stroke="var(--color-text-muted)"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                fontFamily="var(--font-mono)"
              />
              <Tooltip
                formatter={(value) => {
                  if (typeof value === 'number') {
                    return formatCurrency(value);
                  }
                  return '';
                }}
                contentStyle={{
                  backgroundColor: 'var(--color-bg-elevated, #131313)',
                  border: '1px solid var(--color-border-base, rgba(255,255,255,0.06))',
                  borderRadius: '4px',
                  color: 'var(--color-text-primary)',
                  fontSize: '11px',
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
                dataKey="netFlow"
                stroke="var(--color-gold)"
                strokeWidth={2}
                fill="url(#netFlowGradient)"
                animationDuration={600}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </DataPanelContent>
    </DataPanel>
  );
}
