'use client';

import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { useFormat } from '@/hooks/use-format';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface AccountBalanceDataPoint {
  month: string;
  balance: number;
  inflows: number;
  outflows: number;
}

interface AccountsOverviewProps {
  balanceHistory: AccountBalanceDataPoint[];
}

export function AccountsOverview({ balanceHistory }: AccountsOverviewProps) {
  const { formatCurrency } = useFormat();

  const currentMonth = balanceHistory[balanceHistory.length - 1];
  const previousMonth = balanceHistory[balanceHistory.length - 2];
  const balanceChange = currentMonth.balance - previousMonth.balance;
  const balanceChangePercent = (balanceChange / previousMonth.balance) * 100;
  const isPositive = balanceChange > 0;

  // Calculate 3-month averages
  const recentThreeMonths = balanceHistory.slice(-3);
  const avgInflows = recentThreeMonths.reduce((sum, d) => sum + d.inflows, 0) / 3;
  const avgOutflows = recentThreeMonths.reduce((sum, d) => sum + d.outflows, 0) / 3;
  const netFlow = currentMonth.inflows - currentMonth.outflows;

  return (
    <DataPanel variant="chart" elevation="hover">
      <DataPanelHeader>
        <div className="flex items-center justify-between">
          <DataPanelTitle>Accounts Overview</DataPanelTitle>
          <div className="flex items-center gap-1.5 type-label text-xs">
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-positive)]" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-negative)] rotate-180" />
            )}
            <span className={isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}>
              {isPositive ? '+' : ''}{balanceChangePercent.toFixed(1)}%
            </span>
            <span className="text-[var(--color-text-muted)]">vs last month</span>
          </div>
        </div>
      </DataPanelHeader>
      <DataPanelContent>
        <div className="flex gap-6">
          {/* Left: Metrics */}
          <div className="flex-shrink-0 w-[40%] space-y-4">
            {/* Current Balance */}
            <div>
              <div className="type-caption text-[var(--color-text-secondary)] mb-1">Total Balance</div>
              <div className="type-data text-3xl font-tabular text-[var(--color-text-primary)]">
                {formatCurrency(currentMonth.balance)}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`type-label text-xs ${isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                  {isPositive ? '+' : ''}{formatCurrency(balanceChange)}
                </span>
                <span className="type-caption text-[var(--color-text-muted)]">this month</span>
              </div>
            </div>

            {/* Monthly Flow */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowUpRight className="h-3 w-3 text-[var(--color-positive)]" />
                  <div className="type-caption text-[var(--color-text-secondary)]">Inflows</div>
                </div>
                <div className="type-data text-sm font-tabular text-[var(--color-positive)]">
                  {formatCurrency(currentMonth.inflows)}
                </div>
              </div>
              <div className="p-3 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowDownRight className="h-3 w-3 text-[var(--color-negative)]" />
                  <div className="type-caption text-[var(--color-text-secondary)]">Outflows</div>
                </div>
                <div className="type-data text-sm font-tabular text-[var(--color-negative)]">
                  {formatCurrency(currentMonth.outflows)}
                </div>
              </div>
            </div>

            {/* Net Flow */}
            <div className="p-3 bg-[var(--color-gold-surface)] rounded border border-[var(--color-gold)]/20">
              <div className="type-caption text-[var(--color-text-secondary)] mb-1">Net Flow</div>
              <div className={`type-data text-xl font-tabular ${netFlow >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
              </div>
            </div>

            {/* 3-Month Averages */}
            <div className="pt-3 border-t border-[var(--color-border-subtle)] space-y-2">
              <div className="flex justify-between type-label text-xs">
                <span className="text-[var(--color-text-secondary)]">3-Mo Avg Inflows</span>
                <span className="text-[var(--color-text-primary)] font-tabular">{formatCurrency(avgInflows)}</span>
              </div>
              <div className="flex justify-between type-label text-xs">
                <span className="text-[var(--color-text-secondary)]">3-Mo Avg Outflows</span>
                <span className="text-[var(--color-text-primary)] font-tabular">{formatCurrency(avgOutflows)}</span>
              </div>
            </div>
          </div>

          {/* Right: Chart */}
          <div className="flex-1">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceHistory}>
                  <defs>
                    <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    stroke="var(--color-text-secondary)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    fontFamily="var(--font-inter)"
                  />
                  <YAxis
                    stroke="var(--color-text-secondary)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    fontFamily="var(--font-inter)"
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
                      fontFamily: 'var(--font-inter)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="var(--color-gold)"
                    strokeWidth={2}
                    fill="url(#balanceGradient)"
                    animationDuration={800}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </DataPanelContent>
    </DataPanel>
  );
}
