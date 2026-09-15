/**
 * Wash sale disallowance math, IRC §1091.
 *
 * Given one loss sale and the purchases of the same security around it, this
 * returns how much of the loss is disallowed, how much survives, and what the
 * replacement shares' basis becomes. It is arithmetic on numbers the caller
 * supplies. It reads no market data and no user book.
 *
 * What it models:
 *   §1091(a)   the 61-day window: 30 days before the sale, the sale date, and
 *              30 days after, and disallowance in proportion to the replacement
 *              shares matched against the shares sold
 *   §1.1091-1(b),(c) matching in order of acquisition, earliest purchase first,
 *              whether or not the replacement count reaches the count sold
 *   §1091(d)   the disallowed loss added to the replacement shares' basis
 *   §1223(3)   the sold lot's holding period tacking onto the replacement
 *   Rev. Rul. 2008-5  a purchase inside an IRA or Roth: the loss is disallowed
 *              and NO basis is restored anywhere, so it is gone for good
 *
 * What it does NOT model, and every one of these must stay visible wherever the
 * output is rendered:
 *   - MORE THAN ONE TAX LOT IN THE SALE. The proportional disallowance
 *     `loss x matched / sold` equals the share-by-share result of §1091 only
 *     when every share sold carries the same per-share basis. The input takes
 *     one aggregate basis for one share count, so the caller must be selling a
 *     single lot. A sale drawn from two lots at different prices produces a
 *     figure here that is not the right answer under either lot identification,
 *     and the caller must say so on the surface. See allocate() below for the
 *     only place rounding is allowed to move a cent.
 *   - What counts as "substantially identical". The caller asserts that the
 *     purchases entered are of the same or a substantially identical security.
 *     The IRS has never defined the term for funds, and nothing here tests it.
 *   - Selling the replacement shares themselves. Every purchase entered is
 *     treated as replacement property still held. Shares bought and then sold
 *     inside the window, leaving nothing held, are not replacement property.
 *   - Which of several same-day purchases is the replacement. Order of
 *     acquisition does not break a tie between purchases on one date, so entry
 *     order decides it here and `sameDateOrdering` says when that happened.
 *   - More than one loss sale. One sale at a time; a second sale has its own
 *     window and its own matching order.
 *   - Purchases the caller does not enter. §1091 is tested at the taxpayer
 *     level, so a spouse's purchases and every unlinked account count.
 *   - Short sales, options, contracts to acquire, §1233, §1259.
 *
 * A result showing no disallowance is NEVER a §1091 clearance. No surface may
 * describe any output of this module as wash-sale-safe.
 */

import { WASH_SALE_WINDOW_DAYS } from '@/lib/financial-config';
import { longTermFromDate } from '@/lib/tax-math';

const DAY_MS = 86_400_000;

/** Share counts are floats, so 0.05 + 0.35 lands a hair under 0.4. Every
 *  comparison against a share count goes through this. */
const SHARE_EPS = 1e-9;

/** Above these the cent arithmetic stops being exact in a double, so the module
 *  refuses rather than printing Infinity or NaN. */
const MAX_AMOUNT = 1e12;
const MAX_SHARES = 1e9;

/** A purchase of the same or a substantially identical security. */
export interface ReplacementBuy {
  /** Trade date, YYYY-MM-DD. */
  date: string;
  shares: number;
  /** Total dollars paid for those shares, before any §1091 adjustment. */
  cost: number;
  /** True when bought in an IRA or Roth IRA. */
  retirement?: boolean;
}

export interface WashSaleInput {
  /** Trade date of the loss sale, YYYY-MM-DD. */
  saleDate: string;
  /** Shares sold, from a SINGLE tax lot. See the module header. */
  sharesSold: number;
  /** Total dollars received, net of commissions. */
  proceeds: number;
  /** Total cost basis of the shares sold. */
  costBasis: number;
  /** Purchases around the sale. An empty list is valid. */
  buys: ReplacementBuy[];
  /** Acquisition date of the shares sold, YYYY-MM-DD. Optional; supplying it
   *  is what makes the §1223(3) holding-period output available. */
  acquiredDate?: string;
}

export interface AdjustedLot {
  date: string;
  /** Shares entered for this purchase. */
  purchasedShares: number;
  /** Of those, the ones matched against the loss sale, earliest lot first.
   *  Only these take the basis adjustment and the tacked holding period. */
  replacementShares: number;
  /** What was paid for the replacement shares, pro-rated out of the purchase. */
  cost: number;
  /** Disallowed loss added to those shares' basis. Zero in a retirement account,
   *  where Rev. Rul. 2008-5 restores nothing. Never negative. */
  basisAdded: number;
  adjustedBasis: number;
  retirement: boolean;
  /** Holding-period start after §1223(3) tacking. Null when the sold lot's
   *  acquisition date was not supplied, when the lot is in a retirement
   *  account, or when the sold lot was held for zero days. */
  holdingPeriodStart: string | null;
  /** Days of the sold lot's holding period carried onto the replacement shares. */
  daysTacked: number;
  /** First date on which selling the replacement shares would be long term. */
  longTermFrom: string | null;
  /** True when the tacked period already makes the lot long term on the day it
   *  was bought, so longTermFrom is a date in the past. */
  alreadyLongTerm: boolean;
}

export type WashSaleVerdict =
  /** The sale produced a gain, or broke even. §1091 tests losses only. */
  | 'gain'
  /** A loss, and no entered purchase falls inside the 61-day window. */
  | 'no-match'
  /** Fewer replacement shares than shares sold. Part of the loss survives. */
  | 'partial'
  /** Replacement shares at least equal the shares sold. The whole loss is out. */
  | 'full';

export interface WashSaleResult {
  verdict: WashSaleVerdict;
  /** Positive when the sale was a loss, otherwise 0. */
  realizedLoss: number;
  /** Positive when the sale was a gain, otherwise 0. Zero on a break-even. */
  realizedGain: number;
  sharesSold: number;
  /** Replacement shares matched against the sale, capped at sharesSold. */
  sharesMatched: number;
  disallowedLoss: number;
  /** The part of the loss still deductible this year, before the §1211(b) cap. */
  deductibleLoss: number;
  /** Disallowed dollars added back to a taxable lot's basis. */
  basisRestored: number;
  /** Disallowed dollars with nowhere to go, from retirement-account purchases. */
  permanentlyLost: number;
  /** First day of the 61-day window. */
  windowStart: string;
  /** Last day of the 61-day window. */
  windowEnd: string;
  /** The day after the window closes. Not a clearance, see the module header. */
  dayAfterWindow: string;
  /** Matched purchases, earliest first. */
  lots: AdjustedLot[];
  /** Purchases entered that fall outside the window, so §1091 does not reach
   *  them. Holding shares bought earlier is not itself a wash sale. */
  outsideWindow: ReplacementBuy[];
  /** Replacement shares beyond the count sold. They take no basis adjustment. */
  excessShares: number;
  /** True when two or more in-window purchases share a date. Order of
   *  acquisition cannot break that tie, so entry order decided which shares
   *  became the replacement property, and the surface must disclose it. */
  sameDateOrdering: boolean;
}

/**
 * Read a dollar or share amount a person typed. Blank is absent, not zero, and
 * anything that is not plainly a positive decimal is REFUSED rather than
 * repaired, so the caller can show an error instead of a figure.
 *
 * It lives here rather than in the page because it is the step between a
 * stranger's keystrokes and every dollar printed: stripping stray characters
 * read "1,5" as 15 and "-100" as 100, which put a figure ten times off on the
 * screen with no warning. There are no component tests in this repo, so a
 * function this consequential belongs where it can be tested.
 */
export function parseAmount(raw: string): number | null {
  const s = String(raw).trim().replace(/[$\s]/g, '');
  if (s === '') return null;
  // Plain digits, or digits with comma grouping. At most one decimal point.
  if (!/^\d+(\.\d+)?$/.test(s) && !/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Whole-day UTC timestamp for a strict YYYY-MM-DD, or null. */
function parseDay(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  // Date.UTC rolls 2026-02-31 forward into March. Reject instead of accepting
  // a date the caller did not type.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
    return null;
  }
  return t;
}

function toIso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

const money = (n: number) => Math.round(n * 100) / 100;

const positiveFinite = (n: number, max: number) => Number.isFinite(n) && n > 0 && n <= max;
const nonNegativeFinite = (n: number, max: number) => Number.isFinite(n) && n >= 0 && n <= max;

/**
 * Split a dollar total across weights so that the parts sum to the total
 * exactly and no part is negative or more than a cent off its pro-rata share.
 *
 * Largest remainder, in whole cents. The obvious alternative, rounding each
 * part and giving the last one the residual, makes the last part a plug rather
 * than a figure: across twenty-four equal reinvestment lots it printed a cent
 * for twenty-three of them and twelve cents for the last, and against a
 * sub-dollar loss it printed a NEGATIVE basis adjustment, which §1091(d) can
 * never produce.
 */
function allocate(total: number, weights: number[]): number[] {
  const cents = Math.round(total * 100);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0 || cents <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (cents * w) / sum);
  const out = exact.map((e) => Math.floor(e));
  let left = cents - out.reduce((a, b) => a + b, 0);
  // Leftover pennies to the largest fractional parts. Index breaks a tie, so
  // the result is deterministic for identical lots.
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < order.length && left > 0; k += 1, left -= 1) out[order[k].i] += 1;

  return out.map((c) => c / 100);
}

/**
 * Disallowance for one loss sale of one tax lot. Returns null when the input
 * cannot produce a figure worth printing: a malformed date, a non-finite,
 * negative or absurdly large amount, or a purchase row with no shares. Callers
 * pass complete rows only, and are responsible for telling the reader which
 * field was refused.
 */
export function computeWashSale(input: WashSaleInput): WashSaleResult | null {
  const saleDay = parseDay(input.saleDate);
  if (saleDay === null) return null;
  if (!positiveFinite(input.sharesSold, MAX_SHARES)) return null;
  if (!nonNegativeFinite(input.proceeds, MAX_AMOUNT)) return null;
  if (!nonNegativeFinite(input.costBasis, MAX_AMOUNT)) return null;

  const acquiredDay = input.acquiredDate ? parseDay(input.acquiredDate) : null;
  if (input.acquiredDate && acquiredDay === null) return null;
  // A lot cannot be sold before it was bought.
  if (acquiredDay !== null && acquiredDay > saleDay) return null;

  const parsed: { day: number; buy: ReplacementBuy }[] = [];
  for (const buy of input.buys) {
    const day = parseDay(buy.date);
    if (day === null) return null;
    if (!positiveFinite(buy.shares, MAX_SHARES)) return null;
    if (!nonNegativeFinite(buy.cost, MAX_AMOUNT)) return null;
    parsed.push({ day, buy });
  }

  const windowStart = saleDay - WASH_SALE_WINDOW_DAYS * DAY_MS;
  const windowEnd = saleDay + WASH_SALE_WINDOW_DAYS * DAY_MS;
  const frame = {
    windowStart: toIso(windowStart),
    windowEnd: toIso(windowEnd),
    dayAfterWindow: toIso(windowEnd + DAY_MS),
  };

  const sharesSold = input.sharesSold;
  const loss = money(input.costBasis - input.proceeds);

  const inWindow = parsed
    .filter((p) => p.day >= windowStart && p.day <= windowEnd)
    // Order of acquisition, per §1.1091-1(b) and (c). Stable, so same-day
    // purchases keep the order they were entered in, which the statute does
    // not settle. sameDateOrdering reports when that mattered.
    .sort((a, b) => a.day - b.day);
  const outsideWindow = parsed.filter((p) => p.day < windowStart || p.day > windowEnd).map((p) => p.buy);
  const sameDateOrdering = new Set(inWindow.map((p) => p.day)).size !== inWindow.length;

  const totalReplacementShares = inWindow.reduce((n, p) => n + p.buy.shares, 0);
  const rawExcess = totalReplacementShares - sharesSold;
  const excessShares = rawExcess > SHARE_EPS ? rawExcess : 0;

  // §1091 disallows losses. A gain, or a break-even, is outside the rule.
  if (loss <= 0) {
    return {
      verdict: 'gain',
      realizedLoss: 0,
      realizedGain: money(input.proceeds - input.costBasis),
      sharesSold,
      sharesMatched: 0,
      disallowedLoss: 0,
      deductibleLoss: 0,
      basisRestored: 0,
      permanentlyLost: 0,
      ...frame,
      lots: [],
      outsideWindow,
      excessShares,
      sameDateOrdering,
    };
  }

  // Match replacement shares to shares sold, earliest purchase first.
  let remaining = sharesSold;
  const matched: { day: number; buy: ReplacementBuy; shares: number; cost: number }[] = [];
  for (const p of inWindow) {
    if (remaining <= SHARE_EPS) break;
    const shares = Math.min(p.buy.shares, remaining);
    matched.push({
      day: p.day,
      buy: p.buy,
      shares,
      // Pro-rate when only part of a purchase is replacement property.
      cost: money(p.buy.cost * (shares / p.buy.shares)),
    });
    remaining -= shares;
  }

  const sharesMatched = matched.reduce((n, m) => n + m.shares, 0);
  const fullyReplaced = sharesMatched >= sharesSold - SHARE_EPS;
  const disallowedLoss = fullyReplaced
    ? loss
    : Math.min(loss, money((loss * sharesMatched) / sharesSold));
  const deductibleLoss = money(loss - disallowedLoss);

  const shares = allocate(disallowedLoss, matched.map((m) => m.shares));
  const heldDays = acquiredDay === null ? 0 : Math.round((saleDay - acquiredDay) / DAY_MS);

  let basisRestored = 0;
  let permanentlyLost = 0;
  const lots: AdjustedLot[] = matched.map((m, i) => {
    const share = shares[i];
    const retirement = m.buy.retirement === true;
    const basisAdded = retirement ? 0 : share;
    if (retirement) permanentlyLost = money(permanentlyLost + share);
    else basisRestored = money(basisRestored + share);

    // §1223(3): the replacement shares inherit the period the sold shares were
    // held, so the clock starts that many days before the purchase. Retirement
    // lots get no tacking, since §1223(3) needs a basis fixed by §1091(d), and
    // a lot held for zero days has nothing to carry.
    const start = acquiredDay === null || retirement || heldDays === 0
      ? null
      : toIso(m.day - heldDays * DAY_MS);
    const longTermFrom = start === null ? null : longTermFromDate(start);

    return {
      date: m.buy.date,
      purchasedShares: m.buy.shares,
      replacementShares: m.shares,
      cost: m.cost,
      basisAdded,
      adjustedBasis: money(m.cost + basisAdded),
      retirement,
      holdingPeriodStart: start,
      daysTacked: start === null ? 0 : heldDays,
      longTermFrom,
      // The tacked period can reach past the purchase date far enough that the
      // lot is long term the day it is bought.
      alreadyLongTerm: longTermFrom !== null && longTermFrom <= m.buy.date,
    };
  });

  return {
    verdict: sharesMatched <= SHARE_EPS ? 'no-match' : fullyReplaced ? 'full' : 'partial',
    realizedLoss: loss,
    realizedGain: 0,
    sharesSold,
    sharesMatched,
    disallowedLoss,
    deductibleLoss,
    basisRestored,
    permanentlyLost,
    ...frame,
    lots,
    outsideWindow,
    excessShares,
    sameDateOrdering,
  };
}
