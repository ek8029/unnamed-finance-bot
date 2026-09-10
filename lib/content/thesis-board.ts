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

/* ── one row's receipts ─────────────────────────────────────────────────────
   The expansion body of a table row used to be derived inside the component
   that rendered it, which meant the derivation only existed on the server that
   rendered the whole page. The table now loads a row's receipts when the row is
   opened, so the same derivation has to survive a trip through JSON: this is
   that trip's shape, and the only place the shaping happens. ── */

/** Mirrors the mechanism cap the row body has always rendered. */
const MAX_MECHANISMS = 4;
/** Receipts carried per mechanism; the rest stay a count. */
const MAX_ITEMS = 2;

export interface MechanismReceipts {
  label: string;
  mentions: number;
  sourceClasses: string[];
  maxStatus: LadderStatus;
  lastSeen: string | null;
  /** Every receipt behind this mechanism; `items` carries only the first few. */
  itemsTotal: number;
  items: { id: string; dateISO: string; title: string; excerpt: string | null; url: string | null }[];
}

export interface PillarReceipts {
  key: string;
  claim: string;
  breaksIf: string | null;
  status: LadderStatus;
  line: string;
  /** Single mentions nothing has confirmed: counted, never listed. */
  singles: number;
  mechanisms: MechanismReceipts[];
}

/** One pillar as the row body renders it: state line, kill criterion, the
 *  adverse and corroborated mechanisms, and the receipts under each. */
export function pillarReceipts(p: ScoredPillar): PillarReceipts {
  const { status, line } = pillarStateLine(p);
  const adverse = p.mechanisms.filter((m) => m.maxStatus !== 'watch');
  const corroboratedQuiet = p.mechanisms.filter((m) => m.maxStatus === 'watch' && m.mentions > 1);
  return {
    key: p.key,
    claim: p.claim,
    breaksIf: p.breaksIf,
    status,
    line,
    singles: p.mechanisms.length - adverse.length - corroboratedQuiet.length,
    mechanisms: [...adverse, ...corroboratedQuiet].slice(0, MAX_MECHANISMS).map((m) => ({
      label: m.label,
      mentions: m.mentions,
      sourceClasses: [...m.sourceClasses],
      maxStatus: m.maxStatus,
      lastSeen: m.lastSeen,
      itemsTotal: m.items.length,
      items: m.items.slice(0, MAX_ITEMS).map((c) => ({
        id: c.id,
        dateISO: c.dateISO,
        title: c.title,
        excerpt: c.excerpt,
        url: c.url,
      })),
    })),
  };
}

/** Trouble-first pillar order, the order the row body has always used. */
export function pillarsInOrder(d: ScoringThesisData): ScoredPillar[] {
  return [...d.pillars].sort((a, b) => RANK[topCeiling(a.mechanisms)] - RANK[topCeiling(b.mechanisms)]);
}
