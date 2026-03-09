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
