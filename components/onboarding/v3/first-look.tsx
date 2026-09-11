'use client';
// Screen 3 of onboarding v3: what the person wants Helm to lead with. Its own
// screen, and every card previews the answer against THEIR book: the exposure
// card draws their real top weights, the receipts card names their largest
// position, the changes card reads today's largest move on the book, the
// overlap card counts the names sitting in more than one of their accounts.
//
// Nothing here is a verdict and nothing is invented. A book that has not landed
// yet says so; a failed read says nothing at all rather than claiming calm.
import { useEffect, useRef, useState } from 'react';
import { FIRST_LOOK_CODES, type FirstLook } from '@/lib/onboarding/first-look';
import { bookExposure } from '@/lib/onboarding/v3-exposure';
import { V3_COPY } from '@/lib/onboarding/v3-copy';
import type { BookHolding } from './use-book';

const copy = V3_COPY.firstLook;
const STRIPE = { backgroundImage: 'repeating-linear-gradient(45deg, var(--color-gold) 0 4px, transparent 4px 8px)' } as const;

type Mover = { ticker: string; changePct: number } | null;

export function FirstLookScreen({ holdings, accounts, syncing, readOnly = false, onDone }: {
  holdings: BookHolding[];
  accounts: number;
  /** Institution still importing, or null. Drives the "not landed yet" line. */
  syncing: string | null;
  /** Harness: preview the screen without writing the preference. */
  readOnly?: boolean;
  onDone: (codes: FirstLook[]) => void;
}) {
  const [picked, setPicked] = useState<FirstLook[]>([]);
  const [submitted, setSubmitted] = useState(false);
  // null = still reading, 'error' = no claim either way.
  const [mover, setMover] = useState<Mover | 'error' | undefined>(undefined);
  const done = useRef(false);

  const book = bookExposure(holdings);
  const rows = book.rows.slice(0, 3);
  const shared = book.rows.filter((r) => r.accounts > 1);
  const options = FIRST_LOOK_CODES.filter((c) => c !== 'overlap' || accounts >= 2);
  // An empty book reads differently mid-import than after one: only the first
  // is a "wait", the second is simply an empty book.
  const pending = rows.length === 0 ? (syncing ? copy.pending : copy.empty) : null;

  useEffect(() => {
    if (holdings.length === 0) return;
    let cancelled = false;
    fetch('/api/dashboard/delta', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        const m = d?.mover;
        setMover(m && typeof m.ticker === 'string' && Number.isFinite(m.changePct) ? { ticker: m.ticker, changePct: m.changePct } : null);
      })
      .catch(() => { if (!cancelled) setMover('error'); });
    return () => { cancelled = true; };
  }, [holdings.length]);

  const toggle = (c: FirstLook) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  function save(codes: FirstLook[]) {
    if (done.current) return;
    done.current = true;
    setSubmitted(true);
    // Non-blocking: a failed save (migration not applied, network) never holds the reveal.
    if (!readOnly) {
      fetch('/api/user/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ first_look: codes }) })
        .catch((e) => console.error('first_look save failed', e));
    }
    onDone(codes);
  }

  return (
    <section>
      {/* The screen heading above already names this group, so the fieldset
          takes it as a label rather than repeating it in a legend. */}
      <fieldset aria-label={copy.title}>
        <div className="grid grid-cols-1 gap-4 min-[860px]:grid-cols-2">
          {options.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer flex-col rounded-xl border border-[var(--color-border-base)] bg-[var(--color-surface-tint)] p-5 transition-colors hover:border-[var(--color-border-strong)] has-[:checked]:border-[var(--color-gold)]"
            >
              <span className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  checked={picked.includes(c)}
                  onChange={() => toggle(c)}
                  disabled={submitted}
                />
                <span>
                  <span className="block text-[15px] text-[var(--color-text-primary)]">{copy.options[c]}</span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{copy.hints[c]}</span>
                </span>
              </span>

              <span className="mt-4 block min-h-[84px]">
                {c === 'exposure' && <ExposurePreview rows={rows} pending={pending} />}
                {c === 'receipts' && <ReceiptsPreview ticker={book.top?.ticker ?? null} pending={pending} />}
                {c === 'changes' && <ChangesPreview mover={mover} pending={pending} />}
                {c === 'overlap' && <OverlapPreview shared={shared} pending={pending} />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-8 flex flex-col items-start gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className="helm-button min-h-[44px]" onClick={() => save(picked)} disabled={submitted}>{copy.save}</button>
          <button type="button" className="min-h-[44px] text-[13px] text-[var(--color-text-muted)] underline-offset-2 hover:underline" onClick={() => save([])} disabled={submitted}>{copy.skip}</button>
        </div>
      </div>
    </section>
  );
}

function Pending({ line }: { line: string }) {
  return <span className="block text-[12px] text-[var(--color-text-muted)]">{line}</span>;
}

function ExposurePreview({ rows, pending }: { rows: { ticker: string; totalPct: number; directPct: number; indirectPct: number }[]; pending: string | null }) {
  if (pending) return <Pending line={pending} />;
  return (
    <span className="block">
      {rows.map((r) => {
        const direct = Math.min(100, Math.max(0, r.directPct));
        const indirect = Math.min(100 - direct, Math.max(0, r.indirectPct));
        return (
          <span key={r.ticker} className="mb-2 block last:mb-0">
            <span className="flex items-baseline justify-between text-[12px]">
              <span className="text-[var(--color-text-primary)]">{r.ticker}</span>
              <span className="tabular-nums text-[var(--color-text-secondary)]">{Math.round(r.totalPct)}%</span>
            </span>
            <span className="mt-1 flex h-2 overflow-hidden rounded bg-[var(--color-bg-base)]" aria-hidden="true">
              <span className="h-full bg-[var(--color-gold)]" style={{ width: `${direct}%` }} />
              <span className="h-full" style={{ width: `${indirect}%`, ...STRIPE }} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function ReceiptsPreview({ ticker, pending }: { ticker: string | null; pending: string | null }) {
  if (pending || !ticker) return <Pending line={pending ?? V3_COPY.firstLook.empty} />;
  return (
    <span className="flex items-center gap-3">
      <span className="rounded-md border border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] px-2.5 py-1 text-[14px] tabular-nums text-[var(--color-text-primary)]">{ticker}</span>
      <span className="flex flex-wrap gap-1.5">
        {copy.sourceTags.map((tag) => (
          <span key={tag} className="rounded border border-[var(--color-border-base)] px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{tag}</span>
        ))}
      </span>
    </span>
  );
}

function ChangesPreview({ mover, pending }: { mover: Mover | 'error' | undefined; pending: string | null }) {
  if (pending) return <Pending line={pending} />;
  if (mover === 'error') return null;
  if (mover === undefined) return <span className="block h-3 w-2/3 animate-pulse rounded bg-[var(--color-bg-base)]" aria-hidden="true" />;
  if (mover === null) return <Pending line={copy.moverNone} />;
  const up = mover.changePct >= 0;
  const pct = `${Math.abs(mover.changePct).toFixed(2)}%`;
  return (
    <span className="flex items-baseline gap-2">
      <span className={`text-[22px] tabular-nums ${up ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{up ? '+' : '-'}{pct}</span>
      <span className="text-[13px] text-[var(--color-text-secondary)]">{up ? copy.moverUp(mover.ticker, pct) : copy.moverDown(mover.ticker, pct)}</span>
    </span>
  );
}

function OverlapPreview({ shared, pending }: { shared: { ticker: string; accounts: number }[]; pending: string | null }) {
  if (pending) return <Pending line={pending} />;
  if (shared.length === 0) return <Pending line={copy.noShared} />;
  return (
    <span className="block">
      <span className="block text-[13px] text-[var(--color-text-primary)]">{copy.sharedNames(shared.length)}</span>
      <span className="mt-2 flex flex-wrap gap-1.5">
        {shared.slice(0, 4).map((r) => (
          <span key={r.ticker} className="rounded-full border border-[var(--color-border-base)] px-2 py-0.5 text-[12px] text-[var(--color-text-secondary)]">{r.ticker}</span>
        ))}
      </span>
    </span>
  );
}
