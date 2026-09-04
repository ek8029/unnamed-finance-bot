'use client';

/**
 * Edit or remove positions you typed in.
 *
 * The manual endpoint only ever appended, so a typo was permanent and a
 * correction produced a second lot. Settings has linked here under the words
 * "Add or edit" the whole time, and only the first half was true. A user wrote
 * in on 2026-09-02 asking how to do the second half.
 *
 * Only manual rows are reachable: the API scopes every write to the caller's own
 * manual account, so a Plaid position cannot be edited here even by id.
 */

import { useEffect, useState, useCallback } from 'react';
import { Trash2, Check, X, Pencil, Loader2 } from 'lucide-react';

interface ManualHolding {
  id: string;
  ticker: string;
  shares: number;
  costBasis: number | null;
  currentPrice: number;
  totalValue: number;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

export function ManualHoldingsEditor({ onChange }: { onChange?: () => void }) {
  const [holdings, setHoldings] = useState<ManualHolding[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [shares, setShares] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/portfolio/manual')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { holdings?: ManualHolding[] } | null) => setHoldings(j?.holdings ?? []))
      .catch(() => setHoldings([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (h: ManualHolding) => {
    setEditing(h.id);
    setShares(String(h.shares));
    setCost(h.costBasis != null ? String(h.costBasis) : '');
    setError(null);
  };

  const save = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch('/api/portfolio/manual', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, shares, costBasis: cost === '' ? null : cost }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not save that change');
      setEditing(null);
      load();
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that change');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (h: ManualHolding) => {
    setBusy(h.id);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/manual?id=${encodeURIComponent(h.id)}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not remove that position');
      load();
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that position');
    } finally {
      setBusy(null);
    }
  };

  // Loading shows a shell, never an empty state: an empty state here reads as
  // "your positions are gone".
  if (holdings === null) {
    return (
      <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-4">
        <div className="h-4 w-40 rounded bg-[var(--color-bg-inset)] animate-pulse" />
      </div>
    );
  }
  if (holdings.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] overflow-hidden mb-7">
      <div className="px-4 py-3 border-b border-[var(--color-border-base)] flex items-center justify-between">
        <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Positions you typed in</p>
        <span className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>
          {holdings.length} position{holdings.length === 1 ? '' : 's'}
        </span>
      </div>

      {error && (
        <p className="px-4 py-2 text-[13px] text-[var(--color-negative)] border-b border-[var(--color-border-base)]">{error}</p>
      )}

      <ul className="divide-y divide-[var(--color-border-base)]">
        {holdings.map((h) => (
          <li key={h.id} className="px-4 py-3">
            {editing === h.id ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[15px] font-semibold text-[var(--color-text-primary)] w-16" style={MONO}>{h.ticker}</span>
                <label className="text-[12px] text-[var(--color-text-muted)]">
                  Shares
                  <input
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    inputMode="decimal"
                    className="ml-2 w-24 px-2 py-1.5 rounded border border-[var(--color-border-base)] bg-[var(--color-bg-inset)] text-[14px] text-[var(--color-text-primary)]"
                  />
                </label>
                <label className="text-[12px] text-[var(--color-text-muted)]">
                  Cost basis
                  <input
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    inputMode="decimal"
                    placeholder="optional"
                    className="ml-2 w-28 px-2 py-1.5 rounded border border-[var(--color-border-base)] bg-[var(--color-bg-inset)] text-[14px] text-[var(--color-text-primary)]"
                  />
                </label>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => save(h.id)}
                    disabled={busy === h.id}
                    aria-label={`Save ${h.ticker}`}
                    className="p-2 rounded hover:bg-[var(--color-bg-inset)] text-[var(--color-positive)] disabled:opacity-50 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    {busy === h.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setEditing(null); setError(null); }}
                    aria-label="Cancel"
                    className="p-2 rounded hover:bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-[15px] font-semibold text-[var(--color-text-primary)] w-16" style={MONO}>{h.ticker}</span>
                <span className="text-[14px] text-[var(--color-text-secondary)]" style={MONO}>
                  {h.shares} sh
                  {h.costBasis != null ? ` · $${h.costBasis.toLocaleString('en-US')} cost` : ''}
                </span>
                <span className="text-[14px] text-[var(--color-text-muted)] ml-auto" style={MONO}>
                  ${Math.round(h.totalValue).toLocaleString('en-US')}
                </span>
                <button
                  onClick={() => startEdit(h)}
                  aria-label={`Edit ${h.ticker}`}
                  className="p-2 rounded hover:bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove(h)}
                  disabled={busy === h.id}
                  aria-label={`Remove ${h.ticker}`}
                  className="p-2 rounded hover:bg-[var(--color-bg-inset)] text-[var(--color-text-muted)] hover:text-[var(--color-negative)] disabled:opacity-50 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                >
                  {busy === h.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="px-4 py-3 text-[13px] text-[var(--color-text-muted)] border-t border-[var(--color-border-base)]">
        Editing a position here changes only what you entered by hand. Positions synced from a
        brokerage are managed by that connection.
      </p>
    </div>
  );
}
