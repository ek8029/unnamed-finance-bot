'use client';

// The value ledger: two honest columns.
//   Surfaced — dollars Helm FLAGGED (estimates: harvestable tax savings +
//              insight impacts). Never worded as returns or performance.
//   Realized — what the USER recorded actually executing. Their record.
// The gap between the columns is the product's pitch and its integrity: we
// never claim the second number, the user writes it.

import { useState } from 'react';
import type { ValueLedger } from '@/lib/research/types';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

const KIND_LABEL: Record<string, string> = {
  tax_harvest: 'Tax',
  insight: 'Insight',
  tlh_harvest: 'Harvest',
  other: 'Other',
};

export function ValueLedgerCard({
  ledger,
  onAsk,
  canRecord = false,
  onRecorded,
}: {
  ledger: ValueLedger;
  onAsk: (q: string) => void;
  /** Only when the viewer IS the account owner (prod panel, signed in). */
  canRecord?: boolean;
  onRecorded?: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!ledger || (ledger.surfacedTotal <= 0 && (ledger.realizedTotal ?? 0) <= 0)) return null;

  async function record() {
    const amt = Number(amount.replace(/[$,\s]/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) {
      setErr('Enter the dollar amount you realized.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/research/value-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'tlh_harvest', amount: amt, note: note.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not record');
      setRecording(false);
      setAmount('');
      setNote('');
      onRecorded?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not record');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[rgba(230,185,77,0.25)] bg-[rgba(230,185,77,0.05)] p-4 sm:p-5">
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#E6B94D]" style={MONO}>
            Surfaced by Helm
          </div>
          <div className="mt-1.5 text-[30px] font-bold text-[#FAFAFA] leading-none" style={MONO}>
            ${ledger.surfacedTotal.toLocaleString('en-US')}
          </div>
          <div className="mt-1 text-[10.5px] text-[#8A8A8A]" style={MONO}>estimate, flagged not earned</div>
        </div>
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#4ADE80]" style={MONO}>
            Realized by you
          </div>
          <div className="mt-1.5 text-[30px] font-bold text-[#FAFAFA] leading-none" style={MONO}>
            ${(ledger.realizedTotal ?? 0).toLocaleString('en-US')}
          </div>
          <div className="mt-1 text-[10.5px] text-[#8A8A8A]" style={MONO}>what you recorded executing</div>
        </div>
      </div>

      <p className="mt-3 text-[11.5px] leading-[1.5] text-[#8A8A8A] m-0">
        Surfaced dollars are potential (e.g. tax savings if losses were harvested), before wash-sale checks. Not
        investment returns. Not tax advice.
      </p>

      {ledger.lines.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {ledger.lines.map((l, i) => (
            <div key={i} className="flex items-baseline gap-2 text-[13px]">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded shrink-0" style={{ ...MONO, color: '#E6B94D', background: 'rgba(230,185,77,0.1)' }}>
                {KIND_LABEL[l.kind] ?? l.kind}
              </span>
              <span className="text-[#C8C8C8] min-w-0 truncate">{l.label}</span>
              <span className="ml-auto text-[#FAFAFA] font-semibold shrink-0" style={MONO}>${l.amount.toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>
      )}

      {(ledger.realized?.length ?? 0) > 0 && (
        <div className="mt-3 pt-3 border-t border-[rgba(230,185,77,0.15)] space-y-1.5">
          {ledger.realized.map((l) => (
            <div key={l.id} className="flex items-baseline gap-2 text-[13px]">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded shrink-0" style={{ ...MONO, color: '#4ADE80', background: 'rgba(74,222,128,0.1)' }}>
                {KIND_LABEL[l.kind] ?? l.kind}
              </span>
              <span className="text-[#C8C8C8] min-w-0 truncate">{l.label}{l.ticker ? ` · ${l.ticker}` : ''}</span>
              <span className="text-[10.5px] text-[#5F5F5F] shrink-0" style={MONO}>{l.date}</span>
              <span className="ml-auto text-[#FAFAFA] font-semibold shrink-0" style={MONO}>${l.amount.toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => onAsk('How much has Helm surfaced for me, and where does that number come from?')}
          className="text-[11.5px] text-[#E6B94D] hover:brightness-110"
          style={MONO}
        >
          break this down →
        </button>
        {canRecord && !recording && (
          <button
            type="button"
            onClick={() => setRecording(true)}
            className="text-[11.5px] text-[#4ADE80] hover:brightness-110"
            style={MONO}
          >
            + record a harvest I executed
          </button>
        )}
      </div>

      {canRecord && recording && (
        <div className="mt-3 flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.12em] text-[#6A6A6A] mb-1" style={MONO}>
              Amount saved ($)
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="1,250"
              className="w-[110px] bg-[#0B0B0B] border border-white/[0.12] rounded px-2.5 py-2 text-[13px] text-[#FAFAFA] outline-none focus:border-[rgba(74,222,128,0.4)]"
              style={MONO}
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] uppercase tracking-[0.12em] text-[#6A6A6A] mb-1" style={MONO}>
              Note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Harvested PLTR loss"
              className="w-full bg-[#0B0B0B] border border-white/[0.12] rounded px-2.5 py-2 text-[13px] text-[#FAFAFA] outline-none focus:border-[rgba(74,222,128,0.4)]"
            />
          </div>
          <button
            type="button"
            onClick={record}
            disabled={busy}
            className="px-3 py-2 rounded bg-[#4ADE80] text-[#060606] text-[12px] font-semibold disabled:opacity-40"
            style={MONO}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => { setRecording(false); setErr(null); }}
            className="px-2 py-2 text-[12px] text-[#8A8A8A] hover:text-[#FAFAFA]"
            style={MONO}
          >
            cancel
          </button>
          {err && <p className="w-full text-[11.5px] text-[#F87171] m-0" style={MONO}>{err}</p>}
        </div>
      )}
    </div>
  );
}
