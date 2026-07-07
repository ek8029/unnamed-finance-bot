'use client';

// AgentWorklog — "what Helm did while you were away". The passive half of the
// agent surface on the Brief: a timestamped log of the overnight cron work,
// reconstructed from real per-user rows (see /api/agent/worklog). Reads as an
// analyst who already did the work, not a dashboard waiting for you to query it.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { WorklogResponse, WorklogStep, WorklogKind } from '@/app/api/agent/worklog/route';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };
const GOLD = '#E6B94D';

const KIND_META: Record<WorklogKind, { tag: string; color: string }> = {
  sync: { tag: 'SYNC', color: '#8FA9E8' },
  price: { tag: 'PRICE', color: '#4ADE80' },
  read: { tag: 'READ', color: '#9A9A9A' },
  scan: { tag: 'SCAN', color: GOLD },
  flag: { tag: 'FLAG', color: '#F87171' },
  brief: { tag: 'BRIEF', color: GOLD },
};

function relTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '');
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return 'yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function useWorklog() {
  const [data, setData] = useState<WorklogResponse | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    fetch('/api/agent/worklog')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: WorklogResponse | null) => { if (mounted.current && d) setData(d); })
      .catch(() => {});
    return () => { mounted.current = false; };
  }, []);
  return data;
}

export function AgentWorklog() {
  const data = useWorklog();
  if (!data || data.steps.length === 0) return null;
  const { steps, summary, ranAt } = data;

  const segs: string[] = [];
  if (summary.accounts > 0) segs.push(`${summary.accounts} account${summary.accounts === 1 ? '' : 's'}`);
  if (summary.positions > 0) segs.push(`${summary.positions} position${summary.positions === 1 ? '' : 's'}`);
  if (summary.sources > 0) segs.push(`${summary.sources} source${summary.sources === 1 ? '' : 's'} read`);
  if (summary.flags > 0) segs.push(`${summary.flags} flagged`);

  return (
    <section className="mb-3.5 overflow-hidden rounded-lg border border-white/[0.07] bg-[var(--color-bg-surface)]">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-5 py-3.5">
        <span className="text-[13px]" style={{ color: GOLD }}>✦</span>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>
          While you were away
        </span>
        <span className="ml-auto font-mono text-[11px] text-[#6A6A6A]" style={MONO}>
          {summary.theses > 0 && <>watching {summary.theses} {summary.theses === 1 ? 'thesis' : 'theses'} · </>}
          last run {relTime(ranAt)}
        </span>
      </div>

      {/* At-a-glance summary strip */}
      {segs.length > 0 && (
        <div className="border-b border-white/[0.04] px-5 py-2.5 font-mono text-[11px] tracking-[0.02em] text-[#8A8A8A]" style={MONO}>
          {segs.map((s, i) => (
            <span key={s}>
              {i > 0 && <span className="text-[#3A3A3A]"> · </span>}
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Work log */}
      <ol className="m-0 list-none p-0">
        {steps.map((s) => (
          <WorklogRow key={s.id} step={s} />
        ))}
      </ol>
    </section>
  );
}

function WorklogRow({ step }: { step: WorklogStep }) {
  const meta = KIND_META[step.kind];
  const body = (
    <div
      className={`flex items-start gap-3 px-5 py-2.5 transition-colors hover:bg-white/[0.015] ${step.emphasis ? 'bg-[rgba(248,113,113,0.03)]' : ''}`}
      style={step.emphasis ? { boxShadow: 'inset 2px 0 0 rgba(248,113,113,0.55)' } : undefined}
    >
      <span className="mt-[3px] w-[52px] shrink-0 font-mono text-[10.5px] tabular-nums text-[#6A6A6A]" style={MONO}>
        {relTime(step.ts)}
      </span>
      <span
        className="mt-[1px] shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em]"
        style={{ ...MONO, color: meta.color, background: `${meta.color}14`, border: `1px solid ${meta.color}2E` }}
      >
        {meta.tag}
      </span>
      <span className="min-w-0 flex-1 text-[13.5px] leading-[1.45] text-[#D4D4D4]">
        {step.label}
        {step.detail && <span className="text-[#6E6E6E]"> — {step.detail}</span>}
      </span>
      {step.href && <span className="mt-[2px] shrink-0 text-[12px] text-[#5A5A5A]">→</span>}
    </div>
  );
  return (
    <li className="border-b border-white/[0.04] last:border-0">
      {step.href ? <Link href={step.href} className="block no-underline">{body}</Link> : body}
    </li>
  );
}
