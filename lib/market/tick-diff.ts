// Pure decisions for the intraday tick (lib/market/intraday-tick.ts): which
// rows a print actually changes, and what "prices are fresh" means once
// unchanged prints are no longer stamped.
//
// Kept free of Supabase, Redis and Finazon so the predicate that decides
// whether every holding on the dashboard is rewritten can be pinned by a test.

import { etDayStartIso } from '@/lib/agent/judge-queue';

/** holdings.current_price and securities.current_price are NUMERIC(15, 4)
 *  (migration 005:29, :65): a print with more decimals is stored rounded, so
 *  the stored value is compared within half a unit of the fourth decimal or
 *  a row at 12.3456789 reads as changed on every tick and is rewritten
 *  forever. A tolerance rather than rounding both sides: Postgres rounds a
 *  fifth-decimal 5 away from zero, a scaled double can land the other way. */
export const PRICE_TOLERANCE = 5e-5 + 1e-9;

/** The tick heartbeat is this old at most while prices count as fresh. */
export const TICK_FRESH_MS = 10 * 60 * 1000;

export interface StoredPrice {
  current_price: number | string | null;
  last_updated_at: string | null;
}

/**
 * True when the stored row must be repriced: the print differs from the
 * stored price, or the row has not been touched this session (so the first
 * tick of a day always rewrites day_change against the new prior close), or
 * the row has no stored price.
 */
export function holdingNeedsUpdate(stored: StoredPrice, price: number, sessionStartIso: string): boolean {
  if (stored.current_price == null || stored.last_updated_at == null) return true;
  const storedPrice = Number(stored.current_price);
  if (!Number.isFinite(storedPrice)) return true;
  const touchedAt = Date.parse(stored.last_updated_at);
  const sessionStart = Date.parse(sessionStartIso);
  // An unparseable stamp counts as untouched, never as fresh.
  if (!(touchedAt >= sessionStart)) return true;
  return Math.abs(storedPrice - price) > PRICE_TOLERANCE;
}

export interface PrevCloseEntry {
  close: number;
  /** price_date of that close (YYYY-MM-DD), so a stale entry can be told apart. */
  date: string;
}

/**
 * The cached prior-close map, helm:tick:prevclose:{day}. Only entries in the
 * dated shape are kept: a value written before the shape carried a date (a
 * bare number), or anything else malformed, is dropped and so counts as a
 * miss for the targeted market_prices read, never as a crash.
 */
export function parsePrevCloseCache(raw: unknown): Map<string, PrevCloseEntry> {
  const out = new Map<string, PrevCloseEntry>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [ticker, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const { close, date } = v as { close?: unknown; date?: unknown };
    if (typeof close !== 'number' || !Number.isFinite(close) || typeof date !== 'string') continue;
    out.set(ticker, { close, date });
  }
  return out;
}

/** The weekday before an ET calendar day (YYYY-MM-DD): Friday for Monday,
 *  otherwise the day before. Holidays are not known here. */
export function previousWeekday(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const dow = d.getUTCDay();
  if (dow === 0) d.setUTCDate(d.getUTCDate() - 2);
  else if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Tickers whose cached close is dated before `expectedDate`, the previous
 * weekday: a close that had not been written when the cache was built (a
 * failed nightly write, backfilled by the morning sync) and must be
 * re-read. Judged against the calendar, not the newest date in the map, so
 * a night where the close write failed for every ticker is still caught.
 * The day after a market holiday every entry is dated two weekdays back and
 * the whole universe is re-read each tick, which is the pre-diffing cost
 * for that one session.
 */
export function stalePrevCloseTickers(cached: Map<string, PrevCloseEntry>, expectedDate: string): string[] {
  return [...cached.entries()].filter(([, e]) => e.date < expectedDate).map(([t]) => t);
}

/** Tickers whose print differs from the cached last print or were absent.
 *  Exact compare against the cache (a print is a print). */
export function changedPrices(prev: Record<string, number>, next: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [ticker, price] of next) {
    if (prev[ticker] !== price) out.set(ticker, price);
  }
  return out;
}

export interface SecurityPriceRow {
  id: string;
  current_price: number;
  last_updated_at: string;
}

/** One row per changed ticker that has a securities id. */
export function securitiesUpsertRows(
  changed: Map<string, number>,
  idByTicker: Map<string, string>,
  now: string,
): SecurityPriceRow[] {
  const rows: SecurityPriceRow[] = [];
  for (const [ticker, price] of changed) {
    const id = idByTicker.get(ticker);
    if (id) rows.push({ id, current_price: price, last_updated_at: now });
  }
  return rows;
}

const ET_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });

/** ET calendar day (YYYY-MM-DD) and the ISO instant of 00:00 ET for that day. */
export function etDay(d: Date): { day: string; startIso: string } {
  return { day: ET_DAY.format(d), startIso: etDayStartIso(d) };
}

/**
 * Whether the tick heartbeat says prices are fresh. null when there is no
 * heartbeat to read (Redis unconfigured, or the tick has not run yet today):
 * the caller then falls back to the holdings.last_updated_at stamp.
 */
export function pricesFreshFromHeartbeat(hb: { at: string } | undefined, now: number = Date.now()): boolean | null {
  if (!hb) return null;
  const at = Date.parse(hb.at);
  if (!Number.isFinite(at)) return null;
  return now - at < TICK_FRESH_MS;
}
