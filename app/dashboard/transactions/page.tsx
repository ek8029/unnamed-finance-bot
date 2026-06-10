'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Calendar,
  Clock,
  X,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormat } from '@/hooks/use-format';
import { useTransactions } from '@/hooks/use-transactions';

/* ─── Transaction kind inference ─── */
type TxKind = 'BUY' | 'SELL' | 'DIV' | 'DEPOSIT' | 'FEE' | 'TRANSFER' | 'OTHER';

function inferKind(tx: {
  amount: number;
  category_name: string | null;
  category_raw: string | null;
  category_group: string | null;
  description: string;
}): TxKind {
  const cat = (tx.category_raw || tx.category_name || '').toLowerCase();
  const desc = tx.description.toLowerCase();
  const group = (tx.category_group || '').toLowerCase();

  if (/dividend/i.test(cat) || /dividend/i.test(desc)) return 'DIV';
  if (/\bfee\b/i.test(cat) || /\bfee\b/i.test(desc) || /service charge/i.test(cat)) return 'FEE';
  if (/\bbuy\b|purchase.*stock|investment.*buy/i.test(cat) || /\bbuy\b|bought/i.test(desc)) return 'BUY';
  if (/\bsell\b|sale.*stock|investment.*sell/i.test(cat) || /\bsell\b|sold/i.test(desc)) return 'SELL';
  if (/transfer/i.test(cat) || /transfer/i.test(desc) || group === 'transfer') return 'TRANSFER';
  if (/deposit/i.test(cat) || /deposit/i.test(desc) || /payroll/i.test(cat)) return 'DEPOSIT';
  if (tx.amount > 0) return 'DEPOSIT';
  return 'OTHER';
}

/*
 * KIND_CONFIG color rationale:
 * BUY (#7AA3C7) and SELL (#E89A7F) use hardcoded hex values because they are
 * semantic transaction-type colors — cool blue for buys, warm coral for sells —
 * that remain constant regardless of light/dark theme. They are NOT generic
 * brand or theme colors, so CSS custom properties would add indirection with
 * no benefit. DIV/DEPOSIT/FEE/TRANSFER intentionally use CSS vars since they
 * map to existing theme-aware semantic tokens (positive, muted, secondary).
 */
const KIND_CONFIG: Record<TxKind, { label: string; color: string; bg: string }> = {
  BUY:      { label: 'BUY',      color: '#7AA3C7', bg: 'rgba(122,163,199,0.12)' },
  SELL:     { label: 'SELL',     color: '#E89A7F', bg: 'rgba(232,154,127,0.12)' },
  DIV:      { label: 'DIV',      color: 'var(--color-positive)', bg: 'rgba(76,175,80,0.12)' },
  DEPOSIT:  { label: 'DEPOSIT',  color: 'var(--color-positive)', bg: 'rgba(76,175,80,0.12)' },
  FEE:      { label: 'FEE',      color: 'var(--color-text-muted)', bg: 'rgba(128,128,128,0.12)' },
  TRANSFER: { label: 'XFER',    color: 'var(--color-text-secondary)', bg: 'rgba(128,128,128,0.08)' },
  OTHER:    { label: 'OTHER',    color: 'var(--color-text-secondary)', bg: 'rgba(128,128,128,0.08)' },
};

/* ─── Filter chip types ─── */
type ChipFilter = 'ALL' | 'BUY' | 'SELL' | 'DIV' | 'DEPOSIT' | 'FEE';
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit Cards',
  brokerage: 'Brokerage',
  loan: 'Loans',
  mortgage: 'Mortgage',
  crypto: 'Crypto',
  investment: 'Investment',
  depository: 'Depository',
};

const CHIP_FILTERS: { key: ChipFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'BUY', label: 'Buys' },
  { key: 'SELL', label: 'Sells' },
  { key: 'DIV', label: 'Dividends' },
  { key: 'DEPOSIT', label: 'Deposits' },
  { key: 'FEE', label: 'Fees' },
];

/* ─── Date range presets ─── */
type DatePreset = '7d' | '30d' | '90d' | 'ytd' | 'all';
const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'all', label: 'All time' },
];

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  if (preset === 'all') return { from: '', to: '' };
  if (preset === 'ytd') {
    return { from: `${now.getFullYear()}-01-01`, to };
  }
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const from = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0];
  return { from, to };
}

/* ─── CSV Export ─── */
function exportToCsv(
  transactions: Array<{
    date: string;
    description: string;
    merchant_name: string | null;
    category_name: string | null;
    account_name: string | null;
    amount: number;
    is_pending: boolean;
  }>
) {
  const header = 'Date,Description,Merchant,Category,Account,Amount,Status\n';
  const rows = transactions.map((tx) => {
    const esc = (s: string | null) => `"${(s || '').replace(/"/g, '""')}"`;
    return [
      tx.date,
      esc(tx.description),
      esc(tx.merchant_name),
      esc(tx.category_name),
      esc(tx.account_name),
      tx.amount.toFixed(2),
      tx.is_pending ? 'Pending' : 'Posted',
    ].join(',');
  });
  const csv = header + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `helm-transactions-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Date Dropdown ─── */
function DateDropdown({
  activePreset,
  onSelect,
}: {
  activePreset: DatePreset;
  onSelect: (preset: DatePreset) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeLabel = DATE_PRESETS.find((p) => p.key === activePreset)?.label || 'All time';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`Date range: ${activeLabel}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[13px] text-[var(--color-text-secondary)] hover:border-[var(--color-border-base)] motion-safe:transition-colors"
      >
        <Calendar className="w-3.5 h-3.5" />
        <span>{activeLabel}</span>
        <ChevronDown className={`w-3 h-3 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-44 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg shadow-xl overflow-hidden"
          role="listbox"
          aria-label="Date range options"
        >
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="option"
              aria-selected={activePreset === p.key}
              onClick={() => {
                onSelect(p.key);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[13px] motion-safe:transition-colors hover:bg-[var(--color-bg-overlay)] ${
                activePreset === p.key
                  ? 'text-[var(--color-gold)] font-medium'
                  : 'text-[var(--color-text-primary)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Kind Badge ─── */
function KindBadge({ kind }: { kind: TxKind }) {
  const cfg = KIND_CONFIG[kind];
  return (
    <span
      className="inline-flex items-center justify-center rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide leading-none whitespace-nowrap"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}

/* ─── Skeleton Loader ─── */
function LedgerSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((group) => (
        <div key={group}>
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
            <div className="flex-1" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="hidden sm:grid grid-cols-[60px_56px_1fr_100px_100px] gap-3 py-3 border-b border-[var(--color-border-subtle)]"
              >
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-10" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-16 ml-auto" />
                <Skeleton className="h-4 w-20 ml-auto" />
              </div>
            ))}
            {/* Mobile skeleton rows */}
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={`mobile-${i}`}
                className="sm:hidden flex items-center gap-3 py-3 border-b border-[var(--color-border-subtle)]"
              >
                <Skeleton className="h-5 w-10 flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════ */

export default function TransactionsPage() {
  const { formatCurrency, formatCurrencyDetailed } = useFormat();
  const {
    transactions,
    pagination,
    summary,
    accountOptions,
    filters,
    loading,
    error,
    updateFilters,
    goToPage,
  } = useTransactions();

  const [searchInput, setSearchInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [chipFilter, setChipFilter] = useState<ChipFilter>('ALL');
  const [accountChip, setAccountChip] = useState<string>('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  /* ─── Search handlers ─── */
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      updateFilters({ search: searchInput });
    },
    [searchInput, updateFilters]
  );

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearchOpen(false);
    updateFilters({ search: '' });
  }, [updateFilters]);

  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  /* ─── Date preset handler ─── */
  const handleDatePreset = useCallback(
    (preset: DatePreset) => {
      setDatePreset(preset);
      const range = getDateRange(preset);
      updateFilters({ date_from: range.from, date_to: range.to });
    },
    [updateFilters]
  );

  /* ─── Enrich transactions with inferred kind ─── */
  const enriched = useMemo(
    () =>
      transactions.map((tx) => ({
        ...tx,
        kind: inferKind(tx),
      })),
    [transactions]
  );

  /* ─── Client-side chip filtering ─── */
  const filtered = useMemo(() => {
    let result = enriched;
    if (chipFilter !== 'ALL') {
      result = result.filter((tx) => tx.kind === chipFilter);
    }
    if (accountChip) {
      // Find the account_type key that maps to this label
      const typeKey = Object.entries(ACCOUNT_TYPE_LABELS).find(([, v]) => v === accountChip)?.[0] || accountChip.toLowerCase().replace(/ /g, '_');
      result = result.filter((tx) => (tx as Record<string, unknown>).account_type === typeKey);
    }
    return result;
  }, [enriched, chipFilter, accountChip]);

  /* ─── Group by date ─── */
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { dateStr: string; txs: typeof filtered; dailyNet: number }
    >();
    for (const tx of filtered) {
      const key = tx.date;
      if (!map.has(key)) {
        map.set(key, { dateStr: key, txs: [], dailyNet: 0 });
      }
      const group = map.get(key)!;
      group.txs.push(tx);
      group.dailyNet += tx.amount;
    }
    return Array.from(map.values());
  }, [filtered]);

  /* ─── Summary tiles computed from enriched data ─── */
  const tileSummary = useMemo(() => {
    let bought = 0,
      sold = 0,
      dividends = 0,
      fees = 0,
      buyCount = 0,
      sellCount = 0,
      divCount = 0,
      feeCount = 0;
    for (const tx of enriched) {
      switch (tx.kind) {
        case 'BUY':
          bought += Math.abs(tx.amount);
          buyCount++;
          break;
        case 'SELL':
          sold += Math.abs(tx.amount);
          sellCount++;
          break;
        case 'DIV':
          dividends += Math.abs(tx.amount);
          divCount++;
          break;
        case 'FEE':
          fees += Math.abs(tx.amount);
          feeCount++;
          break;
      }
    }
    return { bought, sold, dividends, fees, buyCount, sellCount, divCount, feeCount };
  }, [enriched]);

  /* ─── Account type labels — defined above component, see ACCOUNT_TYPE_LABELS ─── */

  const accountNames = useMemo(() => {
    const typeSet = new Set<string>();
    for (const tx of enriched) {
      const acctType = (tx as Record<string, unknown>).account_type as string | null;
      if (acctType) typeSet.add(acctType);
    }
    return Array.from(typeSet).sort().map(t => ACCOUNT_TYPE_LABELS[t] || t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  }, [enriched]);

  /* ─── Active filter detection ─── */
  const hasActiveFilters =
    filters.search ||
    filters.account_id ||
    filters.category ||
    filters.category_group ||
    filters.date_from ||
    filters.date_to ||
    filters.type ||
    chipFilter !== 'ALL' ||
    accountChip;

  const clearAllFilters = () => {
    setSearchInput('');
    setSearchOpen(false);
    setChipFilter('ALL');
    setAccountChip('');
    setDatePreset('all');
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

  /* ─── Format date for group headers ─── */
  const formatGroupDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const txDate = new Date(d);
    txDate.setHours(0, 0, 0, 0);

    if (txDate.getTime() === today.getTime()) return 'Today';
    if (txDate.getTime() === yesterday.getTime()) return 'Yesterday';

    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  /* ─── Error state ─── */
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6" role="alert">
        <div className="max-w-md w-full bg-[var(--color-bg-surface)] border border-[var(--color-negative)]/20 rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--color-negative)]/10 flex items-center justify-center mx-auto mb-4">
            <X className="w-5 h-5 text-[var(--color-negative)]" />
          </div>
          <h2 className="font-sans text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            Error loading transactions
          </h2>
          <p className="text-[13px] text-[var(--color-text-secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ─── Header ─── */}
      <header className="space-y-4">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--color-text-muted)]"
        >
          <span>HELM</span>
          <span className="text-[var(--color-gold)]" aria-hidden="true">/</span>
          <span className="text-[var(--color-text-secondary)]" aria-current="page">TRANSACTIONS</span>
        </nav>

        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-1.5">
            <h1
              className="font-sans font-bold tracking-tight text-[var(--color-text-primary)] leading-none text-[28px] sm:text-[38px]"
            >
              Activity
            </h1>
            <div
              className="flex items-center gap-3 text-[13px] text-[var(--color-text-muted)]"
              aria-live="polite"
              aria-atomic="true"
            >
              {loading ? (
                <Skeleton className="h-4 w-48" />
              ) : (
                <>
                  {filters.date_from && (
                    <span>
                      {new Date(filters.date_from + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      &ndash;{' '}
                      {filters.date_to
                        ? new Date(filters.date_to + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Present'}
                    </span>
                  )}
                  <span className="hidden sm:inline">&middot;</span>
                  <span>
                    {accountOptions.length} account{accountOptions.length !== 1 ? 's' : ''}
                  </span>
                  <span>&middot;</span>
                  <span>
                    {pagination.total.toLocaleString()} transaction
                    {pagination.total !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {/* Search toggle */}
            {searchOpen ? (
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onBlur={() => {
                    if (!searchInput) setSearchOpen(false);
                  }}
                  placeholder="Search transactions..."
                  aria-label="Search transactions"
                  className="w-full sm:w-52 pl-8 pr-8 py-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" />
                  </button>
                )}
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Open search"
                className="flex items-center justify-center w-9 h-9 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-base)] motion-safe:transition-colors"
                title="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            <DateDropdown activePreset={datePreset} onSelect={handleDatePreset} />

            <button
              type="button"
              onClick={() => exportToCsv(filtered)}
              disabled={loading || filtered.length === 0}
              aria-label="Export transactions to CSV"
              className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[13px] text-[var(--color-text-secondary)] hover:border-[var(--color-border-base)] disabled:opacity-40 disabled:cursor-not-allowed motion-safe:transition-colors"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* Manual entry — placeholder for future feature */}
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="space-y-6">
        {/* ─── Summary Tiles ─── */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {/* Net Flow */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg px-4 py-3.5">
            <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--color-text-muted)] mb-1">
              Net Flow
            </p>
            {loading ? (
              <Skeleton className="h-7 w-24 mb-1" />
            ) : (
              <p
                className={`font-mono font-bold leading-none mb-1 text-[18px] sm:text-[24px] ${
                  summary.netFlow >= 0
                    ? 'text-[var(--color-positive)]'
                    : 'text-[var(--color-negative)]'
                }`}
              >
                {summary.netFlow >= 0 ? '+' : ''}
                {formatCurrency(summary.netFlow)}
              </p>
            )}
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {loading ? '' : `${pagination.total} transactions`}
            </p>
          </div>

          {/* Bought — hardcoded #7AA3C7: semantic "buy" blue, theme-independent (see KIND_CONFIG comment) */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg px-4 py-3.5">
            <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--color-text-muted)] mb-1">
              Bought
            </p>
            {loading ? (
              <Skeleton className="h-7 w-20 mb-1" />
            ) : (
              <p className="font-mono font-bold text-[#7AA3C7] leading-none mb-1 text-[18px] sm:text-[24px]">
                {formatCurrency(tileSummary.bought)}
              </p>
            )}
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {loading ? '' : `${tileSummary.buyCount} trade${tileSummary.buyCount !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Sold — hardcoded #E89A7F: semantic "sell" coral, theme-independent (see KIND_CONFIG comment) */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg px-4 py-3.5">
            <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--color-text-muted)] mb-1">
              Sold
            </p>
            {loading ? (
              <Skeleton className="h-7 w-20 mb-1" />
            ) : (
              <p className="font-mono font-bold text-[#E89A7F] leading-none mb-1 text-[18px] sm:text-[24px]">
                {formatCurrency(tileSummary.sold)}
              </p>
            )}
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {loading ? '' : `${tileSummary.sellCount} trade${tileSummary.sellCount !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Dividends */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg px-4 py-3.5">
            <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--color-text-muted)] mb-1">
              Dividends
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mb-1" />
            ) : (
              <p className="font-mono font-bold text-[var(--color-positive)] leading-none mb-1 text-[18px] sm:text-[24px]">
                {formatCurrency(tileSummary.dividends)}
              </p>
            )}
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {loading ? '' : `${tileSummary.divCount} payment${tileSummary.divCount !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Fees */}
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-lg px-4 py-3.5">
            <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--color-text-muted)] mb-1">
              Fees
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mb-1" />
            ) : (
              <p className="font-mono font-bold text-[var(--color-text-muted)] leading-none mb-1 text-[18px] sm:text-[24px]">
                {formatCurrency(tileSummary.fees)}
              </p>
            )}
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {loading ? '' : `${tileSummary.feeCount} charge${tileSummary.feeCount !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* ─── Filter Chips ─── */}
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter transactions by type">
          {/* Kind chips */}
          {CHIP_FILTERS.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={chipFilter === c.key}
              aria-label={`Filter by ${c.label}`}
              onClick={() => setChipFilter(c.key)}
              className={`px-3 py-2.5 sm:py-1.5 rounded-full text-[12px] font-medium motion-safe:transition-all border ${
                chipFilter === c.key
                  ? 'bg-[var(--color-gold)]/15 border-[var(--color-gold)]/40 text-[var(--color-gold)]'
                  : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-base)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {c.label}
            </button>
          ))}

          {/* Separator */}
          {accountNames.length > 0 && (
            <div className="w-px h-5 bg-[var(--color-border-subtle)] mx-1" aria-hidden="true" />
          )}

          {/* Account chips */}
          {accountNames.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={`Filter by account: ${name}`}
              aria-pressed={accountChip === name}
              onClick={() => setAccountChip(accountChip === name ? '' : name)}
              className={`px-3 py-2.5 sm:py-1.5 rounded-full text-[12px] font-medium motion-safe:transition-all border ${
                accountChip === name
                  ? 'bg-[var(--color-gold)]/15 border-[var(--color-gold)]/40 text-[var(--color-gold)]'
                  : 'bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-base)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {name}
            </button>
          ))}

          {/* Clear all */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              aria-label="Clear all filters"
              className="flex items-center gap-1 px-2 py-2.5 sm:py-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] motion-safe:transition-colors"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* ─── Ledger ─── */}
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-5">
              <LedgerSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <ArrowUpDown className="w-8 h-8 text-[var(--color-text-muted)] mb-3" />
              <p className="text-[15px] text-[var(--color-text-secondary)] mb-1">
                No transactions found
              </p>
              {hasActiveFilters ? (
                <button
                  onClick={clearAllFilters}
                  className="text-[13px] text-[var(--color-gold)] hover:underline"
                >
                  Clear all filters
                </button>
              ) : (
                <p className="text-[13px] text-[var(--color-text-muted)]">
                  Link an account to see your activity here.
                </p>
              )}
            </div>
          ) : (
            <div>
              {grouped.map((group) => (
                <div key={group.dateStr}>
                  {/* Date header row */}
                  <div className="flex items-center gap-3 px-4 sm:px-5 py-2.5 bg-[var(--color-bg-elevated)] border-b border-[var(--color-border-subtle)]">
                    <h3 className="text-[13px] font-semibold text-[var(--color-gold)] font-sans m-0">
                      {formatGroupDate(group.dateStr)}
                    </h3>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      {group.txs.length} transaction{group.txs.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex-1" />
                    <span
                      className={`text-[13px] font-mono font-semibold ${
                        group.dailyNet >= 0
                          ? 'text-[var(--color-positive)]'
                          : 'text-[var(--color-negative)]'
                      }`}
                    >
                      {group.dailyNet >= 0 ? '+' : ''}
                      {formatCurrencyDetailed(group.dailyNet)}
                    </span>
                  </div>

                  {/* Transaction rows */}
                  {group.txs.map((tx) => {
                    const isPositive = tx.amount > 0;
                    // posted_date may have time info; date-only fields show dash
                    const hasTime = typeof tx.posted_date === 'string' && tx.posted_date.includes('T');
                    const displayTime = hasTime
                      ? new Date(tx.posted_date as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      : '\u2014';

                    return (
                      <div key={tx.id}>
                        {/* ── Desktop row: 5-column grid (hidden on mobile) ── */}
                        <div
                          className="hidden sm:grid grid-cols-[minmax(48px,56px)_minmax(48px,56px)_1fr_minmax(80px,120px)_minmax(80px,100px)] items-center gap-2 sm:gap-3 px-5 py-3 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-overlay)] motion-safe:transition-colors cursor-default group"
                        >
                          {/* Time */}
                          <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                            {tx.is_pending ? (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Pend
                              </span>
                            ) : (
                              displayTime
                            )}
                          </span>

                          {/* Kind badge */}
                          <KindBadge kind={tx.kind} />

                          {/* Name + Description */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {/* Ticker / merchant as the primary label */}
                              <span
                                className="font-sans font-semibold text-[var(--color-text-primary)] truncate"
                                style={{ fontSize: '15px' }}
                              >
                                {tx.merchant_name || tx.description}
                              </span>
                              {tx.category_name && (
                                <span className="hidden lg:inline text-[11px] text-[var(--color-text-muted)] truncate">
                                  {tx.category_name}
                                </span>
                              )}
                            </div>
                            {tx.merchant_name && tx.description !== tx.merchant_name && (
                              <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                                {tx.description}
                              </p>
                            )}
                          </div>

                          {/* Account + status */}
                          <div className="text-right min-w-0">
                            <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                              {tx.account_name || '\u2014'}
                            </p>
                            {tx.is_pending && (
                              <p className="text-[10px] text-[var(--color-warning-text)]">Pending</p>
                            )}
                          </div>

                          {/* Amount */}
                          <div className="text-right">
                            <span
                              className={`font-mono font-semibold ${
                                isPositive
                                  ? 'text-[var(--color-positive)]'
                                  : 'text-[var(--color-text-primary)]'
                              }`}
                              style={{ fontSize: '13px' }}
                            >
                              {isPositive ? '+' : ''}
                              {formatCurrencyDetailed(tx.amount)}
                            </span>
                          </div>
                        </div>

                        {/* ── Mobile row: card layout (hidden on sm+) ── */}
                        <div
                          className="sm:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-overlay)] motion-safe:transition-colors cursor-default"
                        >
                          {/* Kind badge */}
                          <div className="flex-shrink-0">
                            <KindBadge kind={tx.kind} />
                          </div>

                          {/* Name + meta stacked */}
                          <div className="flex-1 min-w-0">
                            <span
                              className="block font-sans font-semibold text-[var(--color-text-primary)] truncate"
                              style={{ fontSize: '14px' }}
                            >
                              {tx.merchant_name || tx.description}
                            </span>
                            <span className="block text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                              {tx.is_pending ? 'Pending' : displayTime}
                              {tx.account_name ? ` \u00B7 ${tx.account_name}` : ''}
                            </span>
                          </div>

                          {/* Amount */}
                          <div className="flex-shrink-0 text-right">
                            <span
                              className={`font-mono font-semibold ${
                                isPositive
                                  ? 'text-[var(--color-positive)]'
                                  : 'text-[var(--color-text-primary)]'
                              }`}
                              style={{ fontSize: '13px' }}
                            >
                              {isPositive ? '+' : ''}
                              {formatCurrencyDetailed(tx.amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* ─── Pagination ─── */}
          {pagination.totalPages > 1 && (
            <nav
              aria-label="Transaction pagination"
              className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]"
            >
              <p className="text-[12px] text-[var(--color-text-muted)] font-mono">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  aria-label="Previous page"
                  className="p-2.5 sm:p-1.5 rounded border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] disabled:opacity-30 disabled:cursor-not-allowed motion-safe:transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
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
                      aria-label={`Go to page ${pageNum}`}
                      aria-current={pageNum === pagination.page ? 'page' : undefined}
                      className={`w-9 h-9 sm:w-7 sm:h-7 rounded text-[12px] font-mono motion-safe:transition-colors ${
                        pageNum === pagination.page
                          ? 'bg-[var(--color-gold)] text-black font-semibold'
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
                  aria-label="Next page"
                  className="p-2.5 sm:p-1.5 rounded border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] disabled:opacity-30 disabled:cursor-not-allowed motion-safe:transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </nav>
          )}
        </div>
      </main>
    </div>
  );
}
