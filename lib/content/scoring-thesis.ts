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

import type { SupabaseClient } from '@supabase/supabase-js';
import { createStaticServiceClient } from '@/lib/supabase/server';
import { getHouseThesis } from './house-theses';
import { classifyClaim } from './claim-type';
import {
  clusterByMechanism,
  type ClusterItem,
  type EvidenceClass,
  type Mechanism,
  type SourceClass,
} from './mechanism-cluster';
import { toMechanisms } from './mechanism-judge';
import { evidenceHash, readMechanismCache, scopeKey } from './mechanism-cache';

/* ── source classification ─────────────────────────────────────────────── */

// Wires and press-release distributors carry the primary text itself, so the
// domain settles it. For everything else the domain settles nothing: Yahoo and
// Nasdaq are 741 of 1,000 sampled rows and syndicate reporting and opinion
// alike, which is why classifying by domain filed "France ended Palantir's
// contract with its intelligence agency" as analyst opinion.
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

const VALID_SOURCE_CLASSES = new Set<SourceClass>([
  'company_filing', 'primary_news', 'analyst_opinion', 'insider', 'xbrl', 'price',
]);

/**
 * What kind of independent confirmation this piece of evidence is.
 *
 * `stored` is the judge's own call, made at scoring time with the whole source
 * in front of it, and it wins whenever it is present. Rows scored before that
 * field existed fall back to reading the claim out of the text, which lands
 * around 80% on a blind sample. A mistake there is survivable: `primary_news`
 * still cannot escalate a pillar on its own, so a misread only counts when a
 * genuinely different class agrees with it.
 */
export function classifySource(
  sourceType: string,
  url: string | null,
  text = '',
  stored?: string | null,
): SourceClass {
  if (stored && VALID_SOURCE_CLASSES.has(stored as SourceClass)) return stored as SourceClass;
  switch (sourceType) {
    case 'filing': return 'company_filing';
    case 'xbrl': return 'xbrl';
    case 'form4': return 'insider';
    case 'price_move': return 'price';
    default:
      if (PRIMARY_NEWS_DOMAINS.has(domainOf(url))) return 'primary_news';
      return classifyClaim(text) === 'reported_event' ? 'primary_news' : 'analyst_opinion';
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

/**
 * Big enough to stand alone. The shipped status engine already breaks a pillar
 * on a single severe primary contradiction; the ladder has to honour the same
 * rule or it will talk a real collapse back down to "watch". PRIM fell 38.2% in
 * a day against a pillar that said its share price holds up, and an earlier
 * version of this file called that intact.
 */
// Deliberately identical to the rule in score-theses.ts, so the two engines are
// compared on the same footing rather than one being handed a capability the
// other lacks. That constant is currently copied in score-theses, thesis-actions
// and thesis-investigation; this is a fourth copy and the set wants extracting.
const SEVERE_MOVE_PCT = 20;

export function isSevere(rawSourceType: string, excerpt: string): boolean {
  if (rawSourceType !== 'price_move') return false;
  return Number(excerpt.match(/(\d+(?:\.\d+)?)\s?%/)?.[1] ?? 0) >= SEVERE_MOVE_PCT;
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
  /** Raw fields the shipped status engine consumes, kept so both engines can be
   *  run over identical evidence and compared. */
  sourceKey: string;
  rawSourceType: string;
  isBackfill: boolean;
  createdAt: string;
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

// `pillar_evidence.source_class` arrives with the migration that lets the judge
// emit it. Until that is applied this reads without the column, so the page
// works against today's database and picks the field up the moment it exists.
// Same probe-and-cache shape as hasJudgedByColumn in score-theses.ts.
let sourceClassColumnKnown: boolean | null = null;

async function hasSourceClassColumn(db: SupabaseClient): Promise<boolean> {
  if (sourceClassColumnKnown !== null) return sourceClassColumnKnown;
  const { error } = await db.from('pillar_evidence').select('source_class').limit(1);
  // Cache only a definitive answer: a pooler blip must not poison it for the
  // lifetime of the instance.
  if (!error) sourceClassColumnKnown = true;
  else if (error.code === '42703') sourceClassColumnKnown = false; // undefined_column
  return sourceClassColumnKnown ?? false;
}

interface PillarRow { id: string; thesis_id: string; claim: string; breaks_if: string | null; origin: string }
interface EvidenceRow {
  id: string; pillar_id: string; user_id: string; verdict: string; materiality: string;
  source_type: string; source_key: string; source_title: string; source_url: string | null;
  source_published_at: string | null; excerpt: string; why: string; what_it_means: string;
  consider: string | null; created_at: string; is_backfill: boolean; source_class?: string | null;
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

  const withClass = await hasSourceClassColumn(db);
  const EV_COLS =
    'id, pillar_id, user_id, verdict, materiality, source_type, source_key, source_title, source_url, ' +
    'source_published_at, excerpt, why, what_it_means, consider, created_at, is_backfill' +
    (withClass ? ', source_class' : '');

  const { data: evRows } = await db
    .from('pillar_evidence')
    .select(EV_COLS)
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
    const sourceClass = classifySource(
      e.source_type,
      e.source_url,
      `${e.source_title} ${e.excerpt}`,
      e.source_class,
    );
    findings.set(fk, {
      id: e.id,
      text: `${e.source_title} ${e.excerpt}`,
      sourceClass,
      evidenceClass: classifyEvidence(sourceClass, e.excerpt, hasKillCriterion),
      dateISO: (e.source_published_at ?? e.created_at).slice(0, 10),
      severe: isSevere(e.source_type, e.excerpt),
      verdict: e.verdict as ScoredCatch['verdict'],
      materiality: e.materiality as ScoredCatch['materiality'],
      title: e.source_title,
      excerpt: e.excerpt,
      why: e.why,
      whatItMeans: e.what_it_means,
      consider: e.consider,
      url: e.source_url,
      copies: 1,
      sourceKey: e.source_key,
      rawSourceType: e.source_type,
      isBackfill: e.is_backfill,
      createdAt: e.created_at,
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

  // Prefer the judged grouping where a fresh cache row exists (script/cron
  // writes it; migration 058). Hash mismatch or no row = keep the heuristic.
  // The page path never makes a model call.
  const cache = await readMechanismCache(db, pillars.map((p) => scopeKey(SYM, p.key)));
  for (const p of pillars) {
    const hit = cache.get(scopeKey(SYM, p.key));
    if (!hit || hit.evidenceHash !== evidenceHash(p.catches.map((c) => c.id))) continue;
    const judged = toMechanisms(hit.groups, p.catches);
    if (judged.length > 0) p.mechanisms = judged;
  }

  base.pillars = pillars;
  base.dedupedRows = pillars.reduce((s, p) => s + p.catches.length, 0);
  return base;
}
