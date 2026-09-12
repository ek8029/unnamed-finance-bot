'use client';
// Screen 3 of onboarding v3: the reveal. The book read once: top exposures
// split direct versus inside funds, the one sentence, the receipt on the
// largest name (or the honest fallback), an optional changes card. Never a
// fabricated verdict: the receipt is whatever /api/scan/ticker cites.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { BookHolding } from './use-book';
import { ReceiptCard, fetchReceipt, type Receipt } from './receipt-card';
import { bookExposure, exposureSentence, overlapSentence, type BookExposure } from '@/lib/onboarding/v3-exposure';
import { orderRevealCards, wantsOverlap, type FirstLook } from '@/lib/onboarding/first-look';
import { V3_COPY } from '@/lib/onboarding/v3-copy';
import { revealViewedProperties } from './import-outcome';

const copy = V3_COPY.reveal;
const CARD = 'rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-5';
const STRIPE = { backgroundImage: 'repeating-linear-gradient(45deg, var(--color-gold) 0 4px, transparent 4px 8px)' } as const;

type Mover = { ticker: string; changePct: number };
type ReceiptState = { ticker: string; state: 'loading' | 'error' } | { ticker: string; state: 'ready'; data: Receipt | null };

export function BookReveal({ holdings, accounts, syncing, importsIncomplete, firstLook, onOpenTerminal, onViewed }: {
  holdings: BookHolding[];
  accounts: number;
  syncing: string | null;
  importsIncomplete: boolean;
  /** null = not answered yet, which orders the cards the default way. */
  firstLook: FirstLook[] | null;
  onOpenTerminal: () => void;
  /** Fires exactly once, after the receipt fetch settles on Ready. */
  onViewed: (p: { top_ticker_covered: boolean; synced: boolean }) => void;
}) {
  const book = bookExposure(holdings);
  const top = book.top?.ticker ?? null;
  const cards = orderRevealCards(firstLook, accounts);
  const [receipt, setReceipt] = useState<ReceiptState>({ ticker: '', state: 'loading' });
  // null = loading; 'error' = the fetch failed, so no claim is made either way.
  const [movers, setMovers] = useState<Mover[] | 'error' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const viewed = useRef(false);

  useEffect(() => {
    if (!top) return;
    let cancelled = false;
    setReceipt({ ticker: top, state: 'loading' });
    fetchReceipt(top)
      .then((data) => { if (!cancelled) setReceipt({ ticker: top, state: 'ready', data }); })
      .catch(() => { if (!cancelled) setReceipt({ ticker: top, state: 'error' }); });
    return () => { cancelled = true; };
  }, [top, attempt]);

  const wantsChanges = cards.includes('changes');
  useEffect(() => {
    if (!wantsChanges || movers !== null) return;
    let cancelled = false;
    fetch('/api/dashboard/delta', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        // The route reports the one largest live move on the book (or null).
        const m = d?.mover;
        setMovers(m && typeof m.ticker === 'string' && Number.isFinite(m.changePct) ? [{ ticker: m.ticker, changePct: m.changePct }] : []);
      })
      .catch(() => { if (!cancelled) setMovers('error'); });
    return () => { cancelled = true; };
  }, [wantsChanges, movers]);

  const settled = receipt.state === 'ready' && receipt.ticker === top ? receipt : null;
  useEffect(() => {
    if (!top || !settled || viewed.current) return;
    viewed.current = true;
    onViewed(revealViewedProperties(settled.data !== null, !!syncing, importsIncomplete));
  }, [top, settled, syncing, importsIncomplete, onViewed]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const primary = (
    <button type="button" className="helm-button inline-flex min-h-[44px] items-center gap-2" onClick={onOpenTerminal}>
      {copy.primary}
      <ArrowRight size={18} aria-hidden="true" />
    </button>
  );

  if (holdings.length === 0 && syncing) {
    return (
      <section aria-busy="true">
        <h3 className="text-[15px] text-[var(--color-text-primary)]">{copy.loading}</h3>
        <div className="mt-4 grid gap-3" aria-hidden="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-3 animate-pulse rounded bg-[var(--color-surface-tint)]" style={{ width: `${80 - i * 15}%` }} />)}
        </div>
      </section>
    );
  }

  if (!top) {
    return (
      <section>
        <p className="mb-4 text-[14px] text-[var(--color-text-secondary)]">No positions are available to read yet. Add positions or check your connected accounts.</p>
        <div className="flex flex-col items-start gap-3">{primary}</div>
      </section>
    );
  }

  if (receipt.state === 'error' && receipt.ticker === top) {
    return (
      <section>
        <p role="alert" className="text-[15px] text-[var(--color-text-primary)]">{copy.error}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="min-h-[44px] rounded-md border border-[var(--color-border-base)] px-4 text-[13px] text-[var(--color-text-primary)]" onClick={retry}>{copy.retry}</button>
          {primary}
        </div>
      </section>
    );
  }

  const sentence = wantsOverlap(firstLook, accounts) ? overlapSentence(book, accounts) : exposureSentence(book);
  const held = new Set(holdings.map((h) => h.ticker.toUpperCase()));
  const heldMovers = (Array.isArray(movers) ? movers : []).filter((m) => held.has(m.ticker.toUpperCase())).slice(0, 5);

  return (
    <section>
      {syncing && <p role="status" className="mb-4 text-[13px] text-[var(--color-text-secondary)]">{copy.stillSyncing(syncing)}</p>}
      <div className="grid grid-cols-1 gap-4 min-[860px]:grid-cols-2">
        {cards.map((c) => {
          if (c === 'exposure') return <ExposureCard key={c} book={book} sentence={sentence} />;
          if (c === 'receipts') return <ReceiptCard key={c} className={CARD} ticker={top} receipt={settled ? settled.data : undefined} />;
          if (movers === 'error') return null;
          return (
            <article key={c} className={CARD}>
              <h3 className="text-[14px] font-medium text-[var(--color-text-primary)]">{copy.changesHeading}</h3>
              {movers === null ? (
                <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-[var(--color-surface-tint)]" aria-hidden="true" />
              ) : heldMovers.length === 0 ? (
                <p className="mt-3 text-[13px] text-[var(--color-text-secondary)]">{copy.changesEmpty}</p>
              ) : (
                <ul className="mt-3 grid gap-1">
                  {heldMovers.map((m) => (
                    <li key={m.ticker} className="flex justify-between text-[13px]">
                      <span className="text-[var(--color-text-primary)]">{m.ticker}</span>
                      <span className={m.changePct >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}>{m.changePct >= 0 ? '+' : ''}{m.changePct.toFixed(2)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
      <div className="mt-8 flex flex-col items-start gap-3">{primary}{!importsIncomplete && !syncing && <p className="text-[13px] text-[var(--color-text-muted)]">{copy.promise}</p>}</div>
    </section>
  );
}

function ExposureCard({ book, sentence }: { book: BookExposure; sentence: string }) {
  return (
    <article className={CARD}>
      <h3 className="text-[14px] font-medium text-[var(--color-text-primary)]">{copy.exposureHeading}</h3>
      <ul className="mt-4 grid gap-3">
        {book.rows.slice(0, 5).map((r) => {
          const direct = Math.min(100, Math.max(0, r.directPct));
          const indirect = Math.min(100 - direct, Math.max(0, r.indirectPct));
          return (
            <li key={r.ticker}>
              <div className="flex items-baseline justify-between text-[13px]" aria-hidden="true">
                <span className="text-[var(--color-text-primary)]">{r.ticker}</span>
                <span className="text-[var(--color-text-secondary)]">{Math.round(r.totalPct)}%</span>
              </div>
              <div className="mt-1 flex h-2 overflow-hidden rounded bg-[var(--color-surface-tint)]" aria-hidden="true">
                <div className="h-full bg-[var(--color-gold)]" style={{ width: `${direct}%` }} />
                <div className="h-full" style={{ width: `${indirect}%`, ...STRIPE }} />
              </div>
              <span className="sr-only">{r.ticker}: {Math.round(r.directPct)}% direct, {Math.round(r.indirectPct)}% inside funds</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-2"><span className="inline-block h-2 w-4 rounded-sm bg-[var(--color-gold)]" aria-hidden="true" />{copy.legendDirect}</span>
        <span className="flex items-center gap-2"><span className="inline-block h-2 w-4 rounded-sm" style={STRIPE} aria-hidden="true" />{copy.legendFunds}</span>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-[var(--color-text-primary)]">{sentence}</p>
    </article>
  );
}
