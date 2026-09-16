// tests/monte-carlo-retirement.test.ts
// Pins the arithmetic the /tools/monte-carlo-retirement-calculator page
// prints. Zero-volatility cases are worked by hand in the test so the
// simulation has a closed form to match; the random cases check identities
// that must hold whatever the draws are.
import { describe, it, expect } from 'vitest';
import {
  simulateRetirement,
  lognormalParameters,
  mulberry32,
  normalGenerator,
  parseAmount,
  DEFAULT_SIMULATIONS,
  MAX_SIMULATIONS,
  DEFAULT_SEED,
  type MonteCarloInput,
} from '@/lib/monte-carlo-retirement';

const BASE: MonteCarloInput = {
  startingBalance: 500_000,
  annualContribution: 20_000,
  yearsUntilRetirement: 10,
  yearsInRetirement: 30,
  annualWithdrawal: 60_000,
  inflationRate: 0.02,
  nominalReturn: 0.07,
  volatility: 0.15,
  simulations: 2_000,
  seed: 1,
};

/** Every return is exactly `rate`, so the path is a plain compounding loop. */
const FLAT = (rate: number, over: Partial<MonteCarloInput> = {}): MonteCarloInput => ({
  ...BASE,
  nominalReturn: rate,
  volatility: 0,
  simulations: 5,
  ...over,
});

const allPercentiles = (p: { p10: number; p25: number; p50: number; p75: number; p90: number }) =>
  [p.p10, p.p25, p.p50, p.p75, p.p90];

describe('the seeded generator', () => {
  it('returns the same sequence for the same seed and floats in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i += 1) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('returns a different sequence for a different seed', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(Array.from({ length: 5 }, a)).not.toEqual(Array.from({ length: 5 }, b));
  });

  it('produces standard normal draws: mean near 0, standard deviation near 1', () => {
    const next = normalGenerator(7);
    const n = 40_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i += 1) {
      const z = next();
      sum += z;
      sumSq += z * z;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(sd - 1)).toBeLessThan(0.02);
  });
});

describe('the lognormal parameters', () => {
  it('reproduce the arithmetic mean and standard deviation of the simple return', () => {
    const mean = 0.08;
    const sd = 0.18;
    const { mu, sigma } = lognormalParameters(mean, sd);
    // E[1 + R] = exp(mu + sigma^2 / 2); Var[1 + R] = (exp(sigma^2) - 1) exp(2 mu + sigma^2).
    const gross = Math.exp(mu + (sigma * sigma) / 2);
    const variance = (Math.exp(sigma * sigma) - 1) * Math.exp(2 * mu + sigma * sigma);
    expect(gross - 1).toBeCloseTo(mean, 12);
    expect(Math.sqrt(variance)).toBeCloseTo(sd, 12);
  });

  it('collapse to exact compounding when the standard deviation is zero', () => {
    const { mu, sigma } = lognormalParameters(0.05, 0);
    expect(sigma).toBe(0);
    expect(Math.exp(mu)).toBeCloseTo(1.05, 12);
  });
});

describe('determinism', () => {
  it('returns identical output for the same seed', () => {
    expect(simulateRetirement(BASE)).toEqual(simulateRetirement({ ...BASE }));
  });

  it('returns different output for a different seed', () => {
    const a = simulateRetirement(BASE)!;
    const b = simulateRetirement({ ...BASE, seed: 2 })!;
    // The retirement median, not the ending one: the ending median is zero
    // under both seeds when most paths fail, which this scenario does.
    expect(a.atRetirement.p50).not.toBe(b.atRetirement.p50);
  });

  it('uses the documented default seed and simulation count when none is given', () => {
    const r = simulateRetirement({ ...BASE, seed: undefined, simulations: undefined })!;
    expect(r.seed).toBe(DEFAULT_SEED);
    expect(r.simulations).toBe(DEFAULT_SIMULATIONS);
    expect(DEFAULT_SIMULATIONS).toBe(2_000);
  });
});

describe('zero volatility reduces to closed-form compounding', () => {
  // $100,000 at 7 percent for 10 years with $10,000 added each year end:
  // 100,000 x 1.07^10 + 10,000 x (1.07^10 - 1) / 0.07.
  it('matches the future value of a lump sum plus an ordinary annuity at retirement', () => {
    const r = simulateRetirement(FLAT(0.07, {
      startingBalance: 100_000,
      annualContribution: 10_000,
      yearsUntilRetirement: 10,
      yearsInRetirement: 5,
      annualWithdrawal: 0,
    }))!;
    const g = Math.pow(1.07, 10);
    const want = 100_000 * g + (10_000 * (g - 1)) / 0.07;
    // 1.07^10 = 1.967151; 196,715.14 + 10,000 x 13.816448 = 334,879.62.
    expect(want).toBeCloseTo(334_879.62, 1);
    for (const v of allPercentiles(r.atRetirement)) expect(v).toBeCloseTo(want, 1);
    // No withdrawals, so five more years of 7 percent with no contributions.
    for (const v of allPercentiles(r.atEnd)) expect(v).toBeCloseTo(want * Math.pow(1.07, 5), 1);
  });

  // Retirement from day one. Withdraw at the start of each year, then earn
  // 5 percent. Inflation 3 percent, so the withdrawals are 10,000, 10,300,
  // 10,609.
  //   year 1: (200,000 - 10,000) x 1.05 = 199,500
  //   year 2: (199,500 - 10,300) x 1.05 = 198,660
  //   year 3: (198,660 - 10,609) x 1.05 = 197,453.55
  it('matches a hand-worked withdrawal loop with inflation', () => {
    const r = simulateRetirement(FLAT(0.05, {
      startingBalance: 200_000,
      annualContribution: 0,
      yearsUntilRetirement: 0,
      yearsInRetirement: 3,
      annualWithdrawal: 10_000,
      inflationRate: 0.03,
    }))!;
    expect(r.firstWithdrawal).toBe(10_000);
    expect(r.lastWithdrawal).toBe(10_609);
    expect(r.atEnd.p50).toBeCloseTo(197_453.55, 1);
    expect(r.successRate).toBe(1);
    expect(r.band.map((b) => b.year)).toEqual([0, 3]);
    expect(r.band[1].p50).toBeCloseTo(197_453.55, 1);
  });
});

describe('success rate boundaries', () => {
  it('is 100 percent when nothing is withdrawn', () => {
    const r = simulateRetirement({ ...BASE, annualWithdrawal: 0, volatility: 0.4 })!;
    expect(r.successRate).toBe(1);
    expect(r.failedPaths).toBe(0);
    expect(r.medianDepletionYear).toBeNull();
  });

  it('is 0 percent when the first withdrawal exceeds the balance', () => {
    const r = simulateRetirement({
      ...BASE,
      yearsUntilRetirement: 0,
      startingBalance: 50_000,
      annualWithdrawal: 60_000,
    })!;
    expect(r.successRate).toBe(0);
    expect(r.failedPaths).toBe(r.simulations);
    expect(r.medianDepletionYear).toBe(1);
    for (const v of allPercentiles(r.atEnd)) expect(v).toBe(0);
  });

  it('counts a balance that lands exactly on zero as a failure', () => {
    const r = simulateRetirement(FLAT(0.1, {
      yearsUntilRetirement: 0,
      startingBalance: 1_000,
      annualWithdrawal: 1_000,
      inflationRate: 0,
      yearsInRetirement: 2,
    }))!;
    expect(r.successRate).toBe(0);
  });

  it('is 0 or 1 with zero volatility, never in between', () => {
    for (const w of [0, 20_000, 40_000, 80_000, 200_000]) {
      const r = simulateRetirement(FLAT(0.06, { annualWithdrawal: w }))!;
      expect([0, 1]).toContain(r.successRate);
    }
  });
});

describe('the balance floors at zero and stays there', () => {
  // $1,000, withdraw $600 at the start of each year, no return, no inflation:
  // year 1 ends at 400, year 2 hits zero, year 3 stays at zero.
  it('does not go negative and does not recover', () => {
    const r = simulateRetirement(FLAT(0, {
      startingBalance: 1_000,
      annualContribution: 0,
      yearsUntilRetirement: 0,
      yearsInRetirement: 3,
      annualWithdrawal: 600,
      inflationRate: 0,
    }))!;
    expect(r.successRate).toBe(0);
    expect(r.medianDepletionYear).toBe(2);
    for (const v of allPercentiles(r.atEnd)) expect(v).toBe(0);
  });

  it('stays at zero even when later returns are large', () => {
    const r = simulateRetirement(FLAT(0.5, {
      startingBalance: 1_000,
      annualContribution: 0,
      yearsUntilRetirement: 0,
      yearsInRetirement: 6,
      annualWithdrawal: 2_000,
      inflationRate: 0,
    }))!;
    expect(r.atEnd.p90).toBe(0);
    expect(r.band.find((b) => b.year === 5)!.p90).toBe(0);
  });
});

describe('inflation is applied to withdrawals', () => {
  it('inflates the first withdrawal by the accumulation years and every retirement year after', () => {
    const r = simulateRetirement(FLAT(0, {
      yearsUntilRetirement: 5,
      yearsInRetirement: 4,
      annualWithdrawal: 1_000,
      inflationRate: 0.1,
      startingBalance: 1_000_000,
      annualContribution: 0,
    }))!;
    expect(r.firstWithdrawal).toBeCloseTo(1_000 * Math.pow(1.1, 5), 2);
    expect(r.lastWithdrawal).toBeCloseTo(1_000 * Math.pow(1.1, 8), 2);
  });

  // No return, no accumulation, 10 percent inflation: 1,000 + 1,100 + 1,210
  // = 3,310 leaves the balance.
  it('reduces the ending balance by the inflated withdrawals', () => {
    const r = simulateRetirement(FLAT(0, {
      yearsUntilRetirement: 0,
      yearsInRetirement: 3,
      annualWithdrawal: 1_000,
      inflationRate: 0.1,
      startingBalance: 10_000,
      annualContribution: 0,
    }))!;
    expect(r.atEnd.p50).toBeCloseTo(10_000 - 3_310, 2);
  });

  it('lowers the success rate against the same nominal return', () => {
    const low = simulateRetirement({ ...BASE, inflationRate: 0 })!;
    const high = simulateRetirement({ ...BASE, inflationRate: 0.05 })!;
    expect(high.successRate).toBeLessThan(low.successRate);
  });
});

describe('contributions', () => {
  it('stop at retirement', () => {
    const r = simulateRetirement(FLAT(0, {
      startingBalance: 10_000,
      annualContribution: 1_000,
      yearsUntilRetirement: 2,
      yearsInRetirement: 3,
      annualWithdrawal: 0,
    }))!;
    expect(r.atRetirement.p50).toBe(12_000);
    expect(r.atEnd.p50).toBe(12_000);
  });

  it('are added after the year\'s return, not before', () => {
    // 1,000 x 1.1 + 100 = 1,200, not (1,000 + 100) x 1.1 = 1,210.
    const r = simulateRetirement(FLAT(0.1, {
      startingBalance: 1_000,
      annualContribution: 100,
      yearsUntilRetirement: 1,
      yearsInRetirement: 1,
      annualWithdrawal: 0,
    }))!;
    expect(r.atRetirement.p50).toBeCloseTo(1_200, 6);
  });

  it('leave the retirement balance equal to the start when there is no accumulation', () => {
    const r = simulateRetirement({ ...BASE, yearsUntilRetirement: 0 })!;
    for (const v of allPercentiles(r.atRetirement)) expect(v).toBe(BASE.startingBalance);
  });
});

describe('percentiles', () => {
  it('are monotone at retirement, at the end, and in every band row', () => {
    const r = simulateRetirement(BASE)!;
    for (const p of [r.atRetirement, r.atEnd]) {
      expect(p.p10).toBeLessThanOrEqual(p.p25);
      expect(p.p25).toBeLessThanOrEqual(p.p50);
      expect(p.p50).toBeLessThanOrEqual(p.p75);
      expect(p.p75).toBeLessThanOrEqual(p.p90);
    }
    for (const row of r.band) {
      expect(row.p10).toBeLessThanOrEqual(row.p50);
      expect(row.p50).toBeLessThanOrEqual(row.p90);
    }
  });

  it('spread out with volatility and collapse without it', () => {
    const flat = simulateRetirement({ ...BASE, volatility: 0 })!;
    const noisy = simulateRetirement({ ...BASE, volatility: 0.2 })!;
    expect(flat.atRetirement.p90 - flat.atRetirement.p10).toBeCloseTo(0, 6);
    expect(noisy.atRetirement.p90 - noisy.atRetirement.p10).toBeGreaterThan(0);
  });

  // With no contributions and one year, the median gross return of the
  // lognormal is exp(mu) = (1 + mean) / sqrt(1 + sd^2 / (1 + mean)^2).
  it('put the one-year median where the lognormal says it should be', () => {
    const mean = 0.08;
    const sd = 0.2;
    const r = simulateRetirement({
      ...BASE,
      startingBalance: 1_000_000,
      annualContribution: 0,
      yearsUntilRetirement: 1,
      yearsInRetirement: 1,
      annualWithdrawal: 0,
      nominalReturn: mean,
      volatility: sd,
      simulations: 10_000,
    })!;
    const medianGross = (1 + mean) / Math.sqrt(1 + (sd * sd) / ((1 + mean) * (1 + mean)));
    expect(r.atRetirement.p50 / 1_000_000).toBeCloseTo(medianGross, 2);
  });
});

describe('the band table', () => {
  it('starts at year 0 with the starting balance and ends at the final year', () => {
    const r = simulateRetirement({ ...BASE, yearsUntilRetirement: 7, yearsInRetirement: 6 })!;
    expect(r.band.map((b) => b.year)).toEqual([0, 5, 7, 10, 13]);
    expect(r.band[0]).toEqual({ year: 0, phase: 'start', p10: 500_000, p50: 500_000, p90: 500_000 });
    expect(r.band.map((b) => b.phase)).toEqual(['start', 'accumulation', 'accumulation', 'retirement', 'retirement']);
    expect(r.totalYears).toBe(13);
  });

  it('agrees with the retirement and ending percentiles', () => {
    const r = simulateRetirement(BASE)!;
    const atY = r.band.find((b) => b.year === BASE.yearsUntilRetirement)!;
    const atEnd = r.band[r.band.length - 1];
    expect([atY.p10, atY.p50, atY.p90]).toEqual([r.atRetirement.p10, r.atRetirement.p50, r.atRetirement.p90]);
    expect([atEnd.p10, atEnd.p50, atEnd.p90]).toEqual([r.atEnd.p10, r.atEnd.p50, r.atEnd.p90]);
  });
});

describe('the simulation count', () => {
  it('is capped at 10,000', () => {
    expect(MAX_SIMULATIONS).toBe(10_000);
    const r = simulateRetirement({ ...BASE, simulations: 50_000 })!;
    expect(r.simulations).toBe(10_000);
  });

  it('runs exactly the number asked for under the cap', () => {
    expect(simulateRetirement({ ...BASE, simulations: 1 })!.simulations).toBe(1);
    expect(simulateRetirement({ ...BASE, simulations: 333 })!.simulations).toBe(333);
  });
});

describe('the success rate responds in the expected direction', () => {
  it('falls as the withdrawal rises', () => {
    const a = simulateRetirement({ ...BASE, annualWithdrawal: 30_000 })!;
    const b = simulateRetirement({ ...BASE, annualWithdrawal: 90_000 })!;
    expect(b.successRate).toBeLessThan(a.successRate);
  });

  it('falls as volatility rises with the same mean return', () => {
    const calm = simulateRetirement({ ...BASE, volatility: 0.05 })!;
    const wild = simulateRetirement({ ...BASE, volatility: 0.3 })!;
    expect(wild.successRate).toBeLessThan(calm.successRate);
  });

  it('reports the median depletion year inside the retirement window when some paths fail', () => {
    const r = simulateRetirement({ ...BASE, annualWithdrawal: 90_000 })!;
    expect(r.failedPaths).toBeGreaterThan(0);
    expect(r.failedPaths).toBeLessThan(r.simulations);
    expect(r.medianDepletionYear).toBeGreaterThan(BASE.yearsUntilRetirement);
    expect(r.medianDepletionYear).toBeLessThanOrEqual(r.totalYears);
    expect(r.successRate).toBeCloseTo(1 - r.failedPaths / r.simulations, 12);
  });
});

describe('invalid input returns null', () => {
  it.each([
    ['a negative starting balance', { startingBalance: -1 }],
    ['a non-finite starting balance', { startingBalance: Number.NaN }],
    ['a negative contribution', { annualContribution: -100 }],
    ['a negative withdrawal', { annualWithdrawal: -1 }],
    ['an amount past the ceiling', { startingBalance: 1e13 }],
    ['fractional years until retirement', { yearsUntilRetirement: 2.5 }],
    ['negative years until retirement', { yearsUntilRetirement: -1 }],
    ['zero years in retirement', { yearsInRetirement: 0 }],
    ['more than 100 years in retirement', { yearsInRetirement: 101 }],
    ['a return of -100 percent', { nominalReturn: -1 }],
    ['a return above 100 percent', { nominalReturn: 1.5 }],
    ['a negative volatility', { volatility: -0.1 }],
    ['a non-finite inflation rate', { inflationRate: Infinity }],
    ['zero simulations', { simulations: 0 }],
    ['fractional simulations', { simulations: 10.5 }],
    ['a non-finite seed', { seed: Number.NaN }],
  ] as const)('for %s', (_label, over) => {
    expect(simulateRetirement({ ...BASE, ...over })).toBeNull();
  });

  it('re-exports the shared parseAmount', () => {
    expect(parseAmount('1,000,000')).toBe(1_000_000);
    expect(parseAmount('8.41')).toBe(8.41);
    expect(parseAmount('-5')).toBeNull();
  });
});
