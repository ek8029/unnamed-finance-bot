// lib/push/policy.ts
// Who gets which push, and how many. Pure, so the rules can be tested without
// a device or a database. The decision layer (lib/notify) still decides WHAT
// is material; this decides whether a phone hears about it.

export type PushLevel = 'off' | 'brief' | 'matters' | 'all';
export type PushKind = 'brief' | 'move' | 'breach' | 'investigated' | 'filing';

/** The lowest level at which each kind is sent. */
export const KIND_LEVEL: Record<PushKind, PushLevel> = {
  brief: 'brief',
  move: 'matters',
  breach: 'matters',
  investigated: 'matters',
  filing: 'all',
};

const RANK: Record<PushLevel, number> = { off: 0, brief: 1, matters: 2, all: 3 };

/** Pushes one person may receive in one New York day, across every kind. */
export const DAILY_CAP = 6;

/** Quiet hours in New York: a push that would land in them waits, or is dropped if stale. */
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 8;

export function parseLevel(v: unknown): PushLevel {
  return v === 'off' || v === 'brief' || v === 'matters' || v === 'all' ? v : 'matters';
}

export function levelAllows(level: PushLevel, kind: PushKind): boolean {
  return RANK[level] >= RANK[KIND_LEVEL[kind]];
}

export interface LegacyToggles {
  notification_daily_brief?: boolean | null;
  notification_market_alerts?: boolean | null;
}

/** The two toggles web users still see keep their meaning on the phone. */
export function legacyAllows(t: LegacyToggles | null, kind: PushKind): boolean {
  if (!t) return true;
  if (kind === 'brief') return t.notification_daily_brief !== false;
  return t.notification_market_alerts !== false;
}

export function hourET(now: Date): number {
  return Number(now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).replace(/^24$/, '0'));
}

export function inQuietHours(now: Date): boolean {
  const h = hourET(now);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

export interface PositionMove {
  ticker: string;
  /** Day move of the name, as a fraction (0.032 = +3.2%). */
  pct: number;
  /** Dollars the move put on or took off this person's position. */
  dollars: number;
  /** Share of the book, as a fraction. */
  weight: number;
  /** weight x |pct|: the position's contribution to the day, as a fraction of the book. */
  contribution: number;
}

export const MOVE_MIN_PCT = 0.02;
export const MOVE_MIN_CONTRIBUTION = 0.005;
export const MOVES_PER_PUSH = 3;

/**
 * Which of a person's positions moved their book today. A name has to move at
 * least 2% AND carry at least half a percent of the book with it: a 0.1%
 * position up 10% is noise, and a 30% position up 1.5% is a normal day.
 * Sorted by contribution, capped at what one push can say.
 */
export function selectMoves(rows: { ticker: string; pct: number | null; dollars: number; weight: number }[]): PositionMove[] {
  const out: PositionMove[] = [];
  for (const r of rows) {
    if (r.pct === null || !Number.isFinite(r.pct) || !Number.isFinite(r.weight)) continue;
    const contribution = Math.abs(r.pct) * r.weight;
    if (Math.abs(r.pct) < MOVE_MIN_PCT || contribution < MOVE_MIN_CONTRIBUTION) continue;
    out.push({ ticker: r.ticker, pct: r.pct, dollars: r.dollars, weight: r.weight, contribution });
  }
  return out.sort((a, b) => b.contribution - a.contribution).slice(0, MOVES_PER_PUSH);
}

/** "2026-09-08" in New York, the day the caps and the move keys live in. */
export function dayET(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}
