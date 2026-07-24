'use client';

// Findings as chips, not a feed. The A-shape decision (2026-07-24): the chat
// stays the surface, and what the agent found appears as a compact row of
// clickable chips — same interaction language as the suggested queries — each
// one seeding a grounded question. No wall of cards.

import type { Finding } from '@/lib/research/types';

const MONO = { fontFamily: 'var(--font-mono)' } as const;

const KIND_TONE: Record<Finding['kind'], string> = {
  catch: '#E6B94D',
  investigation: '#7CA9F2',
  cross_thesis: '#F87171',
  action: '#4ADE80',
};

// Rank: agent memos first (rarest, highest signal), then contradicting catches,
// shared-risk, then actions. Within a rank, most recent first.
function rank(f: Finding): number {
  if (f.kind === 'investigation') return 0;
  if (f.kind === 'catch' && f.verdict === 'contradicts') return 1;
  if (f.kind === 'cross_thesis') return 2;
  if (f.kind === 'action') return 3;
  return 4;
}

export function pickChipFindings(findings: Finding[], max = 4): Finding[] {
  return [...findings]
    .sort((a, b) => rank(a) - rank(b) || (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, max);
}

export function questionForFinding(f: Finding): string {
  const subject = f.ticker ? `my ${f.ticker} position` : 'my portfolio';
  return `Helm flagged this on ${subject}: "${f.summary}" — what does it mean for me?`;
}

/** A short human label: ticker + the first clause of the summary. */
function chipLabel(f: Finding): string {
  const clause = f.summary.split(/[.;—]|,\s(?=[a-z])/)[0].trim();
  const text = clause.length > 56 ? `${clause.slice(0, 53)}…` : clause;
  return f.ticker ? `${f.ticker} · ${text}` : text;
}

export function FindingChips({
  findings,
  onAsk,
  disabled = false,
}: {
  findings: Finding[];
  onAsk: (question: string) => void;
  disabled?: boolean;
}) {
  const picks = pickChipFindings(findings);
  if (picks.length === 0) return null;

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)] mb-2" style={MONO}>
        What Helm found · tap to ask
      </div>
      <div className="flex flex-wrap gap-2">
        {picks.map((f) => (
          <button
            key={f.id}
            type="button"
            disabled={disabled}
            onClick={() => onAsk(questionForFinding(f))}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-[var(--color-border-base)] bg-[var(--color-bg-surface)] text-[12.5px] text-[var(--color-text-secondary)] hover:border-[var(--color-gold-border)] hover:text-[var(--color-text-primary)] transition-colors text-left disabled:opacity-50"
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: KIND_TONE[f.kind] }} />
            <span className="min-w-0">{chipLabel(f)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
