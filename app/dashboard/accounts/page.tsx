import { AccountAggregation } from '@/components/dashboard/account-aggregation';
import { mockAccounts } from '@/lib/mock-data';
import { Plus, RefreshCcw, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AccountsPage() {
  const totalBalance = mockAccounts.reduce((sum, account) => sum + account.balance, 0);
  const assetAccounts = mockAccounts.filter((account) => account.balance > 0);
  const liabilityAccounts = mockAccounts.filter((account) => account.balance < 0);

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="type-h1">Accounts</h1>
          <p className="type-body">
            Manage your connected financial accounts and institutions
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" className="flex items-center space-x-2">
            <RefreshCcw className="w-4 h-4" />
            <span>Sync All</span>
          </Button>
          <Button className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add Account</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Balance</CardDescription>
            <CardTitle className="type-data text-3xl">
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-helm-secondary">{mockAccounts.length} accounts connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Assets</CardDescription>
            <CardTitle className="type-data text-3xl text-helm-positive">
              ${assetAccounts.reduce((sum, acc) => sum + acc.balance, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-helm-secondary">{assetAccounts.length} asset accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Liabilities</CardDescription>
            <CardTitle className="type-data text-3xl text-helm-negative">
              ${Math.abs(liabilityAccounts.reduce((sum, acc) => sum + acc.balance, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-helm-secondary">{liabilityAccounts.length} liability accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts by Institution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account List */}
        <div className="space-y-4">
          <h2 className="type-h2">Connected Accounts</h2>
          {mockAccounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-helm-gold-surface border border-helm-gold-border rounded-md flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-helm-gold" />
                    </div>
                    <div>
                      <h3 className="type-h3">{account.institution}</h3>
                      <p className="text-sm text-helm-secondary capitalize">
                        {account.account_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`type-data text-xl ${account.balance >= 0 ? 'text-helm-platinum' : 'text-helm-negative'}`}>
                      {account.balance >= 0 ? '$' : '-$'}
                      {Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-helm-muted">Last synced: 2 hours ago</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Account Aggregation Widget */}
        <div>
          <h2 className="type-h2 mb-4">Quick View</h2>
          <AccountAggregation accounts={mockAccounts} />

          {/* Connection Status */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Connection Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-helm-secondary">Last full sync</span>
                <span className="type-label text-helm-platinum">2 hours ago</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-helm-secondary">Next scheduled sync</span>
                <span className="type-label text-helm-platinum">In 4 hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-helm-secondary">Connection health</span>
                <span className="type-label text-helm-positive">All systems operational</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
