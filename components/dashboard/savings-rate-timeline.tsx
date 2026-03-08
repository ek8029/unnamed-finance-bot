'use client';

import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { useFormat } from '@/hooks/use-format';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';

interface SavingsRateDataPoint {
  month: string;
  rate: number;
  saved: number;
}

interface SavingsRateTimelineProps {
  data: SavingsRateDataPoint[];
  targetRate?: number; // Optional target savings rate (e.g., 20%)
}

export function SavingsRateTimeline({ data, targetRate = 30 }: SavingsRateTimelineProps) {
  const { formatCurrency } = useFormat();

  const currentMonth = data[data.length - 1];
  const previousMonth = data[data.length - 2];
  const rateChange = currentMonth.rate - previousMonth.rate;
  const isPositive = rateChange > 0;

  // Calculate 12-month average
  const avgRate = data.reduce((sum, d) => sum + d.rate, 0) / data.length;
  const totalSaved = data.reduce((sum, d) => sum + d.saved, 0);

  return (
    <DataPanel variant="chart" elevation="hover">
      <DataPanelHeader>
        <div className="flex items-center justify-between">
          <DataPanelTitle>Savings Rate</DataPanelTitle>
          <div className="flex items-center gap-1.5 type-label text-xs">
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-positive)]" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-[var(--color-negative)]" />
            )}
            <span className={isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}>
              {isPositive ? '+' : ''}{rateChange.toFixed(1)}pp
            </span>
            <span className="text-[var(--color-text-muted)]">vs last month</span>
          </div>
        </div>
      </DataPanelHeader>
      <DataPanelContent>
        {/* Multi-Metric Display */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Current Rate */}
          <div>
            <div className="type-caption text-[var(--color-text-secondary)] mb-1">Current</div>
            <div className="type-data text-xl font-tabular text-[var(--color-text-primary)]">
              {currentMonth.rate.toFixed(1)}%
            </div>
          </div>

          {/* 12-Mo Average */}
          <div>
            <div className="type-caption text-[var(--color-text-secondary)] mb-1">12-Mo Avg</div>
            <div className="type-data text-xl font-tabular text-[var(--color-text-secondary)]">
              {avgRate.toFixed(1)}%
            </div>
          </div>

          {/* This Month Saved */}
          <div>
            <div className="type-caption text-[var(--color-text-secondary)] mb-1">This Month</div>
            <div className="type-data text-xl font-tabular text-[var(--color-positive)]">
              {formatCurrency(currentMonth.saved)}
            </div>
          </div>
        </div>

        {/* Target Progress */}
        {targetRate && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)]">
            <Target className="h-3.5 w-3.5 text-[var(--color-gold)]" />
            <div className="type-caption text-[var(--color-text-secondary)]">Target</div>
            <div className="type-label font-tabular text-[var(--color-gold)]">{targetRate}%</div>
            <div className="flex-1" />
            <div className={`type-label text-xs ${currentMonth.rate >= targetRate ? 'text-[var(--color-positive)]' : 'text-[var(--color-warning)]'}`}>
              {currentMonth.rate >= targetRate ? 'On Track' : `${(targetRate - currentMonth.rate).toFixed(1)}pp to go`}
            </div>
          </div>
        )}

        {/* Trend Chart */}
        <div className="h-[80px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis
                dataKey="month"
                stroke="var(--color-text-secondary)"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                fontFamily="var(--font-inter)"
              />
              <YAxis
                stroke="var(--color-text-secondary)"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
                fontFamily="var(--font-inter)"
                domain={[0, 50]}
              />
              <Tooltip
                formatter={(value) => {
                  if (typeof value === 'number') {
                    return `${value.toFixed(1)}%`;
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
                  fontFamily: 'var(--font-inter)',
                }}
              />
              {targetRate && (
                <ReferenceLine
                  y={targetRate}
                  stroke="var(--color-gold)"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: `Target: ${targetRate}%`,
                    position: 'insideTopRight',
                    fontSize: 9,
                    fill: 'var(--color-gold)',
                    fontFamily: 'var(--font-inter)',
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="rate"
                stroke="var(--color-positive)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-positive)', r: 3 }}
                activeDot={{ r: 5 }}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Year-to-Date Total */}
        <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
          <div className="flex justify-between type-label text-xs">
            <span className="text-[var(--color-text-secondary)]">Year-to-Date Savings</span>
            <span className="text-[var(--color-text-primary)] font-tabular">{formatCurrency(totalSaved)}</span>
          </div>
        </div>
      </DataPanelContent>
    </DataPanel>
  );
}
