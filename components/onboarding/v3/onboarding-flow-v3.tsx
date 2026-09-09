'use client';

// Onboarding v3: book first. Three screens over the dashboard, then the real
// terminal. No demo path, no tour. Spec: docs/superpowers/specs/
// 2026-09-08-onboarding-book-first-design.md sections 3, 3.4, 7, 9.
//
//   ask -> loop -> reveal -> /dashboard/portfolio
//
// The screens live in ./book-ask, ./account-loop, ./book-reveal and
// ./first-look. This file owns the state machine, the gate, the events and
// "Do this later". Events carry counts and codes only.

import { useCallback, useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';
import { BookAsk } from './book-ask';
import { AccountLoop } from './account-loop';
import { BookReveal } from './book-reveal';
import { FirstLookQuestion } from './first-look';
import { useBook, type BookAccount } from './use-book';
import type { FirstLook } from '@/lib/onboarding/first-look';
import { V3_COPY } from '@/lib/onboarding/v3-copy';

type Phase = 'ask' | 'loop' | 'reveal';
const V3_KEY = 'helm_onboarding_v3_deferred';
const STEP: Record<Phase, number> = { ask: 1, loop: 2, reveal: 3 };
const SYNC_POLL_MS = 10_000;

function track(event: string, props?: Record<string, unknown>) {
  try { posthog.capture(event, props); } catch { /* posthog no-ops if uninitialized */ }
}

function markDeferred() {
  try { localStorage.setItem(V3_KEY, '1'); } catch { /* storage blocked */ }
}

function lastPlaid(accounts: BookAccount[]): BookAccount | undefined {
  for (let i = accounts.length - 1; i >= 0; i--) if (accounts[i].source === 'plaid') return accounts[i];
  return undefined;
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
  // onSettled must fire once and only once, from whichever exit is reached.
  const settled = useRef(false);
  const settle = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    onSettled?.();
  }, [onSettled]);

  const book = useBook(show);
  const [phase, setPhase] = useState<Phase>(jumpTo ?? 'ask');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  // null = not answered yet.
  const [firstLook, setFirstLook] = useState<FirstLook[] | null>(null);
  const asked = useRef(false);
  // The question sits in the sync wait on the Plaid path and on the loop screen otherwise.
  const [sawPlaid, setSawPlaid] = useState(false);
  // Account ids on record before the latest Link success; the effect below
  // finds the newest Plaid account once the refetch lands.
  const idsBeforeLink = useRef<Set<string> | null>(null);
  const duplicatePending = useRef(false);
  const accountsRef = useRef(book.accounts);
  accountsRef.current = book.accounts;

  // Gate. A returning user with a book, or anyone who chose "later", never sees this.
  useEffect(() => {
    if (harness) return;
    let cancelled = false;
    try {
      if (localStorage.getItem(V3_KEY) === '1') { settle(); return; }
    } catch { /* storage blocked: fall through to the status read */ }
    fetch('/api/onboarding/status', { cache: 'no-store' })
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) { settle(); return; }
        const s = await r.json();
        if (cancelled) return;
        if (s?.hasSavedWork) { markDeferred(); settle(); return; }
        setShow(true);
        track('onb3_shown', { flow: 'v3' });
      })
      .catch(() => { if (!cancelled) settle(); });
    return () => { cancelled = true; };
  }, [harness, settle]);

  // Newest Plaid institution: the account whose id was not on record before
  // the Link success. Falls back to the last Plaid account when the summary
  // has not caught up yet.
  useEffect(() => {
    const before = idsBeforeLink.current;
    if (!before) return;
    const fresh = book.accounts.filter((a) => a.source === 'plaid' && !before.has(a.id));
    const newest = fresh[fresh.length - 1] ?? lastPlaid(book.accounts);
    if (!newest) return;
    idsBeforeLink.current = null;
    setSyncing(newest.institution);
    if (duplicatePending.current) {
      duplicatePending.current = false;
      setDuplicate(newest.institution);
    }
  }, [book.accounts]);

  // While an import runs, the book re-reads every ten seconds.
  useEffect(() => {
    if (!syncing) return;
    const id = setInterval(() => { void book.refetch(); }, SYNC_POLL_MS);
    return () => clearInterval(id);
  }, [syncing, book.refetch]);

  const leave = useCallback(() => {
    if (harness) { setPhase('ask'); void book.refetch(); return; }
    markDeferred();
    settle();
    window.location.href = '/dashboard/portfolio';
  }, [harness, settle, book.refetch]);

  const onPlaidSuccess = useCallback(() => {
    track('onb3_account_added', { flow: 'v3', via: 'plaid', accounts: accountsRef.current.length + 1 });
    setSawPlaid(true);
    idsBeforeLink.current = new Set(accountsRef.current.map((a) => a.id));
    void book.refetch();
    setPhase('loop');
  }, [book.refetch]);

  const onPlaidSynced = useCallback(() => {
    setSyncing(null);
    void book.refetch();
  }, [book.refetch]);

  const onManualComplete = useCallback(() => {
    track('onb3_account_added', { flow: 'v3', via: 'manual', accounts: accountsRef.current.length + 1 });
    void book.refetch();
    setPhase('loop');
  }, [book.refetch]);

  // PlaidLinkButton's warning is a fixed sentence with no institution in it and
  // fires before onSuccess, so the name comes from the newest-account effect.
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

  const manual = !sawPlaid;
  const question = firstLook === null && !asked.current ? (
    <FirstLookQuestion
      accounts={book.accounts.length}
      onDone={(codes) => {
        asked.current = true;
        setFirstLook(codes);
        track('onb3_first_look', { flow: 'v3', count: codes.length, skipped: codes.length === 0 });
      }}
    />
  ) : null;

  const copy = phase === 'ask' ? V3_COPY.ask : phase === 'loop' ? V3_COPY.loop : V3_COPY.reveal;
  // BookAsk renders the ask lede itself; the loop lede belongs to the frame.
  const lede = phase === 'loop' ? V3_COPY.loop.lede : null;
  const step = STEP[phase];

  return (
    <>
      <style jsx global>{`
        @keyframes onb-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes onb-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes onb-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes onb-check { from { stroke-dashoffset: 30; } to { stroke-dashoffset: 0; } }
        @keyframes onb-scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(400%); } }
        @media (prefers-reduced-motion: reduce) {
          @keyframes onb-fade-up { from, to { opacity: 1; transform: none; } }
          @keyframes onb-fade-in { from, to { opacity: 1; } }
          @keyframes onb-progress { from, to { transform: scaleX(1); } }
          @keyframes onb-scanline { from, to { transform: translateY(150%); } }
        }
      `}</style>

      <div className="fixed inset-0 z-[100] bg-[#050505] overflow-y-auto overscroll-contain">
        <div className="min-h-[100dvh] flex flex-col">
          <div className="mx-auto w-full max-w-5xl px-4 py-10">
            <div role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3} className="flex gap-1.5">
              {[1, 2, 3].map((n) => (
                <span key={n} aria-hidden="true" className={`h-1 w-10 rounded-full ${n <= step ? 'bg-[var(--color-gold)]' : 'bg-[var(--color-surface-tint)]'}`} />
              ))}
              <span className="sr-only">{V3_COPY.step(step)}</span>
            </div>

            <h1 className="type-h1 mt-6">{copy.title}</h1>
            {lede && <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{lede}</p>}

            <div className="mt-8">
              {phase === 'ask' && (
                <BookAsk
                  linkedInstitutions={book.accounts.map((a) => a.institution)}
                  onPlaidSuccess={onPlaidSuccess}
                  onPlaidSynced={onPlaidSynced}
                  onManualComplete={onManualComplete}
                  onDuplicate={onDuplicate}
                  onChoice={onChoice}
                  onPlaidExit={onPlaidExit}
                  readOnly={readOnly}
                />
              )}
              {phase === 'loop' && (
                <AccountLoop
                  accounts={book.accounts}
                  holdings={book.holdings}
                  syncing={syncing}
                  duplicate={duplicate}
                  onPlaidSuccess={onPlaidSuccess}
                  onPlaidSynced={onPlaidSynced}
                  onManualComplete={onManualComplete}
                  onDuplicate={onDuplicate}
                  onChoice={onChoice}
                  onPlaidExit={onPlaidExit}
                  onContinue={onContinue}
                  firstLookSlot={manual ? question : undefined}
                  readOnly={readOnly}
                />
              )}
              {phase === 'reveal' && (
                <BookReveal
                  holdings={book.holdings}
                  accounts={book.accounts.length}
                  syncing={syncing}
                  firstLook={firstLook}
                  firstLookSlot={manual ? undefined : question}
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
