// lib/notify/material.ts
//
// ONE definition of "material", in one place.
//
// Helm had three senders and three different answers to this question:
// app/api/cron/digest, app/api/cron/watchlist-alerts, and score-theses via
// lib/thesis-breach. No shared chokepoint is how a one-address allowlist sat
// inside one of them for months without anybody noticing the product's central
// promise was off. Everything that decides to interrupt somebody should decide
// it here.
//
// WHAT QUALIFIES
//
// The insights engine already produces the portfolio's material-events feed:
// concentration, sector weight, harvestable losses, earnings exposure, idle
// cash, each with a priority and a dollar estimate. This module picks the slice
// of it that is worth an interruption, and leaves the rest in the Actions inbox
// to be read when the person chooses to look.
//
// Deliberately EXCLUDED:
//
//   - `spending` and `credit`. Helm is portfolio intelligence, and the live
//     rows make the case better than an argument does: "Other spending up
//     357%", "Government & Non Profit spending up 193%", "General Services
//     spending up 275%". That is Plaid's category tree drifting month to month,
//     not a fact about somebody's money. Notifying on it teaches people that a
//     Helm alert is noise.
//   - Bare price moves. A ticker being down 4% is not a finding; it is the
//     market being the market, and the watchlist mover email already exists for
//     people who asked for exactly that. Note the word bare: a severe move that
//     lib/thesis-investigation has already read and tied to specific pillars a
//     person holds arrives here as a `market` insight ("Why PRIM moved") and
//     does qualify. The move is the trigger; the finding is what it bore on.
//   - `medium` and `low` priority of any type. The inbox is for those.
//
// The engine's own priority ladder does the ranking, so raising or lowering the
// bar is a one-line change here rather than an edit in three senders.

import { createHash } from 'crypto';

/** Insight types that describe the portfolio rather than the chequing account. */
export const MATERIAL_TYPES = new Set(['portfolio', 'tax', 'market']);

/** Priorities worth an interruption. Everything else waits in the inbox. */
export const MATERIAL_PRIORITIES = new Set(['critical', 'high']);

export interface NotifiableInsight {
  id: string;
  user_id: string;
  insight_type: string;
  priority: string;
  title: string;
  description: string;
  estimated_impact_amount?: number | string | null;
  related_entity_type?: string | null;
  related_entity_ids?: string[] | null;
  is_dismissed?: boolean | null;
  is_archived?: boolean | null;
  snoozed_until?: string | null;
  expires_at?: string | null;
}

export interface MaterialEvent {
  insightId: string;
  userId: string;
  notifyKey: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  impact: number | null;
}

/** The fact, with the volatile parts removed.
 *
 *  Dollar amounts and percentages drift with the market every single day. A key
 *  built over them would treat "$62,745 harvestable" and tomorrow's "$62,801
 *  harvestable" as two different findings and announce both, which is the exact
 *  failure this whole layer exists to prevent. Same normalization the insights
 *  engine already uses to supersede its own rows, for the same reason. */
export function normalizeFact(title: string): string {
  return title
    .replace(/\$\s?[\d,]+(\.\d+)?/g, '$X')
    .replace(/\d+(\.\d+)?\s?%/g, 'X%')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Identity of the fact, stable across insight-row churn.
 *
 *  `priority` is part of the key on purpose. If a finding escalates from high
 *  to critical, that is a genuinely new thing to say and it earns one more
 *  announcement. Drifting dollars do not. */
export function notifyKeyFor(i: NotifiableInsight): string {
  const entities = (i.related_entity_ids ?? []).slice().sort().join(',');
  const material = [
    i.insight_type,
    i.priority,
    i.related_entity_type ?? '',
    entities,
    normalizeFact(i.title),
  ].join('|');
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

function isLive(i: NotifiableInsight, now: number): boolean {
  if (i.is_dismissed || i.is_archived) return false;
  if (i.snoozed_until && new Date(i.snoozed_until).getTime() > now) return false;
  if (i.expires_at && new Date(i.expires_at).getTime() < now) return false;
  return true;
}

function impactOf(i: NotifiableInsight): number | null {
  if (i.estimated_impact_amount == null) return null;
  const n = Number(i.estimated_impact_amount);
  return Number.isFinite(n) ? n : null;
}

/** The one threshold. Returns the events worth announcing, most severe first. */
export function selectMaterial(rows: NotifiableInsight[], now = Date.now()): MaterialEvent[] {
  const events = rows
    .filter((i) => MATERIAL_TYPES.has(i.insight_type))
    .filter((i) => MATERIAL_PRIORITIES.has(i.priority))
    .filter((i) => isLive(i, now))
    .map((i) => ({
      insightId: i.id,
      userId: i.user_id,
      notifyKey: notifyKeyFor(i),
      type: i.insight_type,
      priority: i.priority,
      title: i.title,
      description: i.description,
      impact: impactOf(i),
    }));

  // Two rows can normalize to the same fact (the engine's supersede is per-run
  // and other writers insert independently). Announcing the same sentence twice
  // in one email is worse than the duplicate row it came from.
  const seen = new Set<string>();
  const unique = events.filter((e) => {
    if (seen.has(e.notifyKey)) return false;
    seen.add(e.notifyKey);
    return true;
  });

  return unique.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'critical' ? -1 : 1;
    return (b.impact ?? 0) - (a.impact ?? 0);
  });
}
