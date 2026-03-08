'use client';

import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { formatCurrency, formatPercentage } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, CreditCard, TrendingUp } from 'lucide-react';

interface FinancialSummaryCardsProps {
  totalAssets: number;
  totalLiabilities: number;
  monthlyCashFlow: number;
  portfolioValue: number;
}

export function FinancialSummaryCards({
  totalAssets,
  totalLiabilities,
  monthlyCashFlow,
  portfolioValue,
}: FinancialSummaryCardsProps) {
  const summaryData = [
    {
      title: 'Total Assets',
      value: totalAssets,
      change: 3.2,
      icon: Wallet,
      iconColor: 'text-helm-gold',
      iconBg: 'bg-helm-gold-surface border border-helm-gold-border',
    },
    {
      title: 'Total Liabilities',
      value: totalLiabilities,
      change: -2.1,
      icon: CreditCard,
      iconColor: 'text-helm-negative',
      iconBg: 'bg-helm-elevated border border-helm-border-subtle',
    },
    {
      title: 'Monthly Cash Flow',
      value: monthlyCashFlow,
      change: 5.4,
      icon: TrendingUp,
      iconColor: 'text-helm-positive',
      iconBg: 'bg-helm-elevated border border-helm-border-subtle',
    },
    {
      title: 'Portfolio Value',
      value: portfolioValue,
      change: 4.8,
      icon: DollarSign,
      iconColor: 'text-helm-platinum',
      iconBg: 'bg-helm-elevated border border-helm-border-subtle',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {summaryData.map((item) => {
        const Icon = item.icon;
        const isPositive = item.change > 0;

        return (
          <DataPanel key={item.title} variant="metric" elevation="hover">
            <DataPanelHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3">
              <DataPanelTitle className="text-xs">{item.title}</DataPanelTitle>
              <div className={`rounded-md p-1.5 ${item.iconBg}`}>
                <Icon className={`h-3.5 w-3.5 ${item.iconColor}`} />
              </div>
            </DataPanelHeader>
            <DataPanelContent className="p-3 pt-0">
              <div className="type-data text-2xl font-tabular text-helm-platinum">
                {formatCurrency(item.value)}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {isPositive ? (
                  <ArrowUpRight className="h-3 w-3 text-helm-positive" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-helm-negative" />
                )}
                <span
                  className={`type-label text-xs font-tabular ${
                    isPositive ? 'text-helm-positive' : 'text-helm-negative'
                  }`}
                >
                  {formatPercentage(item.change)}
                </span>
                <span className="type-label text-xs text-helm-muted">from last month</span>
              </div>
            </DataPanelContent>
          </DataPanel>
        );
      })}
    </div>
  );
}
