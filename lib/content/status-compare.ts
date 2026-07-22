// Runs the SHIPPED pillar-status engine and the v2 corroboration ladder over
// identical evidence, so the difference between them is measured rather than
// argued about.
//
// The shipped engine (lib/thesis-status.ts) counts an "independent" contradiction
// as a distinct source_key, which is a distinct URL. Five outlets covering one
// analyst note is therefore five independent contradictions, and two of those
// escalate a pillar to weakening. The ladder counts independence by SOURCE CLASS
// within a mechanism, so the same five stay one confirmation.
//
// The ladder is a ceiling layered over the existing score, never a replacement:
// it can only hold a status down, never push one up. Anything it lowers is a
// case the shipped engine escalated on repetition alone.

import { derivePillarStatus, type EvidenceForStatus, type PillarStatus } from '@/lib/thesis-status';
import { ladderCeiling, type LadderStatus, type Mechanism } from './mechanism-cluster';
import type { ScoredCatch } from './scoring-thesis';

const RANK: Record<Exclude<PillarStatus, 'unverified'>, number> = { intact: 0, weakening: 1, broken: 2 };
const AT_RANK: Exclude<PillarStatus, 'unverified'>[] = ['intact', 'weakening', 'broken'];
/** "watch" is the ladder saying "do not alarm", which on the user side is intact. */
const CEILING_RANK: Record<LadderStatus, number> = { watch: 0, weakening: 1, broken: 2 };
/** Matches WINDOW_MS in lib/thesis-status.ts. */
const WINDOW_MS = 30 * 86400_000;

export interface PillarComparison {
  shipped: PillarStatus;
  ceiling: LadderStatus;
  v2: PillarStatus;
  changed: boolean;
  /** Plain-language account of why the two engines differ, or agree. */
  reason: string;
  /** Distinct URLs the shipped engine treats as independent contradictions. */
  shippedIndependent: number;
  /** Distinct source classes behind the strongest contradicting mechanism. */
  v2Confirmations: number;
}

const isLiveContradiction = (c: ScoredCatch) =>
  c.verdict === 'contradicts' && c.materiality === 'material' && !c.isBackfill;

function toShippedShape(c: ScoredCatch): EvidenceForStatus {
  return {
    verdict: c.verdict,
    materiality: c.materiality,
    source_type: c.rawSourceType as EvidenceForStatus['source_type'],
    source_key: c.sourceKey,
    is_backfill: c.isBackfill,
    created_at: c.createdAt,
    // The shipped engine is handed its own severity flag, exactly as the cron
    // does. Comparing against a weakened version of it would prove nothing.
    severe: c.severe,
  };
}

/**
 * The highest status any single mechanism could justify. Only contradictions
 * escalate, so a mechanism carrying nothing but supporting evidence cannot lift
 * the ceiling off the floor.
 */
export function ladderCeilingForPillar(
  mechanisms: Mechanism<ScoredCatch>[],
  now: Date = new Date(),
): { ceiling: LadderStatus; confirmations: number } {
  // Same 30-day window the shipped engine uses. A ceiling computed over a wider
  // window than the decision it caps would be a looser check, not a tighter one.
  const cutoff = now.getTime() - WINDOW_MS;
  let ceiling: LadderStatus = 'watch';
  let confirmations = 0;
  for (const m of mechanisms) {
    const against = m.items.filter((c) => isLiveContradiction(c) && new Date(c.createdAt).getTime() >= cutoff);
    if (against.length === 0) continue;
    const r = ladderCeiling(
      against.map((c) => c.sourceClass),
      against.map((c) => c.evidenceClass),
      against.some((c) => c.severe),
    );
    const classes = new Set(against.map((c) => c.sourceClass)).size;
    if (CEILING_RANK[r.maxStatus] > CEILING_RANK[ceiling]) {
      ceiling = r.maxStatus;
      confirmations = classes;
    } else if (r.maxStatus === ceiling && classes > confirmations) {
      confirmations = classes;
    }
  }
  return { ceiling, confirmations };
}

export function comparePillar(
  catches: ScoredCatch[],
  mechanisms: Mechanism<ScoredCatch>[],
  now: Date = new Date(),
): PillarComparison {
  const shipped = derivePillarStatus(catches.map(toShippedShape), null, now);
  const { ceiling, confirmations } = ladderCeilingForPillar(mechanisms, now);

  const recent = now.getTime() - WINDOW_MS;
  const shippedIndependent = new Set(
    catches.filter((c) => isLiveContradiction(c) && new Date(c.createdAt).getTime() >= recent).map((c) => c.sourceKey),
  ).size;

  if (shipped === 'unverified') {
    return {
      shipped, ceiling, v2: shipped, changed: false, shippedIndependent, v2Confirmations: confirmations,
      reason: 'No live evidence has landed, so neither engine has anything to say.',
    };
  }

  const capped = Math.min(RANK[shipped], CEILING_RANK[ceiling]);
  const v2 = AT_RANK[capped];
  const changed = v2 !== shipped;

  let reason: string;
  if (!changed) {
    reason =
      shipped === 'intact'
        ? 'Nothing material contradicts this pillar, so both engines leave it alone.'
        : `Both engines agree: ${confirmations} independent source ${confirmations === 1 ? 'class' : 'classes'} behind the contradiction.`;
  } else {
    reason =
      `The shipped engine escalated on ${shippedIndependent} distinct URLs. Clustered, they are one story with ` +
      `${confirmations} independent source ${confirmations === 1 ? 'class' : 'classes'} behind it, which the ladder ` +
      `caps at ${ceiling}.`;
  }

  return { shipped, ceiling, v2, changed, reason, shippedIndependent, v2Confirmations: confirmations };
}
