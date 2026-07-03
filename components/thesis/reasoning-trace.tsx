// Reasoning trace — the agent's causal chain for one catch, as one visual:
// read the source (verbatim, dated) → tested against a stated reason →
// verdict → where the thesis stands now. The minute-1 artifact: a new visitor
// sees HOW the agent thinks before they have an account. Pure render, no
// client JS; every field comes from real rows (nothing invented).

import type { TickerThesisData, PublicCatch, PublicPillar } from '@/lib/content/public-thesis';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

const VERDICT_META: Record<string, { label: string; color: string }> = {
  contradicts: { label: 'works against the reason', color: '#F87171' },
  supports: { label: 'reinforces the reason', color: '#4ADE80' },
};

const STATUS_COLOR: Record<string, string> = {
  intact: '#4ADE80',
  weakening: '#E6B94D',
  broken: '#F87171',
  unverified: '#8A8A8A',
};

/** The most significant recent catch: newest contradicts wins, else newest. */
function pickLead(data: TickerThesisData): { c: PublicCatch; pillar: PublicPillar } | null {
  let best: { c: PublicCatch; pillar: PublicPillar } | null = null;
  for (const p of data.pillars) {
    for (const c of p.catches) {
      if (!best) { best = { c, pillar: p }; continue; }
      const bContra = best.c.verdict === 'contradicts';
      const cContra = c.verdict === 'contradicts';
      if (cContra !== bContra ? cContra : c.dateISO > best.c.dateISO) best = { c, pillar: p };
    }
  }
  return best;
}

function Step({ eyebrow, last = false, children }: { eyebrow: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative pl-7 pb-5">
      {!last && <span aria-hidden className="absolute left-[5px] top-4 bottom-0 w-px bg-white/[0.10]" />}
      <span aria-hidden className="absolute left-0 top-[5px] w-[11px] h-[11px] rounded-full border border-[rgba(230,185,77,0.55)] bg-[#131313]" />
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] mb-1.5" style={MONO}>
        {eyebrow}
      </div>
      {children}
    </div>
  );
}

export function ReasoningTrace({ data }: { data: TickerThesisData }) {
  const lead = pickLead(data);
  if (!lead) return null;
  const { c, pillar } = lead;
  const verdict = VERDICT_META[c.verdict] ?? { label: 'noted', color: '#8A8A8A' };
  const statusColor = STATUS_COLOR[pillar.status] ?? '#8A8A8A';
  const intact = data.pillars.filter((p) => p.status === 'intact').length;
  const safeUrl = c.sourceUrl && /^https?:\/\//i.test(c.sourceUrl) ? c.sourceUrl : null;

  return (
    <section
      aria-label={`How Helm reasoned about the latest ${data.ticker} evidence`}
      className="rounded-lg border border-white/[0.07] bg-[#131313] px-6 pt-5 pb-2"
    >
      <div className="mb-5 flex items-baseline justify-between gap-3 flex-wrap">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]" style={MONO}>
          How the agent read it
        </span>
        <span className="font-mono text-[11px] text-[var(--color-text-muted)]" style={MONO}>
          {c.dateISO} · every step below is a real record
        </span>
      </div>

      <Step eyebrow={`Read · ${c.sourceLabel}`}>
        <p className="m-0 text-[15px] leading-[1.65] text-[#D4D4D4]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          &ldquo;{c.verbatimCite}&rdquo;
        </p>
        {safeUrl && (
          <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[var(--color-gold)] hover:underline" style={MONO}>
            source ↗
          </a>
        )}
      </Step>

      <Step eyebrow="Tested against the stated reason">
        <p className="m-0 text-[14px] leading-[1.55] text-[var(--color-text-secondary)]">{pillar.claim}</p>
      </Step>

      <Step eyebrow="Verdict">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ ...MONO, color: verdict.color, background: `${verdict.color}1A` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: verdict.color }} />
          {c.verdict} · {verdict.label}
        </span>
        {c.summary && (
          <p className="m-0 mt-2 text-[13px] leading-[1.55] text-[var(--color-text-muted)]">{c.summary}</p>
        )}
      </Step>

      <Step eyebrow="Where the thesis stands" last>
        <p className="m-0 text-[14px] text-[var(--color-text-secondary)]">
          This reason is <span className="font-semibold" style={{ color: statusColor }}>{pillar.statusLabel.toLowerCase()}</span>
          {' · '}
          {intact} of {data.pillars.length} reasons to own {data.ticker} hold as of {data.asOfDate ?? c.dateISO}.
        </p>
      </Step>
    </section>
  );
}
