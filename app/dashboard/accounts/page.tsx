'use client';

import { useEffect, useMemo, useState } from 'react';
import { mockAccounts, mockTransactions, mockAccountBalanceHistory } from '@/lib/mock-data';
import { Plus, RefreshCcw, Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { Transaction } from '@/types';
import { AccountsOverview } from '@/components/accounts/accounts-overview';

export default function AccountsPage() {
  const totalBalance = mockAccounts.reduce((sum, account) => sum + account.balance, 0);
  const assetAccounts = mockAccounts.filter((account) => account.balance > 0);
  const liabilityAccounts = mockAccounts.filter((account) => account.balance < 0);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'assets' | 'liabilities'>('all');
  const [sortBy, setSortBy] = useState<'balance-high' | 'balance-low' | 'name'>('balance-high');

  const primaryAccountId = useMemo(() => {
    const positive = assetAccounts.sort((a, b) => b.balance - a.balance)[0];
    return positive?.id ?? null;
  }, [assetAccounts]);

  const selectedAccount = selectedAccountId
    ? mockAccounts.find((a) => a.id === selectedAccountId) || null
    : null;

  const recentTransactions: Transaction[] = useMemo(
    () =>
      selectedAccountId
        ? mockTransactions
            .filter((t) => t.account_id === selectedAccountId)
            .sort((a, b) => b.date.getTime() - a.date.getTime())
        : [],
    [selectedAccountId]
  );

  // Filter and sort accounts
  const filteredAndSortedAccounts = useMemo(() => {
    let filtered = mockAccounts;

    // Apply filter
    if (filterType === 'assets') {
      filtered = assetAccounts;
    } else if (filterType === 'liabilities') {
      filtered = liabilityAccounts;
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'balance-high') {
        return Math.abs(b.balance) - Math.abs(a.balance);
      } else if (sortBy === 'balance-low') {
        return Math.abs(a.balance) - Math.abs(b.balance);
      } else {
        return a.institution.localeCompare(b.institution);
      }
    });

    return sorted;
  }, [filterType, sortBy, assetAccounts, liabilityAccounts]);

  // Simulate initial loading for skeletons
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timeout);
  }, []);

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

      {/* Accounts Overview */}
      <AccountsOverview balanceHistory={mockAccountBalanceHistory} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Balance</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <CardTitle className="type-data text-3xl">
                {formatCurrency(totalBalance)}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-helm-secondary">{mockAccounts.length} accounts connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Assets</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <CardTitle className="type-data text-3xl text-helm-positive">
                {formatCurrency(assetAccounts.reduce((sum, acc) => sum + acc.balance, 0))}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-helm-secondary">{assetAccounts.length} asset accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Liabilities</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <CardTitle className="type-data text-3xl text-helm-negative">
                {formatCurrency(Math.abs(liabilityAccounts.reduce((sum, acc) => sum + acc.balance, 0)))}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-helm-secondary">{liabilityAccounts.length} liability accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Consolidated account list with drill-down */}
      <Card variant="elevated">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Tap any account to see recent activity and details.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter Controls */}
              <div className="flex gap-1 p-1 bg-helm-elevated rounded border border-helm-border-subtle">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded type-label text-xs transition-colors ${
                    filterType === 'all'
                      ? 'bg-helm-gold text-helm-base'
                      : 'text-helm-secondary hover:text-helm-platinum'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('assets')}
                  className={`px-3 py-1.5 rounded type-label text-xs transition-colors ${
                    filterType === 'assets'
                      ? 'bg-helm-positive text-helm-base'
                      : 'text-helm-secondary hover:text-helm-platinum'
                  }`}
                >
                  Assets
                </button>
                <button
                  onClick={() => setFilterType('liabilities')}
                  className={`px-3 py-1.5 rounded type-label text-xs transition-colors ${
                    filterType === 'liabilities'
                      ? 'bg-helm-negative text-helm-base'
                      : 'text-helm-secondary hover:text-helm-platinum'
                  }`}
                >
                  Liabilities
                </button>
              </div>

              {/* Sort Controls */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'balance-high' | 'balance-low' | 'name')}
                className="px-3 py-1.5 bg-helm-elevated border border-helm-border-subtle rounded type-label text-xs text-helm-platinum cursor-pointer hover:border-helm-border-strong transition-colors"
              >
                <option value="balance-high">Balance: High to Low</option>
                <option value="balance-low">Balance: Low to High</option>
                <option value="name">Name: A to Z</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredAndSortedAccounts.length === 0 ? (
            <div className="text-center py-8 text-helm-secondary">
              <p className="text-sm">No accounts match the current filter.</p>
            </div>
          ) : (
            filteredAndSortedAccounts.map((account) => {
              const isPrimary = account.id === primaryAccountId;
              const isSelected = account.id === selectedAccountId;

              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`w-full text-left rounded-md border px-4 py-3 flex items-center justify-between gap-4 transition-all ${
                    isPrimary
                      ? 'border-helm-gold-border bg-helm-gold-surface/20'
                      : 'border-helm-border-base bg-helm-elevated hover:border-helm-border-strong'
                  } ${isSelected ? 'ring-1 ring-helm-gold' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-helm-overlay border border-helm-border-subtle rounded-md flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-helm-secondary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="type-h3">{account.institution}</h3>
                        {isPrimary && (
                          <span className="type-caption text-helm-gold">Primary</span>
                        )}
                      </div>
                      <p className="text-xs text-helm-secondary capitalize">
                        {account.account_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`type-data text-xl ${
                        account.balance >= 0 ? 'text-helm-platinum' : 'text-helm-negative'
                      }`}
                    >
                      {formatCurrency(Math.abs(account.balance))}{' '}
                      {account.balance < 0 && <span className="type-caption">due</span>}
                    </p>
                    <p className="text-xs text-helm-muted">Last synced: 2 hours ago</p>
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Connection Status */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
          <CardDescription>High-level health across all linked institutions.</CardDescription>
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

      {/* Account detail drawer */}
      {selectedAccount && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setSelectedAccountId(null)}
          />
          <div className="w-full max-w-md bg-helm-surface border-l border-helm-border-base shadow-2xl animate-slide-in-bottom">
            <div className="flex items-center justify-between px-6 py-4 border-b border-helm-border-base">
              <div>
                <p className="type-caption text-helm-secondary mb-1">Account details</p>
                <h2 className="type-h2">{selectedAccount.institution}</h2>
                <p className="text-xs text-helm-secondary capitalize">
                  {selectedAccount.account_type.replace('_', ' ')}
                </p>
              </div>
              <button
                className="p-2 text-helm-secondary hover:text-helm-platinum"
                onClick={() => setSelectedAccountId(null)}
                aria-label="Close account details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="type-label text-helm-secondary">Current balance</span>
                <span
                  className={`type-data text-xl ${
                    selectedAccount.balance >= 0 ? 'text-helm-platinum' : 'text-helm-negative'
                  }`}
                >
                  {formatCurrency(Math.abs(selectedAccount.balance))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-label text-helm-secondary">Institution</span>
                <span className="type-label text-helm-platinum">{selectedAccount.institution}</span>
              </div>
              <div className="pt-2 border-t border-helm-border-subtle">
                <p className="type-label text-helm-secondary mb-2">Recent transactions</p>
                {recentTransactions.length === 0 ? (
                  <p className="text-xs text-helm-muted">No recent activity for this account.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {recentTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-md border border-helm-border-subtle bg-helm-elevated px-3 py-2"
                      >
                        <div>
                          <p className="text-xs text-helm-platinum">{tx.description}</p>
                          <p className="text-[10px] text-helm-muted">
                            {tx.category} · {tx.date.toLocaleDateString()}
                          </p>
                        </div>
                        <div
                          className={`type-data text-sm ${
                            tx.amount >= 0 ? 'text-helm-positive' : 'text-helm-negative'
                          }`}
                        >
                          {tx.amount >= 0 ? '+' : '-'}
                          {formatCurrency(Math.abs(tx.amount))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
