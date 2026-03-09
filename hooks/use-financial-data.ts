'use client';

import { useState, useEffect } from 'react';

// Types for API responses
interface FinancialSummary {
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
  monthly_cash_flow: number;
  portfolio_value: number;
  changes?: {
    assets: number | null;
    liabilities: number | null;
    cash_flow: number | null;
    portfolio: number | null;
  };
}

interface HealthScore {
  score: number;
  debt_to_asset_ratio: number;
  savings_rate: number;
  emergency_fund_months: number;
  portfolio_diversification: number;
}

interface Insight {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  recommended_action?: string;
  estimated_impact?: number;
  source: string;
  created_at: string;
}

interface Account {
  id: string;
  institution: string;
  institution_logo?: string;
  account_type: string;
  balance: number;
  account_name: string;
  sync_status: string;
  last_synced_at?: string;
}

interface Holding {
  id: string;
  ticker: string;
  asset_name: string;
  shares: number;
  current_price: number;
  total_value: number;
  day_change_percentage: number;
  portfolio_allocation: number;
  sector?: string;
  asset_class?: string;
  cost_basis?: number;
  unrealised_gain?: number;
}

interface NetWorthDataPoint {
  month: string;
  value: number;
  assets: number;
  liabilities: number;
}

interface CashFlowDataPoint {
  month: string;
  income: number;
  expenses: number;
  netFlow: number;
}

interface CompositionItem {
  name: string;
  value: number;
  percentage: number;
  items?: string[];
}

interface SavingsRatePoint {
  month: string;
  rate: number;
  saved: number;
}

interface FinancialDataState {
  financialSummary: FinancialSummary | null;
  healthScore: HealthScore | null;
  insights: Insight[];
  accounts: Account[];
  holdings: Holding[];
  netWorthHistory: NetWorthDataPoint[];
  cashFlowHistory: CashFlowDataPoint[];
  assetsComposition: CompositionItem[];
  liabilitiesComposition: CompositionItem[];
  savingsRateTimeline: SavingsRatePoint[];
  loading: boolean;
  error: string | null;
}

export function useFinancialSummary() {
  const [state, setState] = useState<FinancialDataState>({
    financialSummary: null,
    healthScore: null,
    insights: [],
    accounts: [],
    holdings: [],
    netWorthHistory: [],
    cashFlowHistory: [],
    assetsComposition: [],
    liabilitiesComposition: [],
    savingsRateTimeline: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/financial-summary');
        if (!res.ok) throw new Error('Failed to fetch financial summary');
        const data = await res.json();

        setState({
          financialSummary: data.financialSummary,
          healthScore: data.healthScore,
          insights: data.insights || [],
          accounts: data.accounts || [],
          holdings: data.holdings || [],
          netWorthHistory: data.netWorthHistory || [],
          cashFlowHistory: data.cashFlowHistory || [],
          assetsComposition: data.assetsComposition || [],
          liabilitiesComposition: data.liabilitiesComposition || [],
          savingsRateTimeline: data.savingsRateTimeline || [],
          loading: false,
          error: null,
        });
      } catch (err) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    }

    // Auto-sync: trigger a background Plaid sync on dashboard load
    // Only syncs if last sync was more than 1 hour ago
    async function autoSync() {
      try {
        const lastSync = sessionStorage.getItem('helm_last_auto_sync');
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        if (lastSync && Number(lastSync) > oneHourAgo) {
          return; // Already synced recently this session
        }

        sessionStorage.setItem('helm_last_auto_sync', String(Date.now()));

        // Fire-and-forget background sync
        const res = await fetch('/api/plaid/sync', { method: 'POST' });
        if (res.ok) {
          // Re-fetch dashboard data after sync completes
          const summaryRes = await fetch('/api/financial-summary');
          if (summaryRes.ok) {
            const data = await summaryRes.json();
            setState(prev => ({
              ...prev,
              financialSummary: data.financialSummary,
              healthScore: data.healthScore,
              insights: data.insights || prev.insights,
              accounts: data.accounts || prev.accounts,
              holdings: data.holdings || prev.holdings,
              netWorthHistory: data.netWorthHistory || prev.netWorthHistory,
              cashFlowHistory: data.cashFlowHistory || prev.cashFlowHistory,
              assetsComposition: data.assetsComposition || prev.assetsComposition,
              liabilitiesComposition: data.liabilitiesComposition || prev.liabilitiesComposition,
              savingsRateTimeline: data.savingsRateTimeline || prev.savingsRateTimeline,
            }));
          }
        }
      } catch {
        // Auto-sync failure is non-fatal — don't show errors
      }
    }

    fetchData();
    autoSync();
  }, []);

  return state;
}

interface BalanceHistoryPoint {
  month: string;
  balance: number;
  inflows: number;
  outflows: number;
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/accounts');
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
      setBalanceHistory(data.balanceHistory || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refetch = () => {
    fetchData();
  };

  return { accounts, balanceHistory, loading, error, refetch };
}

interface PerformanceMetrics {
  return_1d: number | null;
  return_1w: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_6m: number | null;
  return_ytd: number | null;
  return_1y: number | null;
  sharpe_ratio: number | null;
  beta: number | null;
  volatility: number | null;
}

interface PortfolioHistoryPoint {
  label: string;
  value: number;
  gain_loss: number;
}

export function useHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [allocation, setAllocation] = useState<{ name: string; value: number; percentage: number }[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/holdings');
        if (!res.ok) throw new Error('Failed to fetch holdings');
        const data = await res.json();
        setHoldings(data.holdings || []);
        setAllocation(data.allocation || []);
        setTotalValue(data.totalValue || 0);
        setPerformanceMetrics(data.performanceMetrics || null);
        setPortfolioHistory(data.portfolioHistory || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { holdings, allocation, totalValue, performanceMetrics, portfolioHistory, loading, error };
}

export function useInsights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/insights');
        if (!res.ok) throw new Error('Failed to fetch insights');
        const data = await res.json();
        setInsights(data.insights || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const dismissInsight = async (id: string) => {
    try {
      await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'dismiss' }),
      });
      setInsights(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      console.error('Failed to dismiss insight:', err);
    }
  };

  return { insights, loading, error, dismissInsight };
}

export function useTaxData() {
  const [taxData, setTaxData] = useState<{
    taxEstimate: {
      year: number;
      estimatedIncomeTax: number;
      shortTermCapitalGains: number;
      longTermCapitalGains: number;
      deductionsIdentified: number;
      totalEstimatedTax: number;
      estimatedQuarterlyPayment: number;
    } | null;
    capitalGainsSummary: {
      totalRealizedGains: number;
      shortTermGains: number;
      longTermGains: number;
      transactions: number;
    } | null;
    optimizationTasks: {
      id: string;
      title: string;
      description?: string;
      potentialSavings?: number;
      type: string;
      priority: string;
      deadline?: string;
    }[];
  }>({
    taxEstimate: null,
    capitalGainsSummary: null,
    optimizationTasks: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/tax');
        if (!res.ok) throw new Error('Failed to fetch tax data');
        const data = await res.json();
        setTaxData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { ...taxData, loading, error };
}
