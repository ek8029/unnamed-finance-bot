// Pure presentation logic for the thesis views (terminal table + overview).
// No supabase / next imports — client components may use this. The plain-English
// status vocabulary lives here so every surface says it the same way.

import { convergence, type LadderStatus, type Mechanism } from './mechanism-cluster';
import type { ScoringThesisData, ScoredPillar } from './scoring-thesis';

export const STATUS_WORD: Record<LadderStatus, string> = {
  watch: 'steady',
  weakening: 'under pressure',
  broken: 'breaking',
};
export const STATUS_TONE: Record<LadderStatus, string> = {
  watch: '#4ADE80',
  weakening: '#E6B94D',
  broken: '#F87171',
};
export const RANK: Record<LadderStatus, number> = { broken: 0, weakening: 1, watch: 2 };

export const NEW_DAYS = 7;
export const isFresh = (dateISO: string) =>
  Date.now() - new Date(dateISO).getTime() < NEW_DAYS * 86400000;

export const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString()}`;

/** Worst (most adverse) ladder status across a set of mechanisms. */
export function worstLadder(mechanisms: Mechanism[]): LadderStatus {
  return mechanisms.reduce<LadderStatus>(
    (worst, m) => (RANK[m.maxStatus] < RANK[worst] ? m.maxStatus : worst),
    'watch',
  );
}

export function thesisCeiling(d: ScoringThesisData): LadderStatus {
  return d.pillars.reduce<LadderStatus>(
    (worst, p) => (RANK[worstLadder(p.mechanisms)] < RANK[worst] ? worstLadder(p.mechanisms) : worst),
    'watch',
  );
}

export function tally(d: ScoringThesisData): { supports: number; against: number } {
  let supports = 0;
  let against = 0;
  for (const p of d.pillars)
    for (const c of p.catches) {
      if (c.verdict === 'supports') supports++;
      else if (c.verdict === 'contradicts') against++;
    }
  return { supports, against };
}

/** The one thing that matters on this thesis right now, in one sentence. */
export function headline(d: ScoringThesisData): string {
  const pillars = [...d.pillars].sort(
    (a, b) => RANK[worstLadder(a.mechanisms)] - RANK[worstLadder(b.mechanisms)],
  );
  const worst = pillars[0];
  if (!worst) return 'No scored evidence yet.';
  const worstStatus = worstLadder(worst.mechanisms);
  if (worstStatus === 'watch') {
    // Kept in step with the same branch in thesis-board.ts: the count
    // restatement duplicated the chips rendered directly above it, so the
    // latest evidence goes here instead. If you change one, change both.
    const latest = d.pillars.flatMap((p) => p.catches)[0];
    return latest ? `Quiet. Latest: ${latest.title}` : 'Quiet. Nothing challenges this thesis.';
  }
  const mover = worst.mechanisms.find((m) => m.maxStatus === worstStatus);
  const conv = convergence(worst.mechanisms);
  const base = mover ? mover.label : 'Multiple reports';
  return conv.converging
    ? `${base} — and ${conv.adverseMechanisms - 1} more independent ${conv.adverseMechanisms - 1 === 1 ? 'issue' : 'issues'} on the same pillar`
    : base;
}

export function pillarStateLine(p: ScoredPillar): { status: LadderStatus; line: string } {
  const status = worstLadder(p.mechanisms);
  const supports = p.catches.filter((c) => c.verdict === 'supports').length;
  const against = p.catches.filter((c) => c.verdict === 'contradicts').length;
  const sides = `${supports} supporting · ${against} against`;
  if (status === 'watch') return { status, line: sides };
  const mover = p.mechanisms.find((m) => m.maxStatus === status);
  const classes = mover?.sourceClasses.length ?? 0;
  const corroboration = classes >= 2 ? `${classes} independent source types` : 'a single source so far';
  return { status, line: `${mover?.label ?? 'multiple reports'} · ${corroboration} · ${sides}` };
}

/* ── Serializable shapes for client-rendered views ─────────────────────── */

export interface OverviewStory {
  label: string;
  adverse: boolean;
  fresh: boolean;
  mentions: number;
  classes: number;
  receipts: { date: string; title: string; url: string | null; quote: string | null }[];
  more: number;
}

export interface OverviewPillar {
  claim: string;
  status: LadderStatus;
  line: string;
  breaksIf: string | null;
  stories: OverviewStory[];
  singles: number;
}

export interface OverviewRow {
  ticker: string;
  status: LadderStatus;
  value: number | null;
  pl: number | null;
  supports: number;
  against: number;
  headline: string;
  statement: string | null;
  earnings: string | null;
  freshEvidence: boolean;
  receiptsOnFile: number;
  lastScan: string | null;
  pillars: OverviewPillar[];
  drivers: string[];
}

export interface OverviewDriver {
  name: string;
  rationale: string;
  tickers: string[];
  tone: LadderStatus;
}

export function toOverviewPillars(d: ScoringThesisData): OverviewPillar[] {
  return [...d.pillars]
    .sort((a, b) => RANK[worstLadder(a.mechanisms)] - RANK[worstLadder(b.mechanisms)])
    .map((p) => {
      const adverse = p.mechanisms.filter((m) => m.maxStatus !== 'watch');
      const corroboratedQuiet = p.mechanisms.filter((m) => m.maxStatus === 'watch' && m.mentions > 1);
      const singles = p.mechanisms.length - adverse.length - corroboratedQuiet.length;
      const { status, line } = pillarStateLine(p);
      return {
        claim: p.claim,
        status,
        line,
        breaksIf: p.breaksIf,
        singles,
        stories: [...adverse, ...corroboratedQuiet].slice(0, 4).map((m) => ({
          label: m.label,
          adverse: m.maxStatus !== 'watch',
          fresh: !!m.lastSeen && isFresh(m.lastSeen),
          mentions: m.mentions,
          classes: m.sourceClasses.length,
          receipts: m.items.slice(0, 2).map((c) => ({
            date: c.dateISO,
            title: c.title,
            url: c.url,
            quote: c.excerpt ? c.excerpt.slice(0, 160) : null,
          })),
          more: Math.max(0, m.items.length - 2),
        })),
      };
    });
}
