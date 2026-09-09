// Pure decisions for the intraday tick (lib/market/intraday-tick.ts): which
// rows a print actually changes, and what "prices are fresh" means once
// unchanged prints are no longer stamped.
//
// Kept free of Supabase, Redis and Finazon so the predicate that decides
// whether every holding on the dashboard is rewritten can be pinned by a test.

import { etDayStartIso } from '@/lib/agent/judge-queue';

export const PRICE_EPS = 1e-6;

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
  return Math.abs(storedPrice - price) > PRICE_EPS;
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
