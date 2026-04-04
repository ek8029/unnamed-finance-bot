'use client';

import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { useFormat } from '@/hooks/use-format';
import { useCountUp } from '@/hooks/use-count-up';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, CreditCard, TrendingUp } from 'lucide-react';

interface Changes {
  assets: number | null;
  liabilities: number | null;
  cash_flow: number | null;
  portfolio: number | null;
}

interface SummaryItem {
  title: string;
  value: number;
  change: number | null;
  icon: typeof Wallet;
  iconColor: string;
  iconBg: string;
}

function SummaryCard({ item, index }: { item: SummaryItem; index: number }) {
  const { formatCurrency, formatPercentage } = useFormat();
  const Icon = item.icon;
  const isPositive = (item.change ?? 0) >= 0;
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  const animatedValue = useCountUp(item.value, 1200, 0, index * 100);
  const displayValue = isVisible ? animatedValue : item.value;

  return (
    <div
      ref={ref}
      className="transition-[opacity,transform,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        filter: isVisible ? 'blur(0px)' : 'blur(4px)',
        transitionDelay: `${index * 80}ms`,
      }}
    >
      <DataPanel variant="metric">
        <DataPanelHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-2.5">
          <DataPanelTitle className="text-xs">{item.title}</DataPanelTitle>
          <div className={`rounded p-2.5 ${item.iconBg} ${index === 0 ? 'shadow-glow-gold' : ''}`}>
            <Icon className={`h-3.5 w-3.5 ${item.iconColor}`} />
          </div>
        </DataPanelHeader>
        <DataPanelContent className="p-2.5 pt-0">
          <div className="type-data-sm font-tabular text-[var(--color-text-primary)] glow-white">
            {formatCurrency(displayValue)}
          </div>
          <div className="flex items-center gap-1 mt-1 whitespace-nowrap overflow-hidden">
            {item.change !== null ? (
              <>
                {isPositive ? (
                  <ArrowUpRight className="h-3 w-3 shrink-0 text-[var(--color-positive)]" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 shrink-0 text-[var(--color-negative)]" />
                )}
                <span
                  className={`type-label font-tabular ${
                    isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                  }`}
                >
                  {formatPercentage(item.change)}
                </span>
                <span className="type-label text-[var(--color-text-muted)]">vs last mo</span>
              </>
            ) : (
              <span className="type-label text-[var(--color-text-muted)]">--</span>
            )}
          </div>
        </DataPanelContent>
      </DataPanel>
    </div>
  );
}

interface FinancialSummaryCardsProps {
  totalAssets: number;
  totalLiabilities: number;
  monthlyCashFlow: number;
  portfolioValue: number;
  changes?: Changes;
}

export function FinancialSummaryCards({
  totalAssets,
  totalLiabilities,
  monthlyCashFlow,
  portfolioValue,
  changes,
}: FinancialSummaryCardsProps) {
  const summaryData: SummaryItem[] = [
    {
      title: 'Total Assets',
      value: totalAssets,
      change: changes?.assets ?? null,
      icon: Wallet,
      iconColor: 'text-[var(--color-gold)]',
      iconBg: 'bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]',
    },
    {
      title: 'Total Liabilities',
      value: totalLiabilities,
      change: changes?.liabilities ?? null,
      icon: CreditCard,
      iconColor: 'text-[var(--color-negative)]',
      iconBg: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]',
    },
    {
      title: 'Monthly Cash Flow',
      value: monthlyCashFlow,
      change: changes?.cash_flow ?? null,
      icon: TrendingUp,
      iconColor: 'text-[var(--color-positive)]',
      iconBg: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]',
    },
    {
      title: 'Portfolio Value',
      value: portfolioValue,
      change: changes?.portfolio ?? null,
      icon: DollarSign,
      iconColor: 'text-[var(--color-text-primary)]',
      iconBg: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {summaryData.map((item, index) => (
        <SummaryCard key={item.title} item={item} index={index} />
      ))}
    </div>
  );
}
