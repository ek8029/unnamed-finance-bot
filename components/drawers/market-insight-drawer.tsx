'use client';

import { DrawerSection, DrawerSectionHeader } from '@/components/ui/drawer';
import { Holding } from '@/types';
import { useFormat } from '@/hooks/use-format';
import { TrendingUp, TrendingDown, AlertCircle, ExternalLink } from 'lucide-react';

interface MarketInsightDrawerProps {
  insightTitle: string;
  insightDescription: string;
  recommendedAction: string;
  affectedHoldings: Holding[];
}

export function MarketInsightDrawer({
  insightTitle,
  insightDescription,
  recommendedAction,
  affectedHoldings,
}: MarketInsightDrawerProps) {
  const { formatCurrency } = useFormat();
  const totalExposure = affectedHoldings.reduce((sum, h) => sum + h.total_value, 0);

  return (
    <>
      {/* Market Alert */}
      <DrawerSection className="bg-[var(--color-bg-elevated)]">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[var(--color-warning)]/10 rounded border border-[var(--color-warning)]/20">
            <AlertCircle className="h-5 w-5 text-[var(--color-warning)]" />
          </div>
          <div className="flex-1">
            <h3 className="type-h3 text-[var(--color-text-primary)] mb-1">{insightTitle}</h3>
            <p className="text-[15px] text-[var(--color-text-secondary)] leading-relaxed">
              {insightDescription}
            </p>
          </div>
        </div>
      </DrawerSection>

      {/* Exposure Summary */}
      <DrawerSection>
        <DrawerSectionHeader>Your Exposure</DrawerSectionHeader>
        <div className="p-4 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="type-caption text-[var(--color-text-secondary)] mb-1">Total Exposure</div>
              <div className="type-data text-2xl font-tabular text-[var(--color-text-primary)]">
                {formatCurrency(totalExposure)}
              </div>
            </div>
            <div>
              <div className="type-caption text-[var(--color-text-secondary)] mb-1">Affected Holdings</div>
              <div className="type-data text-2xl font-tabular text-[var(--color-text-primary)]">
                {affectedHoldings.length}
              </div>
            </div>
          </div>
        </div>
      </DrawerSection>

      {/* Recommended Action */}
      <DrawerSection>
        <DrawerSectionHeader>Context</DrawerSectionHeader>
        <div className="p-4 bg-[var(--color-gold-surface)] rounded border border-[var(--color-gold)]/20">
          <div className="flex items-start gap-2">
            <div className="type-label text-[15px] text-[var(--color-gold)] leading-relaxed">
              {recommendedAction}
            </div>
          </div>
        </div>
      </DrawerSection>

      {/* Affected Holdings Detail */}
      <DrawerSection>
        <DrawerSectionHeader>Affected Positions</DrawerSectionHeader>
        <div className="space-y-2">
          {affectedHoldings.map((holding) => {
            const costBasis = holding.cost_basis || 0;
            const totalGainLoss = holding.total_value - holding.shares * costBasis;
            const gainLossPercentage = costBasis > 0 ? (totalGainLoss / (holding.shares * costBasis)) * 100 : 0;

            return (
              <div
                key={holding.id}
                className="p-4 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="type-h3 text-[var(--color-text-primary)]">{holding.ticker}</span>
                      <span className="type-caption text-[var(--color-text-secondary)]">
                        {holding.asset_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 type-caption text-[var(--color-text-secondary)]">
                      <span>{holding.shares} shares</span>
                      <span>•</span>
                      <span>{holding.portfolio_allocation.toFixed(1)}% of portfolio</span>
                    </div>
                  </div>
                  <button className="p-1.5 rounded hover:bg-[var(--color-bg-overlay)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" aria-label="View ticker details">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-4 p-3 bg-[var(--color-bg-surface)] rounded border border-[var(--color-border-subtle)]">
                  <div>
                    <div className="type-caption text-[var(--color-text-secondary)] mb-1">Current Value</div>
                    <div className="type-data text-[15px] font-tabular text-[var(--color-text-primary)]">
                      {formatCurrency(holding.total_value)}
                    </div>
                  </div>
                  <div>
                    <div className="type-caption text-[var(--color-text-secondary)] mb-1">Current Price</div>
                    <div className="type-data text-[15px] font-tabular text-[var(--color-text-primary)]">
                      {formatCurrency(holding.current_price)}
                    </div>
                  </div>
                  <div>
                    <div className="type-caption text-[var(--color-text-secondary)] mb-1">Day Change</div>
                    <div
                      className={`flex items-center gap-1 type-data text-[15px] font-tabular ${
                        (holding.day_change_percentage ?? 0) >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                      }`}
                    >
                      {(holding.day_change_percentage ?? 0) >= 0 ? (
                        <TrendingUp className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="h-3 w-3" aria-hidden="true" />
                      )}
                      <span className="sr-only">{(holding.day_change_percentage ?? 0) >= 0 ? 'Up' : 'Down'}</span>
                      <span>
                        {holding.day_change_percentage != null
                          ? `${holding.day_change_percentage >= 0 ? '+' : ''}${holding.day_change_percentage.toFixed(2)}%`
                          : '--'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="type-caption text-[var(--color-text-secondary)] mb-1">Total Gain/Loss</div>
                    <div
                      className={`type-data text-[15px] font-tabular ${
                        totalGainLoss >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'
                      }`}
                    >
                      {totalGainLoss >= 0 ? '+' : ''}
                      {gainLossPercentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DrawerSection>
    </>
  );
}
