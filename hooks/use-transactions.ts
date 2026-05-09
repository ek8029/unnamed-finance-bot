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
    const d = (days: number) => new Date(now.getTime() - 86400000 * days).toISOString().split('T')[0];
    const demoTx: Transaction[] = [
      { id: 'dt-1', amount: -87.42, date: d(1), posted_date: d(1), description: 'Whole Foods Market', merchant_name: 'Whole Foods', category_name: 'Groceries', category_raw: 'FOOD_AND_DRINK_GROCERIES', category_group: 'Food & Drink', category_color: null, account_name: 'Chase Checking', institution_name: 'Chase', is_pending: false },
      { id: 'dt-2', amount: 4250.00, date: d(2), posted_date: d(2), description: 'Direct Deposit - Payroll', merchant_name: null, category_name: 'Income', category_raw: 'INCOME_WAGES', category_group: 'Income', category_color: null, account_name: 'Chase Checking', institution_name: 'Chase', is_pending: false },
      { id: 'dt-3', amount: -15.99, date: d(3), posted_date: d(3), description: 'Netflix', merchant_name: 'Netflix', category_name: 'Subscription', category_raw: 'ENTERTAINMENT_SUBSCRIPTION', category_group: 'Entertainment', category_color: null, account_name: 'Amex Platinum', institution_name: 'American Express', is_pending: false },
      { id: 'dt-4', amount: -24.50, date: d(3), posted_date: d(3), description: 'Uber', merchant_name: 'Uber', category_name: 'Transportation', category_raw: 'TRANSPORTATION_RIDESHARE', category_group: 'Transportation', category_color: null, account_name: 'Amex Platinum', institution_name: 'American Express', is_pending: false },
      { id: 'dt-5', amount: -2500.00, date: d(5), posted_date: d(5), description: 'Vanguard - VOO Purchase', merchant_name: 'Vanguard', category_name: 'Investment', category_raw: 'TRANSFER_INVESTMENT', category_group: 'Transfer', category_color: null, account_name: 'Fidelity Brokerage', institution_name: 'Fidelity', is_pending: false },
      { id: 'dt-6', amount: -6.75, date: d(5), posted_date: d(5), description: 'Starbucks', merchant_name: 'Starbucks', category_name: 'Coffee Shops', category_raw: 'FOOD_AND_DRINK_COFFEE', category_group: 'Food & Drink', category_color: null, account_name: 'Chase Checking', institution_name: 'Chase', is_pending: false },
      { id: 'dt-7', amount: -142.30, date: d(6), posted_date: d(6), description: 'Amazon.com', merchant_name: 'Amazon', category_name: 'Shopping', category_raw: 'SHOPPING_GENERAL', category_group: 'Shopping', category_color: null, account_name: 'Amex Platinum', institution_name: 'American Express', is_pending: false },
      { id: 'dt-8', amount: -178.50, date: d(7), posted_date: d(7), description: 'Con Edison', merchant_name: 'Con Edison', category_name: 'Utilities', category_raw: 'BILLS_UTILITIES', category_group: 'Bills', category_color: null, account_name: 'Chase Checking', institution_name: 'Chase', is_pending: false },
      { id: 'dt-9', amount: 42.50, date: d(8), posted_date: d(8), description: 'Dividend - AAPL', merchant_name: null, category_name: 'Dividend', category_raw: 'INCOME_DIVIDENDS', category_group: 'Income', category_color: null, account_name: 'Fidelity Brokerage', institution_name: 'Fidelity', is_pending: false },
      { id: 'dt-10', amount: -2200.00, date: d(10), posted_date: d(10), description: 'Rent Payment', merchant_name: null, category_name: 'Rent', category_raw: 'RENT_RENT', category_group: 'Bills', category_color: null, account_name: 'Chase Checking', institution_name: 'Chase', is_pending: false },
    ];
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
