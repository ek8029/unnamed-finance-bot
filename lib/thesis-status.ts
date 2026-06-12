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

  if (independent.length >= 2 && hasPrimary) return 'broken';
  if (recentMaterialContradictions.length >= 1) return 'weakening';
  return 'intact';
}
