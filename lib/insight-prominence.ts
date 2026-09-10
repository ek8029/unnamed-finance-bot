// lib/insight-prominence.ts
// How prominent an open insight is allowed to be, and the copy for the quiet tier.
//
// Evan, 2026-09-10: "Just find a tasteful fix bro. I don't want the same thing
// flagged over and over again. Flag it once, if a user dismisses or acts on it
// get rid of it, if not just keep a note that it's there and don't perpetually
// scream it into a user's face."
//
// Three states, all decided in lib/insights-reader.ts:
//
//   announced  raised after this person last read their updates. The only tier
//              that occupies the queue, with exactly today's prominence.
//   standing   open, but already seen. One quiet line and a disclosure on the
//              same page. Never announced a second time.
//   gone       dismissed, archived, snoozed, expired, or acted on. Not read.
//
// Prominence is decidable from created_at alone because the writers stopped
// resetting it: lib/insight-recurrence.ts leaves a recurring finding whose
// substance has not moved exactly as it is, created_at included, and only pushes
// its expiry out. So a per-user watermark is enough, and nothing has to be
// written to the 100+ open rows that predate this change: they fall into the
// quiet tier by themselves.
//
// The watermark is user_preferences.updates_seen_at (migration 078), stamped by
// the overview's Updates card and read by lib/agent/updates-seen.ts. Reusing it
// rather than adding a column keeps "what this person has seen" as one fact.

export type InsightProminence = 'announced' | 'standing';

/** How recent an open flag has to be to still be announced to someone who has
 *  no watermark at all, which is every user until they next load the overview.
 *
 *  Without a window, a first visit would announce every open row at once, which
 *  is the behaviour being removed. 72 hours because that is already the horizon
 *  the Updates card reads over (AGENT_LOG_COPY.empty, "the last 72 hours"), and
 *  because it is the widest gap between two runs of the jobs that write this
 *  table: the daily cron is weekday gated, so Friday morning's flags are the
 *  newest a person can meet on a Monday, exactly 72 hours later. Anything older
 *  than that has had at least one run behind it and is not news. */
export const INSIGHT_ANNOUNCE_GRACE_MS = 72 * 60 * 60 * 1000;

/** Which tier one open row belongs to. Pure, so both the reader and the page can
 *  call it, and so the boundary cases are pinned by a test rather than by a
 *  comment. */
export function insightProminence(
  createdAt: string | null | undefined,
  seenAt: string | null | undefined,
  now: number = Date.now(),
): InsightProminence {
  const created = createdAt ? Date.parse(createdAt) : NaN;
  // A row we cannot date cannot be shown to be new. Quiet is the safe side.
  if (Number.isNaN(created)) return 'standing';
  const seen = seenAt ? Date.parse(seenAt) : NaN;
  // No watermark, or one that will not parse: fall back to the window.
  if (Number.isNaN(seen)) return created > now - INSIGHT_ANNOUNCE_GRACE_MS ? 'announced' : 'standing';
  // A row raised at the watermark instant was included in that read.
  return created > seen ? 'announced' : 'standing';
}

/** The quiet line's copy. One object so a test can sweep it for em dashes,
 *  exclamation marks and advice language. */
export const STANDING_COPY = {
  /** Mono eyebrow on the quiet line. */
  label: 'Standing',
  /** Follows the count: "6 still open". */
  openSuffix: 'still open',
  /** The rest of the quiet line. */
  seen: 'Seen already, kept here rather than raised again.',
  /** The disclosure control. One word, so the line stays a line. */
  show: 'Show',
  /** Sits above the list once it is open. */
  listNote: 'Each of these was flagged once. Dismiss one and it goes for good.',
  /** Replaces the queue heading when nothing has arrived since the last visit. */
  nothingNew: 'Nothing new since your last visit.',
} as const;

/** "6 still open". Kept next to the copy so the two cannot drift. */
export function standingLine(n: number): string {
  return `${n} ${STANDING_COPY.openSuffix}`;
}
