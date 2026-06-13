'use client';

import { DrawerSection, DrawerSectionHeader } from '@/components/ui/drawer';
import { Holding } from '@/types';
import { useFormat } from '@/hooks/use-format';
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
  const { formatCurrency } = useFormat();
  // Find holdings with losses for tax-loss harvesting
  const holdingsWithLosses = holdings.filter((h) => (h.unrealised_gain || 0) < 0);
  const totalUnrealizedLosses = holdingsWithLosses.reduce(
    (sum, h) => sum + Math.abs(h.unrealised_gain || 0),
    0
  );

  return (
    <>
      {/* Tax Opportunity */}
      <DrawerSection className="bg-[var(--color-bg-elevated)]">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-[var(--color-positive)]/10 rounded border border-[var(--color-positive)]/20">
            <FileText className="h-5 w-5 text-[var(--color-positive)]" />
          </div>
          <div className="flex-1">
            <h3 className="type-h3 text-[var(--color-text-primary)] mb-2">Tax Optimization Opportunity</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">
              {insightDescription}
            </p>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[var(--color-positive)]" />
              <span className="type-label text-sm text-[var(--color-text-secondary)]">Potential Tax Savings:</span>
              <span className="type-data text-lg font-tabular text-[var(--color-positive)]">
                {formatCurrency(potentialSavings)}
              </span>
            </div>
          </div>
        </div>
      </DrawerSection>

      {/* Recommended Action */}
      <DrawerSection>
        <DrawerSectionHeader>What this means</DrawerSectionHeader>
        <div className="p-4 bg-[var(--color-gold-surface)] rounded border border-[var(--color-gold)]/20 mb-4">
          <p className="text-sm text-[var(--color-gold)] leading-relaxed mb-3">
            {recommendedAction}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="default" className="bg-[var(--color-gold)] text-black font-semibold hover:bg-[var(--color-gold-hi)]">
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
          <h4 className="type-label text-xs text-[var(--color-text-primary)] mb-2">Before Taking Action:</h4>
          {[
            'Review your current tax bracket and expected income',
            'Consider holding periods for long-term vs short-term gains',
            'Ensure compliance with wash-sale rules (30-day period)',
            'Consult with a tax professional for your specific situation',
          ].map((item, index) => (
            <div key={index} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
              <div className="w-1 h-1 rounded-full bg-[var(--color-gold)] mt-1.5 flex-shrink-0" />
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
          <div className="p-3 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)] mb-3">
            <div className="flex items-center justify-between">
              <span className="type-label text-sm text-[var(--color-text-secondary)]">
                Total Harvestable Losses
              </span>
              <span className="type-data text-lg font-tabular text-[var(--color-negative)]">
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
                  className="p-3 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)]"
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
                      <div className="type-caption text-[var(--color-text-secondary)]">
                        {holding.shares} shares @ {formatCurrency(holding.current_price)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="type-data text-sm font-tabular text-[var(--color-negative)] mb-1">
                        {formatCurrency(unrealisedGain)}
                      </div>
                      <div className="flex items-center gap-1 type-label text-xs text-[var(--color-negative)]">
                        <TrendingDown className="h-3 w-3" />
                        <span className="font-tabular">{lossPercentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--color-border-subtle)]">
                    <div>
                      <div className="type-caption text-[var(--color-text-secondary)] mb-0.5">Cost Basis</div>
                      <div className="type-label text-xs font-tabular text-[var(--color-text-primary)]">
                        {formatCurrency(costBasis * holding.shares)}
                      </div>
                    </div>
                    <div>
                      <div className="type-caption text-[var(--color-text-secondary)] mb-0.5">Current Value</div>
                      <div className="type-label text-xs font-tabular text-[var(--color-text-primary)]">
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
              className="w-full p-3 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)] transition-colors text-left group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="type-label text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-gold)] transition-colors">
                    {resource.title}
                  </div>
                  <div className="type-caption text-[var(--color-text-secondary)]">{resource.subtitle}</div>
                </div>
                <FileText className="h-4 w-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-gold)] transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </DrawerSection>
    </>
  );
}
