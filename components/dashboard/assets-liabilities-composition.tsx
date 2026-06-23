'use client';

import {
  DataPanel,
  DataPanelContent,
  DataPanelHeader,
  DataPanelTitle,
} from '@/components/ui/data-panel';
import { useFormat } from '@/hooks/use-format';

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

        {/* Assets Breakdown */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono mb-2">Assets Breakdown</div>
          <div className="space-y-2">
            {assets.map((item) => (
              <div key={item.name}>
                <div className="flex justify-between type-label text-[13px] mb-1">
                  <span className="text-[var(--color-text-secondary)]">{item.name}</span>
                  <span className="text-[var(--color-text-primary)] font-tabular">
                    {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg-elevated)] rounded overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-positive)] rounded transition-transform duration-500 origin-left w-full"
                    style={{ transform: `scaleX(${item.percentage / 100})` }}
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
                <div className="flex justify-between type-label text-[13px] mb-1">
                  <span className="text-[var(--color-text-secondary)]">{item.name}</span>
                  <span className="text-[var(--color-text-primary)] font-tabular">
                    {formatCurrency(item.value)} ({item.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg-elevated)] rounded overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-negative)] rounded transition-transform duration-500 origin-left w-full"
                    style={{ transform: `scaleX(${item.percentage / 100})` }}
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
