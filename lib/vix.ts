// The real VIX index. Finazon's us_stocks_essential dataset has no indices,
// so every other quote path in the app can only see VIXY, the ETF, whose
// dollar price is NOT a volatility level. This module is the one place that
// can answer "what is the VIX", via Cboe's own free delayed-quote feed
// (no key, 15-minute delay; schema verified live 2026-08-23).
//
// The delay is fine for every current consumer: the brief generates at
// 9:15 ET, where the prior close is the right input anyway.

const CBOE_URL = 'https://cdn.cboe.com/api/global/delayed_quotes/quotes/_VIX.json';
const TRADING_DAYS_PER_YEAR = 252;
const CACHE_MS = 5 * 60 * 1000;

export interface VixQuote {
  /** The index level, e.g. 15.13. Delayed 15 minutes by Cboe. */
  value: number;
  /** Day change in points and percent, vs the previous close. */
  change: number;
  changePct: number;
  prevClose: number;
  /** VIX / sqrt(252): the one-sigma daily S&P move options are pricing, in
   *  percent. One day in three should close outside it. A band, not a limit. */
  pricedDayPct: number;
}

let cached: { at: number; quote: VixQuote } | null = null;

export async function getVixQuote(): Promise<VixQuote | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.quote;
  try {
    const res = await fetch(CBOE_URL, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return cached?.quote ?? null;
    const json = (await res.json()) as {
      data?: { current_price?: number; price_change?: number; price_change_percent?: number; prev_day_close?: number };
    };
    const d = json.data;
    if (!d || typeof d.current_price !== 'number' || d.current_price <= 0) return cached?.quote ?? null;
    const quote: VixQuote = {
      value: d.current_price,
      change: d.price_change ?? 0,
      changePct: d.price_change_percent ?? 0,
      prevClose: d.prev_day_close ?? d.current_price,
      pricedDayPct: d.current_price / Math.sqrt(TRADING_DAYS_PER_YEAR),
    };
    cached = { at: Date.now(), quote };
    return quote;
  } catch {
    // Network failure: serve the stale quote if we ever had one. The VIX does
    // not move enough in minutes to make a stale reading worse than no cell.
    return cached?.quote ?? null;
  }
}
