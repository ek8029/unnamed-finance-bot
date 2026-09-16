/**
 * Federal capital gains tax arithmetic for one tax year.
 *
 * Given a filing status, taxable ordinary income, and a short-term and a
 * long-term capital gain or loss, this returns the federal tax on the gain and
 * where each dollar of it lands. It is arithmetic on numbers the caller
 * supplies. It reads no market data and no user book.
 *
 * What it models:
 *   §1222       netting: a short-term loss offsets a long-term gain and a
 *               long-term loss offsets a short-term gain before any rate applies
 *   §1(h),
 *   §1(j)(5)    the long-term gain stacked on top of ordinary income and any
 *               short-term gain, taxed at 0, 15 and 20 percent as taxable income
 *               crosses the maximum zero rate amount and the maximum 15 percent
 *               rate amount for the filing status
 *   §1(j)(2)    the short-term gain stacked on top of ordinary income at the
 *               ordinary brackets
 *   §1411       the 3.8 percent net investment income tax on the lesser of the
 *               net gain and the excess of MAGI over the statutory threshold
 *   §1211(b),
 *   §1212(b)    a net capital loss deducted against ordinary income up to $3,000
 *               ($1,500 married filing separately), the rest carried forward,
 *               short-term loss absorbed by the deduction first
 *
 * What it does NOT model, and every one of these must stay visible wherever the
 * output is rendered:
 *   - STATE TAX. Federal only.
 *   - MAGI. The tool has no adjusted gross income figure, so it treats MAGI as
 *     the taxable ordinary income entered plus the net gain. For most filers
 *     real MAGI is higher (it sits above the standard deduction), so the NIIT
 *     here can start later than it would on a return.
 *   - Qualified dividends, §1250 unrecaptured gain at 25 percent, collectibles
 *     at 28 percent, §1202 stock, §1256 contracts, the AMT, phase-outs that
 *     depend on AGI, and the limit in §1211(b) that a loss deduction cannot
 *     exceed taxable income.
 *   - Prior-year carryovers. The loss entered is this year's loss.
 *
 * Every bracket figure lives in the constants block below with the irs.gov page
 * it was read from. A year is supported only when every figure for it was read
 * from that source.
 */

/** Re-exported so the page parses input the same way every tool page does. */
export { parseAmount } from '@/lib/wash-sale';

export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh';
export type TaxYear = 2026;

export const FILING_STATUSES: { value: FilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'mfj', label: 'Married filing jointly' },
  { value: 'mfs', label: 'Married filing separately' },
  { value: 'hoh', label: 'Head of household' },
];

/** An ordinary income bracket: `rate` applies to taxable income up to `upTo`. */
export interface OrdinaryBracket {
  rate: number;
  upTo: number;
}

export interface YearFigures {
  year: TaxYear;
  /** Where the figures were read from, for the page to cite. */
  sources: { ordinary: string; longTerm: string; niit: string; lossCap: string };
  ordinary: Record<FilingStatus, OrdinaryBracket[]>;
  /** §1(j)(5)(B): taxable income up to `zeroUpTo` is taxed at 0 percent,
   *  up to `fifteenUpTo` at 15 percent, above that at 20 percent. */
  longTerm: Record<FilingStatus, { zeroUpTo: number; fifteenUpTo: number }>;
  /** §1411(b) MAGI thresholds. Statutory, not indexed. */
  niitThreshold: Record<FilingStatus, number>;
  /** §1211(b) cap on a net capital loss deducted against ordinary income. */
  lossCap: Record<FilingStatus, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bracket figures. Each set names the irs.gov page it was read from.
// ─────────────────────────────────────────────────────────────────────────────

// Ordinary brackets and the 0/15/20 thresholds: Rev. Proc. 2025-32, section
// 3.01 (tax rate tables) and section 3.03 (maximum capital gains rate), read
// from https://www.irs.gov/pub/irs-drop/rp-25-32.pdf on 2026-09-16. The
// single/joint figures also appear in the IRS news release at
// https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill
// NIIT: https://www.irs.gov/taxtopics/tc559 (3.8 percent; $250,000 joint,
// $125,000 married filing separately, $200,000 single and head of household).
// Loss cap: https://www.irs.gov/taxtopics/tc409 ($3,000, $1,500 married filing
// separately).
const YEAR_2026: YearFigures = {
  year: 2026,
  sources: {
    ordinary: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
    longTerm: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
    niit: 'https://www.irs.gov/taxtopics/tc559',
    lossCap: 'https://www.irs.gov/taxtopics/tc409',
  },
  ordinary: {
    // Rev. Proc. 2025-32 Table 3, unmarried individuals.
    single: [
      { rate: 0.10, upTo: 12_400 },
      { rate: 0.12, upTo: 50_400 },
      { rate: 0.22, upTo: 105_700 },
      { rate: 0.24, upTo: 201_775 },
      { rate: 0.32, upTo: 256_225 },
      { rate: 0.35, upTo: 640_600 },
      { rate: 0.37, upTo: Infinity },
    ],
    // Table 1, married filing jointly and surviving spouses.
    mfj: [
      { rate: 0.10, upTo: 24_800 },
      { rate: 0.12, upTo: 100_800 },
      { rate: 0.22, upTo: 211_400 },
      { rate: 0.24, upTo: 403_550 },
      { rate: 0.32, upTo: 512_450 },
      { rate: 0.35, upTo: 768_700 },
      { rate: 0.37, upTo: Infinity },
    ],
    // Table 4, married filing separately.
    mfs: [
      { rate: 0.10, upTo: 12_400 },
      { rate: 0.12, upTo: 50_400 },
      { rate: 0.22, upTo: 105_700 },
      { rate: 0.24, upTo: 201_775 },
      { rate: 0.32, upTo: 256_225 },
      { rate: 0.35, upTo: 384_350 },
      { rate: 0.37, upTo: Infinity },
    ],
    // Table 2, heads of households.
    hoh: [
      { rate: 0.10, upTo: 17_700 },
      { rate: 0.12, upTo: 67_450 },
      { rate: 0.22, upTo: 105_700 },
      { rate: 0.24, upTo: 201_750 },
      { rate: 0.32, upTo: 256_200 },
      { rate: 0.35, upTo: 640_600 },
      { rate: 0.37, upTo: Infinity },
    ],
  },
  // Rev. Proc. 2025-32 section 3.03.
  longTerm: {
    single: { zeroUpTo: 49_450, fifteenUpTo: 545_500 },
    mfj: { zeroUpTo: 98_900, fifteenUpTo: 613_700 },
    mfs: { zeroUpTo: 49_450, fifteenUpTo: 306_850 },
    hoh: { zeroUpTo: 66_200, fifteenUpTo: 579_600 },
  },
  niitThreshold: { single: 200_000, mfj: 250_000, mfs: 125_000, hoh: 200_000 },
  lossCap: { single: 3_000, mfj: 3_000, mfs: 1_500, hoh: 3_000 },
};

export const NIIT_RATE = 0.038;

export const TAX_YEARS: Record<TaxYear, YearFigures> = { 2026: YEAR_2026 };

export const LATEST_TAX_YEAR: TaxYear = 2026;

// ─────────────────────────────────────────────────────────────────────────────

/** Above this the cent arithmetic stops being exact in a double. */
const MAX_AMOUNT = 1e12;

const money = (n: number) => Math.round(n * 100) / 100;

export interface CapitalGainsInput {
  year: TaxYear;
  filingStatus: FilingStatus;
  /** Taxable ordinary income before the gain: after the standard or itemized
   *  deduction, with no capital gain in it. Zero is valid. */
  ordinaryIncome: number;
  /** Net short-term result for the year. Negative is a loss. */
  shortTerm: number;
  /** Net long-term result for the year. Negative is a loss. */
  longTerm: number;
}

/** One slice of the gain landing in one bracket. */
export interface BracketPiece {
  kind: 'short-term' | 'long-term';
  /** 0, 0.15, 0.2 for long-term; the ordinary rate for short-term. */
  rate: number;
  /** Taxable income at which this slice starts, after stacking. */
  from: number;
  /** Taxable income at which this slice ends. */
  to: number;
  /** Dollars of the gain in this slice. Always positive. */
  amount: number;
  tax: number;
}

export interface CapitalGainsResult {
  year: TaxYear;
  filingStatus: FilingStatus;
  ordinaryIncome: number;
  /** After §1222 netting. Both zero or positive; at most one of the two loss
   *  fields below is positive. */
  netShortTermGain: number;
  netLongTermGain: number;
  /** netShortTermGain + netLongTermGain. */
  netGain: number;
  /** Positive only when the year nets to a loss. */
  netCapitalLoss: number;
  /** §1211(b): the part of the loss deducted against ordinary income. */
  lossDeduction: number;
  /** The cap that applied, for the surface to name. */
  lossCap: number;
  /** §1212(b): carried to next year, by character. */
  carryoverShortTerm: number;
  carryoverLongTerm: number;
  carryover: number;
  /** Ordinary tax saved by the deduction, on the brackets for the year. */
  ordinaryTaxReduction: number;
  /** Tax on the ordinary income alone, before any gain. Context only. */
  taxOnOrdinaryIncome: number;
  shortTermPieces: BracketPiece[];
  longTermPieces: BracketPiece[];
  shortTermTax: number;
  longTermTax: number;
  /** What this tool used as MAGI: ordinary income plus the net gain. */
  magi: number;
  niitThreshold: number;
  /** Dollars the 3.8 percent applied to. */
  niitBase: number;
  niit: number;
  /** shortTermTax + longTermTax + niit. */
  totalTax: number;
  /** totalTax / netGain, or 0 when there is no gain. */
  effectiveRate: number;
}

const finiteWithin = (n: number, max: number) => Number.isFinite(n) && Math.abs(n) <= max;

/** Tax on `income` alone, at the ordinary brackets. */
function ordinaryTax(income: number, brackets: OrdinaryBracket[]): number {
  return money(stackOrdinary(0, income, brackets).reduce((n, p) => n + p.tax, 0));
}

/** Slices of `amount` stacked on top of `base` across the ordinary brackets. */
function stackOrdinary(base: number, amount: number, brackets: OrdinaryBracket[]): BracketPiece[] {
  const out: BracketPiece[] = [];
  let lo = 0;
  for (const b of brackets) {
    const from = Math.max(lo, base);
    const to = Math.min(b.upTo, base + amount);
    if (to > from) {
      const slice = money(to - from);
      out.push({ kind: 'short-term', rate: b.rate, from, to, amount: slice, tax: money(slice * b.rate) });
    }
    lo = b.upTo;
  }
  return out;
}

/** Slices of `amount` stacked on top of `base` across the 0/15/20 thresholds. */
function stackLongTerm(
  base: number,
  amount: number,
  t: { zeroUpTo: number; fifteenUpTo: number },
): BracketPiece[] {
  const bands = [
    { rate: 0, upTo: t.zeroUpTo },
    { rate: 0.15, upTo: t.fifteenUpTo },
    { rate: 0.2, upTo: Infinity },
  ];
  const out: BracketPiece[] = [];
  let lo = 0;
  for (const b of bands) {
    const from = Math.max(lo, base);
    const to = Math.min(b.upTo, base + amount);
    if (to > from) {
      const slice = money(to - from);
      out.push({ kind: 'long-term', rate: b.rate, from, to, amount: slice, tax: money(slice * b.rate) });
    }
    lo = b.upTo;
  }
  return out;
}

/**
 * Federal tax on the gain. Returns null when the input cannot produce a figure
 * worth printing: an unsupported year or filing status, a negative ordinary
 * income, or a non-finite or absurdly large amount.
 */
export function computeCapitalGainsTax(input: CapitalGainsInput): CapitalGainsResult | null {
  const figures = TAX_YEARS[input.year];
  if (!figures) return null;
  const status = input.filingStatus;
  if (!FILING_STATUSES.some((s) => s.value === status)) return null;
  if (!Number.isFinite(input.ordinaryIncome) || input.ordinaryIncome < 0 || input.ordinaryIncome > MAX_AMOUNT) {
    return null;
  }
  if (!finiteWithin(input.shortTerm, MAX_AMOUNT) || !finiteWithin(input.longTerm, MAX_AMOUNT)) return null;

  const ordinaryIncome = money(input.ordinaryIncome);
  const brackets = figures.ordinary[status];
  const ltThresholds = figures.longTerm[status];
  const lossCap = figures.lossCap[status];
  const niitThreshold = figures.niitThreshold[status];

  // §1222 netting. A loss of one character offsets a gain of the other. What
  // is left keeps the character of the side that was larger (§1212(b)(1)).
  let st = money(input.shortTerm);
  let lt = money(input.longTerm);
  if (st < 0 && lt > 0) {
    const n = money(lt + st);
    if (n >= 0) { lt = n; st = 0; } else { lt = 0; st = n; }
  } else if (lt < 0 && st > 0) {
    const n = money(st + lt);
    if (n >= 0) { st = n; lt = 0; } else { st = 0; lt = n; }
  }

  const netShortTermGain = Math.max(0, st);
  const netLongTermGain = Math.max(0, lt);
  const netGain = money(netShortTermGain + netLongTermGain);

  // A year that nets to a loss.
  const stLoss = Math.max(0, -st);
  const ltLoss = Math.max(0, -lt);
  const netCapitalLoss = money(stLoss + ltLoss);
  const lossDeduction = Math.min(netCapitalLoss, lossCap);
  // §1212(b)(2) treats the allowed deduction as a short-term gain, so it
  // absorbs the short-term loss first and the long-term loss with what is left.
  const carryoverShortTerm = money(Math.max(0, stLoss - lossDeduction));
  const carryoverLongTerm = money(ltLoss - Math.max(0, lossDeduction - stLoss));
  const carryover = money(carryoverShortTerm + carryoverLongTerm);

  const taxOnOrdinaryIncome = ordinaryTax(ordinaryIncome, brackets);
  const ordinaryTaxReduction = lossDeduction > 0
    ? money(taxOnOrdinaryIncome - ordinaryTax(Math.max(0, ordinaryIncome - lossDeduction), brackets))
    : 0;

  // Stacking: short-term on top of ordinary income, long-term on top of both.
  const shortTermPieces = stackOrdinary(ordinaryIncome, netShortTermGain, brackets);
  const longTermPieces = stackLongTerm(money(ordinaryIncome + netShortTermGain), netLongTermGain, ltThresholds);
  const shortTermTax = money(shortTermPieces.reduce((n, p) => n + p.tax, 0));
  const longTermTax = money(longTermPieces.reduce((n, p) => n + p.tax, 0));

  // §1411: 3.8 percent of the lesser of net investment income (the net gain,
  // here) and the excess of MAGI over the threshold. MAGI is approximated as
  // ordinary income plus the net gain; see the module header.
  const magi = money(ordinaryIncome + netGain);
  const niitBase = money(Math.min(netGain, Math.max(0, magi - niitThreshold)));
  const niit = money(niitBase * NIIT_RATE);

  const totalTax = money(shortTermTax + longTermTax + niit);
  const effectiveRate = netGain > 0 ? totalTax / netGain : 0;

  return {
    year: input.year,
    filingStatus: status,
    ordinaryIncome,
    netShortTermGain,
    netLongTermGain,
    netGain,
    netCapitalLoss,
    lossDeduction,
    lossCap,
    carryoverShortTerm,
    carryoverLongTerm,
    carryover,
    ordinaryTaxReduction,
    taxOnOrdinaryIncome,
    shortTermPieces,
    longTermPieces,
    shortTermTax,
    longTermTax,
    magi,
    niitThreshold,
    niitBase,
    niit,
    totalTax,
    effectiveRate,
  };
}
