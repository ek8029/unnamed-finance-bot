'use client';

import { DrawerSection, DrawerSectionHeader } from '@/components/ui/drawer';
import { Holding } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { FileText, DollarSign, TrendingDown, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TaxInsightDrawerProps {
  insightDescription: string;
  recommendedAction: string;
  potentialSavings: number;
  holdings?: Holding[];
}

export function TaxInsightDrawer({
  insightDescription,
  recommendedAction,
  potentialSavings,
  holdings = [],
}: TaxInsightDrawerProps) {
  // Find holdings with losses for tax-loss harvesting
  const holdingsWithLosses = holdings.filter((h) => (h.unrealised_gain || 0) < 0);
  const totalUnrealizedLosses = holdingsWithLosses.reduce(
    (sum, h) => sum + Math.abs(h.unrealised_gain || 0),
    0
  );

  return (
    <>
      {/* Tax Opportunity */}
      <DrawerSection className="bg-helm-elevated">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-helm-positive/10 rounded border border-helm-positive/20">
            <FileText className="h-5 w-5 text-helm-positive" />
          </div>
          <div className="flex-1">
            <h3 className="type-h3 text-helm-platinum mb-2">Tax Optimization Opportunity</h3>
            <p className="text-sm text-helm-secondary leading-relaxed mb-3">
              {insightDescription}
            </p>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-helm-positive" />
              <span className="type-label text-sm text-helm-secondary">Potential Tax Savings:</span>
              <span className="type-data text-lg font-tabular text-helm-positive">
                {formatCurrency(potentialSavings)}
              </span>
            </div>
          </div>
        </div>
      </DrawerSection>

      {/* Recommended Action */}
      <DrawerSection>
        <DrawerSectionHeader>Next Steps</DrawerSectionHeader>
        <div className="p-4 bg-helm-gold-surface rounded border border-helm-gold/20 mb-4">
          <p className="text-sm text-helm-gold leading-relaxed mb-3">
            {recommendedAction}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="default" className="bg-helm-gold text-helm-base hover:bg-helm-gold/90">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Schedule Tax Consultation
            </Button>
            <Button size="sm" variant="outline">
              Learn More
            </Button>
          </div>
        </div>

        {/* Tax Strategy Checklist */}
        <div className="space-y-2">
          <h4 className="type-label text-xs text-helm-platinum mb-2">Before Taking Action:</h4>
          {[
            'Review your current tax bracket and expected income',
            'Consider holding periods for long-term vs short-term gains',
            'Ensure compliance with wash-sale rules (30-day period)',
            'Consult with a tax professional for your specific situation',
          ].map((item, index) => (
            <div key={index} className="flex items-start gap-2 text-xs text-helm-secondary">
              <div className="w-1 h-1 rounded-full bg-helm-gold mt-1.5 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </DrawerSection>

      {/* Holdings with Losses (if applicable) */}
      {holdingsWithLosses.length > 0 && (
        <DrawerSection>
          <DrawerSectionHeader>
            Positions with Unrealized Losses
          </DrawerSectionHeader>
          <div className="p-3 bg-helm-elevated rounded border border-helm-border-subtle mb-3">
            <div className="flex items-center justify-between">
              <span className="type-label text-sm text-helm-secondary">
                Total Harvestable Losses
              </span>
              <span className="type-data text-lg font-tabular text-helm-negative">
                -{formatCurrency(totalUnrealizedLosses)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {holdingsWithLosses.map((holding) => {
              const costBasis = holding.cost_basis || 0;
              const unrealisedGain = holding.unrealised_gain || 0;
              const lossPercentage = costBasis > 0
                ? (unrealisedGain / (holding.shares * costBasis)) * 100
                : 0;

              return (
                <div
                  key={holding.id}
                  className="p-3 bg-helm-elevated rounded border border-helm-border-subtle"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="type-label text-sm text-helm-platinum font-medium">
                          {holding.ticker}
                        </span>
                        <span className="type-caption text-helm-secondary">
                          {holding.asset_name}
                        </span>
                      </div>
                      <div className="type-caption text-helm-secondary">
                        {holding.shares} shares @ {formatCurrency(holding.current_price)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="type-data text-sm font-tabular text-helm-negative mb-1">
                        {formatCurrency(unrealisedGain)}
                      </div>
                      <div className="flex items-center gap-1 type-label text-xs text-helm-negative">
                        <TrendingDown className="h-3 w-3" />
                        <span className="font-tabular">{lossPercentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-helm-border-subtle">
                    <div>
                      <div className="type-caption text-helm-secondary mb-0.5">Cost Basis</div>
                      <div className="type-label text-xs font-tabular text-helm-platinum">
                        {formatCurrency(costBasis * holding.shares)}
                      </div>
                    </div>
                    <div>
                      <div className="type-caption text-helm-secondary mb-0.5">Current Value</div>
                      <div className="type-label text-xs font-tabular text-helm-platinum">
                        {formatCurrency(holding.total_value)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DrawerSection>
      )}

      {/* Tax Resources */}
      <DrawerSection>
        <DrawerSectionHeader>Tax Resources</DrawerSectionHeader>
        <div className="space-y-2">
          {[
            { title: 'IRS Publication 550', subtitle: 'Investment Income and Expenses' },
            { title: 'Tax-Loss Harvesting Guide', subtitle: 'Comprehensive strategy overview' },
            { title: 'Capital Gains Calculator', subtitle: 'Estimate your tax liability' },
          ].map((resource, index) => (
            <button
              key={index}
              className="w-full p-3 bg-helm-elevated rounded border border-helm-border-subtle hover:border-helm-border-strong transition-colors text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="type-label text-sm text-helm-platinum group-hover:text-helm-gold transition-colors">
                    {resource.title}
                  </div>
                  <div className="type-caption text-helm-secondary">{resource.subtitle}</div>
                </div>
                <FileText className="h-4 w-4 text-helm-secondary group-hover:text-helm-gold transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </DrawerSection>
    </>
  );
}
