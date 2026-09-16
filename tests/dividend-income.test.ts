// tests/dividend-income.test.ts
// Pins the arithmetic the /tools/dividend-income-calculator page prints. See
// lib/dividend-income.ts for the model: a contribution is added at the start
// of each year, that year's dividend is yield times the resulting value (the
// yield compounding by the dividend growth rate), price growth is applied to
// the value, and the dividend is added back at year end only when
// reinvestment is on.
import { describe, it, expect } from 'vitest';
import { computeDividendIncome, parseAmount, MAX_YEARS, type DividendIncomeInput } from '@/lib/dividend-income';

const BASE: DividendIncomeInput = {
  startingInvestment: 10_000,
  dividendYieldPercent: 4,
  dividendGrowthRatePercent: 0,
  priceGrowthRatePercent: 0,
  years: 5,
  reinvestDividends: false,
  annualContribution: 0,
  paymentFrequency: 'annual',
};

const cents = (n: number) => Math.round(n * 100);

describe('zero growth, no reinvestment: income is yield times value every year', () => {
  it('pays the same dividend every year because the value never changes', () => {
    const r = computeDividendIncome(BASE)!;
    expect(r.rows).toHaveLength(5);
    for (const row of r.rows) {
      expect(row.portfolioValue).toBe(10_000);
      expect(row.annualDividendIncome).toBe(400); // 4% of $10,000
    }
    expect(r.year1Income).toBe(400);
    expect(r.finalYearIncome).toBe(400);
    expect(r.rows[4].cumulativeDividends).toBe(2_000);
  });

  it('reports 0 percent of value from reinvested dividends when not reinvesting', () => {
    const r = computeDividendIncome(BASE)!;
    for (const row of r.rows) expect(row.shareOfValueFromReinvestedDividends).toBe(0);
  });

  it('splits the totals into contributed and dividends paid, with no growth', () => {
    const r = computeDividendIncome(BASE)!;
    expect(r.totalContributed).toBe(10_000);
    expect(r.totalFromGrowth).toBe(0);
    expect(r.totalFromDividends).toBe(2_000); // 5 years x $400, paid out
    expect(r.finalPortfolioValue).toBe(10_000);
  });
});

describe('zero growth, with reinvestment: income is yield times the compounding value', () => {
  it('grows the value by exactly the prior dividend each year', () => {
    const r = computeDividendIncome({ ...BASE, reinvestDividends: true })!;
    // Year 1: 4% of $10,000 = $400, value becomes $10,400.
    expect(r.rows[0].annualDividendIncome).toBe(400);
    expect(r.rows[0].portfolioValue).toBe(10_400);
    // Year 2: 4% of $10,400 = $416, value becomes $10,816.
    expect(r.rows[1].annualDividendIncome).toBe(416);
    expect(r.rows[1].portfolioValue).toBe(10_816);
  });

  it('every dividend equals the stated yield times that year-s starting value', () => {
    const r = computeDividendIncome({ ...BASE, reinvestDividends: true, years: 10 })!;
    const money4 = (v: number) => Math.round(v * 0.04 * 100) / 100;
    let priorValue = 10_000;
    for (const row of r.rows) {
      expect(row.annualDividendIncome).toBe(money4(priorValue));
      priorValue = row.portfolioValue;
    }
  });
});

describe('reinvest vs not reinvest ordering', () => {
  it('produces a strictly larger final value and cumulative dividends when reinvesting', () => {
    const off = computeDividendIncome({ ...BASE, dividendYieldPercent: 3, years: 15 })!;
    const on = computeDividendIncome({ ...BASE, dividendYieldPercent: 3, years: 15, reinvestDividends: true })!;
    expect(on.finalPortfolioValue).toBeGreaterThan(off.finalPortfolioValue);
    expect(on.rows[14].cumulativeDividends).toBeGreaterThan(off.rows[14].cumulativeDividends);
    // Not reinvesting: value never moves from the starting investment.
    expect(off.finalPortfolioValue).toBe(10_000);
  });

  it('matches exactly when the yield is zero, since there is nothing to reinvest', () => {
    const off = computeDividendIncome({ ...BASE, dividendYieldPercent: 0, priceGrowthRatePercent: 6 })!;
    const on = computeDividendIncome({ ...BASE, dividendYieldPercent: 0, priceGrowthRatePercent: 6, reinvestDividends: true })!;
    expect(on.finalPortfolioValue).toBe(off.finalPortfolioValue);
  });
});

describe('contribution-only path (zero yield)', () => {
  it('grows by contributions and price growth alone, with no dividend income', () => {
    const r = computeDividendIncome({
      ...BASE,
      startingInvestment: 0,
      dividendYieldPercent: 0,
      priceGrowthRatePercent: 5,
      annualContribution: 1_000,
      years: 3,
    })!;
    // Year 1: $1,000 contributed, grown 5% -> $1,050.
    expect(r.rows[0].portfolioValue).toBe(1_050);
    // Year 2: $1,050 + $1,000 = $2,050, grown 5% -> $2,152.50.
    expect(r.rows[1].portfolioValue).toBe(2_152.5);
    for (const row of r.rows) expect(row.annualDividendIncome).toBe(0);
    expect(r.totalFromDividends).toBe(0);
    expect(r.totalContributed).toBe(3_000);
  });
});

describe('dividend growth rate compounds the yield used each year', () => {
  it('raises the second year-s dividend beyond what the flat yield would pay', () => {
    const flat = computeDividendIncome({ ...BASE, years: 2 })!;
    const growing = computeDividendIncome({ ...BASE, years: 2, dividendGrowthRatePercent: 10 })!;
    expect(flat.rows[1].annualDividendIncome).toBe(400);
    // Year 2 yield is 4% x 1.10 = 4.4% of the (unchanged, no-reinvest) $10,000.
    expect(growing.rows[1].annualDividendIncome).toBe(440);
  });
});

describe('payment frequency only changes how the final year is divided', () => {
  it('divides the final year-s income by 12, 4, or 1', () => {
    const monthly = computeDividendIncome({ ...BASE, paymentFrequency: 'monthly' })!;
    const quarterly = computeDividendIncome({ ...BASE, paymentFrequency: 'quarterly' })!;
    const annual = computeDividendIncome({ ...BASE, paymentFrequency: 'annual' })!;
    expect(monthly.perPeriodIncomeAtEnd).toBe(33.33); // $400 / 12, rounded to whole cents
    expect(quarterly.perPeriodIncomeAtEnd).toBe(100);
    expect(annual.perPeriodIncomeAtEnd).toBe(400);
    // Changing frequency never changes the projection itself.
    expect(monthly.finalPortfolioValue).toBe(quarterly.finalPortfolioValue);
  });
});

describe('cap on years', () => {
  it('caps a request past 50 years at 50 and reports it', () => {
    const r = computeDividendIncome({ ...BASE, years: 100 })!;
    expect(r.rows).toHaveLength(MAX_YEARS);
    expect(r.cappedYears).toBe(true);
  });

  it('does not cap exactly 50 years', () => {
    const r = computeDividendIncome({ ...BASE, years: 50 })!;
    expect(r.rows).toHaveLength(50);
    expect(r.cappedYears).toBe(false);
  });

  it('produces the same first 50 rows whether asked for 50 or 500 years', () => {
    const at50 = computeDividendIncome({ ...BASE, years: 50, reinvestDividends: true, dividendGrowthRatePercent: 3, priceGrowthRatePercent: 6 })!;
    const at500 = computeDividendIncome({ ...BASE, years: 500, reinvestDividends: true, dividendGrowthRatePercent: 3, priceGrowthRatePercent: 6 })!;
    expect(at500.rows).toEqual(at50.rows);
  });
});

describe('invalid input', () => {
  it.each([
    ['a negative starting investment', { ...BASE, startingInvestment: -1 }],
    ['a non-finite starting investment', { ...BASE, startingInvestment: Number.NaN }],
    ['a starting investment past the ceiling', { ...BASE, startingInvestment: 1e13 }],
    ['a negative dividend yield', { ...BASE, dividendYieldPercent: -1 }],
    ['a dividend yield past 100 percent', { ...BASE, dividendYieldPercent: 101 }],
    ['a dividend growth rate at -100 percent', { ...BASE, dividendGrowthRatePercent: -100 }],
    ['a dividend growth rate below -100 percent', { ...BASE, dividendGrowthRatePercent: -150 }],
    ['a price growth rate at -100 percent', { ...BASE, priceGrowthRatePercent: -100 }],
    ['a price growth rate below -100 percent', { ...BASE, priceGrowthRatePercent: -200 }],
    ['zero years', { ...BASE, years: 0 }],
    ['negative years', { ...BASE, years: -5 }],
    ['a fractional number of years', { ...BASE, years: 2.5 }],
    ['a non-finite number of years', { ...BASE, years: Number.NaN }],
    ['a negative annual contribution', { ...BASE, annualContribution: -100 }],
    ['a non-finite annual contribution', { ...BASE, annualContribution: Number.POSITIVE_INFINITY }],
    ['an unknown payment frequency', { ...BASE, paymentFrequency: 'weekly' as unknown as 'annual' }],
    ['a non-boolean reinvest flag', { ...BASE, reinvestDividends: 'yes' as unknown as boolean }],
  ])('returns null for %s', (_label, input) => {
    expect(computeDividendIncome(input)).toBeNull();
  });

  it('re-exports the shared parseAmount', () => {
    expect(parseAmount('4,200.50')).toBe(4200.5);
    expect(parseAmount('-100')).toBeNull();
  });
});

describe('reconciliation identity over random input', () => {
  it('final value equals contributions plus growth plus reinvested dividends, within a cent per year, over 2,000 cases', () => {
    let seed = 20260916;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

    for (let i = 0; i < 2_000; i += 1) {
      const years = 1 + Math.floor(rnd() * 50);
      const input: DividendIncomeInput = {
        startingInvestment: Math.round(rnd() * 1_000_000) / 100,
        dividendYieldPercent: Math.round(rnd() * 1000) / 100,
        dividendGrowthRatePercent: Math.round((rnd() - 0.3) * 3000) / 100,
        priceGrowthRatePercent: Math.round((rnd() - 0.2) * 2000) / 100,
        years,
        reinvestDividends: true,
        annualContribution: Math.round(rnd() * 500_000) / 100,
        paymentFrequency: 'annual',
      };
      const r = computeDividendIncome(input);
      // Extreme, randomly-generated combinations (near-100-percent yield
      // compounding for decades of reinvestment) can legitimately overflow
      // the cent-exact range and return null; skip those rather than fail.
      if (!r) continue;

      const sum = cents(r.totalContributed) + cents(r.totalFromGrowth) + cents(r.totalFromDividends);
      expect(Math.abs(sum - cents(r.finalPortfolioValue))).toBeLessThanOrEqual(years);

      // Cumulative dividends only rise, and each year-s share of value from
      // reinvested dividends stays within 0 and 1.
      let prevCum = -1;
      for (const row of r.rows) {
        expect(row.cumulativeDividends).toBeGreaterThanOrEqual(prevCum === -1 ? 0 : prevCum);
        prevCum = row.cumulativeDividends;
        expect(row.shareOfValueFromReinvestedDividends).toBeGreaterThanOrEqual(0);
        expect(row.shareOfValueFromReinvestedDividends).toBeLessThanOrEqual(1);
      }
      expect(r.rows[r.rows.length - 1].annualDividendIncome).toBe(r.finalYearIncome);
      expect(r.rows[0].annualDividendIncome).toBe(r.year1Income);
    }
  });
});
