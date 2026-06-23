'use client';

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
  const animatedValue = useCountUp(item.value, 800, 0, index * 80);
  const displayValue = isVisible ? animatedValue : item.value;

  return (
    <div
      ref={ref}
      className="transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        transitionDelay: `${index * 80}ms`,
      }}
    >
      <div className="sovereign-card rounded border overflow-hidden p-3 md:p-5">
        <div className="flex items-center justify-between mb-1.5 md:mb-2">
          <h3 className="text-[10px] md:text-[13px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono leading-tight">
            {item.title}
          </h3>
          <div className={`rounded p-1 md:p-2 ${item.iconBg} ${index === 0 ? 'shadow-glow-gold' : ''}`}>
            <Icon className={`h-3 w-3 md:h-3.5 md:w-3.5 ${item.iconColor}`} />
          </div>
        </div>
        <div className="text-[17px] md:text-xl font-bold font-tabular text-[var(--color-text-primary)]">
          {formatCurrency(displayValue)}
        </div>
        <div className="flex items-center gap-1 mt-0.5 whitespace-nowrap overflow-hidden">
          {item.change !== null ? (
            <>
              {isPositive ? (
                <ArrowUpRight className="h-3 w-3 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
              ) : (
                <ArrowDownRight className="h-3 w-3 shrink-0 text-[var(--color-negative)]" aria-hidden="true" />
              )}
              <span className="sr-only">{isPositive ? 'Up' : 'Down'}</span>
              <span className={`text-[12px] font-tabular ${isPositive ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                {formatPercentage(item.change)}
              </span>
              <span className="text-[12px] text-[var(--color-text-muted)]">vs last mo</span>
            </>
          ) : (
            <span className="text-[12px] text-[var(--color-text-muted)]" aria-label="No change data available">--</span>
          )}
        </div>
      </div>
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
      title: 'Cash Flow',
      value: monthlyCashFlow,
      change: changes?.cash_flow ?? null,
      icon: TrendingUp,
      iconColor: 'text-[var(--color-positive)]',
      iconBg: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]',
    },
    {
      title: 'Portfolio',
      value: portfolioValue,
      change: changes?.portfolio ?? null,
      icon: DollarSign,
      iconColor: 'text-[var(--color-text-primary)]',
      iconBg: 'bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {summaryData.map((item, index) => (
        <SummaryCard key={item.title} item={item} index={index} />
      ))}
    </div>
  );
}
