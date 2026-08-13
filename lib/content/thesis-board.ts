// The derivations behind the theses board: status ceiling, evidence tally, the
// one-line headline, and a pillar's state line.
//
// Extracted from components/testing/theses-v2-body.tsx so the web table and
// /api/thesis/board (which the phone reads) compute the same numbers from the
// same rules. Two copies of "what does this thesis say right now" is how the
// phone ends up telling a different story than the site.

import { topCeiling } from '@/components/testing/thesis-v2-blocks';
import { convergence, type LadderStatus } from '@/lib/content/mechanism-cluster';
import type { ScoringThesisData, ScoredPillar } from '@/lib/content/scoring-thesis';

/* Plain-English status vocabulary — the ladder stays internal. */
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

/** Trouble first: broken sorts above weakening sorts above steady. */
export const RANK: Record<LadderStatus, number> = { broken: 0, weakening: 1, watch: 2 };

export const NEW_DAYS = 7;

export const isFresh = (dateISO: string) =>
  Date.now() - new Date(dateISO).getTime() < NEW_DAYS * 86400000;

export function thesisCeiling(d: ScoringThesisData): LadderStatus {
  return d.pillars.reduce<LadderStatus>(
    (worst, p) => (RANK[topCeiling(p.mechanisms)] < RANK[worst] ? topCeiling(p.mechanisms) : worst),
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
    (a, b) => RANK[topCeiling(a.mechanisms)] - RANK[topCeiling(b.mechanisms)],
  );
  const worst = pillars[0];
  if (!worst) return 'No scored evidence yet.';
  const worstStatus = topCeiling(worst.mechanisms);
  if (worstStatus === 'watch') {
    // The healthy case used to read "Holding up: 9 pieces of supporting
    // evidence, 2 against." Every caller already renders that same tally as
    // chips immediately above this sentence, so the row said the same two
    // numbers twice, once in figures and once in words — and on a thesis
    // sitting at 2-for-2 the word "holding" was doing work the numbers did not
    // support. The latest piece of evidence is the only thing here the chips do
    // not already say, so say that instead.
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
  const status = topCeiling(p.mechanisms);
  const supports = p.catches.filter((c) => c.verdict === 'supports').length;
  const against = p.catches.filter((c) => c.verdict === 'contradicts').length;
  const sides = `${supports} supporting · ${against} against`;
  if (status === 'watch') return { status, line: sides };
  const mover = p.mechanisms.find((m) => m.maxStatus === status);
  const classes = mover?.sourceClasses.length ?? 0;
  const corroboration = classes >= 2 ? `${classes} independent source types` : 'a single source so far';
  return { status, line: `${mover?.label ?? 'multiple reports'} · ${corroboration} · ${sides}` };
}
