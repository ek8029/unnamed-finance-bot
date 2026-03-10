'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Clock, X, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormat } from '@/hooks/use-format';
import { useTransactions } from '@/hooks/use-transactions';

interface CategoryOption {
  id: string;
  name: string;
  category_group?: string;
  count?: number;
}

interface GroupOption {
  name: string;
  count: number;
}

function CategoryDropdown({
  categoryValue,
  groupValue,
  options,
  groups,
  onCategoryChange,
  onGroupChange,
}: {
  categoryValue: string;
  groupValue: string;
  options: CategoryOption[];
  groups: GroupOption[];
  onCategoryChange: (val: string) => void;
  onGroupChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeValue = categoryValue || groupValue;

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Determine the display label
  let selectedLabel = 'All Categories';
  if (groupValue) {
    selectedLabel = groupValue;
  } else if (categoryValue) {
    const match = options.find((c) => c.id === categoryValue);
    selectedLabel = match?.name || categoryValue;
  }

  // Filter options by search query
  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.category_group && c.category_group.toLowerCase().includes(q))
    );
  }, [query, options]);

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (!query) return groups;
    const q = query.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(q));
  }, [query, groups]);

  // Group individual categories by their group
  const grouped = useMemo(() => {
    const result: Record<string, CategoryOption[]> = {};
    for (const c of filtered) {
      const group = c.category_group || 'Other';
      if (!result[group]) result[group] = [];
      result[group].push(c);
    }
    return result;
  }, [filtered]);

  const handleSelect = (type: 'category' | 'group', val: string) => {
    if (type === 'group') {
      onCategoryChange('');
      onGroupChange(val);
    } else {
      onGroupChange('');
      onCategoryChange(val);
    }
    setOpen(false);
  };

  const handleClear = () => {
    onCategoryChange('');
    onGroupChange('');
    setOpen(false);
  };

  return (
    <div className="min-w-[180px] relative" ref={ref}>
      <label className="type-label text-xs text-[var(--color-text-secondary)] mb-1.5 block">
        Category
      </label>
      <button
        type="button"
        onClick={() => { setOpen(!open); setQuery(''); }}
        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-md text-sm text-[var(--color-text-primary)] cursor-pointer hover:border-[var(--color-border-strong)] transition-colors"
      >
        <span className={`truncate ${activeValue ? '' : 'text-[var(--color-text-secondary)]'}`}>
          {selectedLabel}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 ml-2 flex-shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-[var(--color-border-subtle)]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories..."
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)]"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-72 overflow-y-auto">
            {/* "All" option */}
            <button
              type="button"
              onClick={handleClear}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-overlay)] transition-colors ${
                !activeValue ? 'text-[var(--color-gold)] font-medium' : 'text-[var(--color-text-primary)]'
              }`}
            >
              All Categories
            </button>

            {Object.keys(grouped).length === 0 && filteredGroups.length === 0 && (
              <div className="px-3 py-4 text-sm text-[var(--color-text-muted)] text-center">
                No categories match
              </div>
            )}

            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                {/* Group header - clickable to filter entire group */}
                <button
                  type="button"
                  onClick={() => handleSelect('group', group)}
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-overlay)] transition-colors ${
                    groupValue === group ? 'text-[var(--color-gold)]' : ''
                  }`}
                >
                  <span className="type-label text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                    {group}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    Select all
                  </span>
                </button>
                {/* Individual categories within the group */}
                {items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect('category', c.id)}
                    className={`w-full text-left px-3 pl-5 py-1.5 text-sm flex items-center justify-between hover:bg-[var(--color-bg-overlay)] transition-colors ${
                      categoryValue === c.id ? 'text-[var(--color-gold)] font-medium' : 'text-[var(--color-text-primary)]'
                    }`}
                  >
                    <span>{c.name}</span>
                    {c.count !== undefined && (
                      <span className="text-[10px] text-[var(--color-text-muted)] ml-2">{c.count}</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  const { formatCurrency } = useFormat();
  const {
    transactions,
    pagination,
    summary,
    accountOptions,
    categoryOptions,
    groupOptions,
    filters,
    loading,
    error,
    updateFilters,
    goToPage,
  } = useTransactions();

  const [searchInput, setSearchInput] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchInput });
  };

  const clearFilters = () => {
    setSearchInput('');
    updateFilters({
      search: '',
      account_id: '',
      category: '',
      category_group: '',
      date_from: '',
      date_to: '',
      type: '',
    });
  };

  const hasActiveFilters = filters.search || filters.account_id || filters.category || filters.category_group || filters.date_from || filters.date_to || filters.type;

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-xl">
          <h2 className="font-semibold mb-2">Error loading transactions</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="type-h1">Transactions</h1>
        <p className="type-body">
          View and search your transaction history across all accounts
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Transactions</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <CardTitle className="type-data text-2xl">
                {summary.transactionCount.toLocaleString()}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Income</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-1" />
            ) : (
              <CardTitle className="type-data text-2xl text-[var(--color-positive)]">
                {formatCurrency(summary.totalIncome)}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expenses</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-1" />
            ) : (
              <CardTitle className="type-data text-2xl text-[var(--color-negative)]">
                {formatCurrency(summary.totalExpenses)}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Flow</CardDescription>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-1" />
            ) : (
              <CardTitle className={`type-data text-2xl ${summary.netFlow >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>
                {formatCurrency(summary.netFlow)}
              </CardTitle>
            )}
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
              <label className="type-label text-xs text-[var(--color-text-secondary)] mb-1.5 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by description or merchant..."
                  className="w-full pl-9 pr-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-md text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)]"
                />
              </div>
            </form>

            {/* Account Filter */}
            <div className="min-w-[160px]">
              <label className="type-label text-xs text-[var(--color-text-secondary)] mb-1.5 block">Account</label>
              <select
                value={filters.account_id}
                onChange={(e) => updateFilters({ account_id: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-md text-sm text-[var(--color-text-primary)] cursor-pointer focus:outline-none focus:border-[var(--color-gold)]"
              >
                <option value="">All Accounts</option>
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name || a.name}</option>
                ))}
              </select>
            </div>

            {/* Category Filter (Searchable) */}
            <CategoryDropdown
              categoryValue={filters.category}
              groupValue={filters.category_group}
              options={categoryOptions}
              groups={groupOptions}
              onCategoryChange={(val) => updateFilters({ category: val, category_group: '' })}
              onGroupChange={(val) => updateFilters({ category_group: val, category: '' })}
            />

            {/* Type Filter */}
            <div className="min-w-[120px]">
              <label className="type-label text-xs text-[var(--color-text-secondary)] mb-1.5 block">Type</label>
              <select
                value={filters.type}
                onChange={(e) => updateFilters({ type: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-md text-sm text-[var(--color-text-primary)] cursor-pointer focus:outline-none focus:border-[var(--color-gold)]"
              >
                <option value="">All</option>
                <option value="income">Income</option>
                <option value="expense">Expenses</option>
              </select>
            </div>

            {/* Date From */}
            <div className="min-w-[140px]">
              <label className="type-label text-xs text-[var(--color-text-secondary)] mb-1.5 block">From</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => updateFilters({ date_from: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-md text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)]"
              />
            </div>

            {/* Date To */}
            <div className="min-w-[140px]">
              <label className="type-label text-xs text-[var(--color-text-secondary)] mb-1.5 block">To</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => updateFilters({ date_to: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-md text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-gold)]"
              />
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transaction List */}
      <Card variant="elevated">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                {loading
                  ? 'Loading...'
                  : `Showing ${transactions.length} of ${pagination.total} transactions`
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[var(--color-text-secondary)] mb-2">No transactions found</p>
              {hasActiveFilters ? (
                <button
                  onClick={clearFilters}
                  className="text-sm text-[var(--color-gold)] hover:underline"
                >
                  Clear all filters
                </button>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Link an account and sync to see transactions here.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)]">
                    <th className="text-left py-2 px-3 type-label text-xs text-[var(--color-text-muted)]">Date</th>
                    <th className="text-left py-2 px-3 type-label text-xs text-[var(--color-text-muted)]">Description</th>
                    <th className="text-left py-2 px-3 type-label text-xs text-[var(--color-text-muted)]">Category</th>
                    <th className="text-left py-2 px-3 type-label text-xs text-[var(--color-text-muted)]">Account</th>
                    <th className="text-right py-2 px-3 type-label text-xs text-[var(--color-text-muted)]">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isIncome = tx.amount > 0;
                    const displayDate = new Date(tx.date + 'T00:00:00');

                    return (
                      <tr
                        key={tx.id}
                        className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-overlay)] transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[var(--color-text-secondary)]">
                              {displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            {tx.is_pending && (
                              <span title="Pending"><Clock className="w-3 h-3 text-[var(--color-text-muted)]" /></span>
                            )}
                          </div>
                          <span className="text-xs text-[var(--color-text-muted)]">
                            {displayDate.getFullYear()}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="type-h3 text-sm">{tx.merchant_name || tx.description}</div>
                          {tx.merchant_name && tx.description !== tx.merchant_name && (
                            <div className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate max-w-[280px]">
                              {tx.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {tx.category_name ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                              {tx.category_name}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--color-text-muted)]">Uncategorized</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {tx.account_name || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className={`flex items-center justify-end gap-1 ${
                            isIncome
                              ? 'text-[var(--color-positive)]'
                              : 'text-[var(--color-text-primary)]'
                          }`}>
                            {isIncome && <ArrowUpRight className="w-3 h-3" />}
                            {!isIncome && tx.amount < 0 && <ArrowDownRight className="w-3 h-3 text-[var(--color-text-muted)]" />}
                            <span className="type-data text-sm">
                              {isIncome ? '+' : ''}{formatCurrency(Math.abs(tx.amount))}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--color-border-subtle)]">
              <p className="text-sm text-[var(--color-text-muted)]">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-2 rounded-md border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`w-8 h-8 rounded-md text-sm transition-colors ${
                        pageNum === pagination.page
                          ? 'bg-[var(--color-gold)] text-[var(--color-text-inverse)] font-medium'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-2 rounded-md border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
