'use client';

// Compact "Thesis Conviction" KPI tile for the dashboard Overview. Rolls every
// tracked thesis up to a single conviction (broken > weakening > intact) and
// shows the tally, linking to /dashboard/theses. Self-gated to allowlisted users
// (useThesisEnabled) and self-hidden when there is nothing real to show, so it can
// be dropped into the Overview unconditionally.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { summarizePillars } from '@/lib/thesis-summary';
import { STATUS_META, type PillarStatus } from '@/lib/thesis-palette';
import { useThesisEnabled } from '@/lib/use-thesis-access';

/* ── Local types (shape returned by GET /api/thesis) ── */
interface Pillar {
  confirmed: boolean;
  status: PillarStatus;
  status_override: PillarStatus | null;
  lifecycle: string;
}
interface Thesis {
  ticker: string;
  pillars: Pillar[];
}

type ConvictionCounts = { intact: number; weakening: number; broken: number };

// Derive a single thesis's conviction from its pillar status tally. Matches
// getConvictionByTicker exactly: broken wins, then weakening, then intact. A null
// result means unverified-only (no real signal) and must not be counted.
function convictionOf(counts: Record<PillarStatus, number>): 'intact' | 'weakening' | 'broken' | null {
  return counts.broken > 0 ? 'broken' : counts.weakening > 0 ? 'weakening' : counts.intact > 0 ? 'intact' : null;
}

export function ThesisConvictionKpi() {
  const enabled = useThesisEnabled();
  const [counts, setCounts] = useState<ConvictionCounts | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    fetch('/api/thesis')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        const theses: Thesis[] = d.theses ?? [];
        const tally: ConvictionCounts = { intact: 0, weakening: 0, broken: 0 };
        for (const t of theses) {
          const conviction = convictionOf(summarizePillars(t.pillars).statusCounts);
          if (conviction) tally[conviction]++;
        }
        setCounts(tally);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [enabled]);

  if (!enabled || !counts) return null;
  const { intact, weakening, broken } = counts;
  const total = intact + weakening + broken;
  if (total === 0) return null;

  const buckets = ([
    { key: 'intact', count: intact },
    { key: 'weakening', count: weakening },
    { key: 'broken', count: broken },
  ] as { key: PillarStatus; count: number }[]).filter((b) => b.count > 0);

  return (
    <Link href="/dashboard/theses" className="block group">
      <div className="sovereign-card rounded border overflow-hidden p-3 md:p-5">
        <div className="flex items-center justify-between mb-1.5 md:mb-2">
          <h3 className="text-[10px] md:text-[13px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono leading-tight">
            Thesis Conviction
          </h3>
          <span className="text-[12px] font-mono text-[var(--color-text-muted)] group-hover:text-[var(--color-gold)] transition-colors whitespace-nowrap">
            {total} tracked
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {buckets.map((b, i) => (
            <span key={b.key} className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              {i > 0 && <span className="text-[var(--color-text-muted)]" aria-hidden="true">&middot;</span>}
              <span className="text-[17px] md:text-xl font-bold font-tabular leading-none" style={{ color: STATUS_META[b.key].color }}>
                {b.count}
              </span>
              <span className="text-[13px] text-[var(--color-text-muted)]">{STATUS_META[b.key].label}</span>
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
