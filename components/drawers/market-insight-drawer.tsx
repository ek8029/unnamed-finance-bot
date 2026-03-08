'use client';

import { DrawerSection, DrawerSectionHeader } from '@/components/ui/drawer';
import { Holding } from '@/types';
import { formatCurrency } from '@/lib/utils';
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
  const totalExposure = affectedHoldings.reduce((sum, h) => sum + h.total_value, 0);

  return (
    <>
      {/* Market Alert */}
      <DrawerSection className="bg-helm-elevated">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-helm-warning/10 rounded border border-helm-warning/20">
            <AlertCircle className="h-5 w-5 text-helm-warning" />
          </div>
          <div className="flex-1">
            <h3 className="type-h3 text-helm-platinum mb-1">{insightTitle}</h3>
            <p className="text-sm text-helm-secondary leading-relaxed">
              {insightDescription}
            </p>
          </div>
        </div>
      </DrawerSection>

      {/* Exposure Summary */}
      <DrawerSection>
        <DrawerSectionHeader>Your Exposure</DrawerSectionHeader>
        <div className="p-4 bg-helm-elevated rounded border border-helm-border-subtle">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="type-caption text-helm-secondary mb-1">Total Exposure</div>
              <div className="type-data text-2xl font-tabular text-helm-platinum">
                {formatCurrency(totalExposure)}
              </div>
            </div>
            <div>
              <div className="type-caption text-helm-secondary mb-1">Affected Holdings</div>
              <div className="type-data text-2xl font-tabular text-helm-platinum">
                {affectedHoldings.length}
              </div>
            </div>
          </div>
        </div>
      </DrawerSection>

      {/* Recommended Action */}
      <DrawerSection>
        <DrawerSectionHeader>Recommended Action</DrawerSectionHeader>
        <div className="p-4 bg-helm-gold-surface rounded border border-helm-gold/20">
          <div className="flex items-start gap-2">
            <div className="type-label text-sm text-helm-gold leading-relaxed">
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
                className="p-4 bg-helm-elevated rounded border border-helm-border-subtle hover:border-helm-border-strong transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="type-h3 text-helm-platinum">{holding.ticker}</span>
                      <span className="type-caption text-helm-secondary">
                        {holding.asset_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 type-caption text-helm-secondary">
                      <span>{holding.shares} shares</span>
                      <span>•</span>
                      <span>{holding.portfolio_allocation.toFixed(1)}% of portfolio</span>
                    </div>
                  </div>
                  <button className="p-1.5 rounded hover:bg-helm-overlay transition-colors text-helm-secondary hover:text-helm-platinum">
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-4 p-3 bg-helm-surface rounded border border-helm-border-subtle">
                  <div>
                    <div className="type-caption text-helm-secondary mb-1">Current Value</div>
                    <div className="type-data text-sm font-tabular text-helm-platinum">
                      {formatCurrency(holding.total_value)}
                    </div>
                  </div>
                  <div>
                    <div className="type-caption text-helm-secondary mb-1">Current Price</div>
                    <div className="type-data text-sm font-tabular text-helm-platinum">
                      {formatCurrency(holding.current_price)}
                    </div>
                  </div>
                  <div>
                    <div className="type-caption text-helm-secondary mb-1">Day Change</div>
                    <div
                      className={`flex items-center gap-1 type-data text-sm font-tabular ${
                        holding.day_change_percentage >= 0 ? 'text-helm-positive' : 'text-helm-negative'
                      }`}
                    >
                      {holding.day_change_percentage >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>
                        {holding.day_change_percentage >= 0 ? '+' : ''}
                        {holding.day_change_percentage.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="type-caption text-helm-secondary mb-1">Total Gain/Loss</div>
                    <div
                      className={`type-data text-sm font-tabular ${
                        totalGainLoss >= 0 ? 'text-helm-positive' : 'text-helm-negative'
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
