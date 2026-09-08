'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Trash2, Loader2, Check } from 'lucide-react';
import { useDemo } from '@/contexts/demo-context';
import { prepareManualSave, reconcileManualSave, persistManualSave, restoreManualSave, clearManualSave, MANUAL_SAVE_LOGIN_URL, type ManualHoldingRow as HoldingRow, type ManualSaveRequest } from '@/lib/manual-portfolio-save';

interface ManualPortfolioFormProps {
  /** Preview/review surfaces pass this to render the real form while blocking the
   *  write, so a reviewer can walk the screen without adding holdings to their book. */
  readOnly?: boolean;
  /** Rows extracted from a screenshot or CSV. They land here UNSAVED so the user
   *  reviews and corrects them; the import never writes on its own. Remount the
   *  form (change its key) to seed it again. */
  seedRows?: { ticker: string; shares: number; costBasis: number | null }[];
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

export function ManualPortfolioForm({ onComplete, compact = false, readOnly = false, seedRows }: ManualPortfolioFormProps) {
  const [rows, setRows] = useState<HoldingRow[]>(() =>
    seedRows?.length
      ? seedRows.map(r => ({
          id: crypto.randomUUID(),
          ticker: r.ticker,
          shares: String(r.shares),
          // Basis the source did not carry stays EMPTY. A zero here would read
          // as "bought at $0" and manufacture a gain the user never had.
          costBasis: r.costBasis == null ? '' : String(Number(r.costBasis.toFixed(4))),
        }))
      : compact ? [createEmptyRow()] : [createEmptyRow(), createEmptyRow(), createEmptyRow()],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsRetry, setNeedsRetry] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [identityReady, setIdentityReady] = useState(readOnly);
  const [recoveryError, setRecoveryError] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  // A timeout can happen after a write. Until every row is accounted for,
  // retries must use this exact ID and ordered payload.
  const pendingRequest = useRef<ManualSaveRequest | null>(null);
  const saveOwner = useRef<string | null>(null);
  const savingRef = useRef(false);
  const { disableDemo } = useDemo();
  const editingLocked = saving || needsRetry || needsAuth || !identityReady || recoveryError;

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        const data = response.ok ? await response.json() : null;
        if (cancelled) return;
        const userId = typeof data?.user?.id === 'string' ? data.user.id : null;
        if (!userId) { setNeedsAuth(true); return; }
        saveOwner.current = userId;
        try {
          const recovered = restoreManualSave(sessionStorage, userId);
          if (recovered) {
            pendingRequest.current = recovered;
            setRows(recovered.rows);
            setNeedsRetry(true);
            setError('An earlier save needs confirmation. Retry safely to check what already saved, or stop retrying and review your positions.');
          }
        } catch (err) {
          setRecoveryError(true);
          setError(err instanceof Error ? err.message : 'Could not read the recovery record.');
        }
      } catch {
        if (!cancelled) setNeedsAuth(true);
      } finally {
        if (!cancelled) setIdentityReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [readOnly]);


  const updateRow = useCallback((id: string, field: keyof HoldingRow, value: string) => {
    if (savingRef.current || pendingRequest.current) return;
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: field === 'ticker' ? value.toUpperCase() : value } : r));
  }, []);

  const addRow = useCallback(() => {
    if (savingRef.current || pendingRequest.current) return;
    if (rows.length >= 50) return;
    setRows(prev => [...prev, createEmptyRow()]);
  }, [rows.length]);

  const removeRow = useCallback((id: string) => {
    if (savingRef.current || pendingRequest.current) return;
    setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== id));
  }, []);

  const clearRows = useCallback(() => {
    if (savingRef.current || pendingRequest.current) return;
    setError(null);
    setConflicts([]);
    setRows(compact ? [createEmptyRow()] : [createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  }, [compact]);

  const handleSubmit = async () => {
    if (savingRef.current) return;
    setError(null);
    if (readOnly) {
      setError('Preview mode: holdings are not saved here.');
      return;
    }
    if (!identityReady || needsAuth || recoveryError) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const ownerId = saveOwner.current;
      if (!ownerId) { setNeedsAuth(true); return; }
      let request = pendingRequest.current;
      const retryingUncertainSave = request !== null;
      if (!request) {
        request = prepareManualSave(rows, crypto.randomUUID());
        // Persist BEFORE checking a potentially expired session or writing.
        // The owner was verified when this form loaded; only that same user
        // can restore or submit the record after signing in again.
        try { persistManualSave(sessionStorage, ownerId, request); }
        catch { throw new Error('This browser could not keep a recovery record. Allow session storage before saving positions.'); }
        pendingRequest.current = request;
      }
      const authResponse = await fetch('/api/auth/session', { cache: 'no-store' });
      const authData = authResponse.ok ? await authResponse.json() : null;
      const userId = typeof authData?.user?.id === 'string' ? authData.user.id : null;
      if (!userId || (saveOwner.current && saveOwner.current !== userId)) {
        setNeedsRetry(true);
        setNeedsAuth(true);
        setError('Sign in to the account that started this save. Its recovery record stays in this browser tab.');
        return;
      }
      saveOwner.current = userId;
      const res = await fetch('/api/portfolio/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.requestId,
          holdings: request.holdings,
          expectedUserId: userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || (res.status === 409 && data?.code === 'AUTH_ACCOUNT_CHANGED')) {
          setNeedsRetry(true);
          setNeedsAuth(true);
          setError('Your session needs a new sign-in. The original save is preserved in this browser tab, so you can safely resume it afterward.');
          return;
        }
        // The API rejects validation/auth failures before writes. A failure
        // on a later replay says nothing about the earlier uncertain attempt.
        if (!retryingUncertainSave && res.status === 400) {
          clearManualSave(sessionStorage, userId);
          pendingRequest.current = null;
          setNeedsRetry(false);
          setError(typeof data?.error === 'string' ? data.error : 'Could not save. Check your positions and try again.');
        } else {
          setNeedsRetry(true);
          setError('The save could not be confirmed. Keep these positions unchanged and retry safely to check for any that already saved.');
        }
        return;
      }
      const result = reconcileManualSave(request, data);
      clearManualSave(sessionStorage, userId);
      pendingRequest.current = null;
      setNeedsRetry(false);
      setConflicts(result.conflicts);
      if (result.added > 0) disableDemo();
      if (result.failedRows.length > 0) {
        // Only confirmed unsaved rows enter the next request. Keep exact row
        // indexes when reconciling older submissions, including duplicates.
        setRows(result.failedRows);
        const saved = `Saved ${result.added} position${result.added === 1 ? '' : 's'}`;
        if (result.conflicts.length > 0) {
          setError(`${saved}. ${result.conflicts.join(', ')} already exist in your manual portfolio. Edit those existing positions, or remove them from this form before saving new positions.`);
        } else if (result.duplicates.length > 0) {
          setError(`${saved}. Enter ${result.duplicates.join(', ')} once each. A manual account keeps one position per ticker.`);
        } else {
          setError(`${saved}. Only the ${result.failedRows.length} unsaved position${result.failedRows.length === 1 ? ' remains' : 's remain'} below. Check the details or try again shortly.`);
        }
        return;
      }
      if (result.added > 0) {
        // Real positions exist now — kill the sample-data overlay so the user
        // lands on THEIR book, not the demo's (real user lost to this).
        setSuccess(true);
        setTimeout(() => {
          onComplete?.();
        }, 1500);
      }
    } catch (err) {
      if (pendingRequest.current) {
        setNeedsRetry(true);
        setError('The save could not be confirmed. Retry safely to check for positions already saved. The recovery record is kept in this browser tab if you need to sign in again.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not save positions. Please try again.');
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const discardRecovery = () => {
    if (savingRef.current || !saveOwner.current) return;
    try {
      clearManualSave(sessionStorage, saveOwner.current);
      pendingRequest.current = null;
      // A full navigation refreshes the existing manual-position editor too.
      window.location.assign(needsAuth ? MANUAL_SAVE_LOGIN_URL : '/dashboard/portfolio/add');
    } catch {
      setError('Could not remove the recovery record. Retry the save or allow session storage and try again.');
    }
  };

  if (success) {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${compact ? 'py-6' : 'py-12'}`}>
        <div className="w-10 h-10 rounded-full bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.2)] flex items-center justify-center">
          <Check className="w-5 h-5 text-[var(--color-positive)]" />
        </div>
        <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Portfolio saved</p>
        <p className="text-[13px] text-[var(--color-text-muted)]" style={MONO}>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <form className="helm-manual-form" onSubmit={e => { e.preventDefault(); void handleSubmit(); }}>
      <div className="sovereign-card rounded-lg p-6">
        <div className="space-y-3">
          {/* Header row */}
          <div className="helm-manual-columns helm-manual-labels" aria-hidden="true">
            <span className={FIELD_LABEL_CLASS} style={MONO}>Symbol / asset</span>
            <span className={FIELD_LABEL_CLASS} style={MONO}>Shares</span>
            <span className={FIELD_LABEL_CLASS} style={MONO}>
              Cost / share
              <span className="opacity-50 ml-1">opt</span>
            </span>
            <span />
          </div>

          {/* Holding rows */}
          {rows.map((row, index) => (
            <div key={row.id} className="helm-manual-columns helm-manual-row">
              <label><span className="helm-manual-mobile-label">Ticker</span>
              <input
                aria-label={`Position ${index + 1} ticker`}
                type="text"
                placeholder="e.g. BRK.B"
                value={row.ticker}
                onChange={(e) => updateRow(row.id, 'ticker', e.target.value)}
                maxLength={7}
                disabled={editingLocked}
                className={FIELD_CLASS}
                style={MONO}
              />
              </label>
              <label><span className="helm-manual-mobile-label">Shares</span>
              <input
                aria-label={`Position ${index + 1} shares`}
                type="number"
                placeholder="0"
                value={row.shares}
                disabled={editingLocked}
                onChange={(e) => updateRow(row.id, 'shares', e.target.value)}
                min="0"
                step="any"
                className={`${FIELD_CLASS} tabular-nums`}
                style={MONO}
              />
              </label>
              <label><span className="helm-manual-mobile-label">Cost per share (optional)</span>
              <input
                aria-label={`Position ${index + 1} cost per share, optional`}
                type="number"
                placeholder="$0.00"
                value={row.costBasis}
                disabled={editingLocked}
                onChange={(e) => updateRow(row.id, 'costBasis', e.target.value)}
                min="0"
                step="any"
                className={`${FIELD_CLASS} tabular-nums`}
                style={MONO}
              />
              </label>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                disabled={editingLocked || rows.length === 1}
                className="flex items-center justify-center h-[44px] w-10 rounded text-[var(--color-text-muted)] hover:text-[var(--color-negative)] hover:bg-[var(--color-negative)]/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={`Remove position ${index + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add row */}
        {rows.length < 50 && (
          <button
            type="button"
            onClick={addRow}
            disabled={editingLocked}
            className="flex items-center gap-1.5 mt-4 py-2 text-[12px] uppercase tracking-[0.1em] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={MONO}
          >
            <Plus className="w-3.5 h-3.5" />
            Add position
          </button>
        )}

        {/* Error */}
        {error && (
          <p role="alert" className="mt-4 text-[14px] text-[var(--color-negative)]" style={MONO}>
            {error}
          </p>
        )}

        {needsAuth && <p className="mt-3 text-[14px] text-[var(--color-text-secondary)]">Sign in again to continue with the same account. <a className="text-[var(--color-gold)] underline" href={MANUAL_SAVE_LOGIN_URL}>Sign in and return</a></p>}
        {conflicts.length > 0 && <p className="mt-3 text-[14px]"><a className="text-[var(--color-gold)] underline" href="/dashboard/portfolio/add">Review and edit existing positions</a></p>}
        {(needsRetry || recoveryError) && <div className="mt-4 border-t border-[var(--color-border-base)] pt-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          <p>Some positions may already be saved. Stopping the retry removes this tab’s recovery record; it does not delete saved positions. Review your portfolio before entering them again.</p>
          <button type="button" disabled={saving} onClick={discardRecovery} className="mt-2 min-h-[44px] text-[var(--color-gold)] underline disabled:opacity-50">Stop retrying and review positions</button>
        </div>}

        {/* Actions */}
        <div className="flex justify-end gap-2.5 mt-5">
          <button
            type="button"
            onClick={clearRows}
            disabled={editingLocked}
            className="h-9 px-4 inline-flex items-center bg-transparent border border-[var(--color-border-base)] rounded-md text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] transition-colors cursor-pointer disabled:opacity-50"
            style={MONO}
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={saving || !identityReady || needsAuth || recoveryError}
            className="h-9 px-[18px] inline-flex items-center gap-2 bg-[var(--color-gold)] hover:brightness-[1.08] text-[#0A0A0A] font-bold text-[10px] uppercase tracking-[0.12em] rounded-md cursor-pointer transition-all disabled:opacity-50"
            style={MONO}
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving
              </>
            ) : (
              !identityReady ? 'Checking sign-in...' : needsRetry ? 'Retry safely' : 'Save positions'
            )}
          </button>
        </div>
      </div>

      <p className="mt-3 text-[12px] text-[var(--color-text-muted)] text-center" style={MONO}>
        Average cost per share is optional. Add it for tax-loss harvesting insights.
      </p>
    </form>
  );
}
