'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PortfolioAllocation as Allocation } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hiddenNames, setHiddenNames] = useState<Set<string>>(new Set());

  const visibleData = useMemo(
    () => allocation.filter((item) => !hiddenNames.has(item.name)),
    [allocation, hiddenNames]
  );

  const toggleName = (name: string) => {
    setHiddenNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

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
                  data={visibleData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => {
                    const item = entry.payload as Allocation;
                    return `${item.name} ${item.percentage.toFixed(1)}%`;
                  }}
                  outerRadius={110}
                  innerRadius={40}
                  paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={(_, idx) => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {visibleData.map((entry, index) => {
                    const baseColor =
                      HELM_CHART_COLORS[index % HELM_CHART_COLORS.length];
                    const isActive = activeIndex === index;
                    return (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={baseColor}
                        fillOpacity={isActive ? 1 : 0.75}
                        stroke={isActive ? '#ffffff' : 'transparent'}
                        strokeWidth={isActive ? 1.5 : 0}
                      />
                    );
                  })}
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
                    fontFamily: 'var(--font-jetbrains-mono)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {allocation.map((item, index) => {
              const color = HELM_CHART_COLORS[index % HELM_CHART_COLORS.length];
              const isHidden = hiddenNames.has(item.name);
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => toggleName(item.name)}
                  className={`w-full flex items-center justify-between p-3 rounded-md border text-left transition-colors ${
                    isHidden
                      ? 'border-helm-border-subtle bg-helm-surface/40 opacity-60'
                      : 'border-helm-border-base bg-helm-elevated hover:border-helm-border-strong'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="type-h3">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="type-data text-sm">
                      {formatCurrency(item.value)}
                    </div>
                    <div className="text-helm-secondary text-xs">
                      {item.percentage.toFixed(1)}%
                      {isHidden && (
                        <span className="ml-1 text-helm-muted">(hidden)</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
