'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Holding } from '@/types';
import { formatCurrency, formatPercentage, formatNumber } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, TrendingUp, ChevronUp, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface PortfolioMonitorProps {
  holdings: Holding[];
}

export function PortfolioMonitor({ holdings }: PortfolioMonitorProps) {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.total_value, 0);

  type SortKey = 'asset' | 'ticker' | 'value' | 'change' | 'allocation';
  const [sortKey, setSortKey] = useState<SortKey>('asset');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
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
        case 'asset':
          aVal = a.asset_name;
          bVal = b.asset_name;
          break;
        case 'ticker':
          aVal = a.ticker;
          bVal = b.ticker;
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
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ChevronDown className="ml-1 h-3 w-3 inline" />
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Investment Portfolio
          </CardTitle>
          <div className="text-sm text-helm-secondary">
            Total: <span className="type-label text-helm-platinum">{formatCurrency(totalValue)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-helm-border-base">
                  <th
                    className="text-left py-3 px-4 type-label text-helm-secondary cursor-pointer select-none"
                    onClick={() => handleSort('asset')}
                  >
                    Asset {renderSortIcon('asset')}
                  </th>
                  <th
                    className="text-left py-3 px-4 type-label text-helm-secondary cursor-pointer select-none"
                    onClick={() => handleSort('ticker')}
                  >
                    Ticker {renderSortIcon('ticker')}
                  </th>
                  <th className="text-right py-3 px-4 type-label text-helm-secondary">Shares</th>
                  <th className="text-right py-3 px-4 type-label text-helm-secondary">Price</th>
                  <th
                    className="text-right py-3 px-4 type-label text-helm-secondary cursor-pointer select-none"
                    onClick={() => handleSort('value')}
                  >
                    Total Value {renderSortIcon('value')}
                  </th>
                  <th
                    className="text-right py-3 px-4 type-label text-helm-secondary cursor-pointer select-none"
                    onClick={() => handleSort('change')}
                  >
                    Day Change {renderSortIcon('change')}
                  </th>
                  <th
                    className="text-right py-3 px-4 type-label text-helm-secondary cursor-pointer select-none"
                    onClick={() => handleSort('allocation')}
                  >
                    Allocation {renderSortIcon('allocation')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedHoldings.map((holding) => {
                  const isPositiveChange = holding.day_change_percentage >= 0;
                  const isExpanded = expandedRowId === holding.id;
                  const unrealised = holding.unrealised_gain ?? 0;
                  const unrealisedPct =
                    holding.cost_basis && holding.cost_basis > 0
                      ? (unrealised / (holding.cost_basis * holding.shares || 1)) * 100
                      : null;

                  return (
                    <>
                      <tr
                        key={holding.id}
                        className="border-b border-helm-border-subtle hover:bg-helm-overlay transition-colors cursor-pointer"
                        onClick={() =>
                          setExpandedRowId(isExpanded ? null : holding.id)
                        }
                      >
                        <td className="py-3 px-4">
                          <div>
                            <div className="type-h3">{holding.asset_name}</div>
                            {holding.sector && (
                              <div className="text-xs text-helm-muted mt-0.5">
                                {holding.sector}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="type-data text-sm text-helm-platinum">
                            {holding.ticker}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-helm-secondary">
                          {formatNumber(holding.shares)}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-helm-platinum">
                          {formatCurrency(holding.current_price)}
                        </td>
                        <td className="py-3 px-4 text-right type-label text-helm-platinum">
                          {formatCurrency(holding.total_value)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div
                            className={`flex items-center justify-end gap-1 ${
                              isPositiveChange
                                ? 'text-helm-positive'
                                : 'text-helm-negative'
                            }`}
                          >
                            {isPositiveChange ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            <span className="text-sm font-medium">
                              {formatPercentage(holding.day_change_percentage)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-helm-elevated border border-helm-border-subtle rounded-full overflow-hidden">
                              <div
                                className="h-full bg-helm-gold"
                                style={{
                                  width: `${holding.portfolio_allocation}%`,
                                }}
                              />
                            </div>
                            <span className="type-label text-helm-platinum w-12">
                              {holding.portfolio_allocation.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-helm-border-subtle bg-helm-overlay/60">
                          <td colSpan={7} className="py-3 px-4">
                            <div className="flex flex-wrap gap-4 text-xs text-helm-secondary">
                              <div>
                                <span className="type-label block mb-1">
                                  Cost basis (per share)
                                </span>
                                <span className="type-data text-sm">
                                  {holding.cost_basis
                                    ? formatCurrency(holding.cost_basis)
                                    : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="type-label block mb-1">
                                  Unrealised P/L
                                </span>
                                <span
                                  className={`type-data text-sm ${
                                    unrealised >= 0
                                      ? 'text-helm-positive'
                                      : 'text-helm-negative'
                                  }`}
                                >
                                  {unrealised >= 0 ? '+' : '-'}
                                  {formatCurrency(Math.abs(unrealised))}
                                  {unrealisedPct !== null && (
                                    <span className="type-caption ml-2">
                                      ({formatPercentage(unrealisedPct, 1)})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div>
                                <span className="type-label block mb-1">
                                  Asset class
                                </span>
                                <span className="type-data text-sm">
                                  {holding.asset_class ?? '—'}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 p-4 bg-helm-overlay rounded-md border border-helm-border-base">
          <div className="flex items-start gap-2">
            <div className="text-helm-gold mt-0.5">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="type-h3 mb-1">Market Intelligence</h4>
              <p className="text-sm text-helm-secondary">
                Monitoring news and filings for your holdings. You'll be notified of any significant events.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
