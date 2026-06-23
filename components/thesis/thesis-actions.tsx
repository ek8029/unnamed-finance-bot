'use client';

// In-thesis intelligence surface for the agentic pipelines. Self-contained: fetches
// the thesis-scoped insights written by the reasoned-actions, triggered-investigation,
// and cross-thesis-risk pipelines, and renders them grouped:
//   What happened (investigations) -> Consider (actions) -> Shared exposure (risk).
// Never an execute button (RIA guardrail) - links to the Actions Inbox to decide.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

type Kind = 'action' | 'investigation' | 'risk';

interface IntelRow {
  id: string;
  kind: Kind;
  type: string;
  priority: string;
  title: string;
  description: string;
  recommended_action: string | null;
  explanation: string | null;
  estimated_impact: number | null;
  created_at: string;
}

const RED = { color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.30)' };
const AMBER = { color: '#E6B94D', bg: 'rgba(230,185,77,0.08)', border: 'rgba(230,185,77,0.30)' };
const MUTED = { color: '#6A6A6A', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)' };

function pill(kind: Kind, priority: string): { label: string; color: string; bg: string; border: string } {
  const tone = priority === 'critical' || priority === 'high' ? RED : priority === 'medium' ? AMBER : MUTED;
  const label = kind === 'investigation' ? 'EVENT' : kind === 'risk' ? 'EXPOSURE' : priority === 'medium' ? 'MONITOR' : priority === 'low' ? 'NOTE' : 'ACTION';
  return { label, ...tone };
}

function priorityRank(p: string): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[p] ?? 4;
}

const GROUPS: { kind: Kind; label: string }[] = [
  { kind: 'investigation', label: 'What happened' },
  { kind: 'action', label: 'Consider' },
  { kind: 'risk', label: 'Shared exposure' },
];

export function ThesisActions({ thesisId, className = '' }: { thesisId: string; className?: string }) {
  const [rows, setRows] = useState<IntelRow[] | null>(null);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setRows(null);
    fetch(`/api/thesis/actions?thesisId=${encodeURIComponent(thesisId)}`)
      .then((r) => (r.ok ? r.json() : { actions: [] }))
      .then((d) => {
        if (active) setRows(Array.isArray(d.actions) ? d.actions : []);
      })
      .catch(() => {
        if (active) setRows([]);
      });
    return () => {
      active = false;
    };
  }, [thesisId]);

  if (!rows || rows.length === 0) return null;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Non-discretionary: the user decides. "Mark done" = I acted; never auto-executed.
  // Optimistic remove, then persist via the shared insights PATCH.
  const act = (id: string, action: 'useful' | 'snooze' | 'dismiss', snoozeDays?: number) => {
    setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    fetch('/api/insights', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snoozeDays ? { id, action, snooze_days: snoozeDays } : { id, action }),
    }).catch(() => {});
  };

  return (
    <div
      className={`rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] overflow-hidden ${className}`}
      style={{ borderTop: '2px solid rgba(230,185,77,0.35)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E6B94D]" style={MONO}>
          Intelligence
        </span>
        <span className="font-mono text-[11px] text-[#6A6A6A]" style={MONO}>
          {rows.length} grounded in your thesis
        </span>
        <ChevronDown size={15} className={`ml-auto text-[#6A6A6A] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-4">
          {GROUPS.map(({ kind, label }) => {
            const items = rows
              .filter((r) => r.kind === kind)
              .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
            if (items.length === 0) return null;
            return (
              <div key={kind} className="space-y-2.5">
                <div
                  className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A]"
                  style={MONO}
                >
                  {label}
                </div>
                {items.map((a) => {
                  const meta = pill(a.kind, a.priority);
                  const isExpanded = expanded.has(a.id);
                  return (
                    <div key={a.id} className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3.5">
                      <div className="flex items-start gap-2.5">
                        <span
                          className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.14em] px-1.5 py-[3px] rounded shrink-0 mt-[1px]"
                          style={{ ...MONO, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
                        >
                          {meta.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-semibold text-[#FAFAFA] leading-snug">{a.title}</div>
                          <p className="text-[12.5px] leading-[1.55] text-[#9A9A9A] mt-1 mb-0">{a.description}</p>
                          {a.recommended_action && (
                            <p className="text-[12.5px] leading-[1.55] text-[#CFCFCF] mt-2 mb-0">{a.recommended_action}</p>
                          )}
                          {a.estimated_impact != null && a.estimated_impact > 0 && (
                            <div className="font-mono text-[11px] text-[#4ADE80] mt-2" style={MONO}>
                              ~${a.estimated_impact.toLocaleString()} potential tax impact
                            </div>
                          )}
                          {a.explanation && (
                            <button
                              type="button"
                              onClick={() => toggle(a.id)}
                              className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6A6A6A] hover:text-[#9A9A9A] transition-colors mt-2.5"
                              style={MONO}
                            >
                              {isExpanded ? 'Hide evidence' : 'Why'}
                            </button>
                          )}
                          {isExpanded && a.explanation && (
                            <p className="text-[11.5px] leading-[1.55] text-[#7A7A7A] mt-1.5 mb-0 border-l border-white/[0.08] pl-3">
                              {a.explanation}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-white/[0.05]">
                            {a.kind === 'investigation' && (
                              <Link
                                href={`/dashboard/theses/${thesisId}`}
                                className="font-mono text-[10px] uppercase tracking-[0.10em] text-[#E6B94D] hover:opacity-80 transition-opacity"
                                style={MONO}
                              >
                                View reassessment &rsaquo;
                              </Link>
                            )}
                            {a.kind === 'action' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => act(a.id, 'useful')}
                                  className="font-mono text-[10px] uppercase tracking-[0.10em] text-[#4ADE80] hover:opacity-80 transition-opacity"
                                  style={MONO}
                                >
                                  Mark done
                                </button>
                                <button
                                  type="button"
                                  onClick={() => act(a.id, 'snooze', 7)}
                                  className="font-mono text-[10px] uppercase tracking-[0.10em] text-[#6A6A6A] hover:text-[#9A9A9A] transition-colors"
                                  style={MONO}
                                >
                                  Snooze 1w
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => act(a.id, 'dismiss')}
                              className="font-mono text-[10px] uppercase tracking-[0.10em] text-[#6A6A6A] hover:text-[#9A9A9A] transition-colors"
                              style={MONO}
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <Link
            href="/dashboard/actions"
            className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.10em] text-[#6A6A6A] hover:text-[#E6B94D] transition-colors"
            style={MONO}
          >
            Review in Actions Inbox
          </Link>
        </div>
      )}
    </div>
  );
}
