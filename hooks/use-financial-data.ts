'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { isUsMarketOpen, type LiveQuote } from '@/hooks/use-live-prices';

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
    net_worth: number | null;
    net_worth_dollar?: number | null;
    net_worth_baseline_date?: string | null;
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
  day_change_percentage: number | null;
  portfolio_allocation: number;
  sector?: string;
  asset_class?: string;
  cost_basis?: number;
  unrealised_gain?: number;
  /** At least one lot in this position has no cost basis from the broker, so
   *  P/L is unknowable. Render a dash, never a zero — a zero reads as flat. */
  basis_incomplete?: boolean;
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
  netWorthDaily: { date: string; value: number }[];
  cashFlowHistory: CashFlowDataPoint[];
  assetsComposition: CompositionItem[];
  liabilitiesComposition: CompositionItem[];
  savingsRateTimeline: SavingsRatePoint[];
  hasPlaidConnection: boolean;
  loading: boolean;
  error: string | null;
}

export function useFinancialSummary() {
  // Demo mode check
  const isDemo = typeof window !== 'undefined' && sessionStorage.getItem('helm_demo_mode') === '1';

  const [state, setState] = useState<FinancialDataState>({
    financialSummary: null,
    healthScore: null,
    insights: [],
    accounts: [],
    holdings: [],
    netWorthHistory: [],
    netWorthDaily: [],
    cashFlowHistory: [],
    assetsComposition: [],
    liabilitiesComposition: [],
    savingsRateTimeline: [],
    hasPlaidConnection: false,
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
          netWorthDaily: data.netWorthDaily || [],
          cashFlowHistory: data.cashFlowHistory || [],
          assetsComposition: data.assetsComposition || [],
          liabilitiesComposition: data.liabilitiesComposition || [],
          savingsRateTimeline: data.savingsRateTimeline || [],
          hasPlaidConnection: data.hasPlaidConnection ?? false,
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

        // Fire-and-forget background sync, then generate insights
        const res = await fetch('/api/plaid/sync', { method: 'POST' });
        if (res.ok) {
          // Throttle only on success — stamping before the fetch pinned an
          // empty portfolio for an hour when the first sync failed.
          sessionStorage.setItem('helm_last_auto_sync', String(Date.now()));
          // Generate fresh insights from updated data
          await Promise.all([
            fetch('/api/insights/generate', { method: 'POST' }).catch(() => {}),
            fetch('/api/market/prices/refresh', { method: 'POST' }).catch(() => {}),
          ]);
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
              netWorthDaily: data.netWorthDaily || prev.netWorthDaily,
              cashFlowHistory: data.cashFlowHistory || prev.cashFlowHistory,
              assetsComposition: data.assetsComposition || prev.assetsComposition,
              liabilitiesComposition: data.liabilitiesComposition || prev.liabilitiesComposition,
              savingsRateTimeline: data.savingsRateTimeline || prev.savingsRateTimeline,
            }));
          }
        }
      } catch {
        // Auto-sync failure is non-fatal - don't show errors
      }
    }

    fetchData();
    autoSync();
  }, []);

  if (isDemo) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const d = require('@/lib/demo-data');
    return {
      financialSummary: d.DEMO_FINANCIAL_SUMMARY,
      healthScore: d.DEMO_HEALTH_SCORE,
      insights: d.DEMO_INSIGHTS,
      accounts: d.DEMO_ACCOUNTS,
      holdings: d.DEMO_HOLDINGS,
      netWorthHistory: d.DEMO_NET_WORTH_HISTORY,
      netWorthDaily: d.DEMO_NET_WORTH_DAILY || [],
      cashFlowHistory: d.DEMO_CASH_FLOW_HISTORY,
      assetsComposition: d.DEMO_ASSETS_COMPOSITION,
      liabilitiesComposition: d.DEMO_LIABILITIES_COMPOSITION,
      savingsRateTimeline: d.DEMO_SAVINGS_RATE,
      hasPlaidConnection: true,
      loading: false,
      error: null,
    } as FinancialDataState;
  }

  return state;
}

interface BalanceHistoryPoint {
  month: string;
  balance: number;
  inflows: number;
  outflows: number;
}

export function useAccounts() {
  const isDemo = typeof window !== 'undefined' && sessionStorage.getItem('helm_demo_mode') === '1';
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
    if (!isDemo) fetchData();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetch = () => {
    fetchData();
  };

  if (isDemo) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const d = require('@/lib/demo-data');
    return {
      accounts: (d.DEMO_ACCOUNTS ?? []) as Account[],
      balanceHistory: [] as BalanceHistoryPoint[],
      loading: false,
      error: null,
      refetch,
    };
  }

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

const PRICE_REFRESH_KEY = 'helm_last_price_refresh';
const PRICE_REFRESH_INTERVAL = 10 * 60 * 1000; // Heavy DB refresh at most every 10 min (on page load)
const PRICE_POLL_INTERVAL = 15 * 1000;         // Light read-only quote poll every 15s while page is open

export function useHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [allocation, setAllocation] = useState<{ name: string; value: number; percentage: number }[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const holdingsRef = useRef<Holding[]>([]);
  const quotesInFlight = useRef(false);

  useEffect(() => {
    holdingsRef.current = holdings;
  }, [holdings]);

  const applyHoldingsData = useCallback((data: Record<string, unknown>) => {
    // Sync the ref immediately so a quote poll fired right after this
    // sees the new holdings without waiting for a render cycle.
    holdingsRef.current = (data.holdings as Holding[]) || [];
    setHoldings((data.holdings as Holding[]) || []);
    setAllocation((data.allocation as { name: string; value: number; percentage: number }[]) || []);
    setTotalValue((data.totalValue as number) || 0);
    setPerformanceMetrics((data.performanceMetrics as PerformanceMetrics) || null);
    setPortfolioHistory((data.portfolioHistory as PortfolioHistoryPoint[]) || []);
  }, []);

  // Light read-only quote overlay: fetch last trades from /api/market/quotes
  // and patch them onto current holdings. Zero DB writes.
  const pollQuotes = useCallback(async () => {
    if (quotesInFlight.current || document.hidden) return;
    quotesInFlight.current = true;
    try {
      const tickers = [...new Set(
        holdingsRef.current.map((h) => h.ticker).filter((t) => t && t !== 'UNKNOWN')
      )];
      if (tickers.length === 0) return;

      const res = await fetch(`/api/market/quotes?tickers=${encodeURIComponent(tickers.join(','))}`);
      if (!res.ok) return;
      const data: { quotes: LiveQuote[] } = await res.json();
      if (!data.quotes?.length) return;

      const quoteMap = new Map(data.quotes.map((q) => [q.ticker, q]));
      const patched = holdingsRef.current.map((h) => {
        const q = quoteMap.get(h.ticker?.toUpperCase());
        if (!q) return h;
        const total_value = h.shares * q.price;
        return {
          ...h,
          current_price: q.price,
          total_value,
          day_change_percentage: q.dayChangePct ?? h.day_change_percentage,
          // cost_basis here is PER-SHARE (see /api/holdings) — subtracting it
          // raw showed unrealized gain ≈ the position's full market value.
          unrealised_gain: h.cost_basis != null ? total_value - h.cost_basis * h.shares : h.unrealised_gain,
        };
      });
      const total = patched.reduce((sum, h) => sum + (h.total_value || 0), 0);
      setHoldings(patched.map((h) => ({
        ...h,
        portfolio_allocation: total > 0 ? ((h.total_value || 0) / total) * 100 : h.portfolio_allocation,
      })));
      setTotalValue(total);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch {
      // Polling failure is non-fatal — next tick will retry
    } finally {
      quotesInFlight.current = false;
    }
  }, []);

  const refreshPrices = useCallback(async () => {
    try {
      setRefreshing(true);

      // Refresh prices
      const res = await fetch('/api/market/prices/refresh', { method: 'POST' });
      if (res.ok) {
        sessionStorage.setItem(PRICE_REFRESH_KEY, String(Date.now()));
        const now = new Date().toLocaleTimeString();
        setLastRefreshed(now);

        // Re-fetch holdings with updated prices
        const holdingsRes = await fetch('/api/holdings');
        if (holdingsRes.ok) {
          const data = await holdingsRes.json();
          applyHoldingsData(data);
        }
      }

      // Fire-and-forget: news refresh + market enrichment (dividends, splits, metadata)
      fetch('/api/market/news/refresh', { method: 'POST' }).catch(() => {});
      fetch('/api/market/enrich', { method: 'POST' }).catch(() => {});
    } catch {
      // Price refresh failure is non-fatal
    } finally {
      setRefreshing(false);
    }
  }, [applyHoldingsData]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/holdings');
        if (!res.ok) throw new Error('Failed to fetch holdings');
        const data = await res.json();
        applyHoldingsData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    async function autoRefreshPrices() {
      try {
        const lastRefresh = sessionStorage.getItem(PRICE_REFRESH_KEY);
        const threshold = Date.now() - PRICE_REFRESH_INTERVAL;

        if (lastRefresh && Number(lastRefresh) > threshold) {
          setLastRefreshed(new Date(Number(lastRefresh)).toLocaleTimeString());
          return;
        }

        setRefreshing(true);
        const res = await fetch('/api/market/prices/refresh', { method: 'POST' });
        if (res.ok) {
          sessionStorage.setItem(PRICE_REFRESH_KEY, String(Date.now()));
          setLastRefreshed(new Date().toLocaleTimeString());

          const holdingsRes = await fetch('/api/holdings');
          if (holdingsRes.ok) {
            const data = await holdingsRes.json();
            applyHoldingsData(data);
          }
        }

        // Fire-and-forget: news + enrichment
        fetch('/api/market/news/refresh', { method: 'POST' }).catch(() => {});
        fetch('/api/market/enrich', { method: 'POST' }).catch(() => {});
      } catch {
        // Auto-refresh failure is non-fatal
      } finally {
        setRefreshing(false);
      }
    }

    // Live overlay immediately after holdings land (covers after-hours:
    // show last trade), and again after the heavy refresh re-fetch so the
    // DB snapshot never stomps fresher live prices.
    fetchData().then(() => pollQuotes());
    autoRefreshPrices().then(() => pollQuotes());

    // Poll every 30s while the page is open — keeps prices live during
    // market hours without the user needing to do anything. Read-only:
    // /api/market/quotes hits Finazon /price (last trade) and writes
    // nothing to the database, so polling is cheap. The heavy persistence
    // refresh only runs on page load (autoRefreshPrices above).
    const pollId = setInterval(() => {
      if (isUsMarketOpen()) pollQuotes();
    }, PRICE_POLL_INTERVAL);

    // Catch up immediately when the user returns to the tab.
    const onVisible = () => {
      if (!document.hidden && isUsMarketOpen()) pollQuotes();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(pollId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [applyHoldingsData, pollQuotes]);

  // Demo mode — return sample holdings without API calls
  const isDemoHoldings = typeof window !== 'undefined' && sessionStorage.getItem('helm_demo_mode') === '1';
  if (isDemoHoldings) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const d = require('@/lib/demo-data');
    const demoHoldings = d.DEMO_HOLDINGS as Holding[];
    const demoTotal = demoHoldings.reduce((s: number, h: Holding) => s + h.total_value, 0);
    return {
      holdings: demoHoldings,
      allocation: demoHoldings.map((h: Holding) => ({ name: h.ticker, value: h.total_value, percentage: h.portfolio_allocation })),
      totalValue: demoTotal,
      performanceMetrics: { dayChangePct: 0.64, dayChangeAmt: 1180, totalReturnPct: 15.2, totalReturnAmt: 24363 } as unknown as PerformanceMetrics,
      portfolioHistory: [] as PortfolioHistoryPoint[],
      loading: false,
      error: null,
      refreshing: false,
      refreshPrices: async () => {},
      lastRefreshed: null,
    };
  }

  return { holdings, allocation, totalValue, performanceMetrics, portfolioHistory, loading, error, refreshing, refreshPrices, lastRefreshed };
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

// ── Tax position with unrealized P&L ──

export interface TaxPosition {
  ticker: string;
  name: string;
  shares: number;
  costBasis: number;
  currentValue: number;
  gainLoss: number;
  gainLossPct: number;
  sector: string;
  allocationPct: number;
}

export interface RealizedTransaction {
  ticker: string;
  date: string;
  shares: number;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  gainLossType: 'short_term' | 'long_term';
}

export interface TaxSummary {
  unrealized: {
    totalGains: number;
    totalLosses: number;
    netUnrealized: number;
    positions: TaxPosition[];
  };
  realized: {
    shortTermGains: number;
    shortTermLosses: number;
    longTermGains: number;
    longTermLosses: number;
    netRealized: number;
    transactionCount: number;
    transactions: RealizedTransaction[];
  };
}

export function useTaxData() {
  const [data, setData] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/tax');
        if (!res.ok) throw new Error('Failed to fetch tax data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { data, loading, error };
}

// ── Tax-loss harvesting opportunities ──

/** Verbatim contradiction cite from the thesis layer (raw evidence excerpt). */
export interface ThesisCite {
  excerpt: string;
  sourceTitle: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  whatItMeans: string | null;
}

export interface TaxOpportunity {
  ticker: string;
  securityName: string;
  sector: string;
  shares: number;
  costBasis: number;
  currentValue: number;
  unrealizedLoss: number;
  lossPct: number;
  estimatedSavings: number;
  holdingPeriod: 'short_term' | 'long_term' | 'unknown';
  /** Days until this lot crosses to long-term; 0 = already long-term, null = unknown. */
  daysToLongTerm: number | null;
  longTermFrom: string | null;
  effectiveTaxRate: number;
  replacement: { ticker: string; name: string; reason: string } | null;
  washSaleRisk: boolean;
  washSaleDetail: string | null;
  washSaleSeverity: 'none' | 'advisory' | 'flagged';
  accountName: string | null;
  accountSubtype: string | null;
  isRetirement: boolean;
  thesisStatus?: 'intact' | 'weakening' | 'broken';
  thesisCite?: ThesisCite;
}

export interface AnnualCapInfo {
  annualDeductionCap: number;
  ytdNetRealized: number;
  remainingDeductibleLoss: number;
  estimatedCarryforward: number;
  cappedSavings: number;
  uncappedSavings: number;
  gainsOffset: number;
  ordinaryIncomeOffset: number;
  totalPositionSavings: number;
  baselineSavings: number;
}

export interface TaxHarvestReport {
  totalHarvestableLoss: number;
  totalEstimatedSavings: number;
  opportunityCount: number;
  /** Ordinary/short-term rate actually applied — the user's bracket when set. */
  taxRate: number;
  /** Long-term rate actually applied. */
  ltcgRate: number;
  opportunities: TaxOpportunity[];
  retirementPositions: TaxOpportunity[];
  annualCap: AnnualCapInfo;
  /** Filing status from settings, or null. Drives the §1211(b) cap. */
  filingStatus: string | null;
  /** True when taxRate/ltcgRate came from settings rather than app defaults. */
  ratesFromSettings: boolean;
  disclaimer: string;
}

// ── Earnings impact data ──

export interface EarningsPosition {
  ticker: string;
  securityName: string;
  shares: number;
  currentPrice: number;
  totalValue: number;
  allocationPct: number;
  sector: string;
}

export interface UpcomingEarning {
  ticker: string;
  companyName: string;
  date: string;
  time: 'before_open' | 'after_close' | 'unknown';
  epsEstimate: number | null;
  revenueEstimate: number | null;
  position: EarningsPosition;
  beatImpact5pct: number | null;
  missImpact5pct: number | null;
  estimated?: boolean;
  thesisStatus?: 'intact' | 'weakening' | 'broken';
  testPillar?: string;
}

export interface RecentEarning {
  ticker: string;
  companyName: string;
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  /** Filing-sourced year-over-year EPS comparison (XBRL); no consensus vendor. */
  epsYearAgo?: number | null;
  epsYoyPct?: number | null;
  epsQuarterEnd?: string | null;
  surprisePct: number | null;
  beat: boolean;
  position: EarningsPosition;
  estimatedImpact: number | null;
  actualPostEarningsMove: number | null;
  actualDollarImpact: number | null;
}

export interface EarningsReport {
  upcoming: UpcomingEarning[];
  recent: RecentEarning[];
  totalUpcomingExposure: number;
  recentNetImpact: number;
}

export function useEarnings() {
  const [report, setReport] = useState<EarningsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/dashboard/earnings');
        if (!res.ok) throw new Error('Failed to fetch earnings data');
        const data = await res.json();
        setIsPro(data.isPro ?? false);
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { report, loading, error, isPro };
}

// ── Tax-loss harvesting opportunities ──

export function useTaxOpportunities() {
  const [report, setReport] = useState<TaxHarvestReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/dashboard/tax-opportunities');
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          if (body.code === 'PRO_REQUIRED') {
            setProRequired(true);
            return;
          }
        }
        if (!res.ok) throw new Error('Failed to fetch tax opportunities');
        const data = await res.json();
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return { report, loading, error, proRequired };
}

// ── Intelligence Feed ──

export interface IntelligenceMetric {
  label: string;
  value: string;
}

export interface IntelligenceInsight {
  id: string;
  type: 'risk' | 'opportunity' | 'info' | 'action';
  priority: 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  detail: string;
  metrics: IntelligenceMetric[];
  suggestedFollowUp: string;
  createdAt: string;
}

export function useIntelligence() {
  const [insights, setInsights] = useState<IntelligenceInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/dashboard/intelligence');
        if (!res.ok) throw new Error('Failed to fetch intelligence feed');
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

  return { insights, loading, error };
}

// ── Portfolio Wrapped ──

export interface WrappedPosition {
  ticker: string;
  name: string;
  returnPct: number;
  returnDollars: number;
  value: number;
}

export interface WrappedDay {
  date: string;
  changeDollars: number;
  changePct: number;
}

export interface WrappedData {
  period: 'quarter' | 'year';
  periodLabel: string;
  periodRange: string;
  totalReturn: { pct: number; dollars: number };
  bestPosition: WrappedPosition | null;
  worstPosition: WrappedPosition | null;
  bestDays?: WrappedDay[];
  worstDays?: WrappedDay[];
  upDays?: number;
  downDays?: number;
  daySeries?: { date: string; v: number }[];
  totalDividends: number;
  tradeCount: number;
  spyComparison: { userReturn: number; spyReturn: number | null; beat: boolean | null };
  taxSavings: number;
  mostActiveTradingDay: { date: string; trades: number } | null;
  sectorBreakdown: { sector: string; pct: number; value: number }[];
  healthScoreTrend: { start: number | null; end: number | null; change: number };
  netWorthChange: { start: number; end: number; change: number; changePct: number };
  positionCount: number;
  portfolioValue: number;
  investorPersonality?: { type: string; title: string; description: string; traits: string[] };
  topHoldings?: { ticker: string; name: string; value: number; pct: number }[];
}

export function useWrapped(period: 'quarter' | 'year' = 'quarter') {
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    async function fetchData() {
      try {
        const res = await fetch(`/api/dashboard/wrapped?period=${period}`);
        if (!res.ok) throw new Error('Failed to fetch wrapped data');
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [period]);

  return { data, loading, error };
}
