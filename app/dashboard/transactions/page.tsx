'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  Clock,
  X,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  DollarSign,
  AlignJustify,
  RefreshCw,
  Minus,
  Link2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormat } from '@/hooks/use-format';
import { useTransactions } from '@/hooks/use-transactions';
import { usePreview } from '@/lib/preview-context';

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

/* Investment rows carry Plaid's transaction_type, so no inference needed */
function investmentKind(type: string | null | undefined): TxKind {
  const t = (type || '').toLowerCase();
  if (t.includes('dividend')) return 'DIV';
  if (t.includes('buy')) return 'BUY';
  if (t.includes('sell')) return 'SELL';
  if (t.includes('fee') || t.includes('tax')) return 'FEE';
  if (t.includes('transfer') || t.includes('withdrawal')) return 'TRANSFER';
  if (t.includes('deposit') || t.includes('contribution') || t.includes('cash')) return 'DEPOSIT';
  return 'OTHER';
}

/*
 * KIND_ICON maps each transaction kind to the Sovereign Architect ledger icon
 * tile (30px rounded square). Colors map to theme-aware semantic tokens, with
 * BUY/SELL keeping their cool-blue / warm-coral semantics via dedicated tokens.
 * icon = the Lucide glyph rendered at 14px inside the tile.
 */
const KIND_ICON: Record<
  TxKind,
  { Icon: typeof ArrowUp; color: string; tint: string }
> = {
  BUY:      { Icon: ArrowUp,       color: 'var(--color-positive)',      tint: 'rgba(74,222,128,0.08)' },
  SELL:     { Icon: ArrowDown,     color: 'var(--color-negative-text)', tint: 'rgba(248,113,113,0.08)' },
  DIV:      { Icon: DollarSign,    color: 'var(--color-gold)',          tint: 'rgba(230,185,77,0.08)' },
  DEPOSIT:  { Icon: AlignJustify,  color: 'var(--color-info-text)',     tint: 'rgba(96,165,250,0.08)' },
  TRANSFER: { Icon: AlignJustify,  color: 'var(--color-info-text)',     tint: 'rgba(96,165,250,0.08)' },
  FEE:      { Icon: Minus,         color: 'var(--color-text-muted)',    tint: 'rgba(255,255,255,0.03)' },
  OTHER:    { Icon: RefreshCw,     color: 'var(--color-text-muted)',    tint: 'rgba(255,255,255,0.03)' },
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
    const esc = (s: string | null) => {
      // Neutralize CSV formula injection (=, +, -, @ lead chars) so spreadsheets treat it as text.
      const v = /^[=+\-@\t\r]/.test(s || '') ? "'" + (s || '') : (s || '');
      return `"${v.replace(/"/g, '""')}"`;
    };
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
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] text-[14px] text-[var(--color-text-secondary)] hover:border-[var(--color-gold-border)] motion-safe:transition-colors"
      >
        <Calendar className="w-4 h-4" />
        <span>{activeLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 motion-safe:transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-1.5 w-48 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg shadow-xl overflow-hidden"
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
              className={`w-full text-left px-3.5 py-2.5 text-[14px] motion-safe:transition-colors hover:bg-[var(--color-bg-overlay)] ${
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

/* ─── Ledger row icon tile (30px rounded square) ─── */
function KindIcon({ kind }: { kind: TxKind }) {
  const cfg = KIND_ICON[kind];
  const Glyph = cfg.Icon;
  return (
    <span
      className="flex items-center justify-center flex-shrink-0 rounded-[7px]"
      style={{ width: 30, height: 30, backgroundColor: cfg.tint }}
      aria-hidden="true"
    >
      <Glyph className="w-3.5 h-3.5" style={{ color: cfg.color }} strokeWidth={1.8} />
    </span>
  );
}

/* ─── Ledger row title — verb + gold ticker, mirroring the mockup ─── */
function rowVerb(kind: TxKind): string {
  switch (kind) {
    case 'BUY': return 'Bought';
    case 'SELL': return 'Sold';
    case 'DIV': return 'Dividend';
    case 'DEPOSIT': return 'Deposit';
    case 'FEE': return 'Fee';
    case 'TRANSFER': return 'Transfer';
    default: return '';
  }
}

/* ─── Skeleton Loader ─── */
function LedgerSkeleton() {
  return (
    <div className="space-y-7">
      {[1, 2, 3].map((group) => (
        <div key={group}>
          <Skeleton className="h-3.5 w-32 mb-3" />
          <div className="sovereign-card rounded-lg overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 px-5 py-3.5 border-b border-[var(--color-border-subtle)] last:border-b-0"
              >
                <Skeleton className="w-[30px] h-[30px] rounded-[7px] flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-20 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Connect-your-brokerage empty state ─── */
/* Shown when no account is linked (dataState === 'empty'). Read-only Plaid
   framing + gold Connect CTA, mirroring the rest of the redesigned dashboard. */
function ConnectBrokerage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-[470px] text-center">
        <div className="w-[60px] h-[60px] mx-auto mb-[22px] rounded-[14px] bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center">
          <Link2 className="w-[26px] h-[26px] text-[var(--color-gold)]" strokeWidth={1.6} />
        </div>
        <h1 className="text-[24px] font-bold tracking-[-0.025em] text-[var(--color-text-primary)] mb-3">
          Connect your brokerage
        </h1>
        <p className="text-[14px] leading-[1.65] text-[var(--color-text-muted)] mb-6">
          Link an account and Helm builds your net worth, holdings, taxes and intelligence automatically.{' '}
          <span className="text-[var(--color-positive)]">Read-only access</span> &mdash; Helm can never move money or place trades.
        </p>
        <Link
          href="/dashboard/accounts"
          className="inline-flex items-center justify-center px-6 py-3 bg-[var(--color-gold)] hover:brightness-[1.06] rounded-[7px] text-[#0A0A0A] font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-all"
          style={{ boxShadow: '0 8px 24px rgba(230,185,77,0.25)' }}
        >
          Connect account
        </Link>
        <div className="font-mono text-[10px] text-[var(--color-text-muted)] mt-[18px] tracking-[0.04em]">
          12,000+ institutions &middot; 256-bit encryption &middot; via Plaid
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════ */

export default function TransactionsPage() {
  const { formatCurrency, formatCurrencyDetailed } = useFormat();
  const { dataState } = usePreview();
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
        kind: tx.kind === 'investment' ? investmentKind(tx.transaction_type) : inferKind(tx),
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

  /* ─── Format date for group headers (Today · Oct 21) ─── */
  const formatGroupDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const txDate = new Date(d);
    txDate.setHours(0, 0, 0, 0);

    const monthDay = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });

    if (txDate.getTime() === today.getTime()) return `Today · ${monthDay}`;
    if (txDate.getTime() === yesterday.getTime()) return `Yesterday · ${monthDay}`;

    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `${weekday} · ${monthDay}`;
  };

  /* ─── Empty state: no brokerage linked (preview dataState === 'empty') ─── */
  if (dataState === 'empty') return <ConnectBrokerage />;

  /* ─── Error state ─── */
  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6" role="alert">
        <div className="sovereign-card rounded-xl p-8 text-center max-w-md w-full" style={{ borderColor: 'rgba(248,113,113,0.2)' }}>
          <div className="w-12 h-12 rounded-full bg-[rgba(248,113,113,0.1)] flex items-center justify-center mx-auto mb-4">
            <X className="w-5 h-5 text-[var(--color-negative-text)]" />
          </div>
          <h2 className="font-sans text-[18px] font-semibold text-[var(--color-text-primary)] mb-2">
            Error loading transactions
          </h2>
          <p className="text-[14px] text-[var(--color-text-secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1100px] mx-auto px-4 sm:px-7 py-6 sm:py-7 space-y-6">
      {/* ─── Header ─── */}
      <header className="space-y-5">
        {/* Eyebrow */}
        <div className="type-eyebrow text-[var(--color-text-muted)]">
          Activity <span className="text-[var(--color-gold)]">&middot;</span> All accounts
        </div>

        {/* Title row */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="font-sans font-bold tracking-[-0.025em] text-[var(--color-text-primary)] leading-none text-[28px] sm:text-[34px]">
              Every move, in one ledger
            </h1>
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[var(--color-text-muted)]"
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
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
                  className="w-full sm:w-56 pl-9 pr-9 py-2.5 rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] focus:ring-1 focus:ring-[var(--color-gold)]/30"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3.5 h-3.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" />
                  </button>
                )}
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Open search"
                className="flex items-center justify-center w-10 h-10 rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-gold-border)] motion-safe:transition-colors"
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
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-md border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] text-[14px] text-[var(--color-text-secondary)] hover:border-[var(--color-gold-border)] disabled:opacity-40 disabled:cursor-not-allowed motion-safe:transition-colors"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="space-y-6">
        {/* ─── Summary Tiles ─── */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {/* Cash Flow */}
          <div className="sovereign-card rounded-lg px-5 py-4">
            <p className="type-data-label mb-2">Cash Flow</p>
            {loading ? (
              <Skeleton className="h-7 w-24 mb-1" />
            ) : (
              <p
                className={`font-mono font-bold leading-none mb-1.5 text-[22px] sm:text-[26px] tabular-nums ${
                  summary.netFlow >= 0
                    ? 'text-[var(--color-positive)]'
                    : 'text-[var(--color-negative-text)]'
                }`}
              >
                {summary.netFlow >= 0 ? '+' : ''}
                {formatCurrency(summary.netFlow)}
              </p>
            )}
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {loading ? '' : `${pagination.total} transactions`}
            </p>
          </div>

          {/* Bought */}
          <div className="sovereign-card rounded-lg px-5 py-4">
            <p className="type-data-label mb-2">Bought</p>
            {loading ? (
              <Skeleton className="h-7 w-20 mb-1" />
            ) : (
              <p className="font-mono font-bold text-[var(--color-positive)] leading-none mb-1.5 text-[22px] sm:text-[26px] tabular-nums">
                {formatCurrency(tileSummary.bought)}
              </p>
            )}
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {loading ? '' : `${tileSummary.buyCount} trade${tileSummary.buyCount !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Sold */}
          <div className="sovereign-card rounded-lg px-5 py-4">
            <p className="type-data-label mb-2">Sold</p>
            {loading ? (
              <Skeleton className="h-7 w-20 mb-1" />
            ) : (
              <p className="font-mono font-bold text-[var(--color-negative-text)] leading-none mb-1.5 text-[22px] sm:text-[26px] tabular-nums">
                {formatCurrency(tileSummary.sold)}
              </p>
            )}
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {loading ? '' : `${tileSummary.sellCount} trade${tileSummary.sellCount !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Dividends */}
          <div className="sovereign-card rounded-lg px-5 py-4">
            <p className="type-data-label mb-2">Dividends</p>
            {loading ? (
              <Skeleton className="h-7 w-16 mb-1" />
            ) : (
              <p className="font-mono font-bold text-[var(--color-gold)] leading-none mb-1.5 text-[22px] sm:text-[26px] tabular-nums">
                {formatCurrency(tileSummary.dividends)}
              </p>
            )}
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {loading ? '' : `${tileSummary.divCount} payment${tileSummary.divCount !== 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Fees */}
          <div className="sovereign-card rounded-lg px-5 py-4">
            <p className="type-data-label mb-2">Fees</p>
            {loading ? (
              <Skeleton className="h-7 w-16 mb-1" />
            ) : (
              <p className="font-mono font-bold text-[var(--color-text-muted)] leading-none mb-1.5 text-[22px] sm:text-[26px] tabular-nums">
                {formatCurrency(tileSummary.fees)}
              </p>
            )}
            <p className="text-[13px] text-[var(--color-text-muted)]">
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
              className={`px-3.5 py-2.5 sm:py-2 rounded-full text-[14px] font-medium motion-safe:transition-all border ${
                chipFilter === c.key
                  ? 'bg-[var(--color-gold)]/15 border-[var(--color-gold)]/40 text-[var(--color-gold)]'
                  : 'bg-[var(--color-bg-surface)] border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:border-[var(--color-gold-border)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {c.label}
            </button>
          ))}

          {/* Separator */}
          {accountNames.length > 0 && (
            <div className="w-px h-5 bg-[var(--color-border-base)] mx-1" aria-hidden="true" />
          )}

          {/* Account chips */}
          {accountNames.map((name) => (
            <button
              key={name}
              type="button"
              aria-label={`Filter by account: ${name}`}
              aria-pressed={accountChip === name}
              onClick={() => setAccountChip(accountChip === name ? '' : name)}
              className={`px-3.5 py-2.5 sm:py-2 rounded-full text-[14px] font-medium motion-safe:transition-all border ${
                accountChip === name
                  ? 'bg-[var(--color-gold)]/15 border-[var(--color-gold)]/40 text-[var(--color-gold)]'
                  : 'bg-[var(--color-bg-surface)] border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:border-[var(--color-gold-border)] hover:text-[var(--color-text-primary)]'
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
              className="flex items-center gap-1 px-2.5 py-2.5 sm:py-2 text-[14px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] motion-safe:transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* ─── Ledger ─── */}
        {loading ? (
          <LedgerSkeleton />
        ) : filtered.length === 0 ? (
          <div className="sovereign-card rounded-xl flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-12 h-12 rounded-[10px] bg-[rgba(255,255,255,0.03)] border border-[var(--color-border-base)] flex items-center justify-center mb-4">
              <RefreshCw className="w-5 h-5 text-[var(--color-text-muted)]" strokeWidth={1.6} />
            </div>
            <p className="text-[16px] font-medium text-[var(--color-text-secondary)] mb-1.5">
              No transactions found
            </p>
            {hasActiveFilters ? (
              <button
                onClick={clearAllFilters}
                className="text-[14px] text-[var(--color-gold)] hover:underline"
              >
                Clear all filters
              </button>
            ) : (
              <p className="text-[14px] text-[var(--color-text-muted)]">
                Once your accounts sync, every move lands here.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-7">
            {grouped.map((group) => (
              <div key={group.dateStr}>
                {/* Date group label + daily net */}
                <div className="flex items-center justify-between gap-3 mb-2.5 px-0.5">
                  <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-text-muted)] m-0">
                    {formatGroupDate(group.dateStr)}
                  </h3>
                  <span
                    className={`font-mono text-[13px] font-semibold tabular-nums ${
                      group.dailyNet >= 0
                        ? 'text-[var(--color-positive)]'
                        : 'text-[var(--color-negative-text)]'
                    }`}
                  >
                    {group.dailyNet >= 0 ? '+' : ''}
                    {formatCurrencyDetailed(group.dailyNet)}
                  </span>
                </div>

                {/* Ledger card for this date */}
                <div className="sovereign-card rounded-lg overflow-hidden">
                  {group.txs.map((tx) => {
                    const isPositive = tx.amount > 0;
                    const verb = rowVerb(tx.kind);
                    const ticker = (tx as Record<string, unknown>).ticker as string | null | undefined;
                    // posted_date may have time info; date-only fields show dash
                    const hasTime = typeof tx.posted_date === 'string' && tx.posted_date.includes('T');
                    const displayTime = hasTime
                      ? new Date(tx.posted_date as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                      : null;

                    // Sub-meta: institution/account, time, and share detail when present.
                    const metaParts: string[] = [];
                    if (tx.institution_name || tx.account_name) {
                      metaParts.push((tx.institution_name || tx.account_name) as string);
                    }
                    if (tx.is_pending) {
                      metaParts.push('Pending');
                    } else if (displayTime) {
                      metaParts.push(`${displayTime} ET`);
                    }
                    if (tx.quantity != null && tx.price != null) {
                      metaParts.push(`${Math.abs(tx.quantity).toLocaleString()} @ ${formatCurrencyDetailed(tx.price)}`);
                    }

                    const isSync = tx.kind === 'OTHER';

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center gap-3.5 px-4 sm:px-5 py-3.5 border-b border-[var(--color-border-subtle)] last:border-b-0 hover:bg-[var(--color-bg-overlay)] motion-safe:transition-colors cursor-default"
                      >
                        {/* Icon tile */}
                        <KindIcon kind={tx.kind} />

                        {/* Title + sub-meta */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-semibold text-[var(--color-text-primary)] truncate">
                            {verb && <span>{verb} </span>}
                            {ticker ? (
                              <span className="font-mono text-[var(--color-gold)]">{ticker}</span>
                            ) : (
                              <span>{tx.merchant_name || tx.description}</span>
                            )}
                            {ticker && tx.quantity != null && (
                              <span className="text-[var(--color-text-secondary)]">
                                {' '}&middot; {Math.abs(tx.quantity).toLocaleString()} share{Math.abs(tx.quantity) !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {metaParts.length > 0 && (
                            <div className="font-mono text-[13px] text-[var(--color-text-muted)] truncate mt-1 flex items-center gap-1.5">
                              {tx.is_pending && <Clock className="w-3 h-3 flex-shrink-0" />}
                              <span className="truncate">{metaParts.join(' · ')}</span>
                            </div>
                          )}
                        </div>

                        {/* Right-aligned signed amount */}
                        <div className="flex-shrink-0 text-right">
                          {isSync ? (
                            <span className="font-mono text-[14px] text-[var(--color-text-muted)]">&mdash;</span>
                          ) : (
                            <span
                              className={`font-mono text-[15px] font-semibold tabular-nums ${
                                isPositive
                                  ? 'text-[var(--color-positive)]'
                                  : 'text-[var(--color-text-primary)]'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {formatCurrencyDetailed(tx.amount)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* ─── Pagination ─── */}
            {pagination.totalPages > 1 && (
              <nav
                aria-label="Transaction pagination"
                className="flex items-center justify-between pt-2"
              >
                <p className="text-[13px] text-[var(--color-text-muted)] font-mono">
                  Page {pagination.page} of {pagination.totalPages}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    aria-label="Previous page"
                    className="p-2.5 sm:p-2 rounded border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] disabled:opacity-30 disabled:cursor-not-allowed motion-safe:transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
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
                        className={`w-9 h-9 sm:w-8 sm:h-8 rounded text-[14px] font-mono motion-safe:transition-colors ${
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
                    className="p-2.5 sm:p-2 rounded border border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-overlay)] disabled:opacity-30 disabled:cursor-not-allowed motion-safe:transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </nav>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
