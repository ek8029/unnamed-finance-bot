'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Holding } from '@/types';
import { formatCurrency, formatPercentage, formatNumber } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';

interface PortfolioMonitorProps {
  holdings: Holding[];
}

export function PortfolioMonitor({ holdings }: PortfolioMonitorProps) {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.total_value, 0);

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
          <table className="w-full">
            <thead>
              <tr className="border-b border-helm-border-base">
                <th className="text-left py-3 px-4 type-label text-helm-secondary">Asset</th>
                <th className="text-left py-3 px-4 type-label text-helm-secondary">Ticker</th>
                <th className="text-right py-3 px-4 type-label text-helm-secondary">Shares</th>
                <th className="text-right py-3 px-4 type-label text-helm-secondary">Price</th>
                <th className="text-right py-3 px-4 type-label text-helm-secondary">Total Value</th>
                <th className="text-right py-3 px-4 type-label text-helm-secondary">Day Change</th>
                <th className="text-right py-3 px-4 type-label text-helm-secondary">Allocation</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => {
                const isPositiveChange = holding.day_change_percentage >= 0;

                return (
                  <tr
                    key={holding.id}
                    className="border-b border-helm-border-subtle hover:bg-helm-overlay transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <div className="type-h3">{holding.asset_name}</div>
                        {holding.sector && (
                          <div className="text-xs text-helm-muted mt-0.5">{holding.sector}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm font-semibold text-helm-platinum">
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
                          isPositiveChange ? 'text-helm-positive' : 'text-helm-negative'
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
                            style={{ width: `${holding.portfolio_allocation}%` }}
                          />
                        </div>
                        <span className="type-label text-helm-platinum w-12">
                          {holding.portfolio_allocation.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
