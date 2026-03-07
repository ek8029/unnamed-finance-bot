'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
          <Card key={item.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>{item.title}</CardTitle>
              <div className={`rounded-md p-2 ${item.iconBg}`}>
                <Icon className={`h-4 w-4 ${item.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="type-data text-2xl">{formatCurrency(item.value)}</div>
              <div className="flex items-center gap-1 mt-1">
                {isPositive ? (
                  <ArrowUpRight className="h-4 w-4 text-helm-positive" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-helm-negative" />
                )}
                <span
                  className={`text-xs font-medium ${
                    isPositive ? 'text-helm-positive' : 'text-helm-negative'
                  }`}
                >
                  {formatPercentage(item.change)} from last month
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
