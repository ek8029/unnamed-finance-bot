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

  if (!data || data.length === 0) {
    return null;
  }

  const currentMonth = data[data.length - 1];
  const previousMonth = data.length >= 2 ? data[data.length - 2] : null;
  const rateChange = previousMonth ? currentMonth.rate - previousMonth.rate : 0;
  const isPositive = rateChange > 0;

  // Calculate average over available data
  const avgRate = data.reduce((sum, d) => sum + d.rate, 0) / data.length;
  const totalSaved = data.reduce((sum, d) => sum + d.saved, 0);

  return (
    <DataPanel variant="chart">
      <DataPanelHeader className="!pt-3 !pb-1.5">
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
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
          <div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono mb-0.5">Current</div>
            <div className="text-sm sm:text-xl font-bold font-tabular text-[var(--color-text-primary)]">
              {currentMonth.rate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono mb-0.5">{data.length}-Mo Avg</div>
            <div className="text-sm sm:text-xl font-bold font-tabular text-[var(--color-text-secondary)]">
              {avgRate.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono mb-0.5">Saved</div>
            <div className="text-sm sm:text-xl font-bold font-tabular text-[var(--color-positive)]">
              {formatCurrency(currentMonth.saved)}
            </div>
          </div>
        </div>

        {/* Target Progress */}
        {targetRate && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)]">
            <Target className="h-3.5 w-3.5 text-[var(--color-gold)]" />
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono">Target</div>
            <div className="type-label font-tabular text-[var(--color-gold)] glow-gold-subtle">{targetRate}%</div>
            <div className="flex-1" />
            <div className={`type-label text-xs ${currentMonth.rate >= targetRate ? 'text-[var(--color-positive)]' : 'text-[var(--color-warning)]'}`}>
              {currentMonth.rate >= targetRate ? 'On Track' : `${(targetRate - currentMonth.rate).toFixed(1)}pp to go`}
            </div>
          </div>
        )}

        {/* Trend Chart */}
        <div className="h-[100px] md:h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
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
                tickFormatter={(value) => `${value}%`}
                fontFamily="var(--font-mono)"
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
                    fontFamily: 'var(--font-mono)',
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="rate"
                stroke="var(--color-gold)"
                strokeWidth={2}
                dot={{ fill: 'var(--color-gold)', r: 3 }}
                activeDot={{ r: 5, fill: 'var(--color-gold)', stroke: 'var(--color-bg-surface)', strokeWidth: 2 }}
                animationDuration={600}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Year-to-Date Total */}
        <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)]">
          <div className="flex justify-between type-label text-xs">
            <span className="text-[var(--color-text-secondary)]">Year-to-Date Savings</span>
            <span className="text-[var(--color-text-primary)] font-tabular">{formatCurrency(totalSaved)}</span>
          </div>
        </div>
      </DataPanelContent>
    </DataPanel>
  );
}
