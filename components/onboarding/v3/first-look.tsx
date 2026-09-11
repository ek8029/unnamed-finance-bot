'use client';
// Screen 3 of onboarding v3: what the person wants Helm to lead with. Its own
// screen, and every card draws the answer from THEIR book: the whole book as a
// treemap, their largest position on a sheet of filings, the day's largest move
// as a 45-day line, and a grid of which account holds which shared name.
//
// Nothing here is a verdict and nothing is invented. A book that has not landed
// yet says so; a failed read says nothing at all rather than claiming calm.
import { useEffect, useRef, useState } from 'react';
import { FIRST_LOOK_CODES, type FirstLook } from '@/lib/onboarding/first-look';
import { bookExposure, type ExposureRow } from '@/lib/onboarding/v3-exposure';
import { squarify, sparkPath } from '@/lib/onboarding/treemap';
import { overlapColumns } from '@/lib/onboarding/v3-book-view';
import { V3_COPY } from '@/lib/onboarding/v3-copy';
import type { BookAccount, BookHolding } from './use-book';

const copy = V3_COPY.firstLook;
const STRIPE = { backgroundImage: 'repeating-linear-gradient(45deg, var(--color-gold) 0 4px, transparent 4px 8px)' } as const;

type Mover = { ticker: string; changePct: number } | null;

export function FirstLookScreen({ holdings, accounts, syncing, readOnly = false, onDone }: {
  holdings: BookHolding[];
  accounts: BookAccount[];
  /** Institution still importing, or null. Drives the "not landed yet" line. */
  syncing: string | null;
  /** Harness: preview the screen without writing the preference. */
  readOnly?: boolean;
  onDone: (codes: FirstLook[]) => void;
}) {
  const [picked, setPicked] = useState<FirstLook[]>([]);
  const [submitted, setSubmitted] = useState(false);
  // undefined = still reading, 'error' = no claim either way, null = no mover.
  const [mover, setMover] = useState<Mover | 'error' | undefined>(undefined);
  const [closes, setCloses] = useState<number[]>([]);
  const done = useRef(false);

  const book = bookExposure(holdings);
  const shared = book.rows.filter((r) => r.accounts > 1);
  const options = FIRST_LOOK_CODES.filter((c) => c !== 'overlap' || accounts.length >= 2);
  // An empty book reads differently mid-import than after one: only the first
  // is a "wait", the second is simply an empty book.
  const pending = book.rows.length === 0 ? (syncing ? copy.pending : copy.empty) : null;

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

  // The line under the move. A failed or too-short history draws nothing.
  const moverTicker = mover && mover !== 'error' ? mover.ticker : null;
  useEffect(() => {
    if (!moverTicker) return;
    let cancelled = false;
    fetch(`/api/market/history?ticker=${encodeURIComponent(moverTicker)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (cancelled) return;
        setCloses((d?.prices ?? [])
          .map((p: { close?: unknown }) => Number(p.close))
          .filter((n: number) => Number.isFinite(n) && n > 0));
      })
      .catch(() => { if (!cancelled) setCloses([]); });
    return () => { cancelled = true; };
  }, [moverTicker]);

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

              <span className="mt-4 block min-h-[104px]">
                {c === 'exposure' && <ExposurePreview rows={book.rows} pending={pending} />}
                {c === 'receipts' && <ReceiptsPreview row={book.top} pending={pending} />}
                {c === 'changes' && <ChangesPreview mover={mover} closes={closes} pending={pending} />}
                {c === 'overlap' && <OverlapPreview shared={shared} accounts={accounts} pending={pending} />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="button" className="helm-button min-h-[44px]" onClick={() => save(picked)} disabled={submitted}>{copy.save}</button>
        <button type="button" className="min-h-[44px] text-[13px] text-[var(--color-text-muted)] underline-offset-2 hover:underline" onClick={() => save([])} disabled={submitted}>{copy.skip}</button>
      </div>
    </section>
  );
}

function Pending({ line }: { line: string }) {
  return <span className="block text-[12px] text-[var(--color-text-muted)]">{line}</span>;
}

// The treemap is laid out in these units and scaled by the SVG, so a tile can
// be measured against its label here without touching the DOM.
const MAP_W = 300;
const MAP_H = 124;

function ExposurePreview({ rows, pending }: { rows: ExposureRow[]; pending: string | null }) {
  if (pending) return <Pending line={pending} />;
  // Every name, not a top five: the slivers are the point of the picture.
  const tiles = squarify(rows.map((r) => r.totalPct), MAP_W, MAP_H);
  const topPct = rows[0]?.totalPct || 1;
  return (
    <span className="block">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="block w-full rounded-md"
        role="img"
        aria-label={rows.slice(0, 5).map((r) => `${r.ticker} ${Math.round(r.totalPct)}%`).join(', ')}
      >
        <defs>
          <pattern id="fl-funds" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width={6} height={6} fill="var(--color-gold)" fillOpacity={0.18} />
            <rect width={3} height={6} fill="var(--color-gold)" />
          </pattern>
        </defs>
        {tiles.map((t) => {
          const row = rows[t.index];
          // Weight reads as fill strength as well as area, so the eye lands on
          // the concentration instead of counting boxes.
          const opacity = 0.2 + 0.72 * Math.min(1, row.totalPct / topPct);
          // The striped band is the part of this name held through a fund, cut
          // from the bottom of its own tile, so the legend below is literal.
          const fundBand = row.totalPct > 0 ? t.h * Math.min(1, Math.max(0, row.indirectPct / row.totalPct)) : 0;
          // 9px type runs about 5.6 units a character here, plus the inset.
          const fits = t.w > row.ticker.length * 5.6 + 8;
          return (
            <g key={row.ticker}>
              <rect x={t.x} y={t.y} width={t.w} height={t.h} fill="var(--color-gold)" fillOpacity={opacity} />
              {fundBand > 0.5 && <rect x={t.x} y={t.y + t.h - fundBand} width={t.w} height={fundBand} fill="url(#fl-funds)" fillOpacity={Math.min(1, opacity + 0.15)} />}
              <rect x={t.x} y={t.y} width={t.w} height={t.h} fill="none" stroke="var(--color-bg-base)" strokeWidth={0.8} />
              {fits && t.h > 15 && <text x={t.x + 4} y={t.y + 11} fontSize={9} fontWeight={600} fill="#0A0A0A">{row.ticker}</text>}
              {fits && t.w > 52 && t.h > 31 && <text x={t.x + 4} y={t.y + 22} fontSize={8} fill="#0A0A0A" fillOpacity={0.7}>{Math.round(row.totalPct)}%</text>}
            </g>
          );
        })}
      </svg>
      <span className="mt-2 flex flex-wrap gap-4 text-[11px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-[var(--color-gold)]" aria-hidden="true" />{V3_COPY.reveal.legendDirect}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm" style={STRIPE} aria-hidden="true" />{V3_COPY.reveal.legendFunds}</span>
      </span>
    </span>
  );
}

function ReceiptsPreview({ row, pending }: { row: ExposureRow | null; pending: string | null }) {
  if (pending || !row) return <Pending line={pending ?? copy.empty} />;
  return (
    <span className="flex items-center gap-4">
      {/* Three sheets, the front one carrying the ticker. */}
      <svg viewBox="0 0 84 100" className="block h-[118px] w-[100px] shrink-0" aria-hidden="true">
        <rect x={16} y={12} width={54} height={74} rx={3} fill="var(--color-surface-tint)" stroke="var(--color-border-base)" transform="rotate(-7 43 49)" />
        <rect x={13} y={14} width={54} height={74} rx={3} fill="var(--color-surface-tint)" stroke="var(--color-border-base)" transform="rotate(4 40 51)" />
        <rect x={15} y={15} width={54} height={74} rx={3} fill="var(--color-bg-base)" stroke="var(--color-gold-border)" />
        <text x={42} y={42} fontSize={13} fontWeight={600} textAnchor="middle" fill="var(--color-gold)">{row.ticker}</text>
        {[52, 60, 68, 76].map((y, i) => (
          <rect key={y} x={23} y={y} width={i === 3 ? 20 : 38 - i * 4} height={3} rx={1.5} fill="var(--color-border-strong)" />
        ))}
      </svg>
      <span className="block">
        <span className="block text-[13px] leading-relaxed text-[var(--color-text-primary)]">{copy.largest(row.ticker, Math.round(row.totalPct))}</span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          {copy.sourceTags.map((tag) => (
            <span key={tag} className="rounded border border-[var(--color-border-base)] px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{tag}</span>
          ))}
        </span>
      </span>
    </span>
  );
}

const LINE_W = 150;
const LINE_H = 44;

function ChangesPreview({ mover, closes, pending }: { mover: Mover | 'error' | undefined; closes: number[]; pending: string | null }) {
  if (pending) return <Pending line={pending} />;
  if (mover === 'error') return null;
  if (mover === undefined) return <span className="block h-3 w-2/3 animate-pulse rounded bg-[var(--color-bg-base)]" aria-hidden="true" />;
  if (mover === null) return <Pending line={copy.moverNone} />;
  const up = mover.changePct >= 0;
  const pct = `${Math.abs(mover.changePct).toFixed(2)}%`;
  const colour = up ? 'var(--color-positive)' : 'var(--color-negative)';
  const d = sparkPath(closes, LINE_W, LINE_H, 3);
  // The last point of the path, for the dot that sits on today.
  const lastY = d ? Number(d.slice(d.lastIndexOf(',') + 1)) : null;
  return (
    <span className="block">
      <span className="flex items-baseline gap-2">
        <span className="text-[26px] tabular-nums" style={{ color: colour }}>{up ? '+' : '-'}{pct}</span>
        <span className="text-[13px] text-[var(--color-text-secondary)]">{up ? copy.moverUp(mover.ticker, pct) : copy.moverDown(mover.ticker, pct)}</span>
      </span>
      {d ? (
        <>
        <svg viewBox={`0 0 ${LINE_W} ${LINE_H}`} className="mt-2 block w-full max-w-[320px]" role="img" aria-label={copy.lineLabel(mover.ticker, closes.length)}>
          <path d={d} fill="none" stroke={colour} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
          {lastY != null && Number.isFinite(lastY) && <circle cx={LINE_W} cy={lastY} r={2.2} fill={colour} />}
        </svg>
        <span className="mt-1 block text-[11px] text-[var(--color-text-muted)]">{copy.lineCaption(closes.length)}</span>
        </>
      ) : (
        <span className="mt-2 block text-[11px] text-[var(--color-text-muted)]">{copy.noHistory}</span>
      )}
    </span>
  );
}

// Which account holds which shared name. The grid is the graphic: a filled cell
// is that account holding that name, directly or through a fund it holds.
function OverlapPreview({ shared, accounts, pending }: { shared: ExposureRow[]; accounts: BookAccount[]; pending: string | null }) {
  if (pending) return <Pending line={pending} />;
  if (shared.length === 0) return <Pending line={copy.noShared} />;
  const rows = shared.slice(0, 4);
  const cols = overlapColumns(rows, accounts);
  // Under one column there is no grid to read: a holding can carry no account
  // id, and those names light nothing. Name them instead of drawing a blank.
  if (cols.length < 2) {
    return (
      <span className="block">
        <span className="block text-[13px] text-[var(--color-text-primary)]">{copy.sharedNames(shared.length)}</span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <span key={r.ticker} className="rounded-full border border-[var(--color-border-base)] px-2 py-0.5 text-[12px] text-[var(--color-text-secondary)]">{r.ticker}</span>
          ))}
        </span>
      </span>
    );
  }
  return (
    <span className="block">
      <span className="block text-[13px] text-[var(--color-text-primary)]">{copy.sharedNames(shared.length)}</span>
      <span className="mt-3 block">
        {rows.map((r) => {
          const held = new Set(r.accountIds);
          return (
            <span key={r.ticker} className="mb-1.5 flex items-center gap-3 last:mb-0">
              <span className="w-14 shrink-0 text-[12px] text-[var(--color-text-secondary)]">{r.ticker}</span>
              <span className="flex gap-1.5">
                {cols.map((a) => (
                  <span
                    key={a.id}
                    className={`inline-block h-3 w-3 rounded-sm ${held.has(a.id) ? 'bg-[var(--color-gold)]' : 'border border-[var(--color-border-strong)]'}`}
                    aria-hidden="true"
                  />
                ))}
              </span>
              <span className="sr-only">{copy.heldIn(r.ticker, cols.filter((a) => held.has(a.id)).length)}</span>
            </span>
          );
        })}
      </span>
      <span className="mt-2 flex gap-1.5 pl-[68px] text-[10px] uppercase text-[var(--color-text-muted)]">
        {cols.map((a) => (
          <span key={a.id} className="inline-block w-3 text-center" title={a.institution}>{a.institution.slice(0, 2)}</span>
        ))}
      </span>
    </span>
  );
}
