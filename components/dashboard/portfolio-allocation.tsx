'use client';

import { useMemo, useState } from 'react';
import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { PortfolioAllocation as Allocation } from '@/types';
import { useFormat } from '@/hooks/use-format';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface PortfolioAllocationProps {
  allocation: Allocation[];
}

const HELM_CHART_COLORS = [
  'var(--color-gold)', // gold
  '#38D39F', // positive
  '#6F6F6F', // neutral
  '#D4A94E', // warning
  '#9A9A9A', // secondary
  'var(--color-negative)', // negative
  '#D4B96E', // gold-hi
  'var(--color-positive)', // bright green
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
    <DataPanel variant="metric">
      <DataPanelHeader>
        <DataPanelTitle>Portfolio Allocation</DataPanelTitle>
      </DataPanelHeader>
      <DataPanelContent>
        {/* Stacked layout: chart on top, legend below */}
        <div className="flex flex-col gap-4">
          {/* Donut Chart */}
          <div className="h-[160px] md:h-[200px] w-full" role="img" aria-label="Portfolio allocation breakdown">
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
                  animationDuration={600}
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
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend - no text cutoff, full names visible */}
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
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded border text-left transition-colors duration-200 ${
                    isHidden
                      ? 'border-[var(--color-border-subtle)] bg-transparent opacity-40'
                      : isActive
                      ? 'border-[var(--color-border-strong)] bg-[var(--color-bg-overlay)]'
                      : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="type-label text-[var(--color-text-primary)]">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="type-mono text-[var(--color-text-primary)] glow-white">
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
      </DataPanelContent>
    </DataPanel>
  );
}
