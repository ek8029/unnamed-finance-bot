'use client';

// In-thesis surface for the reasoned-actions pipeline. Self-contained: fetches the
// thesis-scoped actions written into `insights` and renders them as compact,
// non-discretionary rows. Never an execute button (RIA guardrail) — actions link
// to the Actions Inbox where the user reviews and decides.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

interface ThesisActionRow {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  recommended_action: string | null;
  explanation: string | null;
  estimated_impact: number | null;
  created_at: string;
}

const PRIORITY: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'ACTION', color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.30)' },
  high: { label: 'ACTION', color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.30)' },
  medium: { label: 'MONITOR', color: '#E6B94D', bg: 'rgba(230,185,77,0.08)', border: 'rgba(230,185,77,0.30)' },
  low: { label: 'NOTE', color: '#6A6A6A', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)' },
};

function priorityRank(p: string): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[p] ?? 4;
}

export function ThesisActions({ thesisId, className = '' }: { thesisId: string; className?: string }) {
  const [actions, setActions] = useState<ThesisActionRow[] | null>(null);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setActions(null);
    fetch(`/api/thesis/actions?thesisId=${encodeURIComponent(thesisId)}`)
      .then((r) => (r.ok ? r.json() : { actions: [] }))
      .then((d) => {
        if (active) setActions(Array.isArray(d.actions) ? d.actions : []);
      })
      .catch(() => {
        if (active) setActions([]);
      });
    return () => {
      active = false;
    };
  }, [thesisId]);

  // Nothing to show: stay quiet (no empty-state noise inside the thesis).
  if (!actions || actions.length === 0) return null;

  const sorted = [...actions].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

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
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E6B94D]"
          style={MONO}
        >
          Actions
        </span>
        <span className="font-mono text-[11px] text-[#6A6A6A]" style={MONO}>
          {sorted.length} grounded in your thesis
        </span>
        <ChevronDown
          size={15}
          className={`ml-auto text-[#6A6A6A] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-3">
          {sorted.map((a) => {
            const meta = PRIORITY[a.priority] ?? PRIORITY.low;
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
                      <p className="text-[12.5px] leading-[1.55] text-[#CFCFCF] mt-2 mb-0">
                        {a.recommended_action}
                      </p>
                    )}
                    {a.estimated_impact != null && a.estimated_impact > 0 && (
                      <div
                        className="font-mono text-[11px] text-[#4ADE80] mt-2"
                        style={MONO}
                      >
                        ~${a.estimated_impact.toLocaleString()} potential tax impact
                      </div>
                    )}
                    {a.explanation && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev);
                            if (next.has(a.id)) next.delete(a.id);
                            else next.add(a.id);
                            return next;
                          })
                        }
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
                  </div>
                </div>
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
