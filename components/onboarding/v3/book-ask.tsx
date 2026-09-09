'use client';
// Screen 1 of onboarding v3: the ask. Two ways to hand Helm a book at equal
// weight. Manual is first in DOM order so it stacks first on a phone; Plaid
// sits left from 860px. One Link instance, opened by the chips or the search
// button; every exit routes to the manual panel, a notice, or nothing.
import { useCallback, useId, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button';
import { ManualPortfolioForm } from '@/components/manual-portfolio-form';
import { V3_COPY } from '@/lib/onboarding/v3-copy';
import { routeLinkExit } from '@/lib/onboarding/v3-exit-route';
import type { BackgroundSyncResult } from '@/lib/plaid/background-sync';
import type { LinkExitDetail } from '@/lib/plaid/link-exit';
import { useQuotePreview, type PreviewRow } from './use-book';

type Via = 'plaid' | 'manual';

export function BookAsk({ linkedInstitutions, onPlaidSuccess, onPlaidSynced, onManualComplete, onDuplicate, onChoice, readOnly = false, compact = false }: {
  linkedInstitutions: string[];
  onPlaidSuccess: (itemId?: string) => void;
  onPlaidSynced?: (result: BackgroundSyncResult, itemId?: string) => void;
  onManualComplete: () => void;
  onDuplicate?: (message: string) => void;
  /** Once per panel, on the first interaction, for the onb3_ask_choice event. */
  onChoice?: (via: Via) => void;
  /** Harness: the real form with the write blocked. */
  readOnly?: boolean;
  /** Portfolio empty state: tighter padding, no lede. */
  compact?: boolean;
}) {
  const ids = useId();
  const copy = V3_COPY.ask;
  const openRef = useRef<(() => boolean) | null>(null);
  const lastOpener = useRef<HTMLButtonElement | null>(null);
  const manualRef = useRef<HTMLElement | null>(null);
  const chosen = useRef<Set<Via>>(new Set());
  const onChoiceRef = useRef(onChoice);
  onChoiceRef.current = onChoice;
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [manualNotice, setManualNotice] = useState<string | null>(null);
  const [plaidNotice, setPlaidNotice] = useState<string | null>(null);
  const preview = useQuotePreview(rows);

  const choose = useCallback((via: Via) => {
    if (chosen.current.has(via)) return;
    chosen.current.add(via);
    onChoiceRef.current?.(via);
  }, []);

  const handleRows = useCallback((next: PreviewRow[]) => {
    setRows(next);
    if (next.length > 0) choose('manual');
  }, [choose]);

  const openFromChip = (e: React.MouseEvent<HTMLButtonElement>) => {
    const opened = openRef.current?.();
    if (opened === true) lastOpener.current = e.currentTarget;
    choose('plaid');
  };

  const handleExit = useCallback((detail: LinkExitDetail) => {
    const route = routeLinkExit({ ...detail, searchQuery: detail.searchQuery?.trim().slice(0, 60) || null });
    setManualNotice(route.to === 'manual' ? route.message : null);
    setPlaidNotice(route.to === 'stay' ? route.message : null);
    // Link's close moves focus. One frame later, put it where the exit leads:
    // the manual panel when the route says so, otherwise back on the opener.
    const opener = lastOpener.current;
    lastOpener.current = null;
    requestAnimationFrame(() => {
      if (route.to === 'manual') manualRef.current?.querySelector('input')?.focus();
      else opener?.focus();
    });
  }, []);

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isLinked = (chip: string) => linkedInstitutions.some((l) => norm(l).includes(norm(chip)));
  const card = `rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-tint)] ${compact ? 'p-4' : 'p-5'}`;
  const notice = 'rounded-md border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] px-3 py-2 text-[13px] leading-relaxed text-[var(--color-text-primary)]';

  return (
    <div>
      {!compact && <p className="mb-4 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{copy.lede}</p>}
      <div className="grid grid-cols-1 gap-4 min-[860px]:grid-cols-2">
        <section ref={manualRef} aria-labelledby={`${ids}-manual`} className={`${card} min-[860px]:order-2`}>
          <h3 id={`${ids}-manual`} className="text-[17px] font-semibold text-[var(--color-text-primary)]">{copy.manual.heading}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{copy.manual.body}</p>
          {manualNotice && <p role="status" className={`mt-3 ${notice}`}>{manualNotice}</p>}
          <p aria-live="polite" className="mt-3 min-h-[20px] text-[13px] text-[var(--color-text-secondary)]">{preview}</p>
          <div className="mt-3">
            <ManualPortfolioForm compact readOnly={readOnly} onComplete={onManualComplete} onRowsChange={handleRows} />
          </div>
        </section>

        <section aria-labelledby={`${ids}-plaid`} className={card}>
          <h3 id={`${ids}-plaid`} className="text-[17px] font-semibold text-[var(--color-text-primary)]">{copy.plaid.heading}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{copy.plaid.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {copy.plaid.chips.map((chip) => {
              const linked = isLinked(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  disabled={linked}
                  onClick={openFromChip}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 text-[14px] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-gold)] disabled:cursor-default disabled:opacity-60 disabled:hover:border-[var(--color-border)]"
                >
                  {linked && <Check size={14} aria-hidden="true" className="text-[var(--color-positive)]" />}
                  {chip}
                </button>
              );
            })}
          </div>
          {plaidNotice && <p role="status" className={`mt-3 ${notice}`}>{plaidNotice}</p>}
          <div className="mt-4">
            <PlaidLinkButton
              className="helm-button w-full"
              openRef={openRef}
              onSuccess={onPlaidSuccess}
              onWarning={onDuplicate}
              onExitDetail={handleExit}
              onSynced={onPlaidSynced}
              onOpen={() => choose('plaid')}
            >
              {copy.plaid.search}
            </PlaidLinkButton>
          </div>
          <ul className="mt-4 space-y-1.5">
            {copy.plaid.trust.map((line) => (
              <li key={line} className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                <Check size={14} aria-hidden="true" className="mt-[3px] shrink-0 text-[var(--color-positive)]" />
                {line}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
