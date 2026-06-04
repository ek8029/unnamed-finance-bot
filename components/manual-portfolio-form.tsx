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
        <p className="text-[14px] font-medium text-[var(--color-text-primary)]">Portfolio saved</p>
        <p className="text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'max-w-2xl mx-auto'}>
      <div className="space-y-2">
        {/* Header row */}
        <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: '1fr 70px 85px 36px' }}>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium" style={{ fontFamily: 'var(--font-mono)' }}>Ticker</span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium" style={{ fontFamily: 'var(--font-mono)' }}>Shares</span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium" style={{ fontFamily: 'var(--font-mono)' }}>
            Cost basis
            <span className="text-[var(--color-text-muted)] opacity-50 ml-1">opt</span>
          </span>
          <span />
        </div>

        {/* Holding rows */}
        {rows.map((row) => (
          <div key={row.id} className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: '1fr 70px 85px 36px' }}>
            <input
              type="text"
              placeholder="AAPL"
              value={row.ticker}
              onChange={(e) => updateRow(row.id, 'ticker', e.target.value)}
              maxLength={6}
              className="px-2 sm:px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[12px] sm:text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <input
              type="number"
              placeholder="100"
              value={row.shares}
              onChange={(e) => updateRow(row.id, 'shares', e.target.value)}
              min="0"
              step="any"
              className="px-2 sm:px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[12px] sm:text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors tabular-nums"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <input
              type="number"
              placeholder="$150"
              value={row.costBasis}
              onChange={(e) => updateRow(row.id, 'costBasis', e.target.value)}
              min="0"
              step="any"
              className="px-2 sm:px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded text-[12px] sm:text-[13px] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold)] transition-colors tabular-nums"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <button
              onClick={() => removeRow(row.id)}
              className="flex items-center justify-center w-9 h-9 rounded text-[var(--color-text-muted)] hover:text-[var(--color-negative)] hover:bg-[var(--color-negative)]/5 transition-colors cursor-pointer"
              aria-label="Remove"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add row */}
      {rows.length < 50 && (
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 mt-3 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors cursor-pointer"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <Plus className="w-3 h-3" />
          Add position
        </button>
      )}

      {/* Error */}
      {error && (
        <p className="mt-3 text-[12px] text-[var(--color-negative)]" style={{ fontFamily: 'var(--font-mono)' }}>
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full mt-5 flex items-center justify-center gap-2 px-5 py-3 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)] font-semibold text-[14px] rounded-[var(--radius-md)] cursor-pointer transition-colors disabled:opacity-50"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save holdings'
        )}
      </button>

      <p className="mt-3 text-[10px] text-[var(--color-text-muted)] text-center" style={{ fontFamily: 'var(--font-mono)' }}>
        Cost basis is optional. Entering it unlocks tax-loss harvesting insights.
      </p>
    </div>
  );
}
