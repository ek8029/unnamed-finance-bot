// lib/prebuy-risk.ts
// Pre-buy thesis risk: the homework Helm shows BEFORE a position exists. Given a
// ticker the user is researching (not necessarily owned) plus its draft pillars,
// surface three honest, pre-purchase risks:
//   (a) sectorConcentration — how much of the user's book already sits in this
//       ticker's sector, and where that weight lands if a typical position is added.
//   (b) sharedDriver — whether the candidate's draft pillars lean on a driver the
//       user's existing theses already depend on (hidden concentration before the buy).
//   (c) bearCase — the bearish case some investors cite, from the cached analysis.
//
// Cost discipline: NO new OpenAI calls. draftPillars (upstream) and analyzeStock
// (cached, allowGenerate=false) are the only model spend. The shared-driver check
// reads the user's already-computed thesis_clusters cache; it never recomputes.
// Honest by construction: every field is nullable and we state when data is missing.

import { createClient } from '@/lib/supabase/server';
import { analyzeStock } from '@/lib/analyze-stock';
import { getFullTickerData } from '@/lib/financial-data';
import { resolveSector } from '@/lib/portfolio-analysis';
import { termSet, claimSharesDriver } from '@/lib/driver-match';
import type { SynthCluster } from '@/lib/thesis-synthesis';

// Assumption surfaced to the user verbatim: a "typical" new position for the
// projected-weight math. Kept simple and stated, not hidden.
const ASSUMED_POSITION_PCT = 5;

export interface SectorConcentrationRisk {
  sector: string;
  currentSectorPct: number;   // weight of this sector in the book today
  projectedSectorPct: number; // weight if a ~5% position in this ticker is added
  assumedPositionPct: number; // the stated assumption (e.g. 5)
  alreadyHeld: boolean;       // does the user already own this ticker
  note: string;               // plain-language summary
}

export interface SharedDriverRisk {
  driver: string;
  matchedClaim: string;     // the candidate draft pillar that leans on this driver
  otherTickers: string[];   // user's existing tickers already depending on it
  rationale: string;        // from the stored cluster synthesis
}

export interface PrebuyRisk {
  ticker: string;
  // null when the user has no holdings (can't compute concentration) — stated, not faked.
  sectorConcentration: SectorConcentrationRisk | null;
  // [] when the user has no clustered theses yet OR nothing overlaps — distinguished via sharedDriverComputed.
  sharedDriver: SharedDriverRisk[];
  sharedDriverComputed: boolean; // false => no cached cluster set to compare against yet
  // null when no cached analysis exists (we never force generation here).
  bearCase: string | null;
}

interface RawHoldingRow {
  ticker: string;
  total_value: number | null;
  security: { sector: string | null } | null;
}

interface ComputeOpts {
  ticker: string;
  userId: string;
  candidatePillars?: { claim: string }[];
}

/** Resolve the candidate ticker's sector: stored securities row first, profile.industry as fallback. */
async function resolveCandidateSector(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ticker: string,
): Promise<string | null> {
  const { data: sec } = await supabase
    .from('securities')
    .select('sector')
    .eq('ticker', ticker)
    .maybeSingle();

  const stored = sec?.sector;
  if (stored && stored !== 'Unknown') return stored;

  // Fallback: live profile. getFullTickerData is cached (React cache) and only
  // hits a provider on a true miss; industry is the closest sector proxy.
  try {
    const td = await getFullTickerData(ticker);
    const industry = td.profile?.industry;
    if (industry && industry.trim()) return industry.trim();
  } catch {
    // provider failure is non-fatal — concentration just goes uncomputed
  }
  return null;
}

/** (a) Sector concentration if this name were added to the book. */
async function computeSectorConcentration(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  ticker: string,
): Promise<SectorConcentrationRisk | null> {
  const { data: holdings, error } = await supabase
    .from('holdings')
    .select('ticker, total_value, security:securities(sector)')
    .eq('user_id', userId);

  if (error || !holdings || holdings.length === 0) return null;

  const rows = holdings as unknown as RawHoldingRow[];
  // resolveSector only reads { ticker, security.sector } off this array (the co-held
  // underlying lookup), so the partial shape is sufficient. Cast through Parameters
  // to satisfy its RawHolding[] signature without rebuilding every column.
  const rawForResolve = rows.map((h) => ({
    ticker: h.ticker,
    security: { sector: h.security?.sector ?? null },
  })) as unknown as Parameters<typeof resolveSector>[2];

  const totalValue = rows.reduce((sum, h) => sum + Number(h.total_value || 0), 0);
  if (totalValue <= 0) return null;

  const candidateSector = await resolveCandidateSector(supabase, ticker);
  if (!candidateSector) return null;

  // Current value already sitting in the candidate's sector.
  let sectorValue = 0;
  let alreadyHeld = false;
  for (const h of rows) {
    if (h.ticker?.toUpperCase() === ticker.toUpperCase()) alreadyHeld = true;
    const sector = resolveSector(h.ticker, h.security?.sector, rawForResolve);
    if (sector === candidateSector) sectorValue += Number(h.total_value || 0);
  }

  const currentSectorPct = (sectorValue / totalValue) * 100;

  // Projected: a new position worth ASSUMED_POSITION_PCT of the resulting book.
  // newBook = totalValue / (1 - p); the added position lands entirely in this sector.
  const p = ASSUMED_POSITION_PCT / 100;
  const projectedSectorPct = alreadyHeld
    ? currentSectorPct // already in the book — adding more is a sizing call, not a new-sector decision
    : ((sectorValue + (totalValue * p) / (1 - p)) / (totalValue / (1 - p))) * 100;

  const note = alreadyHeld
    ? `You already hold ${ticker}. ${candidateSector} is ${currentSectorPct.toFixed(1)}% of your book today.`
    : `${candidateSector} is ${currentSectorPct.toFixed(1)}% of your book today. If ${ticker} becomes about ${ASSUMED_POSITION_PCT}% of your book, that sector would be roughly ${projectedSectorPct.toFixed(1)}%.`;

  return {
    sector: candidateSector,
    currentSectorPct,
    projectedSectorPct,
    assumedPositionPct: ASSUMED_POSITION_PCT,
    alreadyHeld,
    note,
  };
}

/**
 * (b) Shared-driver overlap. Reads the user's CACHED cluster synthesis (thesis_clusters)
 * and checks whether any candidate draft pillar leans on a driver those clusters already
 * name. Pure text match against cached output — no new LLM call. Returns sharedDriverComputed
 * = false when there is no cached cluster set to compare against (honest "can't tell yet").
 */
async function computeSharedDriver(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  ticker: string,
  candidatePillars: { claim: string }[],
): Promise<{ matches: SharedDriverRisk[]; computed: boolean }> {
  if (candidatePillars.length === 0) return { matches: [], computed: false };

  const { data, error } = await supabase
    .from('thesis_clusters')
    .select('clusters')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data || !Array.isArray(data.clusters)) {
    return { matches: [], computed: false };
  }

  const clusters = data.clusters as SynthCluster[];
  if (clusters.length === 0) return { matches: [], computed: true };

  const upper = ticker.toUpperCase();
  const matches: SharedDriverRisk[] = [];
  const seenDrivers = new Set<string>();

  for (const cluster of clusters) {
    if (!cluster.driver || !Array.isArray(cluster.pillars)) continue;
    // Tickers in this cluster that are NOT the candidate — the existing exposure.
    const otherTickers = [
      ...new Set(
        cluster.pillars
          .map((p) => p.ticker?.toUpperCase())
          .filter((t): t is string => !!t && t !== upper),
      ),
    ];
    if (otherTickers.length === 0) continue;

    if (termSet(cluster.driver).size === 0) continue;

    // A candidate pillar matches only when it shares a DISTINCTIVE (non-filler)
    // driver term — generic words like "revenue"/"growth" can't manufacture one.
    for (const cp of candidatePillars) {
      if (claimSharesDriver(cluster.driver, cp.claim) && !seenDrivers.has(cluster.driver)) {
        seenDrivers.add(cluster.driver);
        matches.push({
          driver: cluster.driver,
          matchedClaim: cp.claim,
          otherTickers,
          rationale: cluster.rationale ?? '',
        });
        break;
      }
    }
  }

  return { matches, computed: true };
}

/** (c) Bear case from the cached analysis. Never forces generation (cost-safe). */
async function computeBearCase(ticker: string): Promise<string | null> {
  try {
    const { analysis } = await analyzeStock(ticker, false);
    const bear = analysis?.bearCase;
    return bear && bear.trim() ? bear.trim() : null;
  } catch {
    return null;
  }
}

export async function computePrebuyRisk(opts: ComputeOpts): Promise<PrebuyRisk> {
  const ticker = opts.ticker.trim().toUpperCase();
  const candidatePillars = opts.candidatePillars ?? [];

  const supabase = await createClient();

  const [sectorConcentration, sharedDriverResult, bearCase] = await Promise.all([
    computeSectorConcentration(supabase, opts.userId, ticker),
    computeSharedDriver(supabase, opts.userId, ticker, candidatePillars),
    computeBearCase(ticker),
  ]);

  return {
    ticker,
    sectorConcentration,
    sharedDriver: sharedDriverResult.matches,
    sharedDriverComputed: sharedDriverResult.computed,
    bearCase,
  };
}
