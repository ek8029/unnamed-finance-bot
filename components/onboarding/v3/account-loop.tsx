'use client';
// Screen 2 of onboarding v3: the loop. The accounts on record, a syncing row
// for a fresh Plaid item, the ask again (compact) for the next account, and
// the door to the reveal. The parent owns the book; this renders it.
import type { ReactNode } from 'react';
import { BookAsk } from './book-ask';
import type { BookAccount, BookHolding } from './use-book';
import { useSettings } from '@/contexts/settings-context';
import { V3_COPY } from '@/lib/onboarding/v3-copy';
import type { BackgroundSyncResult } from '@/lib/plaid/background-sync';

export function AccountLoop({ accounts, holdings, syncing, duplicate, onPlaidSuccess, onPlaidSynced, onManualComplete, onDuplicate, onChoice, onContinue, firstLookSlot, readOnly = false }: {
  accounts: BookAccount[];
  holdings: BookHolding[];
  /** Institution name while its first import runs. */
  syncing: string | null;
  /** Institution name from a duplicate_institution warning. */
  duplicate: string | null;
  onPlaidSuccess: (itemId?: string) => void;
  onPlaidSynced?: (result: BackgroundSyncResult, itemId?: string) => void;
  onManualComplete: () => void;
  onDuplicate?: (message: string) => void;
  onChoice?: (via: 'plaid' | 'manual') => void;
  onContinue: () => void;
  /** Manual path: the first-look question renders here. */
  firstLookSlot?: ReactNode;
  readOnly?: boolean;
}) {
  const copy = V3_COPY.loop;
  const { formatCurrency } = useSettings();
  const positions = accounts.reduce((n, a) => n + a.positions, 0);
  const total = holdings.reduce((n, h) => n + (Number(h.total_value) || 0), 0);
  const heading = accounts.length <= 1 ? copy.one : copy.many(accounts.length, positions, formatCurrency(total));

  return (
    <section aria-label={copy.title}>
      <h3 className="text-[15px] leading-relaxed text-[var(--color-text-primary)]">{heading}</h3>

      <ul className="mt-4 divide-y divide-[var(--color-border-base)] rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)]">
        {accounts.map((a) => {
          const isSyncing = syncing != null && a.institution === syncing;
          return (
            <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] text-[var(--color-text-primary)]">{a.institution}</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">{a.account_type}</p>
              </div>
              {isSyncing ? (
                <div className="flex shrink-0 items-center gap-2" role="status">
                  <svg className="h-5 w-5 animate-pulse text-[var(--color-positive)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[13px] text-[var(--color-text-secondary)]">{copy.syncing(a.institution)}</span>
                </div>
              ) : (
                <p className="shrink-0 text-right text-[13px] text-[var(--color-text-secondary)]">
                  {copy.positions(a.positions)}
                  <span className="block text-[12px] text-[var(--color-text-muted)]">{a.source === 'manual' ? copy.byHand : copy.imported}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {duplicate && (
        <p role="status" className="mt-3 rounded-md border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] px-3 py-2 text-[13px] text-[var(--color-text-primary)]">
          {copy.already(duplicate)}
        </p>
      )}

      <div className="mt-6">
        <BookAsk
          compact
          linkedInstitutions={accounts.map((a) => a.institution)}
          onPlaidSuccess={onPlaidSuccess}
          onPlaidSynced={onPlaidSynced}
          onManualComplete={onManualComplete}
          onDuplicate={onDuplicate}
          onChoice={onChoice}
          readOnly={readOnly}
        />
      </div>

      {firstLookSlot}

      <div className="mt-8 flex flex-col items-start gap-3">
        <button type="button" className="helm-button min-h-[44px]" onClick={onContinue}>{copy.primary}</button>
        <span className="text-[13px] text-[var(--color-text-muted)]">{copy.secondary}</span>
      </div>
    </section>
  );
}
