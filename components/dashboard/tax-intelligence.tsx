'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TaxIntelligence as Tax } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { FileText, CheckCircle2 } from 'lucide-react';

interface TaxIntelligenceProps {
  taxData: Tax;
}

export function TaxIntelligence({ taxData }: TaxIntelligenceProps) {
  const taxItems = [
    { label: 'Estimated Income Tax', value: taxData.estimated_income_tax },
    { label: 'Short-Term Capital Gains', value: taxData.short_term_capital_gains },
    { label: 'Long-Term Capital Gains', value: taxData.long_term_capital_gains },
    { label: 'Deductions Identified', value: taxData.deductions_identified },
    { label: 'Estimated Quarterly Payment', value: taxData.estimated_quarterly_payment },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Tax Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          {taxItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200"
            >
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className="font-semibold text-gray-900">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Optimization Suggestions</h4>
          <div className="space-y-2">
            {taxData.optimization_suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200"
              >
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-green-900">{suggestion}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-start gap-2">
            <div className="text-yellow-600 mt-0.5">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-yellow-900 mb-1">Tax Disclaimer</h4>
              <p className="text-xs text-yellow-800">
                These are estimates based on your financial data. Always consult with a qualified tax
                professional before making tax decisions.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
