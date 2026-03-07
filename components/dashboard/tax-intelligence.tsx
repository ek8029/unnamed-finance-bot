'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaxIntelligence as Tax } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { FileText, Info } from 'lucide-react';

interface TaxIntelligenceProps {
  taxData: Tax;
  onCategorySelect?: (category: string) => void;
}

export function TaxIntelligence({ taxData, onCategorySelect }: TaxIntelligenceProps) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const taxItems = [
    { label: 'Estimated Income Tax', key: 'income', value: taxData.estimated_income_tax },
    { label: 'Short-Term Capital Gains', key: 'short_term', value: taxData.short_term_capital_gains },
    { label: 'Long-Term Capital Gains', key: 'long_term', value: taxData.long_term_capital_gains },
    { label: 'Deductions Identified', key: 'deductions', value: taxData.deductions_identified },
    { label: 'Estimated Quarterly Payment', key: 'quarterly', value: taxData.estimated_quarterly_payment },
  ];

  const handleSelect = (itemKey: string, label: string) => {
    setActiveLabel(label);
    onCategorySelect?.(itemKey);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Tax Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          {taxItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelect(item.key, item.label)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
                activeLabel === item.label
                  ? 'border-helm-gold-border bg-helm-gold-surface/30'
                  : 'border-helm-border-base bg-helm-elevated hover:border-helm-border-strong'
              }`}
            >
              <div className="flex items-center gap-2">
                <Info className="h-3 w-3 text-helm-muted" />
                <span className="type-label text-helm-secondary">{item.label}</span>
              </div>
              <span className="type-data text-sm">
                {formatCurrency(item.value)}
              </span>
            </button>
          ))}
        </div>

        <div className="p-3 rounded-md border border-helm-warning/30 bg-helm-overlay">
          <p className="type-caption text-helm-warning mb-1">Disclaimer</p>
          <p className="text-[11px] text-helm-secondary">
            These views are informational only and are not tax advice. Always consult with a qualified professional
            before taking action.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
