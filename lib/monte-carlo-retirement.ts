/**
 * Monte Carlo retirement simulation.
 *
 * Given a starting balance, a contribution schedule, a withdrawal schedule and
 * a return distribution, this runs a fixed number of simulated paths and
 * reports how many of them never ran out of money, plus percentile balances
 * along the way. It is arithmetic on numbers the caller supplies. It reads no
 * market data and no user book, and it is deterministic for a given seed.
 *
 * What it models:
 *   - One return per year, drawn from a lognormal distribution whose simple
 *     annual return has the arithmetic mean `nominalReturn` and the standard
 *     deviation `volatility` the caller supplies. Returns are independent
 *     across years and across paths (no mean reversion, no regimes).
 *   - Accumulation: for `yearsUntilRetirement` years, the balance earns the
 *     year's return and then `annualContribution` is added at year end.
 *   - Retirement: for `yearsInRetirement` years, the withdrawal is taken at
 *     the start of the year and the remainder earns the year's return.
 *   - The withdrawal is entered in today's dollars and inflated at
 *     `inflationRate` every year from today, so the first retirement
 *     withdrawal is already `yearsUntilRetirement` years of inflation larger.
 *   - The balance floors at zero and stays there. A path that reaches zero at
 *     any point is a failed path, whatever happens after.
 *
 * What it does NOT model, and every one of these must stay visible wherever
 * the output is rendered:
 *   - Fees, taxes, Social Security or any other income, or a change in the
 *     withdrawal in response to the balance.
 *   - Fat tails, volatility clustering, mean reversion, or any dependence
 *     between one year's return and the next.
 *   - Anything about the future. The output is the distribution of outcomes
 *     under the stated assumptions, not a forecast.
 *
 * The default return and volatility live in the constants block below with
 * the page they were read from.
 */

/** Re-exported so the page parses input the same way every tool page does. */
export { parseAmount } from '@/lib/wash-sale';

// ─────────────────────────────────────────────────────────────────────────────
// Default figures. Each names the page it was read from.
// ─────────────────────────────────────────────────────────────────────────────

// Return and volatility: the iShares Core S&P 500 ETF (IVV) product page,
// https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf, read on
// 2026-09-16. "Average Annual" NAV total return since the fund's inception on
// May 15, 2000: 8.41% (table dated Jun 30, 2026). "Standard Deviation (3y)":
// 12.94% as of Aug 31, 2026. The return is a 26-year average of one index
// fund; the standard deviation covers only the last three years, which is
// why the page lets the reader change both.
export const DEFAULT_NOMINAL_RETURN = 0.0841;
export const DEFAULT_VOLATILITY = 0.1294;
export const DEFAULTS_SOURCE = 'https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf';

// Inflation: the Federal Reserve's stated longer-run objective of 2 percent,
// measured by the PCE price index, from
// https://www.federalreserve.gov/faqs/economy_14400.htm, read on 2026-09-16.
export const DEFAULT_INFLATION = 0.02;
export const INFLATION_SOURCE = 'https://www.federalreserve.gov/faqs/economy_14400.htm';

export const DEFAULT_SIMULATIONS = 2_000;
export const MAX_SIMULATIONS = 10_000;
export const DEFAULT_SEED = 20260916;

/** The band table shows every this-many years, plus the final year. */
export const BAND_STEP = 5;

// ─────────────────────────────────────────────────────────────────────────────

const MAX_AMOUNT = 1e12;
const MAX_YEARS = 100;

const money = (n: number) => Math.round(n * 100) / 100;

export interface MonteCarloInput {
  startingBalance: number;
  /** Added at the end of each accumulation year. */
  annualContribution: number;
  /** Whole years, 0 to 100. Zero means retirement starts now. */
  yearsUntilRetirement: number;
  /** Whole years, 1 to 100. */
  yearsInRetirement: number;
  /** In today's dollars. Inflated every year from today. */
  annualWithdrawal: number;
  /** Annual, as a fraction: 0.02 is 2 percent. */
  inflationRate: number;
  /** Arithmetic mean of the simple annual nominal return, as a fraction. */
  nominalReturn: number;
  /** Standard deviation of the simple annual return, as a fraction. */
  volatility: number;
  /** Paths to run. Capped at MAX_SIMULATIONS. */
  simulations?: number;
  seed?: number;
}

export interface Percentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface BandRow {
  /** Years from today. Zero is the starting balance. */
  year: number;
  phase: 'start' | 'accumulation' | 'retirement';
  p10: number;
  p50: number;
  p90: number;
}

export interface MonteCarloResult {
  /** Paths actually run, after the cap. */
  simulations: number;
  seed: number;
  totalYears: number;
  /** Fraction of paths whose balance never reached zero. */
  successRate: number;
  /** Balance at the end of the last accumulation year (or the starting
   *  balance when there is no accumulation). */
  atRetirement: Percentiles;
  /** Balance at the end of the last retirement year. */
  atEnd: Percentiles;
  /** Among failed paths, the median year (from today) in which the balance
   *  first reached zero. Null when no path failed. */
  medianDepletionYear: number | null;
  failedPaths: number;
  /** The nominal withdrawal taken in the first retirement year. */
  firstWithdrawal: number;
  /** The nominal withdrawal taken in the last retirement year. */
  lastWithdrawal: number;
  band: BandRow[];
}

// ── Seeded randomness ────────────────────────────────────────────────────────

/** mulberry32: a 32-bit seeded generator returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draws by Box-Muller over a seeded uniform generator. */
export function normalGenerator(seed: number): () => number {
  const rand = mulberry32(seed);
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const z = spare;
      spare = null;
      return z;
    }
    // 1 - u keeps the log argument in (0, 1].
    const u1 = 1 - rand();
    const u2 = rand();
    const r = Math.sqrt(-2 * Math.log(u1));
    spare = r * Math.sin(2 * Math.PI * u2);
    return r * Math.cos(2 * Math.PI * u2);
  };
}

/**
 * Parameters of the log of the gross return, ln(1 + R), such that the simple
 * return R has arithmetic mean `mean` and standard deviation `sd`.
 * With sd = 0 the growth factor is exactly 1 + mean.
 */
export function lognormalParameters(mean: number, sd: number): { mu: number; sigma: number } {
  const gross = 1 + mean;
  const sigma2 = Math.log(1 + (sd * sd) / (gross * gross));
  return { mu: Math.log(gross) - sigma2 / 2, sigma: Math.sqrt(sigma2) };
}

// ── Percentiles ──────────────────────────────────────────────────────────────

/** Linear interpolation between order statistics of a sorted array. */
function quantile(sorted: Float64Array, p: number): number {
  const n = sorted.length;
  if (n === 1) return sorted[0];
  const pos = p * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, n - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function percentiles(values: Float64Array): Percentiles {
  const sorted = Float64Array.from(values).sort();
  return {
    p10: money(quantile(sorted, 0.1)),
    p25: money(quantile(sorted, 0.25)),
    p50: money(quantile(sorted, 0.5)),
    p75: money(quantile(sorted, 0.75)),
    p90: money(quantile(sorted, 0.9)),
  };
}

// ── Validation ───────────────────────────────────────────────────────────────

const amountOk = (n: number) => Number.isFinite(n) && n >= 0 && n <= MAX_AMOUNT;
const yearsOk = (n: number, min: number) => Number.isInteger(n) && n >= min && n <= MAX_YEARS;

function validate(input: MonteCarloInput): boolean {
  if (!amountOk(input.startingBalance)) return false;
  if (!amountOk(input.annualContribution)) return false;
  if (!amountOk(input.annualWithdrawal)) return false;
  if (!yearsOk(input.yearsUntilRetirement, 0)) return false;
  if (!yearsOk(input.yearsInRetirement, 1)) return false;
  if (!Number.isFinite(input.inflationRate) || input.inflationRate < -0.5 || input.inflationRate > 1) return false;
  if (!Number.isFinite(input.nominalReturn) || input.nominalReturn <= -1 || input.nominalReturn > 1) return false;
  if (!Number.isFinite(input.volatility) || input.volatility < 0 || input.volatility > 2) return false;
  if (input.simulations !== undefined && (!Number.isInteger(input.simulations) || input.simulations < 1)) return false;
  if (input.seed !== undefined && !Number.isFinite(input.seed)) return false;
  return true;
}

// ── The simulation ───────────────────────────────────────────────────────────

/**
 * Runs the simulation. Returns null when the input cannot produce a figure
 * worth printing: a negative or non-finite amount, a non-integer or
 * out-of-range year count, a return at or below -100 percent, a negative
 * volatility, or a simulation count below one.
 */
export function simulateRetirement(input: MonteCarloInput): MonteCarloResult | null {
  if (!validate(input)) return null;

  const Y = input.yearsUntilRetirement;
  const R = input.yearsInRetirement;
  const total = Y + R;
  const n = Math.min(MAX_SIMULATIONS, input.simulations ?? DEFAULT_SIMULATIONS);
  const seed = input.seed ?? DEFAULT_SEED;
  const nextNormal = normalGenerator(seed);
  const { mu, sigma } = lognormalParameters(input.nominalReturn, input.volatility);

  // Which year-end balances to keep: every BAND_STEP years, the retirement
  // boundary, and the final year. Year 0 is the starting balance.
  const tracked = new Set<number>([0, Y, total]);
  for (let t = BAND_STEP; t < total; t += BAND_STEP) tracked.add(t);
  const trackedYears = [...tracked].sort((a, b) => a - b);
  const store = new Map<number, Float64Array>();
  for (const t of trackedYears) store.set(t, new Float64Array(n));

  // Nominal withdrawal in retirement year k (1-based): inflated from today.
  const withdrawals = new Float64Array(R);
  for (let k = 0; k < R; k += 1) {
    withdrawals[k] = input.annualWithdrawal * Math.pow(1 + input.inflationRate, Y + k);
  }

  const depletionYears: number[] = [];

  for (let path = 0; path < n; path += 1) {
    let balance = input.startingBalance;
    let depleted = false;
    store.get(0)![path] = balance;

    for (let t = 1; t <= total; t += 1) {
      if (!depleted) {
        if (t > Y) {
          balance -= withdrawals[t - Y - 1];
          if (balance <= 0) {
            balance = 0;
            depleted = true;
            depletionYears.push(t);
          }
        }
        if (!depleted) {
          const growth = sigma === 0 ? Math.exp(mu) : Math.exp(mu + sigma * nextNormal());
          balance *= growth;
          if (t <= Y) balance += input.annualContribution;
        }
      }
      const slot = store.get(t);
      if (slot) slot[path] = balance;
    }
  }

  depletionYears.sort((a, b) => a - b);
  const failed = depletionYears.length;
  const medianDepletionYear = failed === 0
    ? null
    : failed % 2 === 1
      ? depletionYears[(failed - 1) / 2]
      : (depletionYears[failed / 2 - 1] + depletionYears[failed / 2]) / 2;

  const band: BandRow[] = trackedYears.map((t) => {
    const p = percentiles(store.get(t)!);
    return {
      year: t,
      phase: t === 0 ? 'start' : t <= Y ? 'accumulation' : 'retirement',
      p10: p.p10,
      p50: p.p50,
      p90: p.p90,
    };
  });

  return {
    simulations: n,
    seed,
    totalYears: total,
    successRate: (n - failed) / n,
    atRetirement: percentiles(store.get(Y)!),
    atEnd: percentiles(store.get(total)!),
    medianDepletionYear,
    failedPaths: failed,
    firstWithdrawal: money(withdrawals[0]),
    lastWithdrawal: money(withdrawals[R - 1]),
    band,
  };
}
