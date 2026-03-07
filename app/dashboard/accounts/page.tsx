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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-600">
            Manage your connected financial accounts and institutions
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" className="flex items-center space-x-2">
            <RefreshCcw className="w-4 h-4" />
            <span>Sync All</span>
          </Button>
          <Button className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
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
            <CardTitle className="text-3xl">
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{mockAccounts.length} accounts connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Assets</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              ${assetAccounts.reduce((sum, acc) => sum + acc.balance, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{assetAccounts.length} asset accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Liabilities</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              ${Math.abs(liabilityAccounts.reduce((sum, acc) => sum + acc.balance, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{liabilityAccounts.length} liability accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts by Institution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Connected Accounts</h2>
          {mockAccounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{account.institution}</h3>
                      <p className="text-sm text-gray-600 capitalize">
                        {account.account_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${account.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      {account.balance >= 0 ? '$' : '-$'}
                      {Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500">Last synced: 2 hours ago</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Account Aggregation Widget */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick View</h2>
          <AccountAggregation accounts={mockAccounts} />

          {/* Connection Status */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Connection Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last full sync</span>
                <span className="text-sm font-medium text-gray-900">2 hours ago</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Next scheduled sync</span>
                <span className="text-sm font-medium text-gray-900">In 4 hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Connection health</span>
                <span className="text-sm font-medium text-green-600">All systems operational</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
