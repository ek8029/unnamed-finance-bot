'use client';

import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { useFormat } from '@/hooks/use-format';
import { Progress } from '@/components/ui/progress';

interface CompositionItem {
  name: string;
  value: number;
  percentage: number;
  items?: string[];
}

interface AssetsLiabilitiesCompositionProps {
  assets: CompositionItem[];
  liabilities: CompositionItem[];
}

export function AssetsLiabilitiesComposition({
  assets,
  liabilities,
}: AssetsLiabilitiesCompositionProps) {
  const { formatCurrency } = useFormat();

  const totalAssets = assets.reduce((sum, item) => sum + item.value, 0);
  const totalLiabilities = liabilities.reduce((sum, item) => sum + item.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtToAssetRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  return (
    <DataPanel variant="metric">
      <DataPanelHeader>
        <DataPanelTitle>Financial Composition</DataPanelTitle>
      </DataPanelHeader>
      <DataPanelContent>
        {/* Summary Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-[var(--color-border-subtle)]">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono mb-1">Total Assets</div>
            <div className="type-data text-xl font-tabular text-[var(--color-positive)] glow-positive">
              {formatCurrency(totalAssets)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono mb-1">Total Liabilities</div>
            <div className="type-data text-xl font-tabular text-[var(--color-negative)] glow-negative">
              {formatCurrency(totalLiabilities)}
            </div>
          </div>
        </div>

        {/* Debt-to-Asset Ratio */}
        <div className="mb-4 p-2 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)]">
          <div className="flex justify-between type-label text-xs mb-1.5">
            <span className="text-[var(--color-text-secondary)]">Debt-to-Asset Ratio</span>
            <span className={`font-tabular ${debtToAssetRatio < 30 ? 'text-[var(--color-positive)]' : debtToAssetRatio < 50 ? 'text-[var(--color-warning)]' : 'text-[var(--color-negative)]'}`}>
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
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono mb-2">Assets Breakdown</div>
          <div className="space-y-2">
            {assets.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between type-label text-xs mb-1">
                  <span className="text-[var(--color-text-secondary)]">{item.name}</span>
                  <span className="text-[var(--color-text-primary)] font-tabular">
                    {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg-elevated)] rounded overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-positive)] rounded transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Liabilities Breakdown */}
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono mb-2">Liabilities Breakdown</div>
          <div className="space-y-2">
            {liabilities.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between type-label text-xs mb-1">
                  <span className="text-[var(--color-text-secondary)]">{item.name}</span>
                  <span className="text-[var(--color-text-primary)] font-tabular">
                    {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg-elevated)] rounded overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-negative)] rounded transition-all duration-500"
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
