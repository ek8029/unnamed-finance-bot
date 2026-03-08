'use client';

import { DrawerSection, DrawerSectionHeader } from '@/components/ui/drawer';
import { Holding } from '@/types';
import { useFormat } from '@/hooks/use-format';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface PortfolioInsightDrawerProps {
  holdings: Holding[];
  insightDescription: string;
}

export function PortfolioInsightDrawer({ holdings, insightDescription }: PortfolioInsightDrawerProps) {
  const { formatCurrency } = useFormat();

  // Calculate total portfolio value
  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.total_value, 0);

  // Group holdings by sector
  const holdingsBySector = holdings.reduce((acc, holding) => {
    const sector = holding.sector || 'Other';
    if (!acc[sector]) {
      acc[sector] = [];
    }
    acc[sector].push(holding);
    return acc;
  }, {} as Record<string, Holding[]>);

  // Calculate sector totals
  const sectorTotals = Object.entries(holdingsBySector).map(([sector, sectorHoldings]) => ({
    sector,
    totalValue: sectorHoldings.reduce((sum, h) => sum + h.total_value, 0),
    holdings: sectorHoldings.length,
  }));

  return (
    <>
      {/* Insight Context */}
      <DrawerSection>
        <DrawerSectionHeader>Insight Overview</DrawerSectionHeader>
        <div className="p-3 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)]">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {insightDescription}
            </p>
          </div>
        </div>
      </DrawerSection>

      {/* Sector Concentration */}
      <DrawerSection>
        <DrawerSectionHeader>Sector Allocation</DrawerSectionHeader>
        <div className="space-y-3">
          {sectorTotals.map(({ sector, totalValue, holdings }) => (
            <div key={sector}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="type-label text-sm text-[var(--color-text-primary)]">{sector}</span>
                <div className="flex items-center gap-2">
                  <span className="type-caption text-[var(--color-text-secondary)]">{holdings} holdings</span>
                  <span className="type-data text-sm font-tabular text-[var(--color-text-primary)]">
                    {formatCurrency(totalValue)}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-gold)] rounded-full transition-all duration-500"
                  style={{
                    width: `${(totalValue / totalPortfolioValue) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </DrawerSection>

      {/* Detailed Holdings */}
      <DrawerSection>
        <DrawerSectionHeader>All Holdings</DrawerSectionHeader>
        <div className="space-y-2">
          {holdings.map((holding) => (
            <div
              key={holding.id}
              className="p-3 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)] transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="type-label text-sm text-[var(--color-text-primary)] font-medium">
                      {holding.ticker}
                    </span>
                    <span className="type-caption text-[var(--color-text-secondary)]">
                      {holding.asset_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="type-caption text-[var(--color-text-secondary)]">
                      {holding.shares} shares @ {formatCurrency(holding.current_price)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="type-data text-sm font-tabular text-[var(--color-text-primary)] mb-1">
                    {formatCurrency(holding.total_value)}
                  </div>
                  <div
                    className={`flex items-center gap-1 type-label text-xs ${
                      holding.day_change_percentage >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                    }`}
                  >
                    {holding.day_change_percentage >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span className="font-tabular">
                      {holding.day_change_percentage >= 0 ? '+' : ''}
                      {holding.day_change_percentage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
                <div>
                  <div className="type-caption text-[var(--color-text-secondary)] mb-0.5">Cost Basis</div>
                  <div className="type-label text-xs font-tabular text-[var(--color-text-primary)]">
                    {formatCurrency(holding.cost_basis || 0)}
                  </div>
                </div>
                <div>
                  <div className="type-caption text-[var(--color-text-secondary)] mb-0.5">Unrealized Gain</div>
                  <div
                    className={`type-label text-xs font-tabular ${
                      (holding.unrealised_gain || 0) >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                    }`}
                  >
                    {formatCurrency(holding.unrealised_gain || 0)}
                  </div>
                </div>
                <div>
                  <div className="type-caption text-[var(--color-text-secondary)] mb-0.5">Allocation</div>
                  <div className="type-label text-xs font-tabular text-[var(--color-text-primary)]">
                    {holding.portfolio_allocation.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DrawerSection>
    </>
  );
}
