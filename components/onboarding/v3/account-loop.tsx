'use client';
// Screen 2 of onboarding v3: the loop. The accounts on record, the positions
// typed in by hand read back under their account, a syncing row for a fresh
// Plaid item, the ask again (compact) for the next account, and the door to
// the reveal. The parent owns the book; this renders it.
import { BookAsk } from './book-ask';
import type { BookAccount, BookHolding } from './use-book';
import { useSettings } from '@/contexts/settings-context';
import { V3_COPY } from '@/lib/onboarding/v3-copy';
import { manualPositions, shareLabel } from '@/lib/onboarding/v3-book-view';
import type { BackgroundSyncResult } from '@/lib/plaid/background-sync';

export function AccountLoop({ accounts, holdings, syncing, duplicate, onPlaidSuccess, onPlaidSynced, onManualComplete, onDuplicate, onChoice, onPlaidExit, onContinue, readOnly = false }: {
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
  onPlaidExit?: (code: string | null) => void;
  onChoice?: (via: 'plaid' | 'manual') => void;
  onContinue: () => void;
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
          // Only a hand-typed account expands, and only its OWN positions. An
          // imported book can run to hundreds of rows and is usually still
          // syncing while this is up.
          const typed = a.source === 'manual' ? manualPositions(a.id, holdings) : null;
          return (
            <li key={a.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
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
              </div>

              {typed && typed.rows.length > 0 && (
                <div className="mt-3 border-t border-[var(--color-border-base)] pt-3">
                  <p className="text-[12px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{copy.yourEntry}</p>
                  <ul className="mt-2 grid gap-1.5">
                    {typed.rows.map((r) => (
                      <li key={r.ticker} className="flex items-baseline justify-between gap-4 text-[13px]">
                        <span className="text-[var(--color-text-primary)]">
                          {r.ticker}
                          <span className="ml-2 text-[12px] text-[var(--color-text-muted)]">{copy.shares(shareLabel(r.shares))}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-[var(--color-text-secondary)]">{formatCurrency(r.value)}</span>
                      </li>
                    ))}
                  </ul>
                  {typed.more > 0 && <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">{copy.andMore(typed.more)}</p>}
                </div>
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
          onPlaidExit={onPlaidExit}
          readOnly={readOnly}
        />
      </div>

      <div className="mt-8 flex flex-col items-start gap-3">
        <button type="button" className="helm-button min-h-[44px]" onClick={onContinue}>{copy.primary}</button>
        <span className="text-[13px] text-[var(--color-text-muted)]">{copy.secondary}</span>
      </div>
    </section>
  );
}
