'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { NetWorthDataPoint } from '@/types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface NetWorthCardProps {
  currentNetWorth: number;
  netWorthHistory: NetWorthDataPoint[];
}

export function NetWorthCard({ currentNetWorth, netWorthHistory }: NetWorthCardProps) {
  const previousNetWorth = netWorthHistory[netWorthHistory.length - 2]?.value || 0;
  const change = currentNetWorth - previousNetWorth;
  const changePercentage = (change / previousNetWorth) * 100;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Net Worth</span>
          <div className="flex items-center gap-2 type-body font-normal">
            <TrendingUp className="h-4 w-4 text-helm-positive" />
            <span className="text-helm-positive">
              +{changePercentage.toFixed(1)}% from last month
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="type-data text-4xl">{formatCurrency(currentNetWorth)}</div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={netWorthHistory}>
                <XAxis
                  dataKey="month"
                  stroke="var(--color-text-secondary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  fontFamily="var(--font-dm-mono)"
                />
                <YAxis
                  stroke="var(--color-text-secondary)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  fontFamily="var(--font-dm-mono)"
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
                    fontFamily: 'var(--font-dm-mono)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-gold)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
