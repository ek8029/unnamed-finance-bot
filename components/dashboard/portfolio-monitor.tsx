'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Holding } from '@/types';
import { useFormat } from '@/hooks/use-format';
import { ArrowUpRight, ArrowDownRight, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { HoldingMiniChart } from '@/components/dashboard/holding-mini-chart';
import Link from 'next/link';

interface PortfolioMonitorProps {
  holdings: Holding[];
}

export function PortfolioMonitor({ holdings }: PortfolioMonitorProps) {
  const { formatCurrencyDetailed, formatPercentage, formatNumber } = useFormat();

  type SortKey = 'ticker' | 'price' | 'value' | 'change' | 'allocation';
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timeout);
  }, []);

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
          aVal = a.day_change_percentage ?? 0;
          bVal = b.day_change_percentage ?? 0;
          break;
        case 'allocation':
          aVal = a.portfolio_allocation ?? 0;
          bVal = b.portfolio_allocation ?? 0;
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
    if (Math.abs(v) >= 10000) {
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
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : sortedHoldings.length === 0 ? (
            <div className="py-12 text-center">
              <p className="type-body text-[var(--color-text-muted)]">No holdings to display</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border-base)]">
                  <th
                    className="text-left py-3 px-5 type-eyebrow text-[var(--color-text-muted)] cursor-pointer select-none uppercase tracking-wider"
                    onClick={() => handleSort('ticker')}
                  >
                    Position {renderSortIcon('ticker')}
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
                    Market Value {renderSortIcon('value')}
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
                  const dayChange = holding.day_change_percentage ?? 0;
                  const allocation = holding.portfolio_allocation ?? 0;
                  const isPositiveChange = dayChange >= 0;
                  const isExpanded = expandedRowId === holding.id;
                  const unrealised = holding.unrealised_gain ?? 0;
                  const unrealisedPct = holding.unrealised_pct ?? null;
                  const costBasisTotal = holding.cost_basis ? holding.cost_basis * holding.shares : null;
                  const dayChangeDollars = holding.total_value * (dayChange / 100);
                  const isPositiveUnrealised = unrealised >= 0;

                  return (
                    <React.Fragment key={holding.id}>
                      <tr
                        className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-overlay)] transition-colors cursor-pointer group"
                        onClick={() => setExpandedRowId(isExpanded ? null : holding.id)}
                      >
                        {/* Position: Ticker large + name + shares */}
                        <td className="py-5 px-5">
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                              <span className="text-[11px] font-bold text-[var(--color-text-secondary)] leading-none">
                                {holding.ticker.slice(0, 4)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="font-mono text-[17px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight">
                                {holding.ticker}
                              </div>
                              <div className="text-[13px] text-[var(--color-text-muted)] leading-tight mt-0.5 truncate max-w-[220px]">
                                {holding.asset_name}
                                <span className="text-[var(--color-text-muted)]/60 ml-1.5">
                                  {formatNumber(holding.shares)} shares
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-5 px-4 text-right">
                          <span className="font-mono text-[14px] font-medium text-[var(--color-text-primary)] tabular-nums">
                            {formatCurrencyDetailed(holding.current_price)}
                          </span>
                        </td>

                        {/* Market Value + Unrealised P&L */}
                        <td className="py-5 px-4 text-right">
                          <div className="font-mono text-[17px] font-bold text-[var(--color-text-primary)] tabular-nums leading-tight">
                            {formatValue(holding.total_value)}
                          </div>
                          {(unrealised !== 0 || unrealisedPct !== null) && (
                            <div className={`font-mono text-[12px] tabular-nums leading-tight mt-1 ${
                              isPositiveUnrealised ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                            }`}>
                              {isPositiveUnrealised ? '+' : ''}{formatValue(unrealised)}
                              {unrealisedPct !== null && (
                                <span className="opacity-70 ml-1">
                                  ({unrealisedPct >= 0 ? '+' : ''}{unrealisedPct.toFixed(1)}%)
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Day Change - % and $ */}
                        <td className="py-5 px-4 text-right">
                          <div className={`flex flex-col items-end ${
                            isPositiveChange ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                          }`}>
                            <div className="flex items-center gap-0.5">
                              {isPositiveChange ? (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDownRight className="h-3.5 w-3.5" />
                              )}
                              <span className="font-mono text-[14px] font-semibold tabular-nums">
                                {formatPercentage(dayChange, 2)}
                              </span>
                            </div>
                            <span className="font-mono text-[12px] tabular-nums opacity-70 mt-0.5">
                              {dayChangeDollars >= 0 ? '+' : ''}{formatCurrencyDetailed(dayChangeDollars)}
                            </span>
                          </div>
                        </td>

                        {/* Allocation - bar + % */}
                        <td className="py-5 pr-5 pl-4 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <div className="w-20 h-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[var(--color-gold)] rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, allocation)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[14px] font-medium text-[var(--color-text-secondary)] tabular-nums w-14 text-right">
                              {allocation.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <tr className="border-b border-[var(--color-border-subtle)]">
                          <td colSpan={5} className="py-5 px-5 bg-[var(--color-bg-overlay)]/40">
                            <div className="ml-[54px] space-y-4">
                              <HoldingMiniChart ticker={holding.ticker} />
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                <div>
                                  <span className="type-eyebrow text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] block mb-1.5">
                                    Avg Cost Basis
                                  </span>
                                  <span className="font-mono text-[15px] text-[var(--color-text-primary)] tabular-nums">
                                    {holding.cost_basis ? formatCurrencyDetailed(holding.cost_basis) : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="type-eyebrow text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] block mb-1.5">
                                    Total Cost
                                  </span>
                                  <span className="font-mono text-[15px] text-[var(--color-text-primary)] tabular-nums">
                                    {costBasisTotal ? formatValue(costBasisTotal) : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="type-eyebrow text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] block mb-1.5">
                                    Sector
                                  </span>
                                  <span className="font-mono text-[15px] text-[var(--color-text-primary)]">
                                    {holding.sector || '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="type-eyebrow text-[var(--color-text-muted)] uppercase tracking-wider text-[10px] block mb-1.5">
                                    Asset Class
                                  </span>
                                  <span className="font-mono text-[15px] text-[var(--color-text-primary)]">
                                    {holding.asset_class || '-'}
                                  </span>
                                </div>
                              </div>
                              <Link
                                href={`/analyze/${holding.ticker}`}
                                className="inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-[var(--color-gold)] hover:text-[var(--color-gold-hi)] transition-colors"
                              >
                                View full analysis
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                              </Link>
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
