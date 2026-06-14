// lib/cross-thesis-risk.ts
// Cross-thesis risk monitor (agentic layer, feature 3).
//
// The ACTIVE version of the synthesis: the synthesis names shared drivers across
// theses; this fires when a member of a shared-driver cluster actually MOVES
// (weakening/broken). It is the concentration you cannot see one thesis at a time:
// "N of your theses depend on the same driver, and it just moved."
//
// Pure core (testable) + generator. Neutral language (describes concentration,
// never advises). Writes into `insights` (insight_type concentration, source
// ai_generated, related_entity_type thesis_risk).

import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PillarStatus } from '@/lib/thesis-status';
import { clusterPillars, type SynthPillarInput, type SynthCluster } from '@/lib/thesis-synthesis';

// Lazy: do not construct at module load (keeps the pure exports importable in
// tests / any context without OPENAI_API_KEY).
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  return (_openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}

export interface RiskMember {
  ticker: string;
  thesisId: string;
  worstStatus: PillarStatus;
}

export interface RiskCluster {
  driver: string;
  members: RiskMember[];
}

export interface RiskAlert {
  driver: string;
  thesisIds: string[];
  tickers: string[];
  movedTickers: string[];
  severity: 'critical' | 'high' | 'medium';
  rationale: string;
}

const STATUS_RANK: Record<PillarStatus, number> = { broken: 0, weakening: 1, intact: 2, unverified: 3 };

/** Worst (most degraded) of two statuses. */
export function worstStatus(a: PillarStatus, b: PillarStatus): PillarStatus {
  return STATUS_RANK[a] <= STATUS_RANK[b] ? a : b;
}

/**
 * Turn driver clusters into alerts. A cluster alerts only when it spans 2+ tickers
 * AND at least one member has moved (weakening or broken). Severity scales with how
 * many members broke.
 */
export function buildRiskAlerts(clusters: RiskCluster[]): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  for (const c of clusters) {
    const tickers = [...new Set(c.members.map((m) => m.ticker))];
    if (tickers.length < 2) continue;

    const moved = c.members.filter((m) => m.worstStatus === 'broken' || m.worstStatus === 'weakening');
    if (moved.length === 0) continue;

    const brokenCount = c.members.filter((m) => m.worstStatus === 'broken').length;
    const movedTickers = [...new Set(moved.map((m) => m.ticker))];
    const severity: RiskAlert['severity'] = brokenCount >= 2 ? 'critical' : brokenCount === 1 ? 'high' : 'medium';

    const verb = movedTickers.length === 1 ? 'has moved' : 'have moved';
    const rationale =
      `${tickers.length} of your theses depend on ${c.driver}. ` +
      `${movedTickers.join(', ')} ${verb}, so this shared driver is concentration that one change can move together. ` +
      `Review whether your exposure to ${c.driver} reflects how much conviction you have in it.`;

    alerts.push({
      driver: c.driver,
      thesisIds: [...new Set(c.members.map((m) => m.thesisId))],
      tickers,
      movedTickers,
      severity,
      rationale,
    });
  }
  return alerts;
}

/** Attach per-member worst status to raw synthesis clusters. */
export function toRiskClusters(
  clusters: SynthCluster[],
  thesisIdByTicker: Map<string, string>,
  worstByTicker: Map<string, PillarStatus>,
): RiskCluster[] {
  return clusters.map((c) => {
    const byTicker = new Map<string, RiskMember>();
    for (const p of c.pillars) {
      const ticker = p.ticker.toUpperCase();
      if (!byTicker.has(ticker)) {
        byTicker.set(ticker, {
          ticker,
          thesisId: thesisIdByTicker.get(ticker) ?? '',
          worstStatus: worstByTicker.get(ticker) ?? 'unverified',
        });
      }
    }
    return { driver: c.driver, members: [...byTicker.values()] };
  });
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

function normalizeTitle(title: string): string {
  return title.replace(/\$[\d,]+(\.\d+)?/g, '$X').replace(/\d+(\.\d+)?%/g, 'X%');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient | any;

export async function generateCrossThesisRisks(
  db: AnyClient,
  userId: string,
): Promise<{ generated: number; alerts: RiskAlert[] }> {
  const { data: theses } = await db
    .from('theses')
    .select('id, ticker')
    .eq('user_id', userId)
    .eq('tracked', true);
  if (!theses || theses.length < 2) return { generated: 0, alerts: [] };

  const tickerByThesis = new Map<string, string>();
  const thesisIdByTicker = new Map<string, string>();
  for (const t of theses as { id: string; ticker: string }[]) {
    tickerByThesis.set(t.id, t.ticker);
    thesisIdByTicker.set(t.ticker.toUpperCase(), t.id);
  }
  const thesisIds = [...tickerByThesis.keys()];

  const { data: pillarsRaw } = await db
    .from('thesis_pillars')
    .select('id, thesis_id, claim, status, status_override, confirmed, lifecycle')
    .in('thesis_id', thesisIds)
    .eq('confirmed', true);
  const pillarRows = (pillarsRaw ?? []) as {
    id: string; thesis_id: string; claim: string; status: PillarStatus; status_override: PillarStatus | null; lifecycle?: string;
  }[];

  const inputs: SynthPillarInput[] = [];
  const worstByTicker = new Map<string, PillarStatus>();
  for (const p of pillarRows) {
    if (p.lifecycle === 'dismissed') continue;
    const ticker = tickerByThesis.get(p.thesis_id);
    if (!ticker || typeof p.claim !== 'string' || !p.claim.trim()) continue;
    inputs.push({ id: p.id, ticker, claim: p.claim.trim() });
    const status = p.status_override ?? p.status;
    const key = ticker.toUpperCase();
    worstByTicker.set(key, worstByTicker.has(key) ? worstStatus(worstByTicker.get(key)!, status) : status);
  }
  if (new Set(inputs.map((i) => i.ticker)).size < 2) return { generated: 0, alerts: [] };

  const clusters = await clusterPillars(getOpenAI(), inputs);
  const riskClusters = toRiskClusters(clusters, thesisIdByTicker, worstByTicker);
  const alerts = buildRiskAlerts(riskClusters);
  if (alerts.length === 0) return { generated: 0, alerts: [] };

  // Dedup vs existing open risk alerts (supersede stale same-title)
  const { data: existing } = await db
    .from('insights')
    .select('id, title')
    .eq('user_id', userId)
    .eq('related_entity_type', 'thesis_risk')
    .eq('is_dismissed', false)
    .eq('is_archived', false);
  const existingByNorm = new Map<string, string[]>();
  for (const row of (existing ?? []) as { id: string; title: string }[]) {
    const norm = normalizeTitle(row.title);
    const ids = existingByNorm.get(norm) ?? [];
    ids.push(row.id);
    existingByNorm.set(norm, ids);
  }
  const titleFor = (a: RiskAlert) => `Shared risk: ${a.driver}`;
  const staleIds: string[] = [];
  for (const a of alerts) {
    const ids = existingByNorm.get(normalizeTitle(titleFor(a)));
    if (ids) staleIds.push(...ids);
  }
  if (staleIds.length > 0) {
    await db.from('insights').update({ is_dismissed: true }).in('id', staleIds).eq('user_id', userId);
  }

  const inserts = alerts.map((a) => ({
    user_id: userId,
    insight_type: 'concentration',
    priority: a.severity,
    title: titleFor(a),
    description: `${a.tickers.join(', ')} all depend on ${a.driver}. ${a.movedTickers.join(', ')} just moved.`,
    recommended_action: null,
    explanation: a.rationale,
    estimated_impact_amount: null,
    source_type: 'ai_generated' as const,
    related_entity_type: 'thesis_risk',
    related_entity_ids: a.thesisIds,
  }));
  const { error } = await db.from('insights').insert(inserts);
  if (error) {
    console.error('[cross-thesis-risk] insert error:', error.message);
    return { generated: 0, alerts };
  }

  return { generated: alerts.length, alerts };
}
