// lib/overview-actions.ts
// Persists the overview's "Actions inbox" so it stops re-raising the same finding.
//
// Evan, 2026-09-10: "I don't want the same thing flagged over and over again.
// Flag it once, if a user dismisses or acts on it get rid of it, if not just keep
// a note that it's there and don't perpetually scream it into a user's face."
//
// The panel in app/dashboard/page.tsx read /api/dashboard/intelligence, which
// recomputed lib/intelligence-feed.ts from holdings on every request behind a
// one-hour in-memory cache and stamped every item createdAt = request time. No
// row existed, so there was nothing to dismiss, nothing that remembered when a
// finding was first raised, and every item was "new" on every visit. That is the
// surface being fixed.
//
// Why persist the feed rather than point the panel at the table (route a): the
// ephemeral feed emits four kinds of finding the persistent engine never writes
// at all (earnings, sector momentum, performance highlights, rebalancing), and
// its concentration lane fires from CONCENTRATION_THRESHOLDS.medium (10%) while
// lib/insights-engine.ts only writes above .critical (25%). A production probe
// (scripts/probe-overview-actions.ts) found 55 positions in that 10-25% band
// across 22 users, and zero rows ever written with insight_type 'performance' or
// 'cash_flow'. Reading the table alone would have deleted all of that from the
// overview.
//
// Everything about ageing, expiry and prominence is reused, not restated:
//   lib/insight-recurrence.ts  what counts as the same finding, and what an
//                              unchanged recurrence is allowed to touch
//   lib/insights-engine.ts     INSIGHT_LIFETIMES / insightExpiresAt, and the
//                              expiry sweep at the end of generateInsights
//   lib/insight-prominence.ts  announced vs standing, applied by readInsights

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedInsight, InsightSource } from '@/lib/intelligence-feed';
import {
  RECURRENCE_COLUMNS,
  insightExpiresAt,
  insightSubstanceMoved,
  normalizeInsightText,
  readDismissedFindings,
  type InsightSubstance,
  type InsightType,
  type OpenInsightRow,
} from '@/lib/insight-recurrence';

/**
 * Which insight_type each feed source is written as. Only values migration 029's
 * CHECK constraint allows, and only values INSIGHT_LIFETIMES prices, so every row
 * written here can expire.
 *
 * concentration and rebalancing are both single-name or sector weight findings,
 * which is what 'portfolio' means to the engine. earnings sits with 'market'
 * because an earnings date is a scheduled market event and stales the same way.
 * cash_flow and performance keep their own types: the free tier's basic alerts
 * are exactly those two lanes (FREE_INSIGHT_SOURCES), and one type per lane is
 * what lets that gate survive the move to a table read.
 */
export const FEED_SOURCE_TO_INSIGHT_TYPE: Record<InsightSource, InsightType> = {
  concentration: 'portfolio',
  rebalancing: 'portfolio',
  tax: 'tax',
  earnings: 'market',
  market: 'market',
  performance: 'performance',
  cash_flow: 'cash_flow',
};

/** The types this writer can produce, and therefore the only ones it reads back
 *  when deciding whether a finding is already on the books. */
export const OVERVIEW_INSIGHT_TYPES = ['portfolio', 'market', 'tax', 'performance', 'cash_flow'] as const;

/** How many of this user's rows the recurrence check looks at. Well above any
 *  single user's live count (a 1000-row production sample held 380 portfolio,
 *  market and tax rows across every user), and bounded so one user with a long
 *  history cannot turn a page load into a table scan. */
const RECURRENCE_ROW_CAP = 500;

/** A feed item as a row for `insights`, plus the titles other writers use for the
 *  same finding. */
export interface OverviewCandidate extends InsightSubstance {
  insight_type: InsightType;
  explanation: string | null;
  source_type: 'rule_based';
  /** Normalized titles that mean "somebody else already raised this". Not part
   *  of the row: the write is skipped entirely when one of them is on the books. */
  aliasTitles: string[];
}

/**
 * The titles lib/insights-engine.ts writes for a finding this feed also detects.
 *
 * Both surfaces read one table now, so without this a user above 25% in one name
 * would collect two concentration cards in different words, and a user with a
 * harvestable loss two tax cards. The engine's versions are the better ones (it
 * carries ETF look-through, and the capped IRC 1211(b) math), so its row wins and
 * this writer stays quiet. Below 25%, and for a loss the engine has not written,
 * nothing matches and the feed's own row is written.
 *
 * Coupled to the engine's wording on purpose: an alias that stops matching shows
 * up as a duplicate card, which is visible, rather than as a silent gap.
 */
function engineAliases(f: FeedInsight): string[] {
  if (f.source === 'concentration') {
    const ticker = /^(\S+) concentration above/.exec(f.title)?.[1];
    if (!ticker) return [];
    return [
      normalizeInsightText(`${ticker} is 1% of your portfolio`),
      normalizeInsightText(`${ticker} is 1% of your portfolio (including ETF exposure)`),
    ];
  }
  if (f.source === 'tax') {
    // Covers both feed variants: the portfolio-wide headline and the single
    // "Unrealized loss flagged: X" card. The engine writes one row for the whole
    // harvest either way.
    return [normalizeInsightText('$1 in potential tax savings')];
  }
  return [];
}

/** One feed item as a row. The feed's `summary` is the sentence the panel shows,
 *  so it becomes `description`; `detail` becomes `explanation`, which is part of
 *  the recurrence comparison. No recommended_action: the feed's suggestedFollowUp
 *  is a question to ask, not a course of action, and recommended_action is the
 *  paid field readInsights gates. */
export function feedInsightToCandidate(f: FeedInsight): OverviewCandidate {
  return {
    insight_type: FEED_SOURCE_TO_INSIGHT_TYPE[f.source],
    priority: f.priority,
    title: f.title,
    description: f.summary,
    recommended_action: null,
    explanation: f.detail || null,
    estimated_impact_amount: null,
    source_type: 'rule_based',
    aliasTitles: engineAliases(f),
  };
}

export interface PersistResult {
  /** Findings raised for the first time. */
  inserted: number;
  /** Recurrences whose substance moved, so the row was restated in place. */
  updated: number;
  /** Recurrences left exactly as they were, expiry pushed out. */
  refreshed: number;
  /** Findings deliberately not written: already owned by another writer, or
   *  dismissed and still inside their life. */
  skipped: number;
}

/**
 * Write this run of the feed to `insights`.
 *
 * Nothing is deleted and created_at is never written, so the first time a finding
 * was raised survives every run, which is what lets lib/insight-prominence.ts
 * decide announced vs standing from created_at alone.
 *
 * Errors are logged and swallowed: the panel is a read surface, and failing to
 * write the audit trail is not a reason to show a person nothing.
 */
export async function persistOverviewActions(
  supabase: SupabaseClient,
  userId: string,
  feed: FeedInsight[],
): Promise<PersistResult> {
  const result: PersistResult = { inserted: 0, updated: 0, refreshed: 0, skipped: 0 };
  if (feed.length === 0) return result;

  const runAt = new Date();
  const types = [...OVERVIEW_INSIGHT_TYPES];

  const [{ data: rows, error }, suppressed] = await Promise.all([
    supabase
      .from('insights')
      .select(`${RECURRENCE_COLUMNS}, is_dismissed, is_archived, expires_at`)
      .eq('user_id', userId)
      .in('insight_type', types)
      .order('created_at', { ascending: false })
      .limit(RECURRENCE_ROW_CAP),
    readDismissedFindings(supabase, userId, runAt),
  ]);

  if (error) {
    console.error('[overview-actions] Error reading open insights:', error);
    return result;
  }

  type ReadRow = OpenInsightRow & { is_dismissed: boolean | null; is_archived: boolean | null };
  const openByNorm = new Map<string, ReadRow>();
  for (const r of (rows ?? []) as ReadRow[]) {
    if (r.is_dismissed || r.is_archived) continue;
    const norm = normalizeInsightText(r.title);
    // Newest first, so the first row of a normalized title is the one to keep.
    if (!openByNorm.has(norm)) openByNorm.set(norm, r);
  }

  const claimed = new Set<string>();
  const inserts: Record<string, unknown>[] = [];
  const updates: { id: string; fields: Record<string, unknown> }[] = [];

  for (const item of feed) {
    const c = feedInsightToCandidate(item);
    if (!c.insight_type) continue;
    const norm = normalizeInsightText(c.title);
    // The feed loops holdings, so two lots of one position emit the same alert
    // twice in a run. Claim the title once.
    if (claimed.has(norm)) continue;
    claimed.add(norm);

    // Dismissed, and still inside the life of the finding: gone means gone.
    if (suppressed.has(norm) || c.aliasTitles.some(a => suppressed.has(a))) {
      result.skipped += 1;
      continue;
    }
    // Another writer already has this finding open, in its own words.
    if (c.aliasTitles.some(a => openByNorm.has(a))) {
      result.skipped += 1;
      continue;
    }

    const existing = openByNorm.get(norm);
    if (!existing) {
      inserts.push({
        user_id: userId,
        insight_type: c.insight_type,
        priority: c.priority,
        title: c.title,
        description: c.description,
        recommended_action: c.recommended_action,
        explanation: c.explanation,
        estimated_impact_amount: c.estimated_impact_amount,
        source_type: c.source_type,
        expires_at: insightExpiresAt(c.insight_type, runAt),
      });
      result.inserted += 1;
      continue;
    }

    if (insightSubstanceMoved(existing, c)) {
      updates.push({
        id: existing.id,
        fields: {
          insight_type: c.insight_type,
          priority: c.priority,
          title: c.title,
          description: c.description,
          recommended_action: c.recommended_action,
          explanation: c.explanation,
          estimated_impact_amount: c.estimated_impact_amount,
          expires_at: insightExpiresAt(c.insight_type, runAt),
        },
      });
      result.updated += 1;
    } else {
      // Same finding, same substance. The expiry is the only thing allowed to
      // move: rewriting the row is what made an old flag read as this morning's.
      updates.push({ id: existing.id, fields: { expires_at: insightExpiresAt(c.insight_type, runAt) } });
      result.refreshed += 1;
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from('insights').insert(inserts);
    if (insertError) {
      console.error('[overview-actions] Error inserting insights:', insertError);
      result.inserted = 0;
    }
  }

  for (const u of updates) {
    const { error: updateError } = await supabase
      .from('insights')
      .update(u.fields)
      .eq('id', u.id)
      .eq('user_id', userId);
    if (updateError) console.error('[overview-actions] Error refreshing insight:', updateError);
  }

  return result;
}
