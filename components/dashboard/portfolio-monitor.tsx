'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Holding } from '@/types';
import { useFormat } from '@/hooks/use-format';
import { ArrowUpRight, ArrowDownRight, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PortfolioMonitorProps {
  holdings: Holding[];
}

export function PortfolioMonitor({ holdings }: PortfolioMonitorProps) {
  const { formatCurrencyDetailed, formatPercentage, formatNumber } = useFormat();
  const totalValue = holdings.reduce((sum, holding) => sum + holding.total_value, 0);

  type SortKey = 'ticker' | 'price' | 'value' | 'change' | 'allocation';
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useState(() => {
    const timeout = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timeout);
  });

  const sortedHoldings = useMemo(() => {
    const sorted = [...holdings];
    sorted.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortKey) {
        case 'ticker':
          aVal = a.ticker;
          bVal = b.ticker;
          break;
        case 'price':
          aVal = a.current_price;
          bVal = b.current_price;
          break;
        case 'value':
          aVal = a.total_value;
          bVal = b.total_value;
          break;
        case 'change':
          aVal = a.day_change_percentage;
          bVal = b.day_change_percentage;
          break;
        case 'allocation':
          aVal = a.portfolio_allocation;
          bVal = b.portfolio_allocation;
          break;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const diff = Number(aVal) - Number(bVal);
      return sortDirection === 'asc' ? diff : -diff;
    });
    return sorted;
  }, [holdings, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection(key === 'ticker' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="ml-0.5 h-3 w-3 inline" />
    ) : (
      <ChevronDown className="ml-0.5 h-3 w-3 inline" />
    );
  };

  // Format large currency without cents, small with cents
  const formatValue = (v: number) => {
    if (v >= 10000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
      }).format(v);
    }
    return formatCurrencyDetailed(v);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-[var(--color-text-muted)]" />
            Holdings
          </CardTitle>
          <span className="type-mono text-sm text-[var(--color-text-secondary)]">
            {holdings.length} positions
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3 px-6 pb-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[var(--color-border-base)]">
                  <th
                    className="text-left py-3 px-5 type-eyebrow text-[var(--color-text-muted)] cursor-pointer select-none uppercase tracking-wider"
                    onClick={() => handleSort('ticker')}
                  >
                    Position {renderSortIcon('ticker')}
                  </th>
                  <th className="text-right py-3 px-4 type-eyebrow text-[var(--color-text-muted)] uppercase tracking-wider">
                    Shares
                  </th>
                  <th
                    className="text-right py-3 px-4 type-eyebrow text-[var(--color-text-muted)] cursor-pointer select-none uppercase tracking-wider"
                    onClick={() => handleSort('price')}
                  >
                    Price {renderSortIcon('price')}
                  </th>
                  <th
                    className="text-right py-3 px-4 type-eyebrow text-[var(--color-text-muted)] cursor-pointer select-none uppercase tracking-wider"
                    onClick={() => handleSort('value')}
                  >
                    Value {renderSortIcon('value')}
                  </th>
                  <th
                    className="text-right py-3 px-4 type-eyebrow text-[var(--color-text-muted)] cursor-pointer select-none uppercase tracking-wider"
                    onClick={() => handleSort('change')}
                  >
                    Day {renderSortIcon('change')}
                  </th>
                  <th
                    className="text-right py-3 pr-5 pl-4 type-eyebrow text-[var(--color-text-muted)] cursor-pointer select-none uppercase tracking-wider whitespace-nowrap"
                    onClick={() => handleSort('allocation')}
                  >
                    Weight {renderSortIcon('allocation')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedHoldings.map((holding) => {
                  const isPositiveChange = holding.day_change_percentage >= 0;
                  const isExpanded = expandedRowId === holding.id;
                  const unrealised = holding.unrealised_gain ?? 0;
                  const costBasisTotal = holding.cost_basis ? holding.cost_basis * holding.shares : null;
                  const unrealisedPct = costBasisTotal && costBasisTotal > 0
                    ? (unrealised / costBasisTotal) * 100
                    : null;
                  const dayChangeDollars = holding.total_value * (holding.day_change_percentage / 100);

                  return (
                    <React.Fragment key={holding.id}>
                      <tr
                        className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer group"
                        onClick={() => setExpandedRowId(isExpanded ? null : holding.id)}
                      >
                        {/* Position: Ticker prominent, name secondary */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="type-mono text-base font-semibold text-[var(--color-text-primary)]">
                                {holding.ticker}
                              </div>
                              <div className="text-xs text-[var(--color-text-muted)] leading-tight mt-0.5 max-w-[180px] truncate">
                                {holding.asset_name}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Shares */}
                        <td className="py-4 px-4 text-right">
                          <span className="type-mono text-sm text-[var(--color-text-secondary)]">
                            {formatNumber(holding.shares)}
                          </span>
                        </td>

                        {/* Price - full precision */}
                        <td className="py-4 px-4 text-right">
                          <span className="type-mono text-sm font-medium text-[var(--color-text-primary)]">
                            {formatCurrencyDetailed(holding.current_price)}
                          </span>
                        </td>

                        {/* Total Value - prominent */}
                        <td className="py-4 px-4 text-right">
                          <span className="type-mono text-base font-bold text-[var(--color-text-primary)]">
                            {formatValue(holding.total_value)}
                          </span>
                        </td>

                        {/* Day Change - % and $ */}
                        <td className="py-4 px-4 text-right">
                          <div className={`flex flex-col items-end ${
                            isPositiveChange ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                          }`}>
                            <div className="flex items-center gap-0.5">
                              {isPositiveChange ? (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDownRight className="h-3.5 w-3.5" />
                              )}
                              <span className="type-mono text-sm font-medium">
                                {formatPercentage(holding.day_change_percentage, 2)}
                              </span>
                            </div>
                            <span className="type-mono text-xs opacity-70">
                              {dayChangeDollars >= 0 ? '+' : ''}{formatCurrencyDetailed(dayChangeDollars)}
                            </span>
                          </div>
                        </td>

                        {/* Allocation - bar + % */}
                        <td className="py-4 pr-5 pl-4 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <div className="w-16 h-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[var(--color-gold)] rounded-full"
                                style={{ width: `${Math.min(100, holding.portfolio_allocation)}%` }}
                              />
                            </div>
                            <span className="type-mono text-sm text-[var(--color-text-secondary)] w-14 text-right">
                              {holding.portfolio_allocation.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <tr className="border-b border-[var(--color-border-subtle)]">
                          <td colSpan={6} className="py-5 px-5 bg-[var(--color-bg-overlay)]/40">
                            <div className="grid grid-cols-4 gap-6">
                              <div>
                                <span className="type-eyebrow text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] block mb-1.5">
                                  Avg Cost Basis
                                </span>
                                <span className="type-mono text-base text-[var(--color-text-primary)]">
                                  {holding.cost_basis ? formatCurrencyDetailed(holding.cost_basis) : '-'}
                                </span>
                              </div>
                              <div>
                                <span className="type-eyebrow text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] block mb-1.5">
                                  Total Cost
                                </span>
                                <span className="type-mono text-base text-[var(--color-text-primary)]">
                                  {costBasisTotal ? formatValue(costBasisTotal) : '-'}
                                </span>
                              </div>
                              <div>
                                <span className="type-eyebrow text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] block mb-1.5">
                                  Unrealised P&L
                                </span>
                                <span className={`type-mono text-base font-medium ${
                                  unrealised >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                                }`}>
                                  {unrealised >= 0 ? '+' : ''}{formatCurrencyDetailed(unrealised)}
                                  {unrealisedPct !== null && (
                                    <span className="text-xs opacity-70 ml-1">
                                      ({unrealisedPct >= 0 ? '+' : ''}{unrealisedPct.toFixed(1)}%)
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="type-eyebrow text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] block mb-1.5">
                                  Sector / Class
                                </span>
                                <span className="type-mono text-base text-[var(--color-text-primary)]">
                                  {holding.sector || holding.asset_class || '-'}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
