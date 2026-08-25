'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { Plus, X, Loader2, Trash2, Link2, ShieldCheck, PenLine } from 'lucide-react';
import { useToast } from '@/contexts/toast-context';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { useAccounts } from '@/hooks/use-financial-data';
import { usePreview } from '@/lib/preview-context';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import type { BackgroundSyncResult } from '@/lib/plaid/background-sync';
import { PlaidUpdateLink } from '@/components/plaid/plaid-update-link';

interface Account {
  id: string;
  institution: string;
  account_type: string;
  balance: number;
  account_name: string;
  sync_status: string;
  last_synced_at?: string;
}

interface HealthItem {
  id: string;
  institution_name: string;
  status: string;
  last_balances_sync: string | null;
  last_transactions_sync: string | null;
  error_code: string | null;
  error_message: string | null;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

// Account-type composition palette (matches the design token chart palette).
const TYPE_PALETTE: { key: string; label: string; color: string; match: (t: string) => boolean }[] = [
  { key: 'brokerage', label: 'Brokerage', color: '#E6B94D', match: (t) => t === 'brokerage' || t === 'investment' },
  { key: 'roth', label: 'Roth IRA', color: '#7AA3C7', match: (t) => t.includes('roth') },
  { key: 'retirement', label: 'Retirement', color: '#9FB89D', match: (t) => t === 'ira' || t.includes('401') || t.includes('retire') },
  { key: 'crypto', label: 'Crypto', color: '#8E7DC7', match: (t) => t.includes('crypto') },
  { key: 'hsa', label: 'HSA', color: '#C8A165', match: (t) => t.includes('hsa') },
  { key: 'cash', label: 'Cash', color: '#5A6070', match: (t) => t === 'depository' || t === 'checking' || t === 'savings' || t === 'cash' },
];

// Brand chip color sets keyed off the institution initial.
const CHIP_COLORS: Record<string, { bg: string; fg: string }> = {
  F: { bg: '#13314F', fg: '#7AB8E8' },
  R: { bg: '#0E3D2E', fg: '#4ADE80' },
  S: { bg: '#3A2A0E', fg: '#E6B94D' },
  V: { bg: '#0B2A4A', fg: '#5B8DEF' },
  C: { bg: '#0A2540', fg: '#3B82F6' },
};
const CHIP_FALLBACK = { bg: 'var(--color-bg-overlay)', fg: 'var(--color-text-secondary)' };

function chipColors(institution: string) {
  const initial = (institution.trim()[0] || '?').toUpperCase();
  return { initial, ...(CHIP_COLORS[initial] ?? CHIP_FALLBACK) };
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString('en-US');
}

type CardSyncState = 'synced' | 'syncing' | 'reconnect';

export default function AccountsPage() {
  const { formatCurrency } = useFormat();
  const { accounts, loading: apiLoading, error, refetch } = useAccounts();
  const { success, error: showError } = useToast();
  const { dataState } = usePreview();

  // Separate assets from liabilities by account type, not just balance sign
  // Plaid stores credit card balances as positive (amount owed)
  const liabilityTypes = ['credit_card', 'loan', 'mortgage'];
  const assetAccounts = accounts.filter((account) =>
    !liabilityTypes.includes(account.account_type) && account.balance >= 0
  );
  const liabilityAccounts = accounts.filter((account) =>
    liabilityTypes.includes(account.account_type) || account.balance < 0
  );
  const totalAssets = assetAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0);
  const totalBalance = totalAssets - totalLiabilities;

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  // The shell's "+ Add account" CTA links here with ?add=1. As a plain link it
  // did nothing when you were already on this page. window.location, not
  // useSearchParams: no Suspense boundary needed, and the param is dropped so
  // a refresh does not reopen the modal.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('add') === '1') {
      setShowAddAccount(true);
      window.history.replaceState(null, '', '/dashboard/accounts');
    }
    // Already here when the CTA is clicked: same-path soft nav never remounts,
    // so the shell dispatches an event instead.
    const open = () => setShowAddAccount(true);
    window.addEventListener('helm:add-account', open);
    return () => window.removeEventListener('helm:add-account', open);
  }, []);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<{
    lastSync: string | null;
    itemCount: number;
    errorCount: number;
    items: HealthItem[];
  }>({ lastSync: null, itemCount: 0, errorCount: 0, items: [] });

  const fetchConnectionHealth = async () => {
    try {
      const res = await fetch('/api/plaid/health');
      if (res.ok) {
        const data = await res.json();
        setConnectionHealth(data);
        setHealthError(false);
      } else {
        setHealthError(true);
      }
    } catch {
      setHealthError(true);
    }
  };

  useEffect(() => {
    fetchConnectionHealth();
  }, [syncing]);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.synced === 0 || data.message === 'No active Plaid connections to sync') {
          showError('No accounts to sync', 'Connect an account first.');
        } else {
          success('Sync complete', 'All accounts have been synchronized');
        }
        refetch?.();
      } else {
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
    success('Account linked', 'Syncing holdings in the background. They show up in a minute or two.');
    setShowAddAccount(false);
    refetch?.();
  };

  const handlePlaidSynced = (result: BackgroundSyncResult) => {
    refetch?.();
    if (result === 'synced') success('Holdings synced', 'Your new account is up to date.');
  };

  const handlePlaidError = (error: string) => {
    showError('Connection failed', error);
  };

  const handleDisconnect = async (itemId: string) => {
    const item = connectionHealth.items.find(i => i.id === itemId);
    const institutionName = item?.institution_name || 'Unknown';
    setDisconnecting(itemId);
    setConfirmDisconnect(null);
    try {
      const res = await fetch(`/api/plaid/items/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        success('Disconnected', `${institutionName} has been removed`);
        refetch?.();
        setConnectionHealth(prev => ({
          ...prev,
          items: prev.items.filter(i => i.id !== itemId),
          itemCount: prev.itemCount - 1,
        }));
      } else {
        showError('Disconnect failed', 'Could not disconnect. Please try again.');
      }
    } catch {
      showError('Disconnect failed', 'An error occurred.');
    } finally {
      setDisconnecting(null);
    }
  };

  const handleReconnectSuccess = () => {
    success('Reconnected', 'Bank connection has been restored');
    refetch?.();
    fetchConnectionHealth();
  };

  const primaryAccountId = useMemo(() => {
    const positive = [...assetAccounts].sort((a, b) => b.balance - a.balance)[0];
    return positive?.id ?? null;
  }, [assetAccounts]);

  const selectedAccount = selectedAccountId
    ? accounts.find((a) => a.id === selectedAccountId) || null
    : null;

  // Map an institution name → its Plaid health item (for reconnect / error state).
  const healthByInstitution = useMemo(() => {
    const map = new Map<string, HealthItem>();
    for (const item of connectionHealth.items) {
      if (item.institution_name) map.set(item.institution_name.toLowerCase(), item);
    }
    return map;
  }, [connectionHealth.items]);

  // Determine the three-state sync badge for an account card.
  function cardState(account: Account): { state: CardSyncState; health?: HealthItem } {
    const health = healthByInstitution.get(account.institution.toLowerCase());
    if (health && (health.status === 'error' || health.status === 'login_required')) {
      return { state: 'reconnect', health };
    }
    if (
      account.sync_status === 'error' ||
      account.sync_status === 'login_required' ||
      account.sync_status === 'reconnect'
    ) {
      return { state: 'reconnect', health };
    }
    if (syncing || account.sync_status === 'syncing' || account.sync_status === 'pending') {
      return { state: 'syncing', health };
    }
    return { state: 'synced', health };
  }

  // Net-worth-by-account-type composition (asset accounts only).
  const composition = useMemo(() => {
    const buckets = TYPE_PALETTE.map((p) => ({ ...p, total: 0 }));
    for (const a of assetAccounts) {
      const t = a.account_type.toLowerCase();
      const bucket = buckets.find((b) => b.match(t)) ?? buckets[buckets.length - 1];
      bucket.total += a.balance;
    }
    const grand = buckets.reduce((s, b) => s + b.total, 0) || 1;
    return buckets
      .filter((b) => b.total > 0)
      .map((b) => ({ ...b, pct: (b.total / grand) * 100 }));
  }, [assetAccounts]);

  const allSynced = connectionHealth.errorCount === 0;
  const lastSyncLabel = connectionHealth.lastSync ? formatTimeAgo(connectionHealth.lastSync) : null;

  if (error) {
    return (
      <div className="px-4 sm:px-7 pt-7 pb-16 max-w-[1600px] mx-auto">
        <div className="rounded-lg border p-6"
          style={{ background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.25)', color: 'var(--color-negative-text)' }}>
          <h2 className="text-[15px] font-semibold mb-2">Error loading accounts</h2>
          <p className="text-[15px]">{error}</p>
        </div>
      </div>
    );
  }

  // ── EMPTY · CONNECT BROKERAGE ──────────────────────────────────────────
  if (dataState === 'empty') {
    return (
      <div className="min-h-full flex items-center justify-center p-10">
        <div className="max-w-[470px] text-center">
          <div
            className="mx-auto mb-[22px] flex items-center justify-center"
            style={{
              width: 60, height: 60, borderRadius: 14,
              background: 'rgba(230,185,77,0.06)', border: '1px solid rgba(230,185,77,0.18)',
            }}
          >
            <Link2 className="w-[26px] h-[26px]" strokeWidth={1.6} style={{ color: 'var(--color-gold)' }} />
          </div>
          <div className="text-[24px] font-bold mb-3" style={{ letterSpacing: '-0.025em' }}>
            Connect your brokerage
          </div>
          <p className="text-[15px] leading-[1.65] mb-6" style={{ color: 'var(--color-text-muted)' }}>
            Link an account and Helm builds your net worth, holdings, taxes and intelligence
            automatically.{' '}
            <span style={{ color: 'var(--color-positive)' }}>Read-only access</span>{' '}
            — Helm can never move money or place trades.
          </p>
          <div className="flex justify-center">
            <PlaidLinkButton onSuccess={handlePlaidSuccess} onSynced={handlePlaidSynced} onError={handlePlaidError} onLinkError={(_code, msg) => handlePlaidError(msg)} />
          </div>
          <p className="mt-4 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
            Nothing to connect yet?{' '}
            <NextLink href="/dashboard/portfolio/add" style={{ color: 'var(--color-gold)' }}>
              Enter positions by hand
            </NextLink>
          </p>
          <div
            className="mt-[18px] text-[10px]"
            style={{ ...MONO, color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}
          >
            12,000+ institutions · 256-bit encryption · via Plaid
          </div>
        </div>
      </div>
    );
  }

  // ── CONNECTED / DEMO ───────────────────────────────────────────────────
  return (
    <div className="px-7 pt-7 pb-16 max-w-[1320px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-6 mb-[22px]">
        <div>
          <div
            className="text-[10px] uppercase mb-2"
            style={{ ...MONO, letterSpacing: '0.2em', color: 'var(--color-text-muted)' }}
          >
            Accounts · {accounts.length} connected · read-only
          </div>
          <div className="flex items-baseline gap-[14px] flex-wrap">
            {apiLoading ? (
              <div
                className="h-[34px] w-[180px] rounded animate-pulse"
                style={{ background: 'var(--color-bg-elevated)' }}
              />
            ) : (
              <span
                className="text-[32px] font-bold tabular-nums"
                style={{ letterSpacing: '-0.025em' }}
              >
                {formatCurrency(totalBalance)}
              </span>
            )}
            {!apiLoading && (
              <span
                className="text-[14px]"
                style={{ ...MONO, color: allSynced ? 'var(--color-positive)' : 'var(--color-warning-text)' }}
              >
                {allSynced ? '● All synced' : '◐ Sync attention needed'}
                {lastSyncLabel ? ` · ${lastSyncLabel}` : ''}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="flex items-center gap-[7px] h-[34px] px-[14px] rounded-md cursor-pointer disabled:opacity-60"
          style={{
            background: 'var(--color-gold)', color: '#0A0A0A',
            ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            boxShadow: '0 4px 16px rgba(230,185,77,0.2)',
          }}
        >
          {syncing ? <Loader2 className="w-[13px] h-[13px] animate-spin" /> : <Plus className="w-[13px] h-[13px]" strokeWidth={2.2} />}
          {syncing ? 'Syncing' : 'Sync all'}
        </button>
      </div>

      {/* Net worth by account type */}
      <div
        className="rounded-lg mb-[14px] px-[22px] py-5"
        style={{
          background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
        }}
      >
        <div className="flex justify-between items-center mb-[14px] gap-3">
          <div className="text-[10px] uppercase" style={{ ...MONO, letterSpacing: '0.14em', color: 'var(--color-text-muted)' }}>
            Net worth by account type
          </div>
          <div className="text-[10px] hidden sm:block" style={{ ...MONO, color: 'var(--color-text-muted)' }}>
            {composition.map((c) => `${c.label} ${Math.round(c.pct)}%`).join(' · ')}
          </div>
        </div>
        {apiLoading ? (
          <div className="h-3 w-full rounded animate-pulse mb-4" style={{ background: 'var(--color-bg-elevated)' }} />
        ) : composition.length === 0 ? (
          <div className="text-[14px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
            No assets connected yet.
          </div>
        ) : (
          <>
            <div className="flex w-full overflow-hidden mb-4" style={{ height: 12, borderRadius: 3 }}>
              {composition.map((c) => (
                <div key={c.key} style={{ width: `${c.pct}%`, background: c.color }} />
              ))}
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              {composition.map((c) => (
                <div key={c.key}>
                  <div className="flex items-center gap-[7px] mb-[5px]">
                    <span style={{ width: 8, height: 8, borderRadius: 1, background: c.color }} />
                    <span className="text-[9px] uppercase" style={{ ...MONO, letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
                      {c.label}
                    </span>
                  </div>
                  <div className="text-[15px] font-bold tabular-nums">{formatCurrency(c.total)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Account cards */}
      <div className="grid gap-[14px] mb-[14px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {apiLoading ? (
          [0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg animate-pulse"
              style={{ minHeight: 160, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
            />
          ))
        ) : (
          <>
            {accounts.map((account) => {
              const { state, health } = cardState(account);
              const chip = chipColors(account.institution);
              const dimmed = state === 'reconnect';
              const typeLabel = account.account_type.replace(/_/g, ' ');

              return (
                <div
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id)}
                  className="rounded-lg px-5 py-[18px] cursor-pointer sovereign-card"
                  style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
                >
                  {/* Brand chip + name + type + badge */}
                  <div className="flex items-center gap-[11px] mb-4">
                    <span
                      className="flex items-center justify-center shrink-0"
                      style={{
                        width: 34, height: 34, borderRadius: 7, background: chip.bg, color: chip.fg,
                        ...MONO, fontSize: 14, fontWeight: 700,
                      }}
                    >
                      {chip.initial}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold truncate">{account.institution}</div>
                      <div className="text-[9px] uppercase truncate" style={{ ...MONO, letterSpacing: '0.1em', color: 'var(--color-text-muted)' }}>
                        {typeLabel}
                      </div>
                    </div>
                    <SyncBadge state={state} />
                  </div>

                  {/* Balance */}
                  <div
                    className="text-[24px] font-bold tabular-nums mb-1"
                    style={{ letterSpacing: '-0.02em', color: dimmed ? 'var(--color-text-muted)' : undefined }}
                  >
                    {formatCurrency(Math.abs(account.balance))}
                    {account.balance < 0 && <span className="text-[14px] ml-2" style={{ ...MONO }}>due</span>}
                  </div>

                  {/* Sub-line: last sync / stale */}
                  <div
                    className="text-[12px] mb-[14px]"
                    style={{ ...MONO, color: dimmed ? 'var(--color-text-muted)' : 'var(--color-text-muted)' }}
                  >
                    {dimmed
                      ? `Last synced ${account.last_synced_at ? formatTimeAgo(account.last_synced_at) : 'a while ago'} · stale`
                      : account.account_name}
                  </div>

                  {/* Allocation bar (presentational accent, dimmed when stale) */}
                  <div
                    className="flex w-full overflow-hidden mb-2"
                    style={{ height: 5, borderRadius: 2, opacity: dimmed ? 0.4 : 1 }}
                  >
                    <div style={{ width: '58%', background: chip.fg }} />
                    <div style={{ width: '22%', background: '#7AA3C7' }} />
                    <div style={{ width: '20%', background: '#5A6070' }} />
                  </div>

                  {/* Footer: synced → last sync; reconnect → expired + button */}
                  {state === 'reconnect' ? (
                    <div className="flex items-center justify-between gap-[10px]" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px]" style={{ ...MONO, color: 'var(--color-negative-text)' }}>
                        Connection expired
                      </span>
                      {health?.id ? (
                        <PlaidUpdateLink
                          itemId={health.id}
                          institutionName={account.institution}
                          onSuccess={handleReconnectSuccess}
                          onError={(err) => showError('Reconnect failed', err)}
                        />
                      ) : (
                        <button
                          onClick={handleSyncAll}
                          className="cursor-pointer"
                          style={{
                            padding: '5px 11px', background: 'rgba(248,113,113,0.1)',
                            border: '1px solid rgba(248,113,113,0.25)', borderRadius: 5,
                            color: 'var(--color-negative-text)', ...MONO, fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                          }}
                        >
                          Reconnect
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px]" style={{ ...MONO, color: 'var(--color-text-muted)' }}>
                      {typeLabel} · last sync{' '}
                      {account.last_synced_at ? formatTimeAgo(account.last_synced_at) : 'pending'}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Connect another */}
            <ConnectAnotherTile onClick={() => setShowAddAccount(true)} />
            <EnterByHandTile />
          </>
        )}
      </div>

      {healthError && (
        <div
          className="rounded-lg mb-[14px] px-5 py-3 flex items-center gap-2 text-[14px]"
          style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: 'var(--color-negative-text)' }}
        >
          <span>Could not load connection health.</span>
          <button onClick={fetchConnectionHealth} className="underline hover:no-underline ml-auto">Retry</button>
        </div>
      )}

      {/* Security strip */}
      <div
        className="rounded-lg flex items-center gap-4 flex-wrap px-5 py-4"
        style={{ background: '#0C0C0C', border: '1px solid var(--color-border-subtle)', ...MONO }}
      >
        <ShieldCheck className="w-[18px] h-[18px] shrink-0" strokeWidth={1.6} style={{ color: 'var(--color-positive)' }} />
        <span className="text-[14px]" style={{ color: 'var(--color-text-secondary)' }}>
          <span style={{ color: 'var(--color-positive)' }}>Read-only access</span>
          {' '}— Helm cannot move money or execute trades.
        </span>
        <span className="hidden md:block" style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />
        <span className="text-[14px]" style={{ color: 'var(--color-text-muted)' }}>
          256-bit encryption · Connected via Plaid — same provider as Venmo and Robinhood.
        </span>
      </div>

      {/* Account detail drawer */}
      {selectedAccount && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setSelectedAccountId(null)}
            aria-hidden="true"
          />
          <div role="dialog" aria-modal="true" aria-labelledby="account-detail-heading" className="w-full max-w-md bg-[var(--color-bg-surface)] border-l border-[var(--color-border-base)] shadow-2xl animate-slide-in-bottom">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--color-border-base)]">
              <div>
                <p className="type-caption text-[var(--color-text-secondary)] mb-1">Account details</p>
                <h2 id="account-detail-heading" className="type-h2">{selectedAccount.institution}</h2>
                <p className="text-[13px] text-[var(--color-text-secondary)] capitalize">
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
            <div className="px-4 sm:px-6 py-4 space-y-4">
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
                <p className="text-[13px] text-[var(--color-text-muted)]">View full transaction history on the Transactions page.</p>
              </div>
              {(() => {
                const health = healthByInstitution.get(selectedAccount.institution.toLowerCase());
                if (!health?.id) return null;
                return (
                  <div className="pt-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-2">
                    <span className="type-label text-[var(--color-text-secondary)]">Connection</span>
                    <button
                      onClick={() => setConfirmDisconnect(health.id)}
                      disabled={disconnecting === health.id}
                      className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-negative-text)] transition-colors"
                    >
                      {disconnecting === health.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Disconnect
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setConfirmDisconnect(null)}
            aria-hidden="true"
          />
          <div role="dialog" aria-modal="true" aria-labelledby="disconnect-heading" className="relative w-[calc(100%-2rem)] max-w-sm bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl shadow-2xl animate-scale-in p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--color-negative)]/10 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-[var(--color-negative)]" />
              </div>
              <div>
                <h3 id="disconnect-heading" className="type-h3">Disconnect this institution?</h3>
                <p className="text-[15px] text-[var(--color-text-secondary)]">
                  {connectionHealth.items.find(i => i.id === confirmDisconnect)?.institution_name || 'This institution'}
                </p>
              </div>
            </div>
            <p className="text-[15px] text-[var(--color-text-secondary)]">
              This will remove all associated accounts, transactions, and holdings. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDisconnect(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[var(--color-negative)] hover:bg-[var(--color-negative)]/90 text-white"
                onClick={() => handleDisconnect(confirmDisconnect)}
              >
                Disconnect
              </Button>
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
            aria-hidden="true"
          />
          <div role="dialog" aria-modal="true" aria-labelledby="add-account-heading" className="relative w-[calc(100%-2rem)] max-w-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[var(--color-border-base)]">
              <div>
                <h2 id="add-account-heading" className="type-h2">Connect Account</h2>
                <p className="text-[15px] text-[var(--color-text-secondary)]">Link a new financial account</p>
              </div>
              <button
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-md hover:bg-[var(--color-bg-overlay)] transition-colors"
                onClick={() => setShowAddAccount(false)}
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 sm:px-6 py-6 space-y-6">
              <p className="text-[15px] text-[var(--color-text-secondary)]">
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
                      <span className="text-[15px] text-[var(--color-text-primary)]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg">
                <p className="text-[15px] text-[var(--color-text-secondary)]">
                  Your credentials are encrypted end-to-end by Plaid and never touch our servers.
                </p>
              </div>

              <p className="text-[14px] text-[var(--color-text-secondary)]">
                Prefer not to connect?{' '}
                <NextLink
                  href="/dashboard/portfolio/add"
                  className="text-[var(--color-gold)] hover:underline"
                  onClick={() => setShowAddAccount(false)}
                >
                  Enter positions by hand
                </NextLink>
                . Ticker, shares, cost basis. No sync.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAddAccount(false)}
                >
                  Cancel
                </Button>
                <PlaidLinkButton
                  key={showAddAccount ? 'open' : 'closed'}
                  className="flex-1"
                  onSuccess={handlePlaidSuccess}
                  onSynced={handlePlaidSynced}
                  onError={handlePlaidError}
                  onLinkError={(_code, msg) => handlePlaidError(msg)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Connect-another dashed tile (hover-driven) ───────────────────────────
function ConnectAnotherTile({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="rounded-lg cursor-pointer flex flex-col items-center justify-center gap-[10px]"
      style={{
        border: `1px dashed ${hover ? 'rgba(230,185,77,0.35)' : 'rgba(255,255,255,0.12)'}`,
        background: 'transparent', padding: '18px 20px', minHeight: 160,
        color: hover ? 'var(--color-gold)' : 'var(--color-text-muted)',
        transition: 'border-color 200ms var(--ease-out-expo), color 200ms var(--ease-out-expo)',
      }}
    >
      <Plus className="w-[22px] h-[22px]" strokeWidth={1.6} />
      <span className="text-[10px] uppercase" style={{ ...MONO, letterSpacing: '0.12em' }}>
        Connect another
      </span>
      <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
        12,000+ institutions supported
      </span>
    </button>
  );
}

function EnterByHandTile() {
  const [hover, setHover] = useState(false);
  return (
    <NextLink
      href="/dashboard/portfolio/add"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="rounded-lg cursor-pointer flex flex-col items-center justify-center gap-[10px] no-underline"
      style={{
        border: `1px dashed ${hover ? 'rgba(230,185,77,0.35)' : 'rgba(255,255,255,0.12)'}`,
        background: 'transparent', padding: '18px 20px', minHeight: 160,
        color: hover ? 'var(--color-gold)' : 'var(--color-text-muted)',
        transition: 'border-color 200ms var(--ease-out-expo), color 200ms var(--ease-out-expo)',
      }}
    >
      <PenLine className="w-[22px] h-[22px]" strokeWidth={1.6} />
      <span className="text-[10px] uppercase" style={{ ...MONO, letterSpacing: '0.12em' }}>
        Enter by hand
      </span>
      <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
        No connection needed
      </span>
    </NextLink>
  );
}

// ── Sync badge (three states) ────────────────────────────────────────────
function SyncBadge({ state }: { state: CardSyncState }) {
  const meta = {
    synced: { label: '● Synced', color: 'var(--color-positive)', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)' },
    syncing: { label: '◐ Syncing', color: 'var(--color-warning-text)', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)' },
    reconnect: { label: '⚠ Reconnect', color: 'var(--color-negative-text)', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
  }[state];

  return (
    <span
      className="uppercase shrink-0"
      style={{
        ...MONO, fontSize: 8, letterSpacing: '0.1em', padding: '3px 6px',
        background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 3, color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}
