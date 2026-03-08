'use client';

import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { formatCurrency } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface CompositionItem {
  category: string;
  value: number;
  percentage: number;
}

interface AssetsLiabilitiesCompositionProps {
  assets: CompositionItem[];
  liabilities: CompositionItem[];
}

export function AssetsLiabilitiesComposition({
  assets,
  liabilities,
}: AssetsLiabilitiesCompositionProps) {
  const totalAssets = assets.reduce((sum, item) => sum + item.value, 0);
  const totalLiabilities = liabilities.reduce((sum, item) => sum + item.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtToAssetRatio = (totalLiabilities / totalAssets) * 100;

  return (
    <DataPanel variant="metric" elevation="hover">
      <DataPanelHeader>
        <DataPanelTitle>Financial Composition</DataPanelTitle>
      </DataPanelHeader>
      <DataPanelContent>
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-helm-border-subtle">
          <div>
            <div className="type-caption text-helm-secondary mb-1">Total Assets</div>
            <div className="type-data text-xl font-tabular text-helm-positive">
              {formatCurrency(totalAssets)}
            </div>
          </div>
          <div>
            <div className="type-caption text-helm-secondary mb-1">Total Liabilities</div>
            <div className="type-data text-xl font-tabular text-helm-negative">
              {formatCurrency(totalLiabilities)}
            </div>
          </div>
        </div>

        {/* Debt-to-Asset Ratio */}
        <div className="mb-4 p-2 bg-helm-elevated rounded border border-helm-border-subtle">
          <div className="flex justify-between type-label text-xs mb-1.5">
            <span className="text-helm-secondary">Debt-to-Asset Ratio</span>
            <span className={`font-tabular ${debtToAssetRatio < 30 ? 'text-helm-positive' : debtToAssetRatio < 50 ? 'text-helm-warning' : 'text-helm-negative'}`}>
              {debtToAssetRatio.toFixed(1)}%
            </span>
          </div>
          <Progress
            value={debtToAssetRatio}
            max={100}
            variant={debtToAssetRatio < 30 ? 'positive' : debtToAssetRatio < 50 ? 'warning' : 'negative'}
          />
        </div>

        {/* Assets Breakdown */}
        <div className="mb-4">
          <div className="type-label text-xs text-helm-platinum mb-2">Assets Breakdown</div>
          <div className="space-y-2">
            {assets.map((item) => (
              <div key={item.category}>
                <div className="flex justify-between type-label text-xs mb-1">
                  <span className="text-helm-secondary">{item.category}</span>
                  <span className="text-helm-platinum font-tabular">
                    {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-1.5 bg-helm-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-helm-positive rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Liabilities Breakdown */}
        <div>
          <div className="type-label text-xs text-helm-platinum mb-2">Liabilities Breakdown</div>
          <div className="space-y-2">
            {liabilities.map((item) => (
              <div key={item.category}>
                <div className="flex justify-between type-label text-xs mb-1">
                  <span className="text-helm-secondary">{item.category}</span>
                  <span className="text-helm-platinum font-tabular">
                    {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-1.5 bg-helm-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-helm-negative rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </DataPanelContent>
    </DataPanel>
  );
}
