'use client';

/**
 * What kind of account the hand-entered book is.
 *
 * Helm had no way to know. A manual account carried no subtype and a name that
 * matched nothing, so `isRetirementAccount` returned false for every one of them
 * and the whole book was treated as taxable. A user holding an IRA was shown a
 * tax-loss harvest they cannot take, and the Tax Center counted positions that
 * do not belong in it.
 *
 * Nothing downstream needs the label, only the boolean it implies, but asking
 * for the specific account is no harder to answer and makes the book readable
 * elsewhere.
 */

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

const OPTIONS: { key: string; label: string; taxable: boolean }[] = [
  { key: 'taxable', label: 'Taxable brokerage', taxable: true },
  { key: 'traditional_ira', label: 'Traditional IRA', taxable: false },
  { key: 'roth_ira', label: 'Roth IRA', taxable: false },
  { key: '401k', label: '401(k)', taxable: false },
  { key: 'hsa', label: 'HSA', taxable: false },
  { key: '529', label: '529', taxable: false },
];

export function ManualAccountType({ onChange }: { onChange?: () => void }) {
  const [value, setValue] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/portfolio/manual')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { accountType?: string | null } | null) => setValue(j?.accountType ?? null))
      .catch(() => setValue(null))
      .finally(() => setLoaded(true));
  }, []);

  const pick = async (key: string) => {
    setSaving(key);
    setError(null);
    const previous = value;
    setValue(key);
    try {
      const res = await fetch('/api/portfolio/manual', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType: key }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Could not save that');
      }
      onChange?.();
    } catch (e) {
      setValue(previous);
      setError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setSaving(null);
    }
  };

  // Loading shows a shell, never the unanswered state: flashing "we don't know
  // what this is" at someone who already answered reads as data loss.
  if (!loaded) {
    return (
      <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] p-4 mb-7">
        <div className="h-4 w-56 rounded bg-[var(--color-bg-inset)] animate-pulse" />
      </div>
    );
  }

  const chosen = OPTIONS.find((o) => o.key === value);

  return (
    <div className="rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] overflow-hidden mb-7">
      <div className="px-4 py-3 border-b border-[var(--color-border-base)]">
        <p className="text-[15px] font-medium text-[var(--color-text-primary)]">
          What kind of account is this?
        </p>
        <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
          {value === null
            ? 'Helm assumes taxable until you say otherwise, which puts losses in a retirement account into the tax figures where they do not belong.'
            : chosen?.taxable
              ? 'Losses here can be harvested and appear in the Tax Center.'
              : 'Losses here are not deductible, so Helm keeps them out of the tax figures.'}
        </p>
      </div>

      {error && (
        <p className="px-4 py-2 text-[13px] text-[var(--color-negative)] border-b border-[var(--color-border-base)]">{error}</p>
      )}

      <div className="p-3 flex flex-wrap gap-2">
        {OPTIONS.map((o) => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={active}
              disabled={saving !== null}
              onClick={() => pick(o.key)}
              className={`flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg border text-[14px] transition-colors cursor-pointer disabled:opacity-60 ${
                active
                  ? 'border-[var(--color-gold)] text-[var(--color-text-primary)] bg-[var(--color-bg-inset)]'
                  : 'border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)]'
              }`}
            >
              {saving === o.key ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : active ? (
                <Check className="w-3.5 h-3.5 text-[var(--color-gold)]" />
              ) : null}
              {o.label}
            </button>
          );
        })}
      </div>

      <p className="px-4 py-3 text-[13px] text-[var(--color-text-muted)] border-t border-[var(--color-border-base)] leading-relaxed">
        This covers everything you type in. Positions synced from a brokerage keep
        the account type that broker reports.
      </p>
    </div>
  );
}
