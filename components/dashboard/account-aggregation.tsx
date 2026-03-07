'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Account } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AccountAggregationProps {
  accounts: Account[];
}

const accountTypeLabels: Record<Account['account_type'], string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Card',
  brokerage: 'Brokerage',
  crypto: 'Crypto',
};

const accountTypeColors: Record<Account['account_type'], 'default' | 'secondary' | 'success' | 'warning'> = {
  checking: 'default',
  savings: 'success',
  credit_card: 'warning',
  brokerage: 'secondary',
  crypto: 'default',
};

export function AccountAggregation({ accounts }: AccountAggregationProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Connected Accounts</CardTitle>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between p-3 rounded-md border border-helm-border-base bg-helm-elevated hover:border-helm-border-strong transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-helm-overlay p-2 border border-helm-border-subtle">
                  <Building2 className="h-4 w-4 text-helm-secondary" />
                </div>
                <div>
                  <div className="type-h3">{account.institution}</div>
                  <Badge variant={accountTypeColors[account.account_type]} className="mt-1">
                    {accountTypeLabels[account.account_type]}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className={`type-data text-sm ${account.balance < 0 ? 'text-helm-negative' : 'text-helm-platinum'}`}>
                  {formatCurrency(Math.abs(account.balance))}
                </div>
                {account.balance < 0 && (
                  <div className="text-xs text-helm-muted mt-1">Balance Due</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
