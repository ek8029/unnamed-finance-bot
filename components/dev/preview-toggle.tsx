'use client';
// Dev-only floating control to flip tier + dataState so every locked/empty state
// is testable on localhost. Mirrors the design prototype's Preview control.
// MUST NOT ship to production users (mount only when NODE_ENV !== 'production').

import { usePreview, type DataState } from '@/lib/preview-context';
import type { Tier } from '@/lib/tier-shared';

const TIERS: Tier[] = ['free', 'pro', 'max'];
const STATES: DataState[] = ['connected', 'demo', 'empty'];

export function PreviewToggle() {
  const { tier, dataState, setTier, setDataState } = usePreview();
  return (
    <div
      className="fixed bottom-4 right-4 z-[200] rounded-lg border border-white/[0.12] bg-[#141414] p-2.5 space-y-2"
      style={{ fontFamily: 'var(--font-mono)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
    >
      <div className="text-[8px] uppercase tracking-[0.2em] text-[#5a5a5a]">Preview · dev</div>
      <Row label="Tier" opts={TIERS} val={tier} set={setTier} />
      <Row label="Data" opts={STATES} val={dataState} set={setDataState} />
    </div>
  );
}

function Row<T extends string>({ label, opts, val, set }: { label: string; opts: T[]; val: T; set: (v: T) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] uppercase tracking-[0.16em] text-[#6A6A6A] w-7">{label}</span>
      <div className="flex gap-1">
        {opts.map((o) => (
          <button
            key={o}
            onClick={() => set(o)}
            className="px-2 py-1 rounded text-[9px] uppercase tracking-[0.1em] font-semibold transition-colors"
            style={
              o === val
                ? { background: 'rgba(230,185,77,0.15)', color: '#E6B94D', border: '1px solid rgba(230,185,77,0.4)' }
                : { background: 'transparent', color: '#8A8A8A', border: '1px solid rgba(255,255,255,0.07)' }
            }
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
