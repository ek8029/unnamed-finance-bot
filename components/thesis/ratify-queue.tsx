'use client';

// Ratify queue (reframe variant A): land on a populated review list instead
// of a blank composer. Each holding's thesis is AI-drafted; the user ratifies
// in two clicks. "Looks right" confirms the draft pillars AND tracks the
// thesis (the score-theses cron only scans tracked=true), so confirming is
// what turns monitoring on. The ratify click is the ownership act — the user
// affirms a drafted reason rather than authoring from scratch.

import { useState } from 'react';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

export interface RatifyItem {
  thesisId: string;
  ticker: string;
  draftPillarIds: string[];
  topClaim: string;
  moreCount: number;
}

export interface RatifyHolding {
  ticker: string;
  name: string;
}

interface Props {
  items: RatifyItem[];
  unthesed: RatifyHolding[];
  confirmedCount: number;
  onChanged: () => void | Promise<void>;
  onEdit: (ticker: string) => void;
}

export function RatifyQueue({ items, unthesed, confirmedCount, onChanged, onEdit }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const total = confirmedCount + items.length;

  async function looksRight(item: RatifyItem) {
    if (busy) return;
    setBusy(item.ticker);
    setNote(null);
    try {
      // 1. Confirm each drafted pillar.
      for (const id of item.draftPillarIds) {
        await fetch(`/api/thesis/pillars/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed: true }),
        });
      }
      // 2. Track it — the cron only scans tracked theses, and track-enable
      //    fires the initial backfill scan.
      const tr = await fetch(`/api/thesis/${item.ticker}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked: true }),
      });
      if (!tr.ok && tr.status === 403) {
        setNote(`${item.ticker} confirmed. Tracking is capped on the free tier — upgrade to monitor every position.`);
      }
      await onChanged();
    } catch {
      setNote(`Could not confirm ${item.ticker}. Try again.`);
    } finally {
      setBusy(null);
    }
  }

  async function draftAll() {
    if (drafting) return;
    setDrafting(true);
    setNote(null);
    try {
      for (const h of unthesed) {
        await fetch('/api/thesis/seed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: h.ticker }),
        });
      }
      await onChanged();
    } catch {
      setNote('Could not draft every holding — some may have failed. Try again.');
    } finally {
      setDrafting(false);
    }
  }

  if (items.length === 0 && unthesed.length === 0) return null;

  return (
    <section>
      <div
        className="rounded-lg overflow-hidden bg-[#131313] border border-white/[0.07]"
        style={{ borderTop: '2px solid rgba(230,185,77,0.45)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.05] flex-wrap">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E6B94D]" style={MONO}>
            Confirm why you own each position
          </span>
          {total > 0 && (
            <span className="font-mono text-[11px] text-[#6A6A6A]" style={MONO}>
              {confirmedCount} of {total} confirmed
            </span>
          )}
          {unthesed.length > 0 && (
            <button
              type="button"
              disabled={drafting}
              onClick={draftAll}
              className="ml-auto font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] px-3 py-1.5 rounded border border-[rgba(230,185,77,0.35)] text-[#E6B94D] hover:bg-[rgba(230,185,77,0.08)] transition-colors disabled:opacity-50"
              style={MONO}
            >
              {drafting ? 'Drafting…' : `Draft all (${unthesed.length})`}
            </button>
          )}
        </div>

        {/* Ratify rows */}
        {items.length > 0 ? (
          <div className="divide-y divide-white/[0.05]">
            {items.map((item) => (
              <div key={item.thesisId} className="flex items-center gap-4 px-5 py-3.5">
                <span
                  className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-[#FAFAFA] w-[58px] shrink-0"
                  style={MONO}
                >
                  {item.ticker}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] leading-[1.4] text-[#D8D8D8] m-0 line-clamp-1">
                    &ldquo;{item.topClaim}&rdquo;
                  </p>
                  <p className="mt-1 font-mono text-[10.5px] text-[#5F5F5F] m-0" style={MONO}>
                    {item.moreCount > 0 ? `+ ${item.moreCount} more · ` : ''}Did you buy {item.ticker} for ~this?
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busy === item.ticker}
                    onClick={() => looksRight(item)}
                    className="font-mono text-[11px] font-semibold px-3 py-1.5 rounded bg-[#E6B94D] text-[#0A0A0A] hover:brightness-110 transition disabled:opacity-50"
                    style={MONO}
                  >
                    {busy === item.ticker ? 'Saving…' : 'Looks right'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(item.ticker)}
                    className="font-mono text-[11px] px-3 py-1.5 rounded border border-white/[0.1] text-[#9A9A9A] hover:text-[#D8D8D8] transition-colors"
                    style={MONO}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-4 font-mono text-[12px] text-[#6A6A6A]" style={MONO}>
            All drafts confirmed.{unthesed.length > 0 ? ' Draft your remaining holdings above.' : ''}
          </div>
        )}

        {note && (
          <div className="px-5 py-3 border-t border-white/[0.05] font-mono text-[11px] text-[#9A9A9A]" style={MONO}>
            {note}
          </div>
        )}
      </div>
    </section>
  );
}
