/**
 * Dividend income projection arithmetic. Pure math on the numbers the caller
 * supplies: no market data, no user book, no tax modeling.
 *
 * The model, one year at a time:
 *   1. Any annual contribution is added to the portfolio value at the start
 *      of the year.
 *   2. That year's dividend income is the dividend yield times the resulting
 *      value. The yield used compounds by the dividend growth rate each year
 *      (year 1 uses the yield entered), which is separate from and additive
 *      to the share price growth rate: a fund can raise its dividend faster
 *      or slower than its price moves.
 *   3. Price growth is applied to the value for the year.
 *   4. If dividends are reinvested, that year's dividend is added back to the
 *      value at year end. If not, it is paid out and never added to value.
 *
 * To split the final value into "how much is contributions, how much is
 * price growth, how much is dividends," the module runs a second, parallel
 * simulation with the same contributions and price growth but a 0 percent
 * dividend yield. Whatever the real, dividend-earning simulation has beyond
 * that no-dividend baseline is attributed to dividends (principal plus the
 * compounding of reinvested dividends together, since the two are not
 * separable once reinvested dividends have themselves grown with the price).
 *
 * The yield used in step 2 is capped at 100 percent a year, and the whole
 * projection is refused (returns null) if a value in it ever exceeds the
 * range cent arithmetic is exact in a double: both only bite on extreme,
 * unrealistic combinations of a high yield, a high dividend growth rate, and
 * reinvestment held for decades.
 *
 * What it does NOT model, and every one of these must stay visible wherever
 * the output is rendered:
 *   - TAXES. Qualified dividend tax is a separate step; this tool has no tax
 *     bracket or filing status input.
 *   - A variable or compounding-more-than-annually schedule. Everything
 *     compounds once a year even when a monthly or quarterly payout is shown.
 *   - Reinvestment friction (fees, minimums, fractional-share limits) and any
 *     change in yield, growth, or contribution over the horizon: all three
 *     rates and the contribution are held constant for every year entered.
 */

/** Re-exported so the page parses input the same way every tool page does. */
export { parseAmount } from '@/lib/wash-sale';

export type PaymentFrequency = 'monthly' | 'quarterly' | 'annual';

export const PAYMENT_FREQUENCIES: { value: PaymentFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

/** Above this the cent arithmetic stops being exact in a double. */
const MAX_AMOUNT = 1e12;

/** The page will not project further than this even if asked to. */
export const MAX_YEARS = 50;

const money = (n: number) => Math.round(n * 100) / 100;

const PERIODS_PER_YEAR: Record<PaymentFrequency, number> = { monthly: 12, quarterly: 4, annual: 1 };

export interface DividendIncomeInput {
  /** Dollars invested today. Zero is valid. */
  startingInvestment: number;
  /** Trailing dividend yield, in percent (3 for 3%). Cannot be negative. */
  dividendYieldPercent: number;
  /** How fast the dividend itself grows each year, in percent. Can be
   *  negative (a shrinking dividend), but not -100 or below. */
  dividendGrowthRatePercent: number;
  /** Expected annual share price growth, in percent. Can be negative, but
   *  not -100 or below. */
  priceGrowthRatePercent: number;
  /** Whole number of years to project, 1 to 50. A larger value is capped at
   *  50 rather than rejected. */
  years: number;
  /** Whether each year's dividend is added back to the portfolio at year end
   *  or paid out and excluded from the portfolio from then on. */
  reinvestDividends: boolean;
  /** Dollars added to the portfolio at the start of every year. Zero is
   *  valid. */
  annualContribution: number;
  /** Only changes how the final year's income is divided for display. */
  paymentFrequency: PaymentFrequency;
}

export interface DividendYearRow {
  /** 1-indexed. */
  year: number;
  /** Portfolio value at the end of this year. */
  portfolioValue: number;
  /** Dividend income earned during this year. */
  annualDividendIncome: number;
  /** All dividend income earned from year 1 through this year, whether or
   *  not it was reinvested. */
  cumulativeDividends: number;
  /** 0 to 1: the fraction of this year's ending portfolio value that would
   *  not exist without dividend reinvestment. Always 0 when
   *  reinvestDividends is false. */
  shareOfValueFromReinvestedDividends: number;
}

export interface DividendIncomeResult {
  rows: DividendYearRow[];
  /** True when the requested years exceeded MAX_YEARS and was capped. */
  cappedYears: boolean;
  /** rows[0].annualDividendIncome. */
  year1Income: number;
  /** rows[rows.length - 1].annualDividendIncome. */
  finalYearIncome: number;
  /** finalYearIncome divided by the periods in paymentFrequency. */
  perPeriodIncomeAtEnd: number;
  periodsPerYear: number;
  finalPortfolioValue: number;
  /** Starting investment plus every annual contribution, at face value with
   *  no growth applied. */
  totalContributed: number;
  /** With reinvestment on: the no-dividend-baseline value at the end minus
   *  totalContributed. With reinvestment off: finalPortfolioValue minus
   *  totalContributed (there is no dividend contribution to value either
   *  way, so the two are the same computation). */
  totalFromGrowth: number;
  /** With reinvestment on: finalPortfolioValue minus the no-dividend
   *  baseline, i.e. what reinvested dividends and their own growth added.
   *  With reinvestment off: the plain sum of dividends paid out, since none
   *  of them are in finalPortfolioValue. */
  totalFromDividends: number;
}

const finiteWithin = (n: number, max: number) => Number.isFinite(n) && Math.abs(n) <= max;

/**
 * Projects dividend income and portfolio value year by year. Returns null
 * when the input cannot produce a figure worth printing.
 */
export function computeDividendIncome(input: DividendIncomeInput): DividendIncomeResult | null {
  if (!finiteWithin(input.startingInvestment, MAX_AMOUNT) || input.startingInvestment < 0) return null;
  if (!finiteWithin(input.annualContribution, MAX_AMOUNT) || input.annualContribution < 0) return null;
  if (!Number.isFinite(input.dividendYieldPercent) || input.dividendYieldPercent < 0 || input.dividendYieldPercent > 100) {
    return null;
  }
  if (!Number.isFinite(input.dividendGrowthRatePercent) || input.dividendGrowthRatePercent <= -100 || input.dividendGrowthRatePercent > 100) {
    return null;
  }
  if (!Number.isFinite(input.priceGrowthRatePercent) || input.priceGrowthRatePercent <= -100 || input.priceGrowthRatePercent > 100) {
    return null;
  }
  if (!Number.isInteger(input.years) || input.years < 1) return null;
  if (typeof input.reinvestDividends !== 'boolean') return null;
  if (!PERIODS_PER_YEAR[input.paymentFrequency]) return null;

  const years = Math.min(input.years, MAX_YEARS);
  const cappedYears = input.years > MAX_YEARS;

  const y = input.dividendYieldPercent / 100;
  const d = input.dividendGrowthRatePercent / 100;
  const g = input.priceGrowthRatePercent / 100;
  const contribution = money(input.annualContribution);

  let value = money(input.startingInvestment);
  let principalOnly = value;
  let cumulativeDividends = 0;
  const rows: DividendYearRow[] = [];

  for (let t = 1; t <= years; t += 1) {
    value = money(value + contribution);
    principalOnly = money(principalOnly + contribution);

    // Capped at 100 percent: a dividend growth rate compounding well past the
    // price growth rate for decades otherwise produces a "yield" over the
    // portfolio's own value, which is not a figure worth printing.
    const yieldThisYear = Math.min(1, y * Math.pow(1 + d, t - 1));
    const dividend = money(value * yieldThisYear);
    cumulativeDividends = money(cumulativeDividends + dividend);

    value = money(value * (1 + g));
    principalOnly = money(principalOnly * (1 + g));
    if (input.reinvestDividends) value = money(value + dividend);

    // A yield near the 100 percent cap compounding for decades of reinvestment
    // can still run the value past where cent arithmetic is exact in a
    // double. Refuse rather than print a figure that has stopped meaning
    // anything.
    if (!finiteWithin(value, MAX_AMOUNT) || !finiteWithin(principalOnly, MAX_AMOUNT)) return null;

    const shareOfValueFromReinvestedDividends =
      input.reinvestDividends && value > 0 ? Math.max(0, money(value - principalOnly)) / value : 0;

    rows.push({
      year: t,
      portfolioValue: value,
      annualDividendIncome: dividend,
      cumulativeDividends,
      shareOfValueFromReinvestedDividends,
    });
  }

  const periodsPerYear = PERIODS_PER_YEAR[input.paymentFrequency];
  const year1Income = rows[0].annualDividendIncome;
  const finalYearIncome = rows[rows.length - 1].annualDividendIncome;
  const perPeriodIncomeAtEnd = money(finalYearIncome / periodsPerYear);
  const finalPortfolioValue = value;
  const totalContributed = money(input.startingInvestment + contribution * years);

  const totalFromGrowth = input.reinvestDividends
    ? money(principalOnly - totalContributed)
    : money(finalPortfolioValue - totalContributed);
  const totalFromDividends = input.reinvestDividends
    ? money(finalPortfolioValue - principalOnly)
    : cumulativeDividends;

  return {
    rows,
    cappedYears,
    year1Income,
    finalYearIncome,
    perPeriodIncomeAtEnd,
    periodsPerYear,
    finalPortfolioValue,
    totalContributed,
    totalFromGrowth,
    totalFromDividends,
  };
}
