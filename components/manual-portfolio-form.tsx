'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2, Loader2, Check } from 'lucide-react';

interface HoldingRow {
  id: string;
  ticker: string;
  shares: string;
  costBasis: string;
}

interface ManualPortfolioFormProps {
  onComplete?: () => void;
  compact?: boolean;
}

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

// Sovereign Architect input treatment: inset background, calm border, gold focus.
const FIELD_CLASS =
  'h-[44px] px-3 bg-[var(--color-bg-inset)] border border-[var(--color-border-base)] rounded-[5px] text-[15px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors';

const FIELD_LABEL_CLASS =
  'block text-[9px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-2';

function createEmptyRow(): HoldingRow {
  return { id: crypto.randomUUID(), ticker: '', shares: '', costBasis: '' };
}

export function ManualPortfolioForm({ onComplete, compact = false }: ManualPortfolioFormProps) {
  const [rows, setRows] = useState<HoldingRow[]>([
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);


  const updateRow = useCallback((id: string, field: keyof HoldingRow, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: field === 'ticker' ? value.toUpperCase() : value } : r));
  }, []);

  const addRow = useCallback(() => {
    if (rows.length >= 50) return;
    setRows(prev => [...prev, createEmptyRow()]);
  }, [rows.length]);

  const removeRow = useCallback((id: string) => {
    setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== id));
  }, []);

  const clearRows = useCallback(() => {
    setError(null);
    setRows([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    const validRows = rows.filter(r => r.ticker.trim() && r.shares.trim());

    if (validRows.length === 0) {
      setError('Add at least one holding');
      return;
    }

    for (const r of validRows) {
      if (!/^[A-Z]{1,5}(\.[A-Z])?$/.test(r.ticker.trim())) {
        setError(`Invalid ticker: ${r.ticker}`);
        return;
      }
      const shares = parseFloat(r.shares);
      if (isNaN(shares) || shares <= 0) {
        setError(`Invalid shares for ${r.ticker}`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/portfolio/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdings: validRows.map(r => ({
            ticker: r.ticker.trim(),
            shares: parseFloat(r.shares),
            costBasis: r.costBasis ? parseFloat(r.costBasis) : undefined,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return;
      }

      if (data.failed?.length > 0) {
        setError(`Could not find: ${data.failed.map((f: { ticker: string }) => f.ticker).join(', ')}`);
      }

      if (data.added > 0) {
        setSuccess(true);
        setTimeout(() => {
          onComplete?.();
        }, 1500);
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${compact ? 'py-6' : 'py-12'}`}>
        <div className="w-10 h-10 rounded-full bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.2)] flex items-center justify-center">
          <Check className="w-5 h-5 text-[var(--color-positive)]" />
        </div>
        <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Portfolio saved</p>
        <p className="text-[12px] text-[var(--color-text-muted)]" style={MONO}>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className={compact ? '' : ''}>
      <div className="sovereign-card rounded-lg p-6">
        <div className="space-y-3">
          {/* Header row */}
          <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: '1fr 90px 110px 40px' }}>
            <span className={FIELD_LABEL_CLASS} style={MONO}>Symbol / asset</span>
            <span className={FIELD_LABEL_CLASS} style={MONO}>Shares</span>
            <span className={FIELD_LABEL_CLASS} style={MONO}>
              Cost basis
              <span className="opacity-50 ml-1">opt</span>
            </span>
            <span />
          </div>

          {/* Holding rows */}
          {rows.map((row) => (
            <div key={row.id} className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: '1fr 90px 110px 40px' }}>
              <input
                type="text"
                placeholder="e.g. BRK.B"
                value={row.ticker}
                onChange={(e) => updateRow(row.id, 'ticker', e.target.value)}
                maxLength={6}
                className={FIELD_CLASS}
                style={MONO}
              />
              <input
                type="number"
                placeholder="0"
                value={row.shares}
                onChange={(e) => updateRow(row.id, 'shares', e.target.value)}
                min="0"
                step="any"
                className={`${FIELD_CLASS} tabular-nums`}
                style={MONO}
              />
              <input
                type="number"
                placeholder="$0.00"
                value={row.costBasis}
                onChange={(e) => updateRow(row.id, 'costBasis', e.target.value)}
                min="0"
                step="any"
                className={`${FIELD_CLASS} tabular-nums`}
                style={MONO}
              />
              <button
                onClick={() => removeRow(row.id)}
                className="flex items-center justify-center h-[44px] w-10 rounded text-[var(--color-text-muted)] hover:text-[var(--color-negative)] hover:bg-[var(--color-negative)]/5 transition-colors cursor-pointer"
                aria-label="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add row */}
        {rows.length < 50 && (
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 mt-4 py-2 text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors cursor-pointer"
            style={MONO}
          >
            <Plus className="w-3.5 h-3.5" />
            Add position
          </button>
        )}

        {/* Error */}
        {error && (
          <p className="mt-4 text-[13px] text-[var(--color-negative)]" style={MONO}>
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2.5 mt-5">
          <button
            onClick={clearRows}
            disabled={saving}
            className="h-9 px-4 inline-flex items-center bg-transparent border border-[var(--color-border-base)] rounded-md text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] transition-colors cursor-pointer disabled:opacity-50"
            style={MONO}
          >
            Clear
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="h-9 px-[18px] inline-flex items-center gap-2 bg-[var(--color-gold)] hover:brightness-[1.08] text-[#0A0A0A] font-bold text-[10px] uppercase tracking-[0.12em] rounded-md cursor-pointer transition-all disabled:opacity-50"
            style={MONO}
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving
              </>
            ) : (
              'Add holding'
            )}
          </button>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[var(--color-text-muted)] text-center" style={MONO}>
        Cost basis is optional. Entering it unlocks tax-loss harvesting insights.
      </p>
    </div>
  );
}
