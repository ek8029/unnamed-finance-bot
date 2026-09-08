'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import NextLink from 'next/link';
import { Plus, X, Loader2, Trash2, RefreshCw, ShieldCheck, PenLine } from 'lucide-react';
import { useToast } from '@/contexts/toast-context';
import { Button } from '@/components/ui/button';
import { useFormat } from '@/hooks/use-format';
import { useAccounts } from '@/hooks/use-financial-data';
import { usePreview } from '@/lib/preview-context';
import { requestConnectionSync } from '@/lib/plaid/sync-client';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import type { BackgroundSyncResult } from '@/lib/plaid/background-sync';
import { PlaidUpdateLink } from '@/components/plaid/plaid-update-link';
import { isLiabilityType } from '@/lib/account-balance';
import { accountBalanceDisplay, accountConnectionState, summarizeAccountBalances, type AccountConnectionState } from '@/lib/accounts-presentation';

interface Account {
  id: string;
  institution: string;
  account_type: string;
  balance: number | null;
  account_name: string;
  sync_status: string;
  last_synced_at?: string;
  source?: string;
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
  { key: 'other', label: 'Other assets', color: '#ACB2BC', match: () => true },
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
  if (!Number.isFinite(seconds) || seconds < 0) return 'Not available';
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString('en-US');
}

export default function AccountsPage() {
  const { formatCurrency } = useFormat();
  const { accounts, loading: apiLoading, error, refetch } = useAccounts();
  const { success, error: showError } = useToast();
  const { dataState } = usePreview();

  const totals = summarizeAccountBalances(accounts);
  const assetAccounts = accounts.filter((account): account is Account & { balance: number } =>
    !isLiabilityType(account.account_type) && account.balance != null && account.balance > 0
  );

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
  const [healthLoading, setHealthLoading] = useState(true);
  const [connectionHealth, setConnectionHealth] = useState<{
    lastSync: string | null;
    itemCount: number;
    errorCount: number;
    items: HealthItem[];
  }>({ lastSync: null, itemCount: 0, errorCount: 0, items: [] });

  const fetchConnectionHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/plaid/health');
      if (res.ok) {
        const data = await res.json();
        if (!Array.isArray(data?.items)) throw new Error('Invalid connection status response');
        setConnectionHealth(data);
        setHealthError(false);
      } else {
        setHealthError(true);
      }
    } catch {
      setHealthError(true);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectionHealth();
  }, [syncing]);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await requestConnectionSync();
      if (result.synced > 0) refetch?.();
      if (result.status === 'synced') success('Sync complete', result.message);
      else showError(result.status === 'partial' ? 'Refresh partially complete' : 'Sync incomplete', result.message);
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

  function cardState(account: Account) {
    const health = account.source === 'manual' ? undefined : healthByInstitution.get(account.institution.toLowerCase());
    return { state: accountConnectionState(account, health?.status, { loading: healthLoading, error: healthError, syncing }), health };
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

  const manualCount = accounts.filter((account) => account.source === 'manual').length;
  const noPlaidConnections = !healthLoading && !healthError && connectionHealth.items.length === 0;
  const hasSavedBankAccounts = accounts.some((account) => account.source !== 'manual');
  const activeConnections = connectionHealth.items.filter((item) => item.status === 'active').length;
  const connectionLabel = healthLoading ? 'Checking connections…'
    : healthError ? 'Connection status unavailable'
    : connectionHealth.errorCount > 0 ? `${connectionHealth.errorCount} connection${connectionHealth.errorCount === 1 ? '' : 's'} need attention`
    : activeConnections > 0 ? `${activeConnections} active connection${activeConnections === 1 ? '' : 's'}`
    : noPlaidConnections && hasSavedBankAccounts ? 'Saved accounts · no active connection'
    : 'No linked bank connections';

  if (error) {
    return (
      <div className="px-4 sm:px-7 pt-7 pb-16 max-w-[1600px] mx-auto">
        <div className="rounded-lg border p-6"
          style={{ background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.25)', color: 'var(--color-negative-text)' }}>
          <h2 className="text-[15px] font-semibold mb-2">Error loading accounts</h2>
          <p className="text-[15px]">{error}</p>
          <button type="button" onClick={refetch} disabled={apiLoading} className="mt-4 text-sm underline disabled:opacity-50">{apiLoading ? 'Loading accounts…' : 'Retry accounts'}</button>
        </div>
      </div>
    );
  }

  // Activation offers both paths before an empty dashboard can become a dead end.
  if (dataState === 'empty' || (!apiLoading && accounts.length === 0)) {
    return <div className="px-5 sm:px-7 py-10 max-w-[1100px] mx-auto">
      <header className="helm-overview-heading"><div><span className="helm-label">BUILD YOUR PICTURE</span><h1>Bring your portfolio into focus.</h1><p>Connect for automatic updates, or start with a position you enter yourself.</p></div></header>
      <div className="helm-activation-panel">
        <article><span className="helm-label">AUTOMATIC SYNC</span><h2>Connect a brokerage.</h2><p>Bring your balances, holdings and available cost basis into one view. Your money stays at your brokerage.</p><PlaidLinkButton className="helm-button" onSuccess={handlePlaidSuccess} onSynced={handlePlaidSynced} onError={handlePlaidError} onLinkError={(_code, msg) => handlePlaidError(msg)}>Connect with Plaid</PlaidLinkButton></article>
        <article><span className="helm-label">NO CONNECTION NEEDED</span><h2>Start with one position.</h2><p>Enter a ticker and shares, or import a screenshot or CSV. Add more whenever you are ready.</p><NextLink href="/dashboard/portfolio/add" className="helm-button helm-button-outline">Add your positions</NextLink></article>
      </div>
      <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">Read-only access. Helm cannot place trades or move money. You can disconnect an account at any time.</p>
    </div>;
  }

  // ── CONNECTED / DEMO ───────────────────────────────────────────────────
  return (
    <div className="px-4 sm:px-7 pt-7 pb-16 max-w-[1320px] mx-auto">
      <header className="helm-overview-heading"><div><span className="helm-label">THE FOUNDATION OF YOUR PORTFOLIO</span><h1>Accounts and connections.</h1><p>See what you own, what you owe, and where each balance comes from.</p></div><NextLink href="/dashboard/portfolio/add" className="helm-text-link">Add manual positions ↗</NextLink></header>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-[22px]">
        <div>
          <div
            className="text-[10px] uppercase mb-2"
            style={{ ...MONO, letterSpacing: '0.2em', color: 'var(--color-text-muted)' }}
          >
            {totals.unavailable > 0 ? 'Known account balances' : 'Net account balance'} · {accounts.length} account{accounts.length === 1 ? '' : 's'}
            {manualCount > 0 ? ` · ${manualCount} manual` : ''}
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
                {totals.unavailable === accounts.length ? 'Balance unavailable' : formatCurrency(totals.net)}
              </span>
            )}
            {!apiLoading && (
              <span
                className="text-[12px]"
                style={{ color: connectionHealth.errorCount > 0 || healthError ? 'var(--color-warning-text)' : 'var(--color-text-secondary)' }}
              >
                {connectionLabel}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={healthError ? fetchConnectionHealth : handleSyncAll}
          disabled={syncing || apiLoading || healthLoading || (!healthError && connectionHealth.items.length === 0)}
          className="flex items-center gap-[7px] h-10 px-[14px] rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold)]"
          style={{
            background: 'var(--color-gold)', color: '#0A0A0A',
            ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            boxShadow: '0 4px 16px rgba(230,185,77,0.2)',
          }}
        >
          {syncing ? <Loader2 className="w-[13px] h-[13px] animate-spin" /> : <RefreshCw className="w-[13px] h-[13px]" strokeWidth={2.2} />}
          {syncing ? 'Refreshing' : healthError ? 'Retry connection status' : 'Refresh connections'}
        </button>
      </div>

      <p className="mb-4 text-[12px] text-[var(--color-text-secondary)]">Reported account balances, less debt. Portfolio totals use holding prices and can differ.
        {totals.unavailable > 0 && ` ${totals.unavailable} account${totals.unavailable === 1 ? ' has' : 's have'} no reported balance and ${totals.unavailable === 1 ? 'is' : 'are'} excluded from this total.`}
      </p>
      {healthError && <p role="status" className="mb-4 text-[13px] text-[var(--color-warning-text)]">We couldn’t check your connections. Retry the status check above.</p>}
      {noPlaidConnections && hasSavedBankAccounts && <p role="status" className="mb-4 text-[13px] text-[var(--color-text-secondary)]">Your saved account balances are still shown here, but no bank connection is available to refresh them. Connect an account to bring in updated balances.</p>}
      {!apiLoading && totals.unavailable < accounts.length && <div className="flex flex-wrap gap-x-8 gap-y-3 mb-6 text-[13px] text-[var(--color-text-secondary)]">
        <span>Assets <strong className="block mt-1 text-[17px] tabular-nums text-[var(--color-text-primary)]">{formatCurrency(totals.assets)}</strong></span>
        <span>Amount owed <strong className="block mt-1 text-[17px] tabular-nums text-[var(--color-text-primary)]">{formatCurrency(totals.owed)}</strong></span>
        {totals.credits > 0 && <span>Account credits <strong className="block mt-1 text-[17px] tabular-nums text-[var(--color-text-primary)]">{formatCurrency(totals.credits)}</strong></span>}
        {totals.overdrafts > 0 && <span>Overdrawn balances <strong className="block mt-1 text-[17px] tabular-nums text-[var(--color-negative-text)]">{formatCurrency(totals.overdrafts)}</strong></span>}
      </div>}

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
            Assets by account type
          </div>
          <div className="text-[10px] hidden sm:block" style={{ ...MONO, color: 'var(--color-text-muted)' }}>
            {composition.map((c) => `${c.label} ${Math.round(c.pct)}%`).join(' · ')}
          </div>
        </div>
        {apiLoading ? (
          <div className="h-3 w-full rounded animate-pulse mb-4" style={{ background: 'var(--color-bg-elevated)' }} />
        ) : composition.length === 0 ? (
          <div className="text-[14px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
            No positive asset balances to show.
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
      <div className="grid gap-[14px] mb-[14px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}>
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
              const typeLabel = account.account_type.replace(/_/g, ' ');
              const balance = accountBalanceDisplay(account);
              const lastBalanceSync = health?.last_balances_sync || account.last_synced_at;

              return (
                <article
                  key={account.id}
                  className="rounded-lg min-w-0 overflow-hidden sovereign-card"
                  style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-base)' }}
                >
                  <div className="min-w-0 px-5 pt-[18px] pb-4">
                  {/* Brand chip + name + type + badge */}
                  <div className="flex flex-wrap items-center gap-[11px] mb-4">
                    <span
                      className="flex items-center justify-center shrink-0"
                      style={{
                        width: 34, height: 34, borderRadius: 7, background: chip.bg, color: chip.fg,
                        ...MONO, fontSize: 14, fontWeight: 700,
                      }}
                    >
                      {chip.initial}
                    </span>
                    <div className="flex-1 min-w-[100px]">
                      <div className="text-[15px] font-semibold truncate">{account.institution}</div>
                      <div className="text-[9px] uppercase truncate" style={{ ...MONO, letterSpacing: '0.1em', color: 'var(--color-text-muted)' }}>
                        {typeLabel}
                      </div>
                    </div>
                    <SyncBadge state={state} noActiveConnection={noPlaidConnections} />
                  </div>

                  {/* Balance */}
                  <div
                    className="text-[24px] font-bold tabular-nums mb-1 break-words"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    {balance.amount == null ? 'Balance unavailable' : formatCurrency(balance.amount)}
                    {balance.suffix && <span className="text-[12px] ml-2 font-normal text-[var(--color-text-secondary)]">{balance.suffix}</span>}
                  </div>

                  {/* Source account name and the actual balance timestamp. */}
                  <div
                    className="text-[13px] mb-4 truncate"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {account.account_name}
                  </div>
                  <div className="pt-3 border-t border-[var(--color-border-subtle)] text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                    {balance.amount == null ? 'Waiting for a reported balance'
                      : state === 'manual' ? 'Entered by you · no automatic sync'
                      : lastBalanceSync ? `Balance last reported ${formatTimeAgo(lastBalanceSync)}`
                      : 'Balance update time unavailable'}
                  </div>
                  <button type="button" onClick={() => setSelectedAccountId(account.id)}
                    aria-label={`View ${account.institution} ${account.account_name} account details`}
                    className="mt-3 text-[12px] text-[var(--color-gold)] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-gold)]">View details</button>
                  </div>

                  {/* Connection recovery stays separate from the detail button. */}
                  {state === 'attention' && (
                    <div className="flex flex-wrap items-center justify-between gap-[10px] px-5 pb-4">
                      <span className="text-[10px]" style={{ ...MONO, color: 'var(--color-negative-text)' }}>
                        Connection needs attention
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
                          disabled={syncing}
                          className="cursor-pointer disabled:opacity-50"
                          style={{
                            padding: '5px 11px', background: 'rgba(248,113,113,0.1)',
                            border: '1px solid rgba(248,113,113,0.25)', borderRadius: 5,
                            color: 'var(--color-negative-text)', ...MONO, fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                          }}
                        >
                          Retry refresh
                        </button>
                      )}
                    </div>
                  )}
                </article>
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
          <AccountDialog titleId="account-detail-heading" onClose={() => setSelectedAccountId(null)} className="w-full max-w-md overflow-y-auto bg-[var(--color-bg-surface)] border-l border-[var(--color-border-base)] shadow-2xl animate-slide-in-bottom">
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
                    selectedAccount.balance != null && selectedAccount.balance < 0 && !isLiabilityType(selectedAccount.account_type) ? 'text-[var(--color-negative)]' : 'text-[var(--color-text-primary)]'
                  }`}
                >
                  {selectedAccount.balance == null ? 'Balance unavailable' : formatCurrency(accountBalanceDisplay(selectedAccount).amount!)}
                  {accountBalanceDisplay(selectedAccount).suffix && <span className="ml-2 text-[12px] font-normal">{accountBalanceDisplay(selectedAccount).suffix}</span>}
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
                <NextLink href="/dashboard/transactions" className="text-[13px] text-[var(--color-gold)] hover:underline">View transaction history ↗</NextLink>
              </div>
              {(() => {
                const health = selectedAccount.source === 'manual' ? undefined : healthByInstitution.get(selectedAccount.institution.toLowerCase());
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
          </AccountDialog>
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
          <AccountDialog titleId="disconnect-heading" onClose={() => setConfirmDisconnect(null)} className="relative w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl shadow-2xl animate-scale-in p-6 space-y-4">
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
          </AccountDialog>
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
          <AccountDialog titleId="add-account-heading" onClose={() => setShowAddAccount(false)} className="relative w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl shadow-2xl animate-scale-in">
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
          </AccountDialog>
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

function SyncBadge({ state, noActiveConnection = false }: { state: AccountConnectionState; noActiveConnection?: boolean }) {
  const meta = {
    connected: { label: 'Connected', color: 'var(--color-positive)', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.2)' },
    manual: { label: 'Manual', color: 'var(--color-text-secondary)', bg: 'var(--color-bg-overlay)', border: 'var(--color-border-base)' },
    checking: { label: 'Checking', color: 'var(--color-text-secondary)', bg: 'var(--color-bg-overlay)', border: 'var(--color-border-base)' },
    unavailable: { label: 'Status unavailable', color: 'var(--color-text-secondary)', bg: 'var(--color-bg-overlay)', border: 'var(--color-border-base)' },
    unknown: { label: noActiveConnection ? 'No active connection' : 'Connection unverified', color: 'var(--color-text-secondary)', bg: 'var(--color-bg-overlay)', border: 'var(--color-border-base)' },
    syncing: { label: '◐ Syncing', color: 'var(--color-warning-text)', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.22)' },
    attention: { label: 'Needs attention', color: 'var(--color-negative-text)', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
  }[state];

  return (
    <span
      className="uppercase shrink-0"
      style={{
        ...MONO, fontSize: 9, letterSpacing: '0.05em', padding: '4px 7px',
        background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 3, color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}

// Keep the custom drawer compatible with Plaid's external dialog while giving
// keyboard users an entry point, contained tab order, Escape, and focus return.
function AccountDialog({ titleId, onClose, className, children }: { titleId: string; onClose: () => void; className: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className={className} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? []).filter((control) => control.getClientRects().length > 0);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>{children}</div>;
}
