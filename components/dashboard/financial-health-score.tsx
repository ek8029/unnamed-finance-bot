'use client';

import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { FinancialHealthScore as HealthScore } from '@/types';
import { Progress } from '@/components/ui/progress';

interface FinancialHealthScoreProps {
  healthScore: HealthScore;
}

export function FinancialHealthScore({ healthScore }: FinancialHealthScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-helm-positive';
    if (score >= 60) return 'text-helm-warning';
    return 'text-helm-negative';
  };

  const getScoreVariant = (score: number): 'positive' | 'warning' | 'negative' => {
    if (score >= 80) return 'positive';
    if (score >= 60) return 'warning';
    return 'negative';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <DataPanel variant="metric" elevation="hover">
      <DataPanelHeader>
        <DataPanelTitle>Financial Health</DataPanelTitle>
      </DataPanelHeader>
      <DataPanelContent className="space-y-4">
        {/* Compact Circular Score */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative h-32 w-32">
            <svg className="h-32 w-32 -rotate-90" viewBox="0 0 128 128">
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="var(--color-border-base)"
                strokeWidth="8"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(healthScore.score / 100) * 351.68} 351.68`}
                className={getScoreColor(healthScore.score)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`type-data text-3xl font-tabular ${getScoreColor(healthScore.score)}`}>
                {healthScore.score}
              </span>
              <span className="type-caption text-helm-secondary">{getScoreLabel(healthScore.score)}</span>
            </div>
          </div>
        </div>

        {/* Compact Metrics */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between type-label text-xs mb-1.5">
              <span className="text-helm-secondary">Debt-to-Asset</span>
              <span className="text-helm-platinum font-tabular">{(healthScore.debt_to_asset_ratio * 100).toFixed(1)}%</span>
            </div>
            <Progress
              value={healthScore.debt_to_asset_ratio * 100}
              max={100}
              variant={healthScore.debt_to_asset_ratio < 0.4 ? 'positive' : healthScore.debt_to_asset_ratio < 0.6 ? 'warning' : 'negative'}
            />
          </div>

          <div>
            <div className="flex justify-between type-label text-xs mb-1.5">
              <span className="text-helm-secondary">Savings Rate</span>
              <span className="text-helm-platinum font-tabular">{(healthScore.savings_rate * 100).toFixed(1)}%</span>
            </div>
            <Progress
              value={healthScore.savings_rate * 100}
              max={100}
              variant={healthScore.savings_rate > 0.15 ? 'positive' : healthScore.savings_rate > 0.05 ? 'warning' : 'negative'}
            />
          </div>

          <div>
            <div className="flex justify-between type-label text-xs mb-1.5">
              <span className="text-helm-secondary">Emergency Fund</span>
              <span className="text-helm-platinum font-tabular">{healthScore.emergency_fund_months.toFixed(1)} mo</span>
            </div>
            <Progress
              value={(healthScore.emergency_fund_months / 12) * 100}
              max={100}
              variant={healthScore.emergency_fund_months >= 6 ? 'positive' : healthScore.emergency_fund_months >= 3 ? 'warning' : 'negative'}
            />
          </div>

          <div>
            <div className="flex justify-between type-label text-xs mb-1.5">
              <span className="text-helm-secondary">Diversification</span>
              <span className="text-helm-platinum font-tabular">{(healthScore.portfolio_diversification * 100).toFixed(1)}%</span>
            </div>
            <Progress
              value={healthScore.portfolio_diversification * 100}
              max={100}
              variant={healthScore.portfolio_diversification > 0.7 ? 'positive' : healthScore.portfolio_diversification > 0.5 ? 'warning' : 'negative'}
            />
          </div>
        </div>
      </DataPanelContent>
    </DataPanel>
  );
}
