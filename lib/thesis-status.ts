// lib/thesis-status.ts
// Pure status derivation. Spec §3. Never call an LLM here.

export type PillarStatus = 'unverified' | 'intact' | 'weakening' | 'broken';

export interface EvidenceForStatus {
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  source_type: 'filing' | 'form4' | 'xbrl' | 'news' | 'price_move';
  source_key: string;
  is_backfill: boolean;
  created_at: string; // ISO
  /** A single severe primary contradiction (e.g. a >=20% adverse price move, a
   *  withdrawn guidance) breaks a pillar on its own. Optional; defaults false. */
  severe?: boolean;
}

const PRIMARY_SOURCES = new Set(['filing', 'form4', 'xbrl', 'price_move']);
const WINDOW_MS = 30 * 86400_000;

export function derivePillarStatus(
  evidence: EvidenceForStatus[],
  statusOverride: PillarStatus | null,
  now: Date = new Date(),
): PillarStatus {
  if (statusOverride) return statusOverride;

  const live = evidence.filter((e) => !e.is_backfill);
  if (live.length === 0) return 'unverified';

  const cutoff = now.getTime() - WINDOW_MS;
  const recentMaterialContradictions = live.filter(
    (e) =>
      e.verdict === 'contradicts' &&
      e.materiality === 'material' &&
      new Date(e.created_at).getTime() >= cutoff,
  );

  const distinctKeys = new Map<string, EvidenceForStatus>();
  for (const e of recentMaterialContradictions) {
    if (!distinctKeys.has(e.source_key)) distinctKeys.set(e.source_key, e);
  }
  const independent = [...distinctKeys.values()];
  const hasPrimary = independent.some((e) => PRIMARY_SOURCES.has(e.source_type));

  // A single SEVERE primary contradiction breaks a pillar on its own: a thesis
  // must not sit at "weakening" through a 28% crash or a withdrawn guidance.
  // Ordinary material contradictions still need convergence (below).
  const hasSeverePrimary = independent.some((e) => e.severe === true && PRIMARY_SOURCES.has(e.source_type));
  if (hasSeverePrimary) return 'broken';

  if (independent.length >= 2 && hasPrimary) return 'broken';
  // Weakening needs convergence: two independent material contradictions, or
  // one from a PRIMARY source (a 10-Q line deserves a flag; a single news
  // article does not). Before this rule, one news contradict among dozens of
  // supports flagged "weakening" — 11 of 18 demo theses cried wolf at once.
  // A lone news contradiction stays visible in the evidence trail, unalarmed.
  if (independent.length >= 2 || hasPrimary) return 'weakening';
  return 'intact';
}
