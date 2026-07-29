// The queryable-findings core: pull what the agent ALREADY surfaced for a
// question, normalised into `Finding`s, so the research tab answers from the
// agent's own work instead of re-deriving it.
//
// Four sources, each user-scoped and each wrapped so one failing source never
// takes down the retrieval:
//   pillar_evidence      → thesis catches (the verbatim receipts)
//   thesis_investigations→ agent memos on status transitions
//   thesis_clusters      → cross-thesis / shared-exposure risk
//   insights             → the actions inbox (TLH, concentration, earnings scans)
//
// This never invents. If the agent found nothing for the query, it returns [].

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Finding, Topic } from './types';
import type { InvestigationMemo } from '@/lib/investigation-memo';
import { topicToInsightTypes } from './query-parse';

interface SynthClusterRow {
  driver: string;
  pillars: { ticker: string; claim: string; pillarId: string }[];
  rationale: string;
}

// Cap the total handed to the model. The prompt stays tight and the strongest
// evidence (specific catches, then agent memos) is kept ahead of the softer
// portfolio-level rows.
const MAX_CATCHES = 12;
const MAX_INVESTIGATIONS = 4;
const MAX_ACTIONS = 6;
const MAX_CLUSTERS = 4;

export async function getAgentFindings(
  db: SupabaseClient,
  userId: string,
  tickers: string[],
  topics: Topic[],
  opts: { browseAll?: boolean } = {},
): Promise<Finding[]> {
  const wanted = new Set(tickers.map((t) => t.toUpperCase()));
  const findings: Finding[] = [];

  // ── User's theses, scoped to the named tickers (or all of them for a
  //    topic-level question like "what's breaking?" that names none). ──
  let theses: { id: string; ticker: string }[] = [];
  try {
    let q = db.from('theses').select('id, ticker').eq('user_id', userId);
    if (wanted.size > 0) q = q.in('ticker', [...wanted]);
    const { data } = await q;
    theses = (data ?? []).map((t) => ({ id: String(t.id), ticker: String(t.ticker).toUpperCase() }));
  } catch {
    theses = [];
  }
  const tickerOfThesis = new Map(theses.map((t) => [t.id, t.ticker]));
  const thesisIds = theses.map((t) => t.id);

  // ── Catches (pillar_evidence) ──
  if (thesisIds.length > 0) {
    try {
      const { data: pillars } = await db
        .from('thesis_pillars')
        .select('id, thesis_id, claim')
        .in('thesis_id', thesisIds);
      const pillarMeta = new Map(
        (pillars ?? []).map((p) => [
          String(p.id),
          { ticker: tickerOfThesis.get(String(p.thesis_id)) ?? null, claim: String(p.claim) },
        ]),
      );
      if (pillarMeta.size > 0) {
        const { data: ev } = await db
          .from('pillar_evidence')
          .select(
            'id, pillar_id, verdict, materiality, source_type, source_title, source_url, source_published_at, excerpt, what_it_means, created_at',
          )
          .in('pillar_id', [...pillarMeta.keys()])
          .in('verdict', ['contradicts', 'supports'])
          .order('source_published_at', { ascending: false })
          .limit(MAX_CATCHES * 2);
        // Material first, then most recent; then trim to the cap.
        const rows = (ev ?? []).sort((a, b) => {
          const am = a.materiality === 'material' ? 0 : 1;
          const bm = b.materiality === 'material' ? 0 : 1;
          if (am !== bm) return am - bm;
          return String(b.source_published_at ?? b.created_at).localeCompare(
            String(a.source_published_at ?? a.created_at),
          );
        });
        for (const r of rows.slice(0, MAX_CATCHES)) {
          const meta = pillarMeta.get(String(r.pillar_id));
          findings.push({
            id: `catch:${r.id}`,
            kind: 'catch',
            ticker: meta?.ticker ?? null,
            claim: meta?.claim,
            summary: String(r.what_it_means || r.source_title),
            quote: String(r.excerpt),
            source: String(r.source_title),
            url: (r.source_url as string | null) ?? null,
            date: String(r.source_published_at ?? r.created_at).slice(0, 10),
            verdict: r.verdict as Finding['verdict'],
          });
        }
      }
    } catch {
      /* pillar_evidence unavailable — skip catches */
    }
  }

  // ── Investigations (thesis_investigations, migration 056) ──
  if (thesisIds.length > 0) {
    try {
      const { data: inv } = await db
        .from('thesis_investigations')
        .select('id, thesis_id, memo, trigger_kind, created_at')
        .in('thesis_id', thesisIds)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(MAX_INVESTIGATIONS);
      for (const r of inv ?? []) {
        const memo = r.memo as InvestigationMemo | null;
        if (!memo?.headline) continue;
        const freshest = memo.timeline?.[0];
        findings.push({
          id: `inv:${r.id}`,
          kind: 'investigation',
          ticker: tickerOfThesis.get(String(r.thesis_id)) ?? null,
          summary: memo.headline,
          quote: freshest?.quote,
          source: `Helm investigation (${String(r.trigger_kind).replace('_', ' ')})`,
          url: freshest?.sourceUrl ?? null,
          date: String(r.created_at).slice(0, 10),
        });
      }
    } catch {
      /* table not present — skip investigations */
    }
  }

  // ── Cross-thesis / shared-exposure risk (thesis_clusters) ──
  try {
    const { data: cl } = await db
      .from('thesis_clusters')
      .select('clusters')
      .eq('user_id', userId)
      .maybeSingle();
    const clusters = (cl?.clusters as SynthClusterRow[] | null) ?? [];
    const riskAsked = topics.includes('risk') || topics.includes('concentration');
    const relevant = clusters.filter((c) => {
      if (opts.browseAll) return true;
      const cTickers = (c.pillars ?? []).map((p) => p.ticker.toUpperCase());
      if (wanted.size > 0 && cTickers.some((t) => wanted.has(t))) return true;
      return wanted.size === 0 && riskAsked;
    });
    for (const c of relevant.slice(0, MAX_CLUSTERS)) {
      const cTickers = [...new Set((c.pillars ?? []).map((p) => p.ticker.toUpperCase()))];
      findings.push({
        id: `cluster:${c.driver.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        kind: 'cross_thesis',
        ticker: null,
        summary: `${c.driver} links ${cTickers.join(', ')}: ${c.rationale}`,
        source: 'Cross-thesis monitor',
        date: null,
      });
    }
  } catch {
    /* no clusters row — skip */
  }

  // ── Actions inbox (insights) ──
  // Always pulled: a topic-less, ticker-less question ("which ticker is
  // challenged?") is a whole-book question, and the weakening/broken-thesis
  // alerts live here. Capped at MAX_ACTIONS and intelligence-only regardless.
  const insightTypes = topicToInsightTypes(topics);
  {
    try {
      let q = db
        .from('insights')
        .select('id, insight_type, title, description, estimated_impact_amount, created_at, expires_at, is_dismissed')
        .eq('user_id', userId)
        .eq('is_dismissed', false)
        // Intelligence only, never budgeting: spending/credit detections
        // ("new monthly charge to KFC") are not findings (2026-07-24).
        .in('insight_type', ['portfolio', 'market', 'tax'])
        .order('created_at', { ascending: false })
        .limit(MAX_ACTIONS * 3);
      // Browse mode keeps all intelligence types; a scoped question narrows further.
      if (insightTypes.length > 0 && !opts.browseAll) q = q.in('insight_type', insightTypes);
      const { data: ins } = await q;
      const now = new Date().toISOString();
      const rows = (ins ?? []).filter((r) => !r.expires_at || String(r.expires_at) > now);
      for (const r of rows.slice(0, MAX_ACTIONS)) {
        const text = `${r.title} ${r.description}`;
        const hitTicker = [...wanted].find((t) => new RegExp(`\\b${t}\\b`).test(text)) ?? null;
        const impact =
          r.estimated_impact_amount != null
            ? ` (~$${Math.round(Number(r.estimated_impact_amount)).toLocaleString()})`
            : '';
        findings.push({
          id: `action:${r.id}`,
          kind: 'action',
          ticker: hitTicker,
          summary: `${r.title}${impact}`,
          quote: String(r.description),
          source: 'Actions inbox',
          date: String(r.created_at).slice(0, 10),
        });
      }
    } catch {
      /* insights table issue — skip actions */
    }
  }

  return findings;
}

/**
 * Everything the agent has surfaced across the whole book, most recent first —
 * for the browsable "what Helm found" feed that seeds questions, before any is
 * asked.
 */
export async function getRecentFindings(
  db: SupabaseClient,
  userId: string,
  limit = 24,
): Promise<Finding[]> {
  const all = await getAgentFindings(db, userId, [], [], { browseAll: true });
  return all
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, limit);
}
