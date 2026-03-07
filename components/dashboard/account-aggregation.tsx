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
        <div className="space-y-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-gray-100 p-2">
                  <Building2 className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <div className="font-medium">{account.institution}</div>
                  <Badge variant={accountTypeColors[account.account_type]} className="mt-1">
                    {accountTypeLabels[account.account_type]}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${account.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatCurrency(Math.abs(account.balance))}
                </div>
                {account.balance < 0 && (
                  <div className="text-xs text-gray-500 mt-1">Balance Due</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
