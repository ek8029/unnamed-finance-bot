// lib/thesis-actions.ts
// Reasoned-actions pipeline (agentic layer, feature 1 / centerpiece).
//
// Turns broken/weakening thesis pillars into grounded, NON-DISCRETIONARY actions
// ("consider X, you decide") and writes them into the shared `insights` table so
// they surface automatically in the Actions Inbox AND inside each thesis view.
//
// Design constraints:
//  - PIPELINE, not a UI-coupled feature. Pure, deterministic core (selection +
//    archetype + composition) with clean inputs/outputs; the future agentic
//    orchestration loop invokes these as TOOLS. The UI is a thin consumer.
//  - No LLM here. Every action is grounded in stored evidence that already passed
//    the verbatim-excerpt guard at scoring time. No fabrication possible.
//  - Non-discretionary framing only (RIA-light): we recommend, the user approves,
//    nothing is ever executed. No em dashes (house style).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PillarStatus } from '@/lib/thesis-status';
import { TAX_RATE } from '@/lib/financial-config';
import { isHarvestableLoss } from '@/lib/tax-analysis';
import { estimateCappedTlhSavings, splitLossByCharacter } from '@/lib/tax-math';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionKind = 'harvest_loss' | 'trim' | 'watch';

export interface ActionEvidence {
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  source_type: 'filing' | 'form4' | 'xbrl' | 'news' | 'price_move';
  excerpt: string;
  what_it_means: string | null;
  source_title: string;
  source_url: string | null;
  is_backfill: boolean;
  /** True for a single severe primary contradiction (e.g. a >=20% adverse move). */
  severe: boolean;
}

export interface PillarInput {
  thesisId: string;
  ticker: string;
  pillarId: string;
  claim: string;
  status: PillarStatus;
  evidence: ActionEvidence[];
}

export interface HoldingSnapshot {
  ticker: string;
  totalValue: number;
  unrealisedGainLoss: number | null;
  /** Sum of unrealized loss on this ticker in TAXABLE, priced accounts only —
   *  the portion actually eligible for tax-loss harvesting (excludes IRA/401(k)/
   *  HSA and unpriced positions). Drives harvest-vs-trim and the tax impact. */
  harvestableLoss: number;
}

export interface ThesisAction {
  thesisId: string;
  ticker: string;
  pillarId: string;
  kind: ActionKind;
  insightType: 'portfolio' | 'tax';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendedAction: string;
  explanation: string;
  estimatedImpact: number | null;
  citedExcerpts: string[];
}

const PRIMARY_SOURCES = new Set(['filing', 'form4', 'xbrl', 'price_move']);
const MAX_CITED = 2;

// ---------------------------------------------------------------------------
// Pure core (deterministic, testable)
// ---------------------------------------------------------------------------

/** Live, material, contradicting evidence ranked severe-first then primary-first. */
export function topContradictions(evidence: ActionEvidence[], limit = MAX_CITED): ActionEvidence[] {
  return evidence
    .filter((e) => !e.is_backfill && e.verdict === 'contradicts' && e.materiality === 'material')
    .sort((a, b) => {
      if (a.severe !== b.severe) return a.severe ? -1 : 1;
      const ap = PRIMARY_SOURCES.has(a.source_type) ? 0 : 1;
      const bp = PRIMARY_SOURCES.has(b.source_type) ? 0 : 1;
      return ap - bp;
    })
    .slice(0, limit);
}

/**
 * Keep only pillars that warrant an action: broken or weakening, and grounded by
 * at least one live material contradiction we can cite. Intact / unverified, or
 * a status with no citable contradiction, are skipped (cannot ground an action).
 */
export function selectActionableSituations(pillars: PillarInput[]): PillarInput[] {
  return pillars.filter(
    (p) =>
      (p.status === 'broken' || p.status === 'weakening') &&
      topContradictions(p.evidence).length > 0,
  );
}

/** Archetype: weakening => watch; broken at a loss => harvest_loss; else trim. */
export function deriveActionKind(status: PillarStatus, holding?: HoldingSnapshot): ActionKind {
  if (status === 'weakening') return 'watch';
  // Only a TAXABLE, priced loss is harvestable. A position underwater purely in
  // an IRA/401(k) has harvestableLoss 0 → trim, not harvest (nothing to deduct).
  const atLoss = holding != null && holding.harvestableLoss > 0;
  return atLoss ? 'harvest_loss' : 'trim';
}

function derivePriority(status: PillarStatus, severe: boolean): ThesisAction['priority'] {
  if (status === 'weakening') return 'medium';
  return severe ? 'critical' : 'high';
}

function fmtMoney(n: number): string {
  return `$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

function groundingLine(cited: ActionEvidence[]): string {
  return cited
    .map((c) => {
      const meaning = c.what_it_means ? ` ${c.what_it_means.trim()}` : '';
      return `${c.source_title}: "${c.excerpt}".${meaning}`;
    })
    .join(' ')
    .trim();
}

/** Build one grounded, non-discretionary action from a situation + optional holding. */
export interface TlhContext {
  /** Capped savings per dollar of loss (capped pool / total losses), from the
   *  ONE shared formula in tax-analysis. Keeps per-position numbers summing to
   *  the same total the tax center and brief show. */
  savingsPerLossDollar: number;
}

export function buildAction(pillar: PillarInput, holding?: HoldingSnapshot, tlh?: TlhContext): ThesisAction {
  const cited = topContradictions(pillar.evidence);
  const severe = cited.some((c) => c.severe);
  const kind = deriveActionKind(pillar.status, holding);
  const priority = derivePriority(pillar.status, severe);
  const t = pillar.ticker;
  const grounding = groundingLine(cited);

  let insightType: ThesisAction['insightType'] = 'portfolio';
  let title: string;
  let description: string;
  let recommendedAction: string;
  let estimatedImpact: number | null = null;

  if (kind === 'harvest_loss') {
    insightType = 'tax';
    const loss = holding?.harvestableLoss ?? 0;
    // Position share of the ONE capped TLH pool (tax-analysis math). The old
    // min(loss, $3,000) x rate ignored realized-gains offset and disagreed
    // with the brief and the tax center for the same user.
    estimatedImpact = Math.round(loss * (tlh?.savingsPerLossDollar ?? TAX_RATE));
    title = `Harvest the loss on ${t}?`;
    description =
      `Your ${t} thesis broke on the pillar "${pillar.claim}". ` +
      `The position is down ${fmtMoney(loss)}, so the loss is real and harvestable now.`;
    recommendedAction =
      `Consider selling ${t} to harvest the loss, then reallocating to a similar but not ` +
      `substantially identical asset to keep your exposure. IRC 1091 disallows the loss if a ` +
      `substantially identical security is acquired in the 30 days BEFORE the sale, on the day ` +
      `of the sale, or in the 30 days after it: a 61-day wash sale window. Check for recent buys, ` +
      `automatic dividend reinvestment, and purchases inside an IRA or 401(k) before selling; a ` +
      `purchase by your IRA disallows the loss permanently with no basis restoration ` +
      `(Rev. Rul. 2008-5). This is not tax advice; consult a qualified professional. You decide ` +
      `whether to act, and nothing is executed for you.`;
  } else if (kind === 'trim') {
    title = `Trim ${t}?`;
    description =
      `Your ${t} thesis broke on the pillar "${pillar.claim}". ` +
      `The reasons you stated for holding it no longer hold.`;
    recommendedAction =
      `Consider reducing your ${t} exposure while the thesis is broken, either to reallocate ` +
      `or to lock in gains. You decide whether to act, and nothing is executed for you.`;
  } else {
    // watch
    title = `${t} thesis weakening: monitor`;
    description =
      `Your ${t} thesis is weakening on the pillar "${pillar.claim}". ` +
      `It is not broken yet, but the evidence is turning against it.`;
    recommendedAction =
      `No action required yet. Keep monitoring ${t}. If more evidence contradicts this pillar, ` +
      `the thesis breaks and you will see a clear recommendation here.`;
  }

  const explanation = grounding ? `Grounded in the evidence. ${grounding}` : description;

  return {
    thesisId: pillar.thesisId,
    ticker: t,
    pillarId: pillar.pillarId,
    kind,
    insightType,
    priority,
    title,
    description,
    recommendedAction,
    explanation,
    estimatedImpact,
    citedExcerpts: cited.map((c) => c.excerpt),
  };
}

/** Full pure transform: pillars + holdings => grounded actions. */
export function buildThesisActions(
  pillars: PillarInput[],
  holdings: Map<string, HoldingSnapshot>,
  tlh?: TlhContext,
): ThesisAction[] {
  const all = selectActionableSituations(pillars).map((p) =>
    buildAction(p, holdings.get(p.ticker.toUpperCase()), tlh),
  );
  // One action per ticker: a thesis with two weakening pillars should surface a
  // single inbox item, not duplicates. Keep the highest-priority action; tie-break
  // by pillarId so the kept action is stable across scoring runs.
  const RANK: Record<ThesisAction['priority'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const byTicker = new Map<string, ThesisAction>();
  for (const a of all) {
    const key = a.ticker.toUpperCase();
    const cur = byTicker.get(key);
    if (
      !cur ||
      RANK[a.priority] < RANK[cur.priority] ||
      (RANK[a.priority] === RANK[cur.priority] && a.pillarId < cur.pillarId)
    ) {
      byTicker.set(key, a);
    }
  }
  return [...byTicker.values()];
}

// ---------------------------------------------------------------------------
// Generator (I/O orchestration around the pure core)
// ---------------------------------------------------------------------------

const SEVERE_MOVE_PCT = 20;
function parsePct(excerpt: string): number {
  const m = excerpt.match(/(\d+(?:\.\d+)?)%/);
  return m ? parseFloat(m[1]) : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient | any;

/**
 * Reasoned-actions pipeline entrypoint. Reads tracked theses + confirmed pillars +
 * their evidence + holdings, builds grounded non-discretionary actions, and writes
 * the new ones into `insights` (source_type ai_generated, related_entity_type
 * 'thesis'). Idempotent-ish: supersedes stale same-titled thesis actions.
 * Returns the count written and the actions (so callers / the agentic loop can use
 * the structured result without re-reading the DB).
 */
export async function generateThesisActions(
  db: AnyClient,
  userId: string,
): Promise<{ generated: number; actions: ThesisAction[] }> {
  // 1. Tracked theses (id -> ticker)
  const { data: theses } = await db
    .from('theses')
    .select('id, ticker')
    .eq('user_id', userId)
    .eq('tracked', true);
  if (!theses || theses.length === 0) return { generated: 0, actions: [] };

  const tickerByThesis = new Map<string, string>();
  for (const t of theses as { id: string; ticker: string }[]) tickerByThesis.set(t.id, t.ticker);
  const thesisIds = [...tickerByThesis.keys()];

  // 2. Confirmed pillars
  const { data: pillarsRaw } = await db
    .from('thesis_pillars')
    .select('id, thesis_id, claim, status, status_override')
    .in('thesis_id', thesisIds)
    .eq('confirmed', true);
  const pillarRows = (pillarsRaw ?? []) as {
    id: string;
    thesis_id: string;
    claim: string;
    status: PillarStatus;
    status_override: PillarStatus | null;
  }[];
  if (pillarRows.length === 0) return { generated: 0, actions: [] };

  // 3. Evidence for those pillars
  const pillarIds = pillarRows.map((p) => p.id);
  const { data: evidenceRaw } = await db
    .from('pillar_evidence')
    .select(
      'pillar_id, verdict, materiality, source_type, excerpt, what_it_means, source_title, source_url, is_backfill',
    )
    .in('pillar_id', pillarIds);
  const evidenceByPillar = new Map<string, ActionEvidence[]>();
  for (const e of (evidenceRaw ?? []) as Record<string, unknown>[]) {
    const pid = e.pillar_id as string;
    const excerpt = (e.excerpt as string) ?? '';
    const arr = evidenceByPillar.get(pid) ?? [];
    arr.push({
      verdict: e.verdict as ActionEvidence['verdict'],
      materiality: e.materiality as ActionEvidence['materiality'],
      source_type: e.source_type as ActionEvidence['source_type'],
      excerpt,
      what_it_means: (e.what_it_means as string | null) ?? null,
      source_title: (e.source_title as string) ?? '',
      source_url: (e.source_url as string | null) ?? null,
      is_backfill: Boolean(e.is_backfill),
      severe: e.source_type === 'price_move' && parsePct(excerpt) >= SEVERE_MOVE_PCT,
    });
    evidenceByPillar.set(pid, arr);
  }

  // 4. Holdings (ticker -> snapshot), for trim-vs-harvest + tax impact. A ticker
  // can appear in several accounts (taxable + IRA), so AGGREGATE across rows
  // rather than overwrite, and track the harvestable (taxable+priced) loss
  // separately from the total unrealized P/L.
  const { data: holdingsRaw } = await db
    .from('holdings')
    .select('ticker, total_value, unrealised_gain_loss, acquired_at, account:linked_accounts(account_name, account_subtype)')
    .eq('user_id', userId);
  const holdings = new Map<string, HoldingSnapshot>();
  // Per-LOT harvestable losses, kept unfolded so holding period survives the
  // ticker-level aggregation above (one name can sit in two accounts with two
  // acquisition dates, and the character decides the rate).
  const harvestLots: { loss: number; acquiredAt: string | null }[] = [];
  for (const h of (holdingsRaw ?? []) as Record<string, unknown>[]) {
    const ticker = String(h.ticker).toUpperCase();
    const ugl = h.unrealised_gain_loss != null ? Number(h.unrealised_gain_loss) : null;
    const account = (h.account ?? null) as { account_name?: string | null; account_subtype?: string | null } | null;
    const harvestable = isHarvestableLoss({ unrealised_gain_loss: ugl, total_value: h.total_value == null ? null : Number(h.total_value) }, account);
    if (harvestable) {
      harvestLots.push({
        loss: Math.abs(ugl as number),
        acquiredAt: h.acquired_at == null ? null : String(h.acquired_at),
      });
    }
    const prev = holdings.get(ticker);
    holdings.set(ticker, {
      ticker,
      totalValue: (prev?.totalValue ?? 0) + (Number(h.total_value) || 0),
      unrealisedGainLoss: ugl == null && prev?.unrealisedGainLoss == null ? null : (prev?.unrealisedGainLoss ?? 0) + (ugl ?? 0),
      harvestableLoss: (prev?.harvestableLoss ?? 0) + (harvestable ? Math.abs(ugl as number) : 0),
    });
  }

  // 5. Pure transform
  const pillarInputs: PillarInput[] = pillarRows.map((p) => ({
    thesisId: p.thesis_id,
    ticker: tickerByThesis.get(p.thesis_id) ?? '',
    pillarId: p.id,
    claim: p.claim,
    // honor a user override; otherwise trust the last-scored status
    status: p.status_override ?? p.status,
    evidence: evidenceByPillar.get(p.id) ?? [],
  }));
  // ONE TLH pool: capped savings (tax-analysis formula, gains offset + $3k cap)
  // apportioned per dollar of loss, so per-position numbers sum to the same
  // total the tax center and brief show.
  const lossTotal = [...holdings.values()].reduce((s, h) => s + h.harvestableLoss, 0);
  let tlhCtx: TlhContext | undefined;
  if (lossTotal > 0) {
    const { data: ytdGains } = await db
      .from('capital_gains')
      .select('gain_loss, gain_loss_type')
      .eq('user_id', userId)
      .eq('tax_year', new Date().getFullYear())
      .eq('transaction_type', 'sell');
    let stGainYtd = 0;
    let ltGainYtd = 0;
    for (const g of (ytdGains ?? []) as { gain_loss: number | null; gain_loss_type: string | null }[]) {
      if (g.gain_loss_type === 'short_term') stGainYtd += Number(g.gain_loss || 0);
      else ltGainYtd += Number(g.gain_loss || 0);
    }
    // Real IRC §1222 character per lot, so the per-position dollars here agree
    // with the Tax Center instead of being pooled as long-term.
    const character = splitLossByCharacter(harvestLots);
    const capped = estimateCappedTlhSavings({
      stLoss: character.stLoss,
      ltLoss: character.ltLoss,
      unknownLoss: character.unknownLoss,
      stGainYtd,
      ltGainYtd,
      ordinaryRate: TAX_RATE,
    });
    tlhCtx = { savingsPerLossDollar: capped.cappedSavings / lossTotal };
  }

  const actions = buildThesisActions(pillarInputs, holdings, tlhCtx);
  if (actions.length === 0) return { generated: 0, actions: [] };

  // 6. Dedup by THESIS: we now emit at most one action per thesis, so supersede every
  // open thesis action for a thesis we are re-acting on. related_entity_ids = [thesisId,
  // pillarId]; keying on thesisId also clears stale duplicates left by prior per-pillar runs.
  const { data: existing } = await db
    .from('insights')
    .select('id, related_entity_ids')
    .eq('user_id', userId)
    .eq('related_entity_type', 'thesis')
    .eq('is_dismissed', false)
    .eq('is_archived', false);
  const existingByThesis = new Map<string, string[]>();
  for (const row of (existing ?? []) as { id: string; related_entity_ids: string[] | null }[]) {
    const tid = Array.isArray(row.related_entity_ids) ? row.related_entity_ids[0] : undefined;
    if (!tid) continue;
    const ids = existingByThesis.get(tid) ?? [];
    ids.push(row.id);
    existingByThesis.set(tid, ids);
  }
  const staleIds: string[] = [];
  for (const a of actions) {
    const ids = existingByThesis.get(a.thesisId);
    if (ids) staleIds.push(...ids);
  }
  if (staleIds.length > 0) {
    await db.from('insights').update({ is_dismissed: true }).in('id', staleIds).eq('user_id', userId);
  }

  const inserts = actions.map((a) => ({
    user_id: userId,
    insight_type: a.insightType,
    priority: a.priority,
    title: a.title,
    description: a.description,
    recommended_action: a.recommendedAction,
    explanation: a.explanation,
    estimated_impact_amount: a.estimatedImpact,
    source_type: 'ai_generated' as const,
    related_entity_type: 'thesis',
    related_entity_ids: [a.thesisId, a.pillarId],
  }));
  const { error } = await db.from('insights').insert(inserts);
  if (error) {
    console.error('[thesis-actions] insert error:', error.message);
    return { generated: 0, actions };
  }

  return { generated: actions.length, actions };
}
