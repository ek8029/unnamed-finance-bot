// lib/insight-recurrence.ts
// Shared recurrence policy for the thesis-sourced writers of the `insights` table
// (lib/thesis-actions.ts, lib/cross-thesis-risk.ts, lib/thesis-investigation.ts).
//
// lib/insights-engine.ts adopted two rules; these three had neither, which is why a
// thesis flag ("Trim LULU?", "Why PRIM moved", "Shared risk: ...") kept arriving as
// though it were new every run:
//
//  1. Every row written carries an expires_at from INSIGHT_LIFETIMES, so an expiry
//     sweep can retire it. All three inserted a NULL expiry, and a Postgres range
//     filter never matches NULL, so nothing could ever expire them.
//  2. A recurring finding whose substance has not moved is left exactly as it is,
//     created_at included, and only its expiry is pushed back out. All three
//     dismissed the open row and inserted a replacement, so a flag that had been
//     true since Tuesday read as though it arrived this morning and jumped back to
//     the top of a newest-first list.
//
//  3. A finding the person already dealt with, dismissed or acted on, is not
//     raised again while it is still inside its life. All three read OPEN rows to
//     decide "already on the books?", so a dismissed row was invisible and the
//     next run inserted a fresh one with a new created_at. The hold lives in
//     readDismissedFindings (title-keyed) and readDismissedEntityFindings (keyed
//     by related entity, for the writer that matches by thesis rather than title).
//
// The engine's substance rule is priority + description + recommended_action +
// estimated_impact_amount, with money and percentages normalized and the amount
// compared with a 10% tolerance, and with the title deliberately excluded because
// the engine matches candidates BY normalized title. That rule needed widening
// here: all three of these writers carry the finding itself in `explanation`, which
// the engine's own candidates never populate, and thesis-actions matches by thesis
// id rather than by title, so its title and its insight_type can both move under a
// single match (portfolio "Trim X?" becoming tax "Harvest the loss in X"). Substance
// here is therefore the engine's four fields plus title, insight_type and explanation.

import {
  insightExpiresAt,
  readDismissedEntityFindings,
  readDismissedFindings,
  type InsightType,
} from '@/lib/insights-engine';

export { insightExpiresAt, readDismissedEntityFindings, readDismissedFindings };
export type { InsightType };

/** The open row read back for the recurrence check. */
export interface OpenInsightRow {
  id: string;
  insight_type?: string | null;
  priority?: string | null;
  title?: string | null;
  description?: string | null;
  recommended_action?: string | null;
  explanation?: string | null;
  estimated_impact_amount?: number | string | null;
}

/** The candidate row about to be written, as these writers already build it. */
export interface InsightSubstance {
  insight_type: string;
  priority: string;
  title: string;
  description: string;
  recommended_action?: string | null;
  explanation?: string | null;
  estimated_impact_amount?: number | null;
}

/** The columns the recurrence check needs. Kept here so the three writers cannot
 *  drift from the comparison, since a column missing from the select reads as null
 *  and would make every recurrence look changed. */
export const RECURRENCE_COLUMNS =
  'id, insight_type, priority, title, description, recommended_action, explanation, estimated_impact_amount';

/** Money and percentages collapse, exactly as they do in the engine: a sentence
 *  whose dollar figure drifts with the market overnight is the same finding, and
 *  rewriting the row for it is what makes an old flag feel new. */
export function normalizeInsightText(text: string | null | undefined): string {
  return String(text ?? '')
    .replace(/\$[\d,]+(\.\d+)?/g, '$X')
    .replace(/\d+(\.\d+)?%/g, 'X%');
}

/** True when the dollar figure moved enough to be worth re-stating: more than 10%
 *  of the previous figure, or the field appearing/disappearing. */
function impactMoved(prev: number | string | null | undefined, next: number | null | undefined): boolean {
  const a = prev == null || prev === '' ? null : Number(prev);
  const b = next == null ? null : Number(next);
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a !== b;
  return Math.abs(b - a) > Math.max(1, Math.abs(a) * 0.1);
}

/**
 * Has the substance of a recurring finding moved?
 *
 * See the header for why this set is wider than the engine's. A false here means
 * the caller must leave the row alone, created_at and all, and only extend its
 * expires_at.
 */
export function insightSubstanceMoved(existing: OpenInsightRow, next: InsightSubstance): boolean {
  if ((existing.insight_type ?? '') !== next.insight_type) return true;
  if ((existing.priority ?? '') !== next.priority) return true;
  if (normalizeInsightText(existing.title) !== normalizeInsightText(next.title)) return true;
  if (normalizeInsightText(existing.description) !== normalizeInsightText(next.description)) return true;
  if (normalizeInsightText(existing.recommended_action) !== normalizeInsightText(next.recommended_action)) return true;
  if (normalizeInsightText(existing.explanation) !== normalizeInsightText(next.explanation)) return true;
  return impactMoved(existing.estimated_impact_amount, next.estimated_impact_amount);
}
