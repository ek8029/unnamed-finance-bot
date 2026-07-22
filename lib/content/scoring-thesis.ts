// Read layer for the THESIS-SCORING pipeline (thesis-v2 spec §0).
//
// The public /thesis/[ticker] pages read `content_events` — the daily social
// content pipeline, which by design picks one or two newsworthy events per day
// across the whole universe. Measured 2026-07-22: 43 rows all time, so NVDA
// shows 1 catch. The scoring pipeline (`score-theses` -> `pillar_evidence`)
// holds 2,208 rows with the full validation gauntlet already applied.
//
// This module reads that dense pipeline for one ticker and folds the per-user
// copies into the single view a house-scoped scan would produce. Nothing here
// writes, and nothing here is wired into a public page — it feeds
// /testing/thesis-v2 so the density and the clustering can be judged before any
// house-scoping migration is run.

import { createStaticServiceClient } from '@/lib/supabase/server';
import { getHouseThesis } from './house-theses';
import {
  clusterByMechanism,
  type ClusterItem,
  type EvidenceClass,
  type Mechanism,
  type SourceClass,
} from './mechanism-cluster';

/* ── source classification ─────────────────────────────────────────────── */

// Outlets that report a fact first-hand or carry the company's own words.
// Everything else that arrives as `news` is treated as opinion, which the
// corroboration ladder deliberately refuses to escalate on. Yahoo and Nasdaq
// dominate the feed (741 of 1,000 sampled) and syndicate both kinds, so they
// cannot be trusted as primary without reading the byline.
const PRIMARY_NEWS_DOMAINS = new Set([
  'globenewswire.com', 'prnewswire.com', 'businesswire.com', 'sec.gov',
  'reuters.com', 'apnews.com', 'wsj.com', 'bloomberg.com', 'cnbc.com',
  'ft.com', 'axios.com', 'cnn.com', 'cbsnews.com', 'nytimes.com',
]);

function domainOf(url: string | null): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function classifySource(sourceType: string, url: string | null): SourceClass {
  switch (sourceType) {
    case 'filing': return 'company_filing';
    case 'xbrl': return 'xbrl';
    case 'form4': return 'insider';
    case 'price_move': return 'price';
    default: return PRIMARY_NEWS_DOMAINS.has(domainOf(url)) ? 'primary_news' : 'analyst_opinion';
  }
}

/* ── realized vs emerging (spec §4) ────────────────────────────────────── */

const HEDGE = /\b(could|may|might|expects?|expected|projected|forecasts?|potential|possible|likely|risk of|would|plans? to|aims? to|predicts?)\b/i;
const REPORTED = /\b(increased|decreased|declined|rose|fell|grew|totaled|reported|recorded|was|were|posted|generated|delivered)\b/i;

/** A movement is only "realized" if something measurable actually moved. */
const MEASURED = /(\d+(\.\d+)?\s?%|\$\s?\d|\bbasis points?\b|\bpercentage points?\b|\b\d+(\.\d+)? (billion|million)\b)/i;

/**
 * Has the thing already happened, or is it only more likely?
 *
 * "Realized" means the metric named in the pillar's `breaks_if` moved in
 * reported numbers. Without a kill criterion there is no metric to check, so
 * the honest ceiling is `emerging` — a filing is not self-evidently proof of a
 * thesis breaking just because it is a primary source. Suppressing realized in
 * that case is what keeps the ladder from marking a pillar broken on a routine
 * 10-Q. Only 7 of 171 user pillars carry a `breaks_if`; every hand-authored
 * house pillar does, which is the strongest argument for house-scoping.
 */
export function classifyEvidence(
  sourceClass: SourceClass,
  excerpt: string,
  hasKillCriterion: boolean,
): EvidenceClass {
  const hedged = HEDGE.test(excerpt);
  const primarySource = sourceClass === 'company_filing' || sourceClass === 'xbrl';
  if (hasKillCriterion && primarySource && REPORTED.test(excerpt) && MEASURED.test(excerpt) && !hedged) {
    return 'realized';
  }
  // The company hedging about its own business is still a credible mechanism.
  // An outlet hedging is one outlet's guess.
  if (hedged) return primarySource ? 'emerging' : 'speculative';
  return primarySource || sourceClass === 'primary_news' ? 'emerging' : 'speculative';
}

/* ── shapes ────────────────────────────────────────────────────────────── */

export interface ScoredCatch extends ClusterItem {
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  title: string;
  excerpt: string;
  why: string;
  whatItMeans: string;
  consider: string | null;
  url: string | null;
  /** How many per-user copies of this same finding were folded together. */
  copies: number;
}

export interface ScoredPillar {
  key: string;
  claim: string;
  /** Kill criterion, present on 4% of user pillars and on every house pillar. */
  breaksIf: string | null;
  origins: string[];
  catches: ScoredCatch[];
  mechanisms: Mechanism<ScoredCatch>[];
}

export interface ScoringThesisData {
  ticker: string;
  company: string | null;
  /** Whether a hand-authored house thesis exists for this ticker. */
  hasHouseThesis: boolean;
  pillars: ScoredPillar[];
  /** Rows read from pillar_evidence before per-user copies were folded. */
  rawRows: number;
  /** Distinct findings after folding. */
  dedupedRows: number;
  /** How many separate users' scans contributed. */
  contributingUsers: number;
  lastScan: string | null;
  publicRows: number;
}

/* ── read ──────────────────────────────────────────────────────────────── */

interface PillarRow { id: string; thesis_id: string; claim: string; breaks_if: string | null; origin: string }
interface EvidenceRow {
  id: string; pillar_id: string; user_id: string; verdict: string; materiality: string;
  source_type: string; source_key: string; source_title: string; source_url: string | null;
  source_published_at: string | null; excerpt: string; why: string; what_it_means: string;
  consider: string | null; created_at: string;
}

const normClaim = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
/** Same article + same finding, judged separately for two users, is one finding. */
const findingKey = (e: EvidenceRow) => `${e.source_key}|${normClaim(e.excerpt).slice(0, 120)}`;

export async function getScoringThesisData(ticker: string): Promise<ScoringThesisData> {
  const SYM = ticker.toUpperCase().replace(/[^A-Z]/g, '');
  const db = createStaticServiceClient();
  const house = getHouseThesis(SYM);

  const { count: publicRows } = await db
    .from('content_events')
    .select('id', { count: 'exact', head: true })
    .eq('ticker', SYM);

  const base: ScoringThesisData = {
    ticker: SYM,
    company: house?.company ?? null,
    hasHouseThesis: !!house,
    pillars: [],
    rawRows: 0,
    dedupedRows: 0,
    contributingUsers: 0,
    lastScan: null,
    publicRows: publicRows ?? 0,
  };

  const { data: theses } = await db.from('theses').select('id, user_id').eq('ticker', SYM);
  if (!theses?.length) return base;
  base.contributingUsers = new Set(theses.map((t) => t.user_id as string)).size;

  const { data: pillarRows } = await db
    .from('thesis_pillars')
    .select('id, thesis_id, claim, breaks_if, origin')
    .in('thesis_id', theses.map((t) => t.id as string));
  if (!pillarRows?.length) return base;

  const { data: evRows } = await db
    .from('pillar_evidence')
    .select('id, pillar_id, user_id, verdict, materiality, source_type, source_key, source_title, source_url, source_published_at, excerpt, why, what_it_means, consider, created_at')
    .in('pillar_id', (pillarRows as PillarRow[]).map((p) => p.id))
    .order('source_published_at', { ascending: false });

  const evidence = (evRows ?? []) as unknown as EvidenceRow[];
  base.rawRows = evidence.length;
  base.lastScan = evidence.reduce<string | null>(
    (m, e) => (!m || e.created_at > m ? e.created_at : m),
    null,
  );

  // Fold the per-user duplicates: group pillars by claim, then findings by article + excerpt.
  const pillarGroup = new Map<string, { claim: string; breaksIf: string | null; origins: Set<string>; ids: Set<string> }>();
  const groupOfPillar = new Map<string, string>();
  for (const p of pillarRows as PillarRow[]) {
    const key = normClaim(p.claim);
    const g = pillarGroup.get(key) ?? { claim: p.claim, breaksIf: null, origins: new Set<string>(), ids: new Set<string>() };
    g.breaksIf = g.breaksIf ?? p.breaks_if;
    g.origins.add(p.origin);
    g.ids.add(p.id);
    pillarGroup.set(key, g);
    groupOfPillar.set(p.id, key);
  }

  const byGroup = new Map<string, Map<string, ScoredCatch>>();
  for (const e of evidence) {
    const gk = groupOfPillar.get(e.pillar_id);
    if (!gk) continue;
    const hasKillCriterion = !!pillarGroup.get(gk)?.breaksIf;
    const findings = byGroup.get(gk) ?? new Map<string, ScoredCatch>();
    const fk = findingKey(e);
    const seen = findings.get(fk);
    if (seen) {
      seen.copies++;
      continue;
    }
    const sourceClass = classifySource(e.source_type, e.source_url);
    findings.set(fk, {
      id: e.id,
      text: `${e.source_title} ${e.excerpt}`,
      sourceClass,
      evidenceClass: classifyEvidence(sourceClass, e.excerpt, hasKillCriterion),
      dateISO: (e.source_published_at ?? e.created_at).slice(0, 10),
      verdict: e.verdict as ScoredCatch['verdict'],
      materiality: e.materiality as ScoredCatch['materiality'],
      title: e.source_title,
      excerpt: e.excerpt,
      why: e.why,
      whatItMeans: e.what_it_means,
      consider: e.consider,
      url: e.source_url,
      copies: 1,
    });
    byGroup.set(gk, findings);
  }

  const pillars: ScoredPillar[] = [];
  for (const [key, g] of pillarGroup) {
    const catches = [...(byGroup.get(key)?.values() ?? [])].sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    if (!catches.length) continue;
    pillars.push({
      key,
      claim: g.claim,
      breaksIf: g.breaksIf,
      origins: [...g.origins],
      catches,
      mechanisms: clusterByMechanism(catches),
    });
  }
  pillars.sort((a, b) => b.catches.length - a.catches.length);

  base.pillars = pillars;
  base.dedupedRows = pillars.reduce((s, p) => s + p.catches.length, 0);
  return base;
}
