// The intraday price tick: last-trade prices onto every holding, every five
// minutes while the market is open.
//
// The full sweep (lib/market/price-sweep.ts) prices from hourly bars, lifts
// to the tape, recomputes allocations, performance and snapshots, and takes
// minutes at the time_series budget. During the session the database behind
// the tax center, the brief, holding pages and the mobile app only moved when
// a user happened to load a dashboard. This does one thing: /price for every
// held ticker, arithmetic, write. Bars, snapshots and allocations stay with
// the sweep and its 16:05 / 19:00 runs.

import { createServiceClient } from '@/lib/supabase/server';
import { FINAZON_PRICE_RPM } from '@/lib/financial-config';
import { getBatchLastTradePrices } from '@/lib/finazon';
import { isUsMarketHours } from '@/lib/live-quotes';
import { repriceHolding, toHoldingUpdate } from '@/lib/market/last-trade';
import { portfolioTotalsByUser } from '@/lib/market/intraday-series';
import { severeMoves, enqueueSevereMoves } from '@/lib/market/severe-move';
import {
  changedPrices, etDay, holdingNeedsUpdate, parsePrevCloseCache, previousWeekday, securitiesUpsertRows, stalePrevCloseTickers,
  type PrevCloseEntry,
} from '@/lib/market/tick-diff';
import { liveTokenUsers, sendPush } from '@/lib/push/send';
import { selectMoves } from '@/lib/push/policy';
import { positionMoved } from '@/lib/push/voice';
import { beat } from '@/lib/agent/heartbeat';
import { redisKey, withRedis } from '@/lib/redis';

/** /price pace for the tick, derived from the plan's configured budget
 *  (FINAZON_PRICE_RPM, 200 on the current plan) minus a 40/min reserve for the
 *  dashboard and mobile polls that share it. Measured 2026-09-04: at a fixed
 *  120/min a 319-name sweep plus the row updates ran about four minutes, so
 *  every other five-minute slot was coalesced away and prices landed every
 *  ten (43 ticks, gaps of 9 to 11 min). At 160/min the sweep is about two
 *  minutes and the run fits the slot. Floor 60 so a misconfigured env can
 *  never stall the tick. */
export const INTRADAY_TICK_RPM = Math.max(60, Math.min(FINAZON_PRICE_RPM - 40, 200));

export interface IntradayTickResult {
  status: number;
  body: Record<string, unknown>;
}

/** The per-ET-day Redis caches (prior close, last prints) outlive the session
 *  by a couple of hours and are gone before the next one. */
const TICK_CACHE_TTL_S = 26 * 3600;

type PrevCloseSource = 'cache' | 'db' | 'cache+db';

export async function runIntradayTick(): Promise<IntradayTickResult> {
  if (!isUsMarketHours()) {
    return { status: 200, body: { success: true, skipped: 'market closed', updated: 0 } };
  }

  const db = await createServiceClient();
  const started = Date.now();

  const { data: holdings, error } = await db
    .from('holdings')
    .select('id, user_id, ticker, shares, total_cost_basis, total_value, security_id, current_price, last_updated_at')
    .neq('ticker', 'UNKNOWN');
  if (error || !holdings || holdings.length === 0) {
    return { status: 200, body: { success: true, message: 'No holdings', updated: 0 } };
  }

  const tickers = [...new Set(holdings.map((h) => (h.ticker || '').toUpperCase()).filter(Boolean))];
  const prices = await getBatchLastTradePrices(tickers, INTRADAY_TICK_RPM);
  if (prices.size === 0) {
    return { status: 200, body: { success: true, message: 'No prices returned', updated: 0 } };
  }

  // Previous session close per ticker, from our own table: the newest row
  // dated before today's ET session. The close does not move during the
  // session, so the map is cached in Redis per ET day as {close, date} and
  // the table is read once a day, plus a targeted read each tick for any
  // ticker the cache lacks or holds stale: a new position, a name with no
  // close on record, or an entry dated before the previous weekday (last
  // night's write failed and the morning sync backfilled it later).
  // Tickers with no close on record at all, and stale ones until they catch
  // up (the whole universe on the day after a holiday), are re-read every
  // tick; both are bounded by the size of the held universe. Without Redis
  // the table is read every tick as before.
  // PostgREST caps a select at 1000 rows and 291 tickers fill that in about
  // three sessions, so page newest-first until every ticker has a close or
  // the history runs out. A ticker with no close on record keeps whatever
  // day_change_pct the last sweep wrote (see toHoldingUpdate).
  const { day: today, startIso: sessionStartIso } = etDay(new Date());
  const prevCloseKey = redisKey('tick', 'prevclose', today);
  const prevCloseEntries = parsePrevCloseCache(await withRedis((r) => r.get<unknown>(prevCloseKey), null));
  const staleClose = new Set(stalePrevCloseTickers(prevCloseEntries, previousWeekday(today)));
  const missingClose = tickers.filter((t) => !prevCloseEntries.has(t) || staleClose.has(t));
  let prevCloseSource: PrevCloseSource = prevCloseEntries.size > 0 ? 'cache' : 'db';
  if (missingClose.length > 0) {
    if (prevCloseEntries.size > 0) prevCloseSource = 'cache+db';
    // Newest-first, so the first row seen per ticker is its latest close and
    // replaces a stale cached entry.
    const seen = new Set<string>();
    const PAGE = 1000;
    for (let page = 0; page < 10 && missingClose.some((t) => !seen.has(t)); page++) {
      const { data: closes, error: closeErr } = await db
        .from('market_prices')
        .select('ticker, close, price_date')
        .in('ticker', missingClose)
        .lt('price_date', today)
        .order('price_date', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (closeErr || !closes) break;
      for (const row of closes) {
        const t = (row.ticker as string).toUpperCase();
        if (!seen.has(t) && Number(row.close) > 0) {
          seen.add(t);
          prevCloseEntries.set(t, { close: Number(row.close), date: String(row.price_date) });
        }
      }
      if (closes.length < PAGE) break;
    }
    await withRedis(
      (r) => r.set(prevCloseKey, Object.fromEntries(prevCloseEntries) as Record<string, PrevCloseEntry>, { ex: TICK_CACHE_TTL_S }),
      null,
    );
  }
  const prevClose = new Map<string, number>([...prevCloseEntries].map(([t, e]) => [t, e.close]));

  // Only rows the print changes are written. A row already at this price
  // and touched this session keeps its stamp; the first tick of a session
  // rewrites every priced row so day_change is against the new prior close.
  // Whether this is the first tick is decided by Redis (helm:tick:first:{day},
  // set once the holdings writes land), not by the stamp: the 09:15 Plaid
  // sync stamps every synced row today at the institution's mark with no
  // day_change, and a name whose first print equals that mark would
  // otherwise be skipped and keep yesterday's day_change all session.
  // Without Redis nothing forces and the stamp rule decides as before.
  const firstTickKey = redisKey('tick', 'first', today);
  const firstTickState = await withRedis(async (r) => ((await r.get(firstTickKey)) == null ? 'first' : 'done'), 'unknown');
  const forceAll = firstTickState === 'first';
  const now = new Date().toISOString();
  let skippedHoldings = 0;
  const updates = holdings.flatMap((h) => {
    const t = (h.ticker || '').toUpperCase();
    const price = prices.get(t);
    if (!price || price <= 0) return [];
    if (!forceAll && !holdingNeedsUpdate({ current_price: h.current_price, last_updated_at: h.last_updated_at }, price, sessionStartIso)) {
      skippedHoldings++;
      return [];
    }
    const r = repriceHolding({ shares: Number(h.shares), total_cost_basis: h.total_cost_basis }, price, prevClose.get(t) ?? null);
    return [{ id: h.id as string, ...r }];
  });

  // Chunked so a large book does not open hundreds of connections at once.
  let updated = 0;
  const CHUNK = 50;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const settled = await Promise.allSettled(
      updates.slice(i, i + CHUNK).map((u) =>
        db.from('holdings').update(toHoldingUpdate(u, now)).eq('id', u.id),
      ),
    );
    updated += settled.filter((s) => s.status === 'fulfilled' && !s.value?.error).length;
  }
  // Set once any write landed: a row that keeps failing is retried by the
  // stamp rule anyway, and waiting for every write would force the whole
  // universe all day.
  if (forceAll && updated > 0) {
    await withRedis((r) => r.set(firstTickKey, '1', { ex: TICK_CACHE_TTL_S }), null);
  }

  // securities.current_price feeds the shared per-ticker surfaces. Prints are
  // diffed against the day's last-print map in Redis so an unchanged print
  // is not rewritten; without Redis every print is written, as before.
  // Written with update().in('id', ...) per distinct print rather than one
  // upsert: securities.ticker and security_name are NOT NULL (migration 005)
  // and an upsert row carrying only id and price fails that check on the
  // insert side of ON CONFLICT before the update side runs.
  const securityByTicker = new Map<string, string>();
  for (const h of holdings) {
    if (h.security_id && h.ticker) securityByTicker.set((h.ticker as string).toUpperCase(), h.security_id as string);
  }
  const lastPrintKey = redisKey('tick', 'last', today);
  const cachedLast = await withRedis((r) => r.get<Record<string, number>>(lastPrintKey), null);
  const changed = changedPrices(cachedLast ?? {}, prices);
  const securityRows = securitiesUpsertRows(changed, securityByTicker, now);
  const idsByPrice = new Map<number, string[]>();
  for (const row of securityRows) idsByPrice.set(row.current_price, [...(idsByPrice.get(row.current_price) ?? []), row.id]);
  const securityGroups = [...idsByPrice.entries()];
  let updatedSecurities = 0;
  const landedPrices = new Set<number>();
  for (let i = 0; i < securityGroups.length; i += CHUNK) {
    const slice = securityGroups.slice(i, i + CHUNK);
    const settled = await Promise.allSettled(
      slice.map(([price, ids]) => db.from('securities').update({ current_price: price, last_updated_at: now }).in('id', ids)),
    );
    settled.forEach((s, j) => {
      if (s.status === 'fulfilled' && !s.value?.error) {
        landedPrices.add(slice[j][0]);
        updatedSecurities += slice[j][1].length;
      }
    });
  }
  // The map carries every print the table now holds: unchanged ones, and
  // changed ones whose write landed. A failed write stays out so the next
  // tick retries it.
  const nextLast: Record<string, number> = { ...(cachedLast ?? {}) };
  for (const [t, p] of prices) {
    if (!changed.has(t) || landedPrices.has(p)) nextLast[t] = p;
  }
  await withRedis((r) => r.set(lastPrintKey, nextLast, { ex: TICK_CACHE_TTL_S }), null);

  // A severe move on a thesis name raises an investigate job for the judge
  // worker (perpetual watch, section 4). Enqueue only, keyed per ticker per
  // day, never a model call inside the tick, never a failed tick over it.
  const severe = severeMoves(prices, prevClose);
  let investigationsQueued = 0;
  if (severe.length > 0) {
    try {
      const q = await enqueueSevereMoves(db, severe, today);
      investigationsQueued = q.queued;
      if (q.error) console.error('[intraday-tick] severe-move enqueue failed:', q.error);
      else if (q.queued > 0) console.log(`[intraday-tick] ${severe.map((m) => `${m.ticker} ${(m.pct * 100).toFixed(1)}%`).join(', ')}: ${q.queued} investigation(s) queued`);
    } catch (err) {
      console.error('[intraday-tick] severe-move enqueue threw:', err instanceof Error ? err.message : err);
    }
  }

  // One point per user for the 1D chart (migration 066), then prune the
  // week-old tail so the table stays a session log, not a history.
  const repricedValue = new Map(updates.map((u) => [u.id, u.total_value]));
  const totals = portfolioTotalsByUser(
    holdings.map((h) => ({ id: h.id as string, user_id: h.user_id as string, total_value: h.total_value })),
    repricedValue,
  );
  // A position that moved the book, told to the phones that asked (push, the
  // "what matters" tier). Only users with a live device, so this never grows
  // with the user base, and never a failed tick over it.
  let pushed = 0;
  try {
    const pushUsers = await liveTokenUsers(db);
    if (pushUsers.size > 0) {
      const byUser = new Map<string, { ticker: string; pct: number | null; dollars: number; weight: number }[]>();
      for (const h of holdings) {
        const uid = h.user_id as string;
        if (!pushUsers.has(uid)) continue;
        const t = (h.ticker || '').toUpperCase();
        const price = prices.get(t);
        const prev = prevClose.get(t);
        const book = totals.get(uid) ?? 0;
        if (!price || !prev || prev <= 0 || book <= 0) continue;
        const shares = Number(h.shares) || 0;
        const valueNow = repricedValue.get(h.id as string) ?? Number(h.total_value) ?? 0;
        const rows = byUser.get(uid) ?? [];
        rows.push({ ticker: t, pct: price / prev - 1, dollars: shares * (price - prev), weight: valueNow / book });
        byUser.set(uid, rows);
      }
      for (const [uid, rows] of byUser) {
        const moves = selectMoves(rows);
        if (moves.length === 0) continue;
        const r = await sendPush(db, uid, 'move', positionMoved(moves), moves.map((m) => `move:${m.ticker}:${today}`));
        pushed += r.sent;
      }
    }
  } catch (err) {
    console.error('[intraday-tick] move push failed:', err instanceof Error ? err.message : err);
  }

  const pointRows = [...totals.entries()].map(([user_id, total_value]) => ({ user_id, captured_at: now, total_value }));
  let points = 0;
  if (pointRows.length > 0) {
    const { error: pointErr } = await db.from('portfolio_intraday_snapshots').insert(pointRows);
    if (pointErr) console.error('[intraday-tick] snapshot insert failed:', pointErr.message);
    else points = pointRows.length;
  }
  await db
    .from('portfolio_intraday_snapshots')
    .delete()
    .lt('captured_at', new Date(Date.now() - 7 * 86_400_000).toISOString());

  const ms = Date.now() - started;
  await beat(db, 'intraday-prices', {
    tickers: tickers.length,
    priced: prices.size,
    updatedHoldings: updated,
    skippedHoldings,
    updatedSecurities,
    prevCloseSource,
    ms,
  });

  return {
    status: 200,
    body: {
      success: true,
      source: 'finazon-price',
      snapshots: points,
      tickers: tickers.length,
      priced: prices.size,
      holdings_updated: updated,
      holdings_skipped: skippedHoldings,
      securities_updated: updatedSecurities,
      prev_close_source: prevCloseSource,
      severe_moves: severe.length,
      investigations_queued: investigationsQueued,
      pushes: pushed,
      duration_ms: ms,
    },
  };
}
