'use client';

// Conviction trigger for the nav chrome (mobile top bar + sidebar on small/mid
// screens, where the fixed rail is hidden). Doubles as a glanceable indicator:
// shows the worst pillar status as a dot + the count needing attention. Opens
// the conviction drawer. Self-contained fetch; renders nothing if the gated
// /api/thesis is unavailable.

import { useEffect, useState } from 'react';
import { Anchor } from 'lucide-react';

type Status = 'unverified' | 'intact' | 'weakening' | 'broken';
const RANK: Record<Status, number> = { broken: 0, weakening: 1, intact: 2, unverified: 3 };
const COLOR: Record<Status, string> = { broken: '#F87171', weakening: '#E6B94D', intact: '#4ADE80', unverified: '#6A6A6A' };

export function ConvictionNavButton({
  onClick,
  className = '',
  label = true,
}: {
  onClick: () => void;
  className?: string;
  label?: boolean;
}) {
  const [worst, setWorst] = useState<Status | null>(null);
  const [attention, setAttention] = useState(0);

  useEffect(() => {
    let on = true;
    fetch('/api/thesis')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!on || !d?.theses) return;
        let w: Status | null = null;
        let count = 0;
        for (const t of d.theses) {
          for (const p of t.pillars ?? []) {
            const s = (p.status_override ?? p.status) as Status;
            if (s === 'broken' || s === 'weakening') count++;
            if (w === null || RANK[s] < RANK[w]) w = s;
          }
        }
        setWorst(w);
        setAttention(count);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  const flagged = worst === 'broken' || worst === 'weakening';

  return (
    <button type="button" onClick={onClick} aria-label="Open conviction" className={className}>
      <Anchor className="w-4 h-4 shrink-0" />
      {label && <span className="font-mono text-[12px] uppercase tracking-[0.12em]">Conviction</span>}
      {flagged && worst && (
        <span className="inline-flex items-center gap-1 ml-auto">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLOR[worst], boxShadow: `0 0 6px ${COLOR[worst]}88` }} />
          {attention > 0 && (
            <span className="font-mono text-[12px] tabular-nums" style={{ color: COLOR[worst] }}>
              {attention}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
