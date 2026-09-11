'use client';
// Screen 3 of onboarding v3: what the person wants Helm to lead with. Its own
// screen, and every card draws its answer from THEIR book: the book by sector
// as a treemap, Helm's cited read on their largest position, the session's
// biggest movers among their own names, the morning read on those names, and a
// grid of which account holds which shared name.
//
// Nothing here is a verdict Helm did not reach and nothing is invented. A book
// that has not landed yet says so, a failed read says nothing at all rather
// than claiming calm, and the movers are labelled with the session they
// describe instead of being called "today" on a Sunday.
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { FIRST_LOOK_CODES, type FirstLook } from '@/lib/onboarding/first-look';
import { bookExposure, type ExposureRow } from '@/lib/onboarding/v3-exposure';
import { squarify } from '@/lib/onboarding/treemap';
import { overlapColumns, sectorSplit, shortSector, type SectorSlice } from '@/lib/onboarding/v3-book-view';
import { V3_COPY } from '@/lib/onboarding/v3-copy';
import { useSettings } from '@/contexts/settings-context';
import { fetchReceipt, type Receipt } from './receipt-card';
import type { BookAccount, BookHolding } from './use-book';

const copy = V3_COPY.firstLook;
const BUCKETS = new Set<string>([copy.buckets.funds, copy.buckets.crypto, copy.buckets.unclassified]);

type Mover = { ticker: string; changePct: number; dollarImpact: number };
type Delta = { movers: Mover[]; isToday: boolean };

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
  // undefined = still reading, 'error' = no claim either way.
  const [delta, setDelta] = useState<Delta | 'error' | undefined>(undefined);
  const [receipt, setReceipt] = useState<Receipt | null | 'error' | undefined>(undefined);
  const done = useRef(false);

  const book = bookExposure(holdings);
  const sectors = sectorSplit(holdings, copy.buckets);
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
        const movers = (Array.isArray(d?.movers) ? d.movers : [])
          .filter((m: Mover) => m && typeof m.ticker === 'string' && Number.isFinite(m.changePct));
        setDelta({ movers, isToday: d?.isToday === true });
      })
      .catch(() => { if (!cancelled) setDelta('error'); });
    return () => { cancelled = true; };
  }, [holdings.length]);

  // Helm's own read on the largest name, cited. `null` means the ticker is
  // outside coverage, which is a real answer and not a failure.
  const top = book.top?.ticker ?? null;
  useEffect(() => {
    if (!top) return;
    let cancelled = false;
    setReceipt(undefined);
    fetchReceipt(top)
      .then((r) => { if (!cancelled) setReceipt(r); })
      .catch(() => { if (!cancelled) setReceipt('error'); });
    return () => { cancelled = true; };
  }, [top]);

  const toggle = (c: FirstLook) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  function save(codes: FirstLook[]) {
    if (done.current) return;
    done.current = true;
    setSubmitted(true);
    // Non-blocking: a failed save (migration not applied, network) never holds the reveal.
    if (!readOnly) void persist(codes);
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
                  className="mt-1 h-[18px] w-[18px] shrink-0"
                  checked={picked.includes(c)}
                  onChange={() => toggle(c)}
                  disabled={submitted}
                />
                <span>
                  <span className="block text-[17px] leading-snug text-[var(--color-text-primary)]">{copy.options[c]}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-[var(--color-text-secondary)]">{copy.hints[c]}</span>
                </span>
              </span>

              <span className="mt-4 block min-h-[112px]">
                {c === 'exposure' && <SectorPreview sectors={sectors} pending={pending} />}
                {c === 'receipts' && <ReceiptsPreview row={book.top} receipt={receipt} pending={pending} />}
                {c === 'changes' && <MoversPreview delta={delta} pending={pending} />}
                {c === 'brief' && <BriefPreview names={new Set(holdings.map((h) => h.ticker.toUpperCase())).size} />}
                {c === 'overlap' && <OverlapPreview shared={shared} accounts={accounts} pending={pending} />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button type="button" className="helm-button inline-flex min-h-[44px] items-center gap-2" onClick={() => save(picked)} disabled={submitted}>{copy.save}<ArrowRight size={18} aria-hidden="true" /></button>
        <button type="button" className="min-h-[44px] text-[14px] text-[var(--color-text-muted)] underline-offset-2 hover:underline" onClick={() => save([])} disabled={submitted}>{copy.skip}</button>
      </div>
    </section>
  );
}

/**
 * Writes the picks, and on a rejected write retries once without `brief`.
 * `brief` is the one code newer than the CHECK constraint on
 * user_preferences.first_look (migration 079 widens it). A single unknown value
 * rejects the whole array, so without this retry a deploy that lands before the
 * migration loses every pick the reader made, not just the new one.
 */
async function persist(codes: FirstLook[]) {
  const put = (body: FirstLook[]) =>
    fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_look: body }),
    });
  try {
    const r = await put(codes);
    if (r.ok || !codes.includes('brief')) return;
    const rest = codes.filter((c) => c !== 'brief');
    const retry = await put(rest);
    if (!retry.ok) console.error('first_look save failed', retry.status);
  } catch (e) {
    console.error('first_look save failed', e);
  }
}

function Pending({ line }: { line: string }) {
  return <span className="block text-[13px] text-[var(--color-text-muted)]">{line}</span>;
}

function Loading() {
  return (
    <span className="block" aria-hidden="true">
      <span className="mb-2 block h-3 w-2/3 animate-pulse rounded bg-[var(--color-bg-base)]" />
      <span className="block h-3 w-1/3 animate-pulse rounded bg-[var(--color-bg-base)]" />
    </span>
  );
}

// The treemap is laid out in these units and scaled by the SVG, so a tile can
// be measured against its label here without touching the DOM.
const MAP_W = 300;
const MAP_H = 132;

function SectorPreview({ sectors, pending }: { sectors: SectorSlice[]; pending: string | null }) {
  if (pending) return <Pending line={pending} />;
  if (sectors.length === 0) return <Pending line={copy.empty} />;
  const tiles = squarify(sectors.map((s) => s.pct), MAP_W, MAP_H);
  const topPct = sectors[0].pct || 1;
  // The sentence names the largest real SECTOR. Funds, crypto and the unfiled
  // remainder are buckets, not sectors, so "Funds is your largest sector at
  // 40%" would be a category error even though the tile is honest.
  const headline = sectors.find((s) => !BUCKETS.has(s.label)) ?? null;
  return (
    <span className="block">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="block w-full rounded-md"
        role="img"
        aria-label={sectors.slice(0, 6).map((s) => `${s.label} ${Math.round(s.pct)}%`).join(', ')}
      >
        {tiles.map((t) => {
          const slice = sectors[t.index];
          // Weight reads as fill strength as well as area, so the eye lands on
          // the concentration instead of counting boxes.
          const opacity = 0.22 + 0.7 * Math.min(1, slice.pct / topPct);
          const short = shortSector(slice.label);
          const name = short.length > 13 ? `${short.slice(0, 12)}.` : short;
          // 9px type runs about 5.2 units a character here, plus the inset. A
          // tall narrow tile cannot take the name across, so it takes it up the
          // side instead: at 9% of the book Healthcare was drawing bare.
          const pct = `${Math.round(slice.pct)}%`;
          // Measured against the rendered SVG: 9px Geist runs about 4.9 units a
          // character in this viewBox, plus the 4-unit inset at each end.
          const run = (chars: number) => chars * 4.9 + 8;
          const across = t.w > run(name.length) && t.h > 16;
          // Up the side, and only as much as the height can actually hold: the
          // percentage came off the top of the Healthcare tile when the fit was
          // measured against the name alone.
          const upward = !across && t.w > 15 && t.h > run(name.length);
          const upwardPct = upward && t.h > run(name.length + pct.length + 1);
          return (
            <g key={slice.label}>
              <rect x={t.x} y={t.y} width={t.w} height={t.h} fill="var(--color-gold)" fillOpacity={opacity} stroke="var(--color-bg-base)" strokeWidth={0.9} />
              {across && (
                <text x={t.x + 4} y={t.y + 12} fontSize={9} fontWeight={600} fill="#0A0A0A">{name}</text>
              )}
              {across && t.h > 30 && (
                <text x={t.x + 4} y={t.y + 24} fontSize={9} fill="#0A0A0A" fillOpacity={0.72}>{pct}</text>
              )}
              {upward && (
                <text
                  x={t.x + 12}
                  y={t.y + t.h - 5}
                  fontSize={9}
                  fontWeight={600}
                  fill="#0A0A0A"
                  transform={`rotate(-90 ${t.x + 12} ${t.y + t.h - 5})`}
                >
                  {upwardPct ? `${name} ${pct}` : name}
                </text>
              )}
              {!across && !upward && t.h > 16 && t.w > 22 && (
                <text x={t.x + 4} y={t.y + 12} fontSize={9} fill="#0A0A0A" fillOpacity={0.72}>{pct}</text>
              )}
            </g>
          );
        })}
      </svg>
      {headline && (
        <span className="mt-2 block text-[13px] leading-relaxed text-[var(--color-text-primary)]">
          {copy.sectorTop(headline.label, Math.round(headline.pct))}
        </span>
      )}
    </span>
  );
}

function ReceiptsPreview({ row, receipt, pending }: { row: ExposureRow | null; receipt: Receipt | null | 'error' | undefined; pending: string | null }) {
  if (pending || !row) return <Pending line={pending ?? copy.empty} />;
  if (receipt === undefined) return <Loading />;
  // A failed scan makes no claim in either direction.
  if (receipt === 'error') return null;
  if (receipt === null) {
    return (
      <span className="flex items-center gap-4">
        <svg viewBox="0 0 84 100" className="block h-[104px] w-[88px] shrink-0" aria-hidden="true">
          <rect x={16} y={12} width={54} height={74} rx={3} fill="var(--color-surface-tint)" stroke="var(--color-border-base)" transform="rotate(-7 43 49)" />
          <rect x={13} y={14} width={54} height={74} rx={3} fill="var(--color-surface-tint)" stroke="var(--color-border-base)" transform="rotate(4 40 51)" />
          <rect x={15} y={15} width={54} height={74} rx={3} fill="var(--color-bg-base)" stroke="var(--color-gold-border)" />
          <text x={42} y={42} fontSize={13} fontWeight={600} textAnchor="middle" fill="var(--color-gold)">{row.ticker}</text>
          {[52, 60, 68, 76].map((y, i) => (
            <rect key={y} x={23} y={y} width={i === 3 ? 20 : 38 - i * 4} height={3} rx={1.5} fill="var(--color-border-strong)" />
          ))}
        </svg>
        <span className="block">
          <span className="block text-[14px] leading-relaxed text-[var(--color-text-secondary)]">{V3_COPY.reveal.receiptFallback(row.ticker)}</span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            {copy.sourceTags.map((tag) => (
              <span key={tag} className="rounded border border-[var(--color-border-base)] px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{tag}</span>
            ))}
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="block">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-[var(--color-text-muted)]">{copy.receiptOn(row.ticker)}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ${receipt.verdict === 'supports' ? 'border-[var(--color-positive)] text-[var(--color-positive)]' : 'border-[var(--color-negative)] text-[var(--color-negative)]'}`}>
          {receipt.verdict}
        </span>
      </span>
      {receipt.claim && <span className="mt-2 block text-[14px] leading-snug text-[var(--color-text-primary)]">{receipt.claim}</span>}
      <span className="mt-2 block border-l-2 border-[var(--color-gold-border)] pl-3 text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
        <span className="line-clamp-3 block">&ldquo;{receipt.verbatimCite}&rdquo;</span>
      </span>
      <span className="mt-2 block text-[12px] text-[var(--color-text-muted)]">{receipt.sourceLabel} {receipt.dateISO}</span>
    </span>
  );
}

function MoversPreview({ delta, pending }: { delta: Delta | 'error' | undefined; pending: string | null }) {
  const { formatCurrency } = useSettings();
  if (pending) return <Pending line={pending} />;
  if (delta === 'error') return null;
  if (delta === undefined) return <Loading />;
  if (delta.movers.length === 0) return <Pending line={copy.quiet} />;
  const widest = Math.max(...delta.movers.map((m) => Math.abs(m.changePct)));
  return (
    <span className="block">
      <span className="mb-2 inline-block rounded border border-[var(--color-border-base)] px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {delta.isToday ? copy.movedToday : copy.movedLastSession}
      </span>
      {delta.movers.slice(0, 3).map((m) => {
        const up = m.changePct >= 0;
        const colour = up ? 'var(--color-positive)' : 'var(--color-negative)';
        return (
          <span key={m.ticker} className="mb-2 block last:mb-0">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] text-[var(--color-text-primary)]">{m.ticker}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-[13px] text-[var(--color-text-muted)]">{up ? '+' : '-'}{formatCurrency(Math.abs(m.dollarImpact))}</span>
                <span className="text-[16px] tabular-nums" style={{ color: colour }}>{up ? '+' : ''}{m.changePct.toFixed(2)}%</span>
              </span>
            </span>
            <span className="mt-1 block h-1.5 w-full rounded bg-[var(--color-bg-base)]" aria-hidden="true">
              <span className="block h-full rounded" style={{ width: `${(Math.abs(m.changePct) / widest) * 100}%`, background: colour }} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

// The morning mail. The rail is 6:00 to 16:00 ET, so the brief sitting just
// left of the opening bell is the whole point of the picture. 13:15 UTC in
// vercel.json is 9:15 ET, and the daily cron is gated off on weekends and NYSE
// holidays, which is why nothing here says "tomorrow".
const RAIL_FROM = 6;
const RAIL_TO = 16;
const railX = (hour: number) => 8 + ((hour - RAIL_FROM) / (RAIL_TO - RAIL_FROM)) * 284;

function BriefPreview({ names }: { names: number }) {
  const brief = railX(9.25);
  const open = railX(9.5);
  return (
    <span className="block">
      <svg viewBox="0 0 300 52" className="block w-full" role="img" aria-label={copy.firstBrief}>
        <line x1={8} y1={34} x2={292} y2={34} stroke="var(--color-border-strong)" strokeWidth={1} />
        {[6, 8, 10, 12, 14, 16].map((h) => (
          <line key={h} x1={railX(h)} y1={31} x2={railX(h)} y2={37} stroke="var(--color-border-strong)" strokeWidth={1} />
        ))}
        <line x1={open} y1={26} x2={open} y2={42} stroke="var(--color-text-muted)" strokeWidth={1} strokeDasharray="2 2" />
        <text x={open + 5} y={48} fontSize={9} fill="var(--color-text-muted)">{copy.openBell}</text>
        <line x1={brief} y1={14} x2={brief} y2={34} stroke="var(--color-gold)" strokeWidth={1.4} />
        <circle cx={brief} cy={34} r={3.4} fill="var(--color-gold)" />
        <text x={brief - 4} y={11} fontSize={10} fontWeight={600} textAnchor="end" fill="var(--color-gold)">9:15 ET</text>
      </svg>
      <span className="mt-1 block text-[13px] text-[var(--color-text-primary)]">{copy.firstBrief}</span>
      <span className="mt-2 flex flex-wrap items-center gap-1.5">
        {copy.briefTags.map((tag) => (
          <span key={tag} className="rounded border border-[var(--color-border-base)] px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{tag}</span>
        ))}
        {names > 0 && <span className="text-[12px] text-[var(--color-text-muted)]">{copy.watching(names)}</span>}
      </span>
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
        <span className="block text-[14px] text-[var(--color-text-primary)]">{copy.sharedNames(shared.length)}</span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <span key={r.ticker} className="rounded-full border border-[var(--color-border-base)] px-2.5 py-1 text-[13px] text-[var(--color-text-secondary)]">{r.ticker}</span>
          ))}
        </span>
      </span>
    );
  }
  return (
    <span className="block">
      <span className="block text-[14px] text-[var(--color-text-primary)]">{copy.sharedNames(shared.length)}</span>
      <span className="mt-3 block">
        {rows.map((r) => {
          const held = new Set(r.accountIds);
          return (
            <span key={r.ticker} className="mb-2 flex items-center gap-3 last:mb-0">
              <span className="w-16 shrink-0 text-[13px] text-[var(--color-text-secondary)]">{r.ticker}</span>
              <span className="flex gap-1.5">
                {cols.map((a) => (
                  <span
                    key={a.id}
                    className={`inline-block h-3.5 w-3.5 rounded-sm ${held.has(a.id) ? 'bg-[var(--color-gold)]' : 'border border-[var(--color-border-strong)]'}`}
                    aria-hidden="true"
                  />
                ))}
              </span>
              <span className="sr-only">{copy.heldIn(r.ticker, cols.filter((a) => held.has(a.id)).length)}</span>
            </span>
          );
        })}
      </span>
      <span className="mt-2 flex gap-1.5 pl-[76px] text-[11px] uppercase text-[var(--color-text-muted)]">
        {cols.map((a) => (
          <span key={a.id} className="inline-block w-3.5 text-center" title={a.institution}>{a.institution.slice(0, 2)}</span>
        ))}
      </span>
    </span>
  );
}
