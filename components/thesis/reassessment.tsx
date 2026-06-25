// Presentational reassessment artifact for the thesis detail page. No data fetching.
// Renders the grounded "what happened and why" record from the triggered-investigation
// pipeline. Diagnosis only. Every line is a verbatim, dated filing/news excerpt, never
// generated prose. Calm "all holding" state when there is no triggering event.

import { STATUS_META, dotGlow, type PillarStatus } from '@/lib/thesis-palette';
import type { Investigation } from '@/lib/thesis-investigation';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

const RED = { color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.30)' };
const GOLD = { color: '#E6B94D', bg: 'rgba(230,185,77,0.08)', border: 'rgba(230,185,77,0.30)' };

type KindMeta = { label: string; color: string; bg: string; border: string };
function kindBadge(kind: Investigation['trigger']['kind']): KindMeta {
  if (kind === 'new_filing') return { label: 'New filing', ...GOLD };
  if (kind === 'breach') return { label: 'Pillar broken', ...RED };
  if (kind === 'pressure') return { label: 'Under pressure', ...GOLD };
  if (kind === 'severe_move') return { label: 'Severe move', ...RED };
  return { label: 'Event', ...RED };
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A]" style={MONO}>
      {children}
    </div>
  );
}

function StatusChip({ status }: { status: PillarStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded border border-white/[0.07] shrink-0" style={MONO}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color, boxShadow: dotGlow(status) }} />
      <span className="text-[12px] font-semibold uppercase tracking-[0.15em]" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </span>
  );
}

export function Reassessment({ investigation }: { investigation: Investigation | null }) {
  if (!investigation) {
    return (
      <div className="rounded-lg border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] px-5 py-4 flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#4ADE80', boxShadow: '0 0 7px #4ADE80' }} />
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6A6A6A] mb-1" style={MONO}>
            Reassessment
          </div>
          <p className="text-[15px] leading-[1.5] text-[#9A9A9A] m-0">
            No active reassessment. Every monitored pillar is holding.
          </p>
        </div>
      </div>
    );
  }

  const badge = kindBadge(investigation.trigger.kind);
  const date = fmtDate(investigation.trigger.date);

  return (
    <div
      className="rounded-xl border border-white/[0.07] bg-[var(--color-bg-elevated,#131313)] overflow-hidden"
      style={{ borderTop: `2px solid ${badge.border}` }}
    >
      <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-5">
        {/* Header: kind badge + date */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] px-2 py-[4px] rounded"
            style={{ ...MONO, color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}
          >
            {badge.label}
          </span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>
            Reassessment
          </span>
          {date && <span className="font-mono text-[11.5px] text-[#6A6A6A] ml-auto tabular-nums" style={MONO}>{date}</span>}
        </div>

        {/* What happened */}
        <div className="space-y-2">
          <SectionLabel>What happened</SectionLabel>
          <p className="text-[16px] leading-[1.5] text-[#FAFAFA] m-0">{investigation.trigger.headline}</p>
        </div>

        {/* What the filings say */}
        {investigation.finding && (
          <div className="space-y-2">
            <SectionLabel>What the filings say</SectionLabel>
            <p className="text-[14.5px] leading-[1.65] text-[#B8B8B8] m-0 border-l border-white/[0.08] pl-4">
              {investigation.finding}
            </p>
          </div>
        )}

        {/* Pillars hit */}
        {investigation.affectedPillars.length > 0 && (
          <div className="space-y-2.5">
            <SectionLabel>Pillars hit</SectionLabel>
            <div className="space-y-2.5">
              {investigation.affectedPillars.map((p, i) => (
                <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.015] p-3.5">
                  <div className="flex items-start gap-2.5">
                    <StatusChip status={p.status} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-[#FAFAFA] leading-snug">{p.claim}</div>
                      {p.excerpt && <p className="text-[13px] leading-[1.55] text-[#7A7A7A] mt-1.5 mb-0 italic">&ldquo;{p.excerpt}&rdquo;</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trust footnote */}
        <div className="pt-1">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)]" style={MONO}>
            Grounded in your filings. No generated narrative.
          </span>
        </div>
      </div>
    </div>
  );
}
