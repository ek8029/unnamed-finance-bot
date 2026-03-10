'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, Building2, X, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/contexts/toast-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormat } from '@/hooks/use-format';
import { useAccounts } from '@/hooks/use-financial-data';
import { AccountsOverview } from '@/components/accounts/accounts-overview';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';

interface Account {
  id: string;
  institution: string;
  account_type: string;
  balance: number;
  account_name: string;
  sync_status: string;
  last_synced_at?: string;
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function AccountsPage() {
  const { formatCurrency } = useFormat();
  const { accounts, balanceHistory, loading: apiLoading, error, refetch } = useAccounts();
  const { success, error: showError } = useToast();

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const assetAccounts = accounts.filter((account) => account.balance > 0);
  const liabilityAccounts = accounts.filter((account) => account.balance < 0);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'assets' | 'liabilities'>('all');
  const [sortBy, setSortBy] = useState<'balance-high' | 'balance-low' | 'name'>('balance-high');
  const [syncing, setSyncing] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<{
    lastSync: string | null;
    itemCount: number;
    errorCount: number;
    items: { institution_name: string; status: string; last_balances_sync: string | null; last_transactions_sync: string | null }[];
  }>({ lastSync: null, itemCount: 0, errorCount: 0, items: [] });

  // Fetch connection health from plaid_items
  useEffect(() => {
    async function fetchConnectionHealth() {
      try {
        const res = await fetch('/api/plaid/health');
        if (res.ok) {
          const data = await res.json();
          setConnectionHealth(data);
        }
      } catch {
        // Non-critical - fail silently
      }
    }
    fetchConnectionHealth();
  }, [syncing]); // Refetch after sync

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST' });
      if (res.ok) {
        success('Sync complete', 'All accounts have been synchronized');
        refetch?.();
      } else {
        // Fallback to legacy sync if no Plaid items exist
        const fallback = await fetch('/api/accounts/sync', { method: 'POST' });
        if (fallback.ok) {
          success('Sync complete', 'All accounts have been synchronized');
          refetch?.();
        } else {
          showError('Sync failed', 'Could not sync accounts. Please try again.');
        }
      }
    } catch (err) {
      showError('Sync failed', 'An error occurred while syncing accounts.');
    } finally {
      setSyncing(false);
    }
  };

  const handlePlaidSuccess = () => {
    success('Account linked', 'Your financial account has been connected successfully');
    setShowAddAccount(false);
    refetch?.();
  };

  const handlePlaidError = (error: string) => {
    showError('Connection failed', error);
  };

  const primaryAccountId = useMemo(() => {
    const positive = assetAccounts.sort((a, b) => b.balance - a.balance)[0];
    return positive?.id ?? null;
  }, [assetAccounts]);

  const selectedAccount = selectedAccountId
    ? accounts.find((a) => a.id === selectedAccountId) || null
    : null;

  // Filter and sort accounts
  const filteredAndSortedAccounts = useMemo(() => {
    let filtered: Account[] = accounts;

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
  }, [filterType, sortBy, accounts, assetAccounts, liabilityAccounts]);

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl">
          <h2 className="font-semibold mb-2">Error loading accounts</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

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
          <Button
            variant="outline"
            className="flex items-center space-x-2"
            onClick={handleSyncAll}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCcw className="w-4 h-4" />
            )}
            <span>{syncing ? 'Syncing...' : 'Sync All'}</span>
          </Button>
          <Button className="flex items-center space-x-2" onClick={() => setShowAddAccount(true)}>
            <Plus className="w-4 h-4" />
            <span>Add Account</span>
          </Button>
        </div>
      </div>

      {/* Accounts Overview */}
      {balanceHistory.length > 0 && (
        <AccountsOverview balanceHistory={balanceHistory} />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Balance</CardDescription>
            {apiLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <CardTitle className="type-data text-3xl">
                {formatCurrency(totalBalance)}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text-secondary)]">{accounts.length} accounts connected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Assets</CardDescription>
            {apiLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <CardTitle className="type-data text-3xl text-[var(--color-positive)]">
                {formatCurrency(assetAccounts.reduce((sum, acc) => sum + acc.balance, 0))}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text-secondary)]">{assetAccounts.length} asset accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Liabilities</CardDescription>
            {apiLoading ? (
              <Skeleton className="h-8 w-32 mt-2" />
            ) : (
              <CardTitle className="type-data text-3xl text-[var(--color-negative)]">
                {formatCurrency(Math.abs(liabilityAccounts.reduce((sum, acc) => sum + acc.balance, 0)))}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--color-text-secondary)]">{liabilityAccounts.length} liability accounts</p>
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
              <div className="flex gap-1 p-1 bg-[var(--color-bg-elevated)] rounded border border-[var(--color-border-subtle)]">
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 rounded type-label text-xs transition-colors ${
                    filterType === 'all'
                      ? 'bg-[var(--color-gold)] text-[var(--color-text-inverse)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('assets')}
                  className={`px-3 py-1.5 rounded type-label text-xs transition-colors ${
                    filterType === 'assets'
                      ? 'bg-[var(--color-positive)] text-[var(--color-text-inverse)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Assets
                </button>
                <button
                  onClick={() => setFilterType('liabilities')}
                  className={`px-3 py-1.5 rounded type-label text-xs transition-colors ${
                    filterType === 'liabilities'
                      ? 'bg-[var(--color-negative)] text-[var(--color-text-inverse)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Liabilities
                </button>
              </div>

              {/* Sort Controls */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'balance-high' | 'balance-low' | 'name')}
                className="px-3 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded type-label text-xs text-[var(--color-text-primary)] cursor-pointer hover:border-[var(--color-border-strong)] transition-colors"
              >
                <option value="balance-high">Balance: High to Low</option>
                <option value="balance-low">Balance: Low to High</option>
                <option value="name">Name: A to Z</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {apiLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredAndSortedAccounts.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">
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
                      ? 'border-[var(--color-gold-border)] bg-[var(--color-gold-surface)]'
                      : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]'
                  } ${isSelected ? 'ring-1 ring-[var(--color-gold)]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[var(--color-bg-overlay)] border border-[var(--color-border-subtle)] rounded-md flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-[var(--color-text-secondary)]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="type-h3">{account.institution}</h3>
                        {isPrimary && (
                          <span className="type-caption text-[var(--color-gold)]">Primary</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] capitalize">
                        {account.account_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`type-data text-xl ${
                        account.balance >= 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-negative)]'
                      }`}
                    >
                      {formatCurrency(Math.abs(account.balance))}{' '}
                      {account.balance < 0 && <span className="type-caption">due</span>}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {account.last_synced_at
                        ? formatTimeAgo(account.last_synced_at)
                        : account.sync_status === 'healthy' ? 'Synced' : account.sync_status}
                    </p>
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
          <CardDescription>Health across all linked institutions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">Last full sync</span>
            <span className="type-label text-[var(--color-text-primary)]">
              {connectionHealth.lastSync ? formatTimeAgo(connectionHealth.lastSync) : 'Never'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">Connected institutions</span>
            <span className="type-label text-[var(--color-text-primary)]">{connectionHealth.itemCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">Connection health</span>
            {connectionHealth.errorCount > 0 ? (
              <span className="type-label text-[var(--color-negative)] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {connectionHealth.errorCount} issue{connectionHealth.errorCount > 1 ? 's' : ''}
              </span>
            ) : connectionHealth.itemCount > 0 ? (
              <span className="type-label text-[var(--color-positive)] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                All systems operational
              </span>
            ) : (
              <span className="type-label text-[var(--color-text-muted)] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                No connections
              </span>
            )}
          </div>
          {/* Per-institution status */}
          {connectionHealth.items.length > 0 && (
            <div className="pt-2 border-t border-[var(--color-border-subtle)] space-y-2">
              {connectionHealth.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">{item.institution_name || 'Unknown'}</span>
                  <div className="flex items-center gap-2">
                    {item.last_balances_sync && (
                      <span className="text-[var(--color-text-muted)]">
                        {formatTimeAgo(item.last_balances_sync)}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      item.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : item.status === 'error'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {item.status === 'active' ? 'Healthy' : item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account detail drawer */}
      {selectedAccount && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setSelectedAccountId(null)}
          />
          <div className="w-full max-w-md bg-[var(--color-bg-surface)] border-l border-[var(--color-border-base)] shadow-2xl animate-slide-in-bottom">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-base)]">
              <div>
                <p className="type-caption text-[var(--color-text-secondary)] mb-1">Account details</p>
                <h2 className="type-h2">{selectedAccount.institution}</h2>
                <p className="text-xs text-[var(--color-text-secondary)] capitalize">
                  {selectedAccount.account_type.replace('_', ' ')}
                </p>
              </div>
              <button
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                onClick={() => setSelectedAccountId(null)}
                aria-label="Close account details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="type-label text-[var(--color-text-secondary)]">Current balance</span>
                <span
                  className={`type-data text-xl ${
                    selectedAccount.balance >= 0 ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-negative)]'
                  }`}
                >
                  {formatCurrency(Math.abs(selectedAccount.balance))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-label text-[var(--color-text-secondary)]">Institution</span>
                <span className="type-label text-[var(--color-text-primary)]">{selectedAccount.institution}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="type-label text-[var(--color-text-secondary)]">Account Name</span>
                <span className="type-label text-[var(--color-text-primary)]">{selectedAccount.account_name}</span>
              </div>
              <div className="pt-2 border-t border-[var(--color-border-subtle)]">
                <p className="type-label text-[var(--color-text-secondary)] mb-2">Recent transactions</p>
                <p className="text-xs text-[var(--color-text-muted)]">Transaction history will be available when Plaid integration is enabled.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowAddAccount(false)}
          />
          <div className="relative w-full max-w-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-base)]">
              <div>
                <h2 className="type-h2">Connect Account</h2>
                <p className="text-sm text-[var(--color-text-secondary)]">Link a new financial account</p>
              </div>
              <button
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-md hover:bg-[var(--color-bg-overlay)] transition-colors"
                onClick={() => setShowAddAccount(false)}
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-6 space-y-6">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Connect your bank accounts, credit cards, and investment accounts securely using Plaid.
              </p>

              <div className="space-y-3">
                <h3 className="type-h3">Supported Account Types</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    'Checking & Savings',
                    'Credit Cards',
                    'Investment Accounts',
                    'Mortgages & Loans',
                  ].map((label) => (
                    <div
                      key={label}
                      className="flex items-center p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg"
                    >
                      <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Your credentials are encrypted end-to-end by Plaid and never touch our servers.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAddAccount(false)}
                >
                  Cancel
                </Button>
                <PlaidLinkButton
                  className="flex-1"
                  onSuccess={handlePlaidSuccess}
                  onError={handlePlaidError}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
