'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle>Financial Health Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center justify-center">
          <div className="relative h-40 w-40">
            <svg className="h-40 w-40 -rotate-90" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="var(--color-border-base)"
                strokeWidth="10"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(healthScore.score / 100) * 439.6} 439.6`}
                className={getScoreColor(healthScore.score)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`type-display text-4xl ${getScoreColor(healthScore.score)}`}>
                {healthScore.score}
              </span>
              <span className="type-label text-helm-secondary mt-1">{getScoreLabel(healthScore.score)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between type-label mb-2">
              <span className="text-helm-secondary">Debt-to-Asset Ratio</span>
              <span className="text-helm-platinum">{(healthScore.debt_to_asset_ratio * 100).toFixed(1)}%</span>
            </div>
            <Progress
              value={healthScore.debt_to_asset_ratio * 100}
              max={100}
              variant={healthScore.debt_to_asset_ratio < 0.4 ? 'positive' : healthScore.debt_to_asset_ratio < 0.6 ? 'warning' : 'negative'}
            />
          </div>

          <div>
            <div className="flex justify-between type-label mb-2">
              <span className="text-helm-secondary">Savings Rate</span>
              <span className="text-helm-platinum">{(healthScore.savings_rate * 100).toFixed(1)}%</span>
            </div>
            <Progress
              value={healthScore.savings_rate * 100}
              max={100}
              variant={healthScore.savings_rate > 0.15 ? 'positive' : healthScore.savings_rate > 0.05 ? 'warning' : 'negative'}
            />
          </div>

          <div>
            <div className="flex justify-between type-label mb-2">
              <span className="text-helm-secondary">Emergency Fund</span>
              <span className="text-helm-platinum">{healthScore.emergency_fund_months.toFixed(1)} months</span>
            </div>
            <Progress
              value={(healthScore.emergency_fund_months / 12) * 100}
              max={100}
              variant={healthScore.emergency_fund_months >= 6 ? 'positive' : healthScore.emergency_fund_months >= 3 ? 'warning' : 'negative'}
            />
          </div>

          <div>
            <div className="flex justify-between type-label mb-2">
              <span className="text-helm-secondary">Portfolio Diversification</span>
              <span className="text-helm-platinum">{(healthScore.portfolio_diversification * 100).toFixed(1)}%</span>
            </div>
            <Progress
              value={healthScore.portfolio_diversification * 100}
              max={100}
              variant={healthScore.portfolio_diversification > 0.7 ? 'positive' : healthScore.portfolio_diversification > 0.5 ? 'warning' : 'negative'}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
