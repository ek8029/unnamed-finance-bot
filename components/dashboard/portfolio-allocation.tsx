'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PortfolioAllocation as Allocation } from '@/types';
import { useFormat } from '@/hooks/use-format';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChartIcon } from 'lucide-react';

interface PortfolioAllocationProps {
  allocation: Allocation[];
}

const HELM_CHART_COLORS = [
  '#C8A95B', // gold
  '#38D39F', // positive
  '#6F6F6F', // neutral
  '#D4A94E', // warning
  '#9A9A9A', // secondary
  '#F87171', // negative
  '#D4B96E', // gold-hi
  '#4ADE80', // bright green
];

export function PortfolioAllocation({ allocation }: PortfolioAllocationProps) {
  const { formatCurrency } = useFormat();

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
        {/* Stacked layout: chart on top, legend below */}
        <div className="flex flex-col gap-4">
          {/* Donut Chart */}
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visibleData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={(_, idx) => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {visibleData.map((entry, index) => {
                    const baseColor = HELM_CHART_COLORS[index % HELM_CHART_COLORS.length];
                    const isActive = activeIndex === index;
                    return (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={baseColor}
                        fillOpacity={isActive ? 1 : 0.8}
                        stroke={isActive ? 'var(--color-text-primary)' : 'transparent'}
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
                    fontSize: '12px',
                  }}
                  labelStyle={{
                    color: 'var(--color-text-secondary)',
                    fontSize: '10px',
                    fontFamily: 'var(--font-inter)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend — no text cutoff, full names visible */}
          <div className="space-y-1.5">
            {allocation.map((item, index) => {
              const color = HELM_CHART_COLORS[index % HELM_CHART_COLORS.length];
              const isHidden = hiddenNames.has(item.name);
              const isActive = !isHidden && activeIndex === visibleData.findIndex(v => v.name === item.name);
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => toggleName(item.name)}
                  onMouseEnter={() => {
                    if (!isHidden) {
                      const idx = visibleData.findIndex(v => v.name === item.name);
                      setActiveIndex(idx);
                    }
                  }}
                  onMouseLeave={() => setActiveIndex(null)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md border text-left transition-all duration-200 ${
                    isHidden
                      ? 'border-[var(--color-border-subtle)] bg-transparent opacity-40'
                      : isActive
                      ? 'border-[var(--color-border-strong)] bg-[var(--color-bg-overlay)]'
                      : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="type-label text-[var(--color-text-primary)] truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="type-mono text-[var(--color-text-primary)]">
                      {item.percentage.toFixed(1)}%
                    </span>
                    <span className="type-mono text-[var(--color-text-muted)]">
                      {formatCurrency(item.value)}
                    </span>
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
