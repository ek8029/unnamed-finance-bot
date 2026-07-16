// lib/evidence-quality.ts
// Deterministic relevance gate for judge output (defense-in-depth behind the
// prompt rules). A hedged "why" is the signature of a loose thematic match:
// when the judge cannot state the bearing plainly, the row is noise, not signal.
// Real case: KO's "diversified portfolio drives growth" pillar collected a
// fairlife ransomware 8-K with why="This incident may affect Coca-Cola's
// product portfolio..." (neutral/context). The gate drops that row at insert.

export type EvidenceVerdict = 'supports' | 'contradicts' | 'neutral';

/** Hedged causal verb phrases: "may affect", "could disrupt", "might weigh"... */
const HEDGED_CAUSAL =
  /\b(?:may|might|could)\s+(?:affect|impact|disrupt|weigh|pressure|pose|hurt|slow|reduce|threaten|undermine|challenge|expose|erode)\b/i;

/** Softer tells, only disqualifying for neutral rows (a supports row may
 *  legitimately say "growth potential"; a neutral row leaning on these words
 *  is filing an association, not evidence). */
const SOFT_TELLS = /\b(?:potential(?:ly)?|underscores?|raises questions|unclear|possibly)\b/i;

/**
 * True when the judge's stated connection is too hedged to be evidence.
 * Neutral rows are held to the stricter bar.
 */
export function isHedgedConnection(why: string, verdict: EvidenceVerdict): boolean {
  if (HEDGED_CAUSAL.test(why)) return true;
  if (verdict === 'neutral' && SOFT_TELLS.test(why)) return true;
  return false;
}

/** Operational-incident language in a source (cyber, recall, litigation, outage). */
export const OPERATIONAL_INCIDENT =
  /\b(?:ransomware|cybersecurity|cyberattack|unauthorized access|data breach|recall(?:s|ed)?|class action|lawsuit|litigation|outage)\b/i;

/** Does a pillar claim speak to operations/execution/costs, where an
 *  operational incident can legitimately land? */
export function isOperationsPillar(claim: string): boolean {
  return /\b(?:operat|execut|suppl[iy]|cost|margin|efficien|infrastructur|securit|manufactur|producti|logisti)/i.test(claim);
}
