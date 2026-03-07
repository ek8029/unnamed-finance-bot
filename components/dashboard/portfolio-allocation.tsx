'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PortfolioAllocation as Allocation } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PieChartIcon } from 'lucide-react';

interface PortfolioAllocationProps {
  allocation: Allocation[];
}

// Helm-branded color palette for portfolio allocation
const HELM_CHART_COLORS = [
  '#B8914A', // helm-gold
  '#CBAA68', // helm-gold-hi
  '#9EC4A8', // helm-positive
  '#6B7A90', // helm-neutral
  '#C4A45A', // helm-warning
  '#8A96AA', // helm-secondary
];

export function PortfolioAllocation({ allocation }: PortfolioAllocationProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5" />
          Portfolio Allocation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocation}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => {
                    const item = entry.payload;
                    return `${item.name} ${item.percentage.toFixed(1)}%`;
                  }}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {allocation.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={HELM_CHART_COLORS[index % HELM_CHART_COLORS.length]} />
                  ))}
                </Pie>
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
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {allocation.map((item, index) => (
              <div
                key={item.name}
                className="flex items-center justify-between p-3 rounded-md border border-helm-border-base bg-helm-elevated hover:border-helm-border-strong transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: HELM_CHART_COLORS[index % HELM_CHART_COLORS.length] }}
                  />
                  <span className="type-h3">{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="type-data text-sm">{formatCurrency(item.value)}</div>
                  <div className="text-helm-secondary text-xs">{item.percentage.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
