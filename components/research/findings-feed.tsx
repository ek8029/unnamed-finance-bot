'use client';

// "What Helm found" — the browsable feed of the agent's recent findings across
// the whole book, shown BEFORE any question. The user reads it, then clicks a
// finding to ask about it (or types a free question below). This is the point of
// the research tab: the agent's work is visible, not buried behind a query.

import { useState } from 'react';
import type { Finding, FindingKind } from '@/lib/research/types';
import { FINDING_KIND_LABEL } from '@/lib/research/types';
import { FindingCard, KIND_TONE } from './finding-card';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

const KIND_ORDER: FindingKind[] = ['catch', 'investigation', 'cross_thesis', 'action'];

export function FindingsFeed({
  findings,
  onAsk,
}: {
  findings: Finding[];
  /** Omit for a read-only feed: cards render static, with their source links. */
  onAsk?: (f: Finding) => void;
}) {
  const [kind, setKind] = useState<FindingKind | 'all'>('all');

  const present = KIND_ORDER.filter((k) => findings.some((f) => f.kind === k));
  const shown = kind === 'all' ? findings : findings.filter((f) => f.kind === kind);

  // Group by position; portfolio-wide findings (cross-thesis, unattributed
  // actions) collect under one heading.
  const groups = new Map<string, Finding[]>();
  for (const f of shown) {
    const key = f.ticker ?? 'Across your book';
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(f);
  }
  const positionCount = new Set(findings.map((f) => f.ticker).filter(Boolean)).size;

  return (
    <div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[13px] font-semibold text-[#FAFAFA]">What Helm found</span>
        <span className="text-[11px] text-[#6A6A6A]" style={MONO}>
          {findings.length} findings across {positionCount} {positionCount === 1 ? 'position' : 'positions'}
        </span>
      </div>

      {/* kind filter */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <FilterChip active={kind === 'all'} onClick={() => setKind('all')} tone="#E6B94D">
          All
        </FilterChip>
        {present.map((k) => (
          <FilterChip key={k} active={kind === k} onClick={() => setKind(k)} tone={KIND_TONE[k]}>
            {FINDING_KIND_LABEL[k]}
          </FilterChip>
        ))}
      </div>

      <div className="mt-3 space-y-4">
        {[...groups.entries()].map(([label, items]) => (
          <div key={label}>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6A6A6A] mb-1.5" style={MONO}>
              {label} · {items.length}
            </div>
            <div className="space-y-2">
              {items.map((f) => (
                <FindingCard key={f.id} finding={f} onAsk={onAsk} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-semibold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full border transition-colors"
      style={{
        ...MONO,
        color: active ? tone : '#8A8A8A',
        borderColor: active ? `${tone}66` : 'rgba(255,255,255,0.1)',
        background: active ? `${tone}12` : 'transparent',
      }}
    >
      {children}
    </button>
  );
}
