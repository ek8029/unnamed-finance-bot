'use client';

import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { useFormat } from '@/hooks/use-format';
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
  const { formatCurrency, formatPercentage } = useFormat();

  const summaryData = [
    {
      title: 'Total Assets',
      value: totalAssets,
      change: 3.2,
      icon: Wallet,
      iconColor: 'text-[var(--color-gold)]',
      iconBg: 'bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]',
    },
    {
      title: 'Total Liabilities',
      value: totalLiabilities,
      change: -2.1,
      icon: CreditCard,
      iconColor: 'text-[var(--color-negative)]',
      iconBg: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]',
    },
    {
      title: 'Monthly Cash Flow',
      value: monthlyCashFlow,
      change: 5.4,
      icon: TrendingUp,
      iconColor: 'text-[var(--color-positive)]',
      iconBg: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]',
    },
    {
      title: 'Portfolio Value',
      value: portfolioValue,
      change: 4.8,
      icon: DollarSign,
      iconColor: 'text-[var(--color-text-primary)]',
      iconBg: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]',
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
              <div className="type-data text-2xl font-tabular text-[var(--color-text-primary)]">
                {formatCurrency(item.value)}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {isPositive ? (
                  <ArrowUpRight className="h-3 w-3 text-[var(--color-positive)]" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-[var(--color-negative)]" />
                )}
                <span
                  className={`type-label text-xs font-tabular ${
                    isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                  }`}
                >
                  {formatPercentage(item.change)}
                </span>
                <span className="type-label text-xs text-[var(--color-text-muted)]">from last month</span>
              </div>
            </DataPanelContent>
          </DataPanel>
        );
      })}
    </div>
  );
}
