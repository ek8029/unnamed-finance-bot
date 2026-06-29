// Pure, deterministic computation of a house thesis's current health from its
// chronological cited evidence (content_events). No I/O, no hardcoded per-ticker
// values — status is a documented function of real catches. Unit-tested.
//
// A pillar's "current status" is a recency-weighted net of the evidence for/against
// it, expressed in "filing-equivalents" so the thresholds are legible:
//   contribution = sign(verdict) * sourceWeight * 0.5^(ageDays / HALF_LIFE_DAYS)
//   S = sum(contribution) / NORMALIZER          (NORMALIZER = filing weight = 3)
// One fresh SEC-filing catch therefore maps to S = ±1.0.

export type Verdict = 'supports' | 'contradicts';
export type SourceType = 'filing' | 'major_news' | 'minor_news';
export type PillarStatus = 'intact' | 'watch' | 'weakening' | 'broken' | 'unverified';
export type ThesisHealth = PillarStatus;

export interface StatusCatch {
  verdict: Verdict;
  /** YYYY-MM-DD, from cite_date ?? run_date (first 10 chars). */
  dateISO: string;
  source_type: SourceType;
}

export const SOURCE_WEIGHT: Record<SourceType, number> = { filing: 3, major_news: 2, minor_news: 1 };
export const VERDICT_SIGN: Record<Verdict, number> = { supports: 1, contradicts: -1 };
export const HALF_LIFE_DAYS = 120;
export const WINDOW_DAYS = 365;
export const NORMALIZER = SOURCE_WEIGHT.filing; // 3 — a single fresh filing == ±1.0

// Thresholds on the normalized score S (in filing-equivalents).
export const THRESHOLD = { intact: 0.5, watch: -0.5, weakening: -1.5 } as const;

export const STATUS_LABEL: Record<PillarStatus, string> = {
  intact: 'Intact',
  watch: 'Watch',
  weakening: 'Weakening',
  broken: 'Broken',
  unverified: 'Unverified',
};

const SEVERITY: Record<PillarStatus, number> = {
  broken: 4,
  weakening: 3,
  watch: 2,
  intact: 1,
  unverified: 0,
};

/** Whole-day difference fromISO -> toISO, computed in UTC. Positive = fromISO is older. */
function ageDays(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO}T00:00:00Z`);
  const to = Date.parse(`${toISO}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function moreSevere(a: PillarStatus, b: PillarStatus): PillarStatus {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

export interface PillarStatusResult {
  status: PillarStatus;
  /** Normalized score in filing-equivalents (0 when unverified). */
  score: number;
  /** Number of catches that fell inside WINDOW_DAYS and drove the status. */
  inWindow: number;
}

/**
 * Compute a single pillar's current status from its catches.
 * @param catches the pillar's catches (any order)
 * @param todayISO YYYY-MM-DD "now" in UTC (injected for determinism/testability)
 */
export function computePillarStatus(catches: StatusCatch[], todayISO: string): PillarStatusResult {
  // Only evidence within the trailing window drives *current* status.
  // Future-dated catches (age < 0, shouldn't occur) are treated as fresh.
  const inWindow = catches.filter((c) => ageDays(c.dateISO, todayISO) <= WINDOW_DAYS);
  if (inWindow.length === 0) return { status: 'unverified', score: 0, inWindow: 0 };

  let sum = 0;
  for (const c of inWindow) {
    const age = Math.max(0, ageDays(c.dateISO, todayISO));
    const decay = Math.pow(0.5, age / HALF_LIFE_DAYS);
    sum += VERDICT_SIGN[c.verdict] * SOURCE_WEIGHT[c.source_type] * decay;
  }
  const score = sum / NORMALIZER;

  let status: PillarStatus;
  if (score >= THRESHOLD.intact) status = 'intact';
  else if (score > THRESHOLD.watch) status = 'watch';
  else if (score > THRESHOLD.weakening) status = 'weakening';
  else status = 'broken';

  // Recency-dominance override: a fresh primary-source (filing) contradiction cannot
  // read as Intact even if older supports outweigh it. Floor the status at Weakening.
  const mostRecent = inWindow.reduce((a, b) => (b.dateISO > a.dateISO ? b : a));
  if (mostRecent.verdict === 'contradicts' && mostRecent.source_type === 'filing') {
    status = moreSevere(status, 'weakening');
  }

  return { status, score, inWindow: inWindow.length };
}

/** Thesis-level health = worst pillar status by severity. */
export function computeThesisHealth(statuses: PillarStatus[]): ThesisHealth {
  if (statuses.some((s) => s === 'broken')) return 'broken';
  if (statuses.some((s) => s === 'weakening')) return 'weakening';
  if (statuses.some((s) => s === 'watch')) return 'watch';
  if (statuses.some((s) => s === 'intact')) return 'intact';
  return 'unverified';
}
