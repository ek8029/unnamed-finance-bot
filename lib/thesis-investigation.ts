// lib/thesis-investigation.ts
// Triggered-investigation pipeline (agentic layer, feature 2).
//
// An EVENT (a severe adverse move, a new primary-source contradiction, a pillar
// breaking) triggers a grounded "what happened and why" record that links the
// event to the affected pillars across a thesis. Diagnosis, not prescription:
// it explains; the reasoned-actions pipeline (feature 1) prescribes.
//
// Pure, deterministic, grounded in stored verbatim evidence. No LLM, no fabrication.
// Writes into the shared `insights` table (insight_type market, source ai_generated,
// related_entity_type thesis_investigation) so it surfaces in the inbox and in-thesis.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PillarStatus } from '@/lib/thesis-status';

export type TriggerKind = 'severe_move' | 'new_filing' | 'breach';

export interface InvEvidence {
  pillarId: string;
  claim: string;
  status: PillarStatus;
  verdict: 'supports' | 'contradicts' | 'neutral';
  materiality: 'material' | 'context';
  source_type: 'filing' | 'form4' | 'xbrl' | 'news' | 'price_move';
  excerpt: string;
  what_it_means: string | null;
  source_title: string;
  source_url: string | null;
  is_backfill: boolean;
  severe: boolean;
  published_at: string | null;
}

export interface Investigation {
  thesisId: string;
  ticker: string;
  trigger: { kind: TriggerKind; headline: string; date: string | null };
  finding: string;
  affectedPillars: { claim: string; status: PillarStatus; excerpt: string }[];
  priority: 'critical' | 'high';
}

const PRIMARY_SOURCES = new Set(['filing', 'form4', 'xbrl', 'price_move']);
const MAX_FINDING_CITES = 3;

/** Live, material, contradicting evidence only. */
function liveMaterialContradictions(rows: InvEvidence[]): InvEvidence[] {
  return rows.filter((e) => !e.is_backfill && e.verdict === 'contradicts' && e.materiality === 'material');
}

/**
 * The headline triggering event for a thesis, strongest first:
 *   severe adverse move > new primary-source contradiction > a broken pillar.
 * Returns null when nothing material is contradicting.
 */
export function pickTrigger(rows: InvEvidence[]): InvEvidence & { kind: TriggerKind } | null {
  const contra = liveMaterialContradictions(rows);
  if (contra.length === 0) return null;

  const severe = contra.find((e) => e.severe && e.source_type === 'price_move');
  if (severe) return { ...severe, kind: 'severe_move' };

  const primary = contra
    .filter((e) => PRIMARY_SOURCES.has(e.source_type))
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))[0];
  if (primary) return { ...primary, kind: 'new_filing' };

  const onBroken = contra.find((e) => e.status === 'broken');
  if (onBroken) return { ...onBroken, kind: 'breach' };

  return null;
}

/**
 * Build a grounded investigation for a thesis, or null if there is no real event
 * worth investigating. We only fire on a severe move or an actually-broken pillar,
 * so an ordinary single weakening news item does NOT spawn an investigation (that
 * is a "watch" action, not an event).
 */
export function buildInvestigation(thesisId: string, ticker: string, rows: InvEvidence[]): Investigation | null {
  const trigger = pickTrigger(rows);
  if (!trigger) return null;

  const contra = liveMaterialContradictions(rows);
  const hasBroken = contra.some((e) => e.status === 'broken');
  if (trigger.kind !== 'severe_move' && !hasBroken) return null;

  // Affected pillars: distinct pillars with a live material contradiction, lead
  // excerpt each, broken first.
  const byPillar = new Map<string, InvEvidence>();
  for (const e of contra) {
    const cur = byPillar.get(e.pillarId);
    if (!cur || (e.severe && !cur.severe)) byPillar.set(e.pillarId, e);
  }
  const affectedPillars = [...byPillar.values()]
    .sort((a, b) => (a.status === 'broken' ? 0 : 1) - (b.status === 'broken' ? 0 : 1))
    .map((e) => ({ claim: e.claim, status: e.status, excerpt: e.excerpt }));

  // Finding: distinct material contradictions (severe + primary first), capped.
  const cites = [...contra]
    .sort((a, b) => {
      if (a.severe !== b.severe) return a.severe ? -1 : 1;
      const ap = PRIMARY_SOURCES.has(a.source_type) ? 0 : 1;
      const bp = PRIMARY_SOURCES.has(b.source_type) ? 0 : 1;
      return ap - bp;
    })
    .filter((e, i, arr) => arr.findIndex((x) => x.excerpt === e.excerpt) === i)
    .slice(0, MAX_FINDING_CITES);
  const finding = cites
    .map((c) => {
      const meaning = c.what_it_means ? ` ${c.what_it_means.trim()}` : '';
      return `${c.source_title}: "${c.excerpt}".${meaning}`;
    })
    .join(' ')
    .trim();

  return {
    thesisId,
    ticker,
    trigger: { kind: trigger.kind, headline: trigger.excerpt, date: trigger.published_at },
    finding,
    affectedPillars,
    priority: trigger.kind === 'severe_move' ? 'critical' : 'high',
  };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

const SEVERE_MOVE_PCT = 20;
function parsePct(excerpt: string): number {
  const m = excerpt.match(/(\d+(?:\.\d+)?)%/);
  return m ? parseFloat(m[1]) : 0;
}
function normalizeTitle(title: string): string {
  return title.replace(/\$[\d,]+(\.\d+)?/g, '$X').replace(/\d+(\.\d+)?%/g, 'X%');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient | any;

export async function generateInvestigations(
  db: AnyClient,
  userId: string,
): Promise<{ generated: number; investigations: Investigation[] }> {
  const { data: theses } = await db
    .from('theses')
    .select('id, ticker')
    .eq('user_id', userId)
    .eq('tracked', true);
  if (!theses || theses.length === 0) return { generated: 0, investigations: [] };

  const tickerByThesis = new Map<string, string>();
  for (const t of theses as { id: string; ticker: string }[]) tickerByThesis.set(t.id, t.ticker);
  const thesisIds = [...tickerByThesis.keys()];

  const { data: pillarsRaw } = await db
    .from('thesis_pillars')
    .select('id, thesis_id, claim, status, status_override')
    .in('thesis_id', thesisIds)
    .eq('confirmed', true);
  const pillarRows = (pillarsRaw ?? []) as {
    id: string; thesis_id: string; claim: string; status: PillarStatus; status_override: PillarStatus | null;
  }[];
  if (pillarRows.length === 0) return { generated: 0, investigations: [] };

  const pillarMeta = new Map(pillarRows.map((p) => [p.id, p]));
  const pillarIds = pillarRows.map((p) => p.id);

  const { data: evidenceRaw } = await db
    .from('pillar_evidence')
    .select('pillar_id, verdict, materiality, source_type, excerpt, what_it_means, source_title, source_url, is_backfill, source_published_at')
    .in('pillar_id', pillarIds);

  // Group evidence by thesis
  const rowsByThesis = new Map<string, InvEvidence[]>();
  for (const e of (evidenceRaw ?? []) as Record<string, unknown>[]) {
    const pid = e.pillar_id as string;
    const meta = pillarMeta.get(pid);
    if (!meta) continue;
    const excerpt = (e.excerpt as string) ?? '';
    const row: InvEvidence = {
      pillarId: pid,
      claim: meta.claim,
      status: meta.status_override ?? meta.status,
      verdict: e.verdict as InvEvidence['verdict'],
      materiality: e.materiality as InvEvidence['materiality'],
      source_type: e.source_type as InvEvidence['source_type'],
      excerpt,
      what_it_means: (e.what_it_means as string | null) ?? null,
      source_title: (e.source_title as string) ?? '',
      source_url: (e.source_url as string | null) ?? null,
      is_backfill: Boolean(e.is_backfill),
      severe: e.source_type === 'price_move' && parsePct(excerpt) >= SEVERE_MOVE_PCT,
      published_at: (e.source_published_at as string | null) ?? null,
    };
    const arr = rowsByThesis.get(meta.thesis_id) ?? [];
    arr.push(row);
    rowsByThesis.set(meta.thesis_id, arr);
  }

  const investigations: Investigation[] = [];
  for (const [thesisId, rows] of rowsByThesis) {
    const inv = buildInvestigation(thesisId, tickerByThesis.get(thesisId) ?? '', rows);
    if (inv) investigations.push(inv);
  }
  if (investigations.length === 0) return { generated: 0, investigations: [] };

  // Dedup vs existing open investigations (supersede stale same-title)
  const { data: existing } = await db
    .from('insights')
    .select('id, title')
    .eq('user_id', userId)
    .eq('related_entity_type', 'thesis_investigation')
    .eq('is_dismissed', false)
    .eq('is_archived', false);
  const existingByNorm = new Map<string, string[]>();
  for (const row of (existing ?? []) as { id: string; title: string }[]) {
    const norm = normalizeTitle(row.title);
    const ids = existingByNorm.get(norm) ?? [];
    ids.push(row.id);
    existingByNorm.set(norm, ids);
  }

  const titleFor = (inv: Investigation) =>
    inv.trigger.kind === 'severe_move' ? `Why ${inv.ticker} moved` : `What changed for ${inv.ticker}`;

  const staleIds: string[] = [];
  for (const inv of investigations) {
    const ids = existingByNorm.get(normalizeTitle(titleFor(inv)));
    if (ids) staleIds.push(...ids);
  }
  if (staleIds.length > 0) {
    await db.from('insights').update({ is_dismissed: true }).in('id', staleIds).eq('user_id', userId);
  }

  const inserts = investigations.map((inv) => {
    const pillarLine = inv.affectedPillars
      .map((p) => `"${p.claim}" (${p.status})`)
      .join('; ');
    return {
      user_id: userId,
      insight_type: 'market',
      priority: inv.priority,
      title: titleFor(inv),
      description: inv.trigger.headline,
      recommended_action: null,
      explanation: `${inv.finding} Pillars affected: ${pillarLine}.`,
      estimated_impact_amount: null,
      source_type: 'ai_generated' as const,
      related_entity_type: 'thesis_investigation',
      related_entity_ids: [inv.thesisId],
    };
  });
  const { error } = await db.from('insights').insert(inserts);
  if (error) {
    console.error('[thesis-investigation] insert error:', error.message);
    return { generated: 0, investigations };
  }

  return { generated: investigations.length, investigations };
}
