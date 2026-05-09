'use client';

import { useState, useEffect, useCallback } from 'react';

interface Transaction {
  id: string;
  amount: number;
  date: string;
  posted_date: string | null;
  description: string;
  merchant_name: string | null;
  category_name: string | null;
  category_raw: string | null;
  category_group: string | null;
  category_color: string | null;
  account_name: string | null;
  institution_name: string | null;
  is_pending: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Summary {
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  transactionCount: number;
}

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

interface FilterOption {
  id: string;
  name: string;
  account_name?: string;
}

interface Filters {
  search: string;
  account_id: string;
  category: string;
  category_group: string;
  date_from: string;
  date_to: string;
  type: string;
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [summary, setSummary] = useState<Summary>({ totalIncome: 0, totalExpenses: 0, netFlow: 0, transactionCount: 0 });
  const [accountOptions, setAccountOptions] = useState<FilterOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    search: '',
    account_id: '',
    category: '',
    category_group: '',
    date_from: '',
    date_to: '',
    type: '',
  });

  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));

      if (filters.search) params.set('search', filters.search);
      if (filters.account_id) params.set('account_id', filters.account_id);
      if (filters.category) params.set('category', filters.category);
      if (filters.category_group) params.set('category_group', filters.category_group);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      if (filters.type) params.set('type', filters.type);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();

      setTransactions(data.transactions || []);
      setPagination(data.pagination);
      setSummary(data.summary);
      setAccountOptions(data.filters?.accounts || []);
      setCategoryOptions(data.filters?.categories || []);
      setGroupOptions(data.filters?.groups || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateFilters = (newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1);
  };

  const goToPage = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, pagination.totalPages)));
  };

  const isDemoTx = typeof window !== 'undefined' && sessionStorage.getItem('helm_demo_mode') === '1';
  if (isDemoTx) {
    const now = new Date();
    const demoTx: Transaction[] = [
      { id: 'dt-1', name: 'Whole Foods Market', amount: -87.42, date: new Date(now.getTime() - 86400000).toISOString().split('T')[0], category: 'Groceries', category_group: 'Food & Drink', account_name: 'Chase Checking', merchant_name: 'Whole Foods', pending: false },
      { id: 'dt-2', name: 'Direct Deposit - Payroll', amount: 4250.00, date: new Date(now.getTime() - 86400000 * 2).toISOString().split('T')[0], category: 'Income', category_group: 'Income', account_name: 'Chase Checking', merchant_name: null, pending: false },
      { id: 'dt-3', name: 'Netflix', amount: -15.99, date: new Date(now.getTime() - 86400000 * 3).toISOString().split('T')[0], category: 'Subscription', category_group: 'Entertainment', account_name: 'Amex Platinum', merchant_name: 'Netflix', pending: false },
      { id: 'dt-4', name: 'Uber', amount: -24.50, date: new Date(now.getTime() - 86400000 * 3).toISOString().split('T')[0], category: 'Transportation', category_group: 'Transportation', account_name: 'Amex Platinum', merchant_name: 'Uber', pending: false },
      { id: 'dt-5', name: 'Vanguard - VOO Purchase', amount: -2500.00, date: new Date(now.getTime() - 86400000 * 5).toISOString().split('T')[0], category: 'Investment', category_group: 'Transfer', account_name: 'Fidelity Brokerage', merchant_name: 'Vanguard', pending: false },
      { id: 'dt-6', name: 'Starbucks', amount: -6.75, date: new Date(now.getTime() - 86400000 * 5).toISOString().split('T')[0], category: 'Coffee Shops', category_group: 'Food & Drink', account_name: 'Chase Checking', merchant_name: 'Starbucks', pending: false },
      { id: 'dt-7', name: 'Amazon.com', amount: -142.30, date: new Date(now.getTime() - 86400000 * 6).toISOString().split('T')[0], category: 'Shopping', category_group: 'Shopping', account_name: 'Amex Platinum', merchant_name: 'Amazon', pending: false },
      { id: 'dt-8', name: 'Con Edison', amount: -178.50, date: new Date(now.getTime() - 86400000 * 7).toISOString().split('T')[0], category: 'Utilities', category_group: 'Bills', account_name: 'Chase Checking', merchant_name: 'Con Edison', pending: false },
      { id: 'dt-9', name: 'Dividend - AAPL', amount: 42.50, date: new Date(now.getTime() - 86400000 * 8).toISOString().split('T')[0], category: 'Dividend', category_group: 'Income', account_name: 'Fidelity Brokerage', merchant_name: null, pending: false },
      { id: 'dt-10', name: 'Rent Payment', amount: -2200.00, date: new Date(now.getTime() - 86400000 * 10).toISOString().split('T')[0], category: 'Rent', category_group: 'Bills', account_name: 'Chase Checking', merchant_name: null, pending: false },
    ] as unknown as Transaction[];
    return {
      transactions: demoTx,
      pagination: { page: 1, limit: 50, total: 10, totalPages: 1 },
      summary: { totalIncome: 4292.50, totalExpenses: 5155.46, netFlow: -862.96, transactionCount: 10 },
      accountOptions: [{ value: 'chase', label: 'Chase Checking' }, { value: 'amex', label: 'Amex Platinum' }, { value: 'fidelity', label: 'Fidelity Brokerage' }],
      categoryOptions: [] as CategoryOption[],
      groupOptions: [] as GroupOption[],
      filters,
      loading: false,
      error: null,
      updateFilters,
      goToPage,
      refetch: fetchData,
    };
  }

  return {
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
    refetch: fetchData,
  };
}
