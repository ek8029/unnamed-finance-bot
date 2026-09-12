'use client';

// Onboarding v3: book first. Three screens over the dashboard, then the real
// terminal. No demo path, no tour. Spec: docs/superpowers/specs/
// 2026-09-08-onboarding-book-first-design.md sections 3, 3.4, 7, 9.
//
//   ask -> loop -> first look -> reveal -> /dashboard/portfolio
//
// The screens live in ./book-ask, ./account-loop, ./first-look and
// ./book-reveal. This file owns the state machine, the gate, the events and
// "Do this later". Events carry counts and codes only.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import posthog from 'posthog-js';
import { BookAsk } from './book-ask';
import { AccountLoop } from './account-loop';
import { BookReveal } from './book-reveal';
import { FirstLookScreen } from './first-look';
import { useBook } from './use-book';
import type { FirstLook } from '@/lib/onboarding/first-look';
import { afterSynced, nextSyncing, pickNewPlaidAccounts } from '@/lib/onboarding/v3-sync-state';
import { V3_COPY } from '@/lib/onboarding/v3-copy';
import { decideV3Gate, deferredKey, type GateOutcome } from '@/lib/onboarding/v3-gate';
import { runBackgroundSync, type BackgroundSyncResult } from '@/lib/plaid/background-sync';
import { importSummary, recordImportOutcome, type ImportOutcomes } from './import-outcome';

type Phase = 'ask' | 'loop' | 'first-look' | 'reveal';
const STEP: Record<Phase, number> = { ask: 1, loop: 2, 'first-look': 3, reveal: 4 };
const STEPS = 4;
const SYNC_POLL_MS = 10_000;

function track(event: string, props?: Record<string, unknown>) {
  try { posthog.capture(event, props); } catch { /* posthog no-ops if uninitialized */ }
}

// Scoped to the account. Without a user id there is nothing to scope, so
// nothing is written: onboarding shows again rather than hiding for everyone.
function markDeferred(userId: string | null) {
  if (!userId) return;
  try { localStorage.setItem(deferredKey(userId), '1'); } catch { /* storage blocked */ }
}

function isDeferred(userId: string) {
  try { return localStorage.getItem(deferredKey(userId)) === '1'; } catch { return false; }
}

export function OnboardingFlowV3({ harness, jumpTo, readOnly, onSettled }: {
  harness?: boolean;
  jumpTo?: Phase;
  /** Harness: the real forms with the writes blocked. */
  readOnly?: boolean;
  /** Fired once when onboarding is dismissed or existing progress makes it unnecessary. */
  onSettled?: () => void;
} = {}) {
  // The harness renders the ask on the server so /testing/onboarding-v3 shows it at once.
  const [show, setShow] = useState(!!harness);
  // The investor demo login: every screen, every visit, nothing written. v2 had
  // this and v3 had lost it, so the demo dashboard stopped showing onboarding
  // the day the v3 flag went on.
  const [demo, setDemo] = useState(false);
  // onSettled must fire once and only once, from whichever exit is reached.
  const settled = useRef(false);
  const settle = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onSettled?.();
  }, [onSettled]);

  const book = useBook(show);
  const [phase, setPhase] = useState<Phase>(jumpTo ?? 'ask');
  // Institutions still on their first import, oldest first. Several Plaid
  // connects can overlap; each Link success adds one pending import and each
  // settled sync removes the oldest.
  const [syncing, setSyncing] = useState<string[]>([]);
  const [pendingConnects, setPendingConnects] = useState(0);
  const [importOutcomes, setImportOutcomes] = useState<ImportOutcomes>({});
  const importOutcomesRef = useRef<ImportOutcomes>({});
  const retryingImport = useRef(false);
  const importGeneration = useRef(0);
  const recordImport = useCallback((itemId: string | undefined, outcome: BackgroundSyncResult | 'pending') => {
    const next = recordImportOutcome(importOutcomesRef.current, itemId, outcome);
    importOutcomesRef.current = next;
    setImportOutcomes(next);
  }, []);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  // null = not answered yet.
  const [firstLook, setFirstLook] = useState<FirstLook[] | null>(null);
  // Every account id seen in any refetch. A Plaid account outside this set is
  // a fresh connection whose institution is still importing.
  const knownIds = useRef<Set<string>>(new Set());
  const duplicatePending = useRef(false);
  // The signed-in account, from the status read. "Do this later" needs it to
  // write the scoped deferral.
  const userIdRef = useRef<string | null>(null);
  const accountsRef = useRef(book.accounts);
  accountsRef.current = book.accounts;

  // Gate. A returning user with a book, or an account that chose "later" in
  // this browser, never sees this. The server read comes first because the
  // deferral is keyed on the account, not the browser, and it fails OPEN: a
  // status outage shows onboarding rather than hiding it from a new user.
  useEffect(() => {
    if (harness) return;
    let cancelled = false;
    const apply = (outcome: GateOutcome, userId: string | null) => {
      if (outcome === 'defer-and-settle') { markDeferred(userId); settle(); return; }
      if (outcome === 'settle') { settle(); return; }
      if (outcome === 'show-demo') setDemo(true);
      setShow(true);
      track('onb3_shown', {
        flow: 'v3',
        gate: outcome === 'show-demo' ? 'demo' : outcome === 'show-unavailable' ? 'unavailable' : 'ok',
      });
    };
    fetch('/api/onboarding/status', { cache: 'no-store' })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) { apply(decideV3Gate({ ok: false }), null); return; }
        const s = await r.json();
        if (cancelled) return;
        const userId = typeof s?.userId === 'string' && s.userId ? s.userId : null;
        userIdRef.current = userId;
        apply(decideV3Gate({
          ok: true,
          isDemo: s?.isDemo === true,
          hasSavedWork: !!s?.hasSavedWork,
          deferred: !!userId && isDeferred(userId),
        }), userId);
      })
      .catch(() => { if (!cancelled) apply(decideV3Gate({ ok: false }), null); });
    return () => { cancelled = true; };
  }, [harness, settle]);

  // After every refetch: Plaid accounts not seen before are fresh connections.
  // Only a Link success in this session makes them "syncing"; the accounts
  // already on record at the first read are simply remembered.
  useEffect(() => {
    const fresh = pendingConnects > 0 ? pickNewPlaidAccounts(knownIds.current, book.accounts) : [];
    for (const a of book.accounts) knownIds.current.add(a.id);
    if (fresh.length === 0) return;
    const names = fresh.map((a) => a.institution);
    setSyncing((s) => nextSyncing(s, names));
    if (duplicatePending.current) {
      duplicatePending.current = false;
      setDuplicate(names[names.length - 1]);
    }
  }, [book.accounts, pendingConnects]);

  // While an import runs, or a connect has not shown up in the book yet, the
  // book re-reads every ten seconds.
  const polling = syncing.length > 0 || pendingConnects > 0;
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => { void book.refetch(); }, SYNC_POLL_MS);
    return () => clearInterval(id);
  }, [polling, book.refetch]);

  const leave = useCallback(() => {
    if (harness) {
      setPhase('ask');
      setSyncing([]);
      setPendingConnects(0);
      importOutcomesRef.current = {};
      setImportOutcomes({});
      importGeneration.current += 1;
      retryingImport.current = false;
      void book.refetch();
      return;
    }
    // The demo starts from zero next visit, so its exit writes nothing.
    if (!demo) markDeferred(userIdRef.current);
    settle();
    window.location.href = '/dashboard/portfolio';
  }, [harness, settle, book.refetch, demo]);

  const onPlaidSuccess = useCallback((itemId?: string) => {
    track('onb3_account_added', { flow: 'v3', via: 'plaid', accounts: accountsRef.current.length + 1 });
    recordImport(itemId, 'pending');
    setPendingConnects((n) => n + 1);
    void book.refetch();
    setPhase('loop');
  }, [book.refetch, recordImport]);

  const onPlaidSynced = useCallback((result: BackgroundSyncResult, itemId?: string) => {
    recordImport(itemId, result);
    track('onb3_import_settled', { flow: 'v3', outcome: result });
    setSyncing(afterSynced);
    setPendingConnects((n) => Math.max(0, n - 1));
    void book.refetch();
  }, [book.refetch, recordImport]);

  const retryImport = useCallback(async () => {
    const summary = importSummary(importOutcomesRef.current);
    // Do not fan out a second import while Link or another retry is pending.
    // The shared sync client also deduplicates a timed-out item's live request.
    if (readOnly || demo || retryingImport.current || summary.pending || !summary.retryItemId) return;
    retryingImport.current = true;
    const generation = importGeneration.current;
    const itemId = summary.retryItemId;
    recordImport(itemId, 'pending');
    setPendingConnects((n) => n + 1);
    track('onb3_import_retry', { flow: 'v3' });
    try {
      const result = await runBackgroundSync({ itemId });
      if (generation === importGeneration.current) onPlaidSynced(result, itemId);
    } finally {
      if (generation === importGeneration.current) retryingImport.current = false;
    }
  }, [readOnly, demo, recordImport, onPlaidSynced]);

  const onManualComplete = useCallback(() => {
    track('onb3_account_added', { flow: 'v3', via: 'manual', accounts: accountsRef.current.length + 1 });
    void book.refetch();
    setPhase('loop');
  }, [book.refetch]);

  // PlaidLinkButton's warning is a fixed sentence with no institution in it and
  // fires before onSuccess, so the name comes from the fresh-account effect.
  const onDuplicate = useCallback((message: string) => {
    const m = /^(.+?) (?:is|was) already connected/.exec(message);
    const name = m && !/^this institution$/i.test(m[1]) ? m[1] : null;
    if (name) setDuplicate(name);
    else duplicatePending.current = true;
    setPhase('loop');
  }, []);

  const onChoice = useCallback((via: 'plaid' | 'manual') => {
    track('onb3_ask_choice', { flow: 'v3', via });
  }, []);

  // The Plaid error code or null. No institution name, no search query.
  const onPlaidExit = useCallback((code: string | null) => {
    track('onb3_plaid_exit', { flow: 'v3', code });
  }, []);

  const onContinue = useCallback(() => {
    const accounts = accountsRef.current;
    track('onb3_loop_continue', { flow: 'v3', accounts: accounts.length, positions: accounts.reduce((n, a) => n + a.positions, 0) });
    setPhase('first-look');
  }, []);

  // The answer is stored by the screen; the flow only orders the reveal with it.
  const onFirstLook = useCallback((codes: FirstLook[]) => {
    setFirstLook(codes);
    track('onb3_first_look', { flow: 'v3', count: codes.length, skipped: codes.length === 0 });
    setPhase('reveal');
  }, []);

  const onViewed = useCallback((p: { top_ticker_covered: boolean; synced: boolean }) => {
    track('onb3_reveal_viewed', { flow: 'v3', ...p });
  }, []);

  const onOpenTerminal = useCallback(() => {
    track('onb3_terminal_opened', { flow: 'v3' });
    leave();
  }, [leave]);

  const onLater = () => {
    track('onb3_deferred', { flow: 'v3', screen: phase });
    leave();
  };

  if (!show) return null;

  // A demo visitor must not write to the house account, so the forms render
  // exactly as they do in the harness: real, and refusing to save.
  const noWrites = readOnly || demo;

  const copy = phase === 'ask' ? V3_COPY.ask : phase === 'loop' ? V3_COPY.loop : phase === 'first-look' ? V3_COPY.firstLook : V3_COPY.reveal;
  // BookAsk renders the ask lede itself; the other ledes belong to the frame.
  const lede = phase === 'loop' ? V3_COPY.loop.lede : phase === 'first-look' ? V3_COPY.firstLook.lede : null;
  const step = STEP[phase];
  // BookAccount has no item-to-institution mapping. Once multiple items have
  // participated, FIFO labels cannot identify the import that is still pending.
  const imports = importSummary(importOutcomes);
  const syncingFirst = imports.pending
    ? Object.keys(importOutcomes).length > 1 ? 'Your brokerage' : syncing[0] ?? 'Your brokerage'
    : null;
  // A failed book read must not pass for an empty book: the reveal would read
  // no positions and the loop would count none.
  const bookFailed = !!book.error && !book.loading;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-[#050505] overflow-y-auto overscroll-contain">
        <div className="min-h-[100dvh] flex flex-col">
          <div className="mx-auto w-full max-w-5xl px-4 py-10">
            <div role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={STEPS} className="flex gap-1.5">
              {Array.from({ length: STEPS }, (_, i) => i + 1).map((n) => (
                <span key={n} aria-hidden="true" className={`h-1 w-10 rounded-full ${n <= step ? 'bg-[var(--color-gold)]' : 'bg-[var(--color-surface-tint)]'}`} />
              ))}
              <span className="sr-only">{V3_COPY.step(step)}</span>
            </div>

            <h1 className="type-h1 mt-6">{copy.title}</h1>
            {lede && <p className="mt-2 text-[16px] leading-relaxed text-[var(--color-text-secondary)]">{lede}</p>}

            <div className="mt-8">
              {imports.incomplete && (
                <section role="status" className="mb-5 rounded-xl border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] p-4">
                  <p className="text-[14px] text-[var(--color-text-primary)]">
                    {imports.issue === 'partial'
                      ? 'The import is incomplete. Helm can read the positions received so far, but some information is still missing.'
                      : imports.issue === 'timeout'
                        ? 'Your brokerage connection is saved. The import is taking longer than expected, so we cannot confirm your holdings yet.'
                        : 'Your brokerage connection is saved, but the holdings import did not finish.'}
                  </p>
                  <p className="mt-2 text-[13px] text-[var(--color-text-secondary)]">Retry the import and review the positions received. A connected brokerage can still import later, so do not enter the same holdings manually. You can use the form for positions held outside your linked accounts.</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {imports.retryItemId && !noWrites && (
                      <button type="button" disabled={imports.pending} onClick={() => void retryImport()} className="min-h-[44px] rounded-md border border-[var(--color-border-base)] px-4 text-[13px] text-[var(--color-text-primary)] disabled:opacity-50">{imports.pending ? 'Import in progress' : 'Retry import'}</button>
                    )}
                    {phase !== 'loop' && (
                      <button type="button" onClick={() => setPhase('loop')} className="min-h-[44px] rounded-md border border-[var(--color-border-base)] px-4 text-[13px] text-[var(--color-text-primary)]">Review or add positions</button>
                    )}
                  </div>
                </section>
              )}
              {phase === 'ask' && (
                <BookAsk
                  linkedInstitutions={book.accounts.map((a) => a.institution)}
                  onPlaidSuccess={onPlaidSuccess}
                  onPlaidSynced={onPlaidSynced}
                  onManualComplete={onManualComplete}
                  onDuplicate={onDuplicate}
                  onChoice={onChoice}
                  onPlaidExit={onPlaidExit}
                  readOnly={noWrites}
                />
              )}
              {demo && phase === 'ask' && (
                /* With writes off, no connect and no manual save can advance the
                   flow, so the demo gets the one door the screens cannot give it. */
                <div className="mt-6">
                  <button type="button" className="helm-button inline-flex min-h-[44px] items-center gap-2" onClick={() => setPhase('loop')}>
                    {V3_COPY.demoContinue}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
              {phase === 'loop' && bookFailed && (
                <p role="status" className="mb-4 text-[13px] text-[var(--color-text-secondary)]">{book.error}</p>
              )}
              {phase === 'loop' && (
                <AccountLoop
                  accounts={book.accounts}
                  holdings={book.holdings}
                  syncing={syncingFirst}
                  importsIncomplete={imports.incomplete || imports.pending}
                  duplicate={duplicate}
                  onPlaidSuccess={onPlaidSuccess}
                  onPlaidSynced={onPlaidSynced}
                  onManualComplete={onManualComplete}
                  onDuplicate={onDuplicate}
                  onChoice={onChoice}
                  onPlaidExit={onPlaidExit}
                  onContinue={onContinue}
                  readOnly={noWrites}
                />
              )}
              {phase === 'first-look' && (
                <FirstLookScreen
                  holdings={bookFailed ? [] : book.holdings}
                  accounts={book.accounts}
                  syncing={syncingFirst}
                  readOnly={noWrites}
                  onDone={onFirstLook}
                />
              )}
              {phase === 'reveal' && bookFailed && (
                <section>
                  <p role="alert" className="text-[15px] text-[var(--color-text-primary)]">{V3_COPY.reveal.bookError}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" className="min-h-[44px] rounded-md border border-[var(--color-border-base)] px-4 text-[13px] text-[var(--color-text-primary)]" onClick={() => void book.refetch()}>{V3_COPY.reveal.retry}</button>
                    <button type="button" className="helm-button min-h-[44px]" onClick={onOpenTerminal}>{V3_COPY.reveal.primary}</button>
                  </div>
                </section>
              )}
              {phase === 'reveal' && !bookFailed && (
                <BookReveal
                  holdings={book.holdings}
                  accounts={book.accounts.length}
                  syncing={syncingFirst}
                  importsIncomplete={imports.incomplete}
                  firstLook={firstLook}
                  onOpenTerminal={onOpenTerminal}
                  onViewed={onViewed}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onLater}
        className="fixed left-4 bottom-4 z-[111] min-h-[44px] text-[13px] text-[var(--color-text-muted)] underline-offset-2 hover:underline"
      >
        {V3_COPY.later}
      </button>
    </>
  );
}
