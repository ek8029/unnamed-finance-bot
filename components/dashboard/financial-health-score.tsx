'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FinancialHealthScore as HealthScore } from '@/types';
import { Progress } from '@/components/ui/progress';

interface FinancialHealthScoreProps {
  healthScore: HealthScore;
}

export function FinancialHealthScore({ healthScore }: FinancialHealthScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
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
                stroke="#e5e7eb"
                strokeWidth="12"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(healthScore.score / 100) * 439.6} 439.6`}
                className={getScoreColor(healthScore.score)}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${getScoreColor(healthScore.score)}`}>
                {healthScore.score}
              </span>
              <span className="text-sm text-gray-500">{getScoreLabel(healthScore.score)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Debt-to-Asset Ratio</span>
              <span className="font-medium">{(healthScore.debt_to_asset_ratio * 100).toFixed(1)}%</span>
            </div>
            <Progress value={healthScore.debt_to_asset_ratio * 100} max={100} />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Savings Rate</span>
              <span className="font-medium">{(healthScore.savings_rate * 100).toFixed(1)}%</span>
            </div>
            <Progress value={healthScore.savings_rate * 100} max={100} />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Emergency Fund</span>
              <span className="font-medium">{healthScore.emergency_fund_months.toFixed(1)} months</span>
            </div>
            <Progress value={(healthScore.emergency_fund_months / 12) * 100} max={100} />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Portfolio Diversification</span>
              <span className="font-medium">{(healthScore.portfolio_diversification * 100).toFixed(1)}%</span>
            </div>
            <Progress value={healthScore.portfolio_diversification * 100} max={100} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
