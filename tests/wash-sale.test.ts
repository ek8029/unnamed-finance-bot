// tests/wash-sale.test.ts
// Pins the arithmetic the /tools/wash-sale-calculator page prints. Every figure
// here is worked by hand in the test name or a comment, because these are
// displayed dollars: a rounding slip shows up as a wrong number on a public
// page rather than as a failing assertion somewhere quiet.
import { describe, it, expect } from 'vitest';
import { computeWashSale, parseAmount } from '@/lib/wash-sale';

const SALE = { saleDate: '2026-06-15', sharesSold: 100, proceeds: 4000, costBasis: 5000 };

describe('the 61-day window', () => {
  it('runs 30 days either side of the sale, inclusive', () => {
    const r = computeWashSale({ ...SALE, buys: [] })!;
    expect(r.windowStart).toBe('2026-05-16');
    expect(r.windowEnd).toBe('2026-07-15');
    expect(r.dayAfterWindow).toBe('2026-07-16');
  });

  it('is 61 days wide', () => {
    const r = computeWashSale({ ...SALE, buys: [] })!;
    const days = (Date.parse(r.windowEnd) - Date.parse(r.windowStart)) / 86_400_000 + 1;
    expect(days).toBe(61);
  });

  it('catches a purchase on the first and last day of the window', () => {
    for (const date of ['2026-05-16', '2026-07-15']) {
      const r = computeWashSale({ ...SALE, buys: [{ date, shares: 100, cost: 4000 }] })!;
      expect(r.verdict).toBe('full');
      expect(r.outsideWindow).toHaveLength(0);
    }
  });

  it('catches a purchase on the sale date itself', () => {
    const r = computeWashSale({ ...SALE, buys: [{ date: '2026-06-15', shares: 100, cost: 4000 }] })!;
    expect(r.verdict).toBe('full');
  });

  it('leaves a purchase one day outside the window alone', () => {
    for (const date of ['2026-05-15', '2026-07-16']) {
      const r = computeWashSale({ ...SALE, buys: [{ date, shares: 100, cost: 4000 }] })!;
      expect(r.verdict).toBe('no-match');
      expect(r.disallowedLoss).toBe(0);
      expect(r.deductibleLoss).toBe(1000);
      expect(r.outsideWindow).toHaveLength(1);
    }
  });

  it('spans a leap day without drifting', () => {
    const r = computeWashSale({
      saleDate: '2028-03-01', sharesSold: 10, proceeds: 100, costBasis: 200, buys: [],
    })!;
    // 2028 is a leap year, so 30 days back from March 1 lands on January 31.
    expect(r.windowStart).toBe('2028-01-31');
    expect(r.windowEnd).toBe('2028-03-31');
  });
});

describe('a sale at a gain', () => {
  it('is not tested by §1091 no matter what was bought', () => {
    const r = computeWashSale({
      saleDate: '2026-06-15', sharesSold: 100, proceeds: 6000, costBasis: 5000,
      buys: [{ date: '2026-06-20', shares: 100, cost: 6000 }],
    })!;
    expect(r.verdict).toBe('gain');
    expect(r.realizedGain).toBe(1000);
    expect(r.realizedLoss).toBe(0);
    expect(r.disallowedLoss).toBe(0);
    expect(r.lots).toHaveLength(0);
  });
});

describe('disallowance in proportion to the shares replaced', () => {
  it('keeps the whole loss when nothing was bought', () => {
    const r = computeWashSale({ ...SALE, buys: [] })!;
    expect(r.verdict).toBe('no-match');
    expect(r.realizedLoss).toBe(1000);
    expect(r.deductibleLoss).toBe(1000);
    expect(r.sharesMatched).toBe(0);
  });

  // 100 shares sold at a $1,000 loss, 40 replaced: $400 out, $600 survives.
  it('disallows 40 percent of the loss when 40 of 100 shares are replaced', () => {
    const r = computeWashSale({ ...SALE, buys: [{ date: '2026-06-20', shares: 40, cost: 1600 }] })!;
    expect(r.verdict).toBe('partial');
    expect(r.sharesMatched).toBe(40);
    expect(r.disallowedLoss).toBe(400);
    expect(r.deductibleLoss).toBe(600);
    expect(r.lots[0].adjustedBasis).toBe(2000); // 1600 paid + 400 disallowed
  });

  it('disallows the whole loss when the share count is replaced', () => {
    const r = computeWashSale({ ...SALE, buys: [{ date: '2026-06-20', shares: 100, cost: 4200 }] })!;
    expect(r.verdict).toBe('full');
    expect(r.disallowedLoss).toBe(1000);
    expect(r.deductibleLoss).toBe(0);
    expect(r.lots[0].adjustedBasis).toBe(5200);
  });

  // Buying back more than was sold cannot disallow more than the loss, and the
  // extra shares take no adjustment.
  it('caps at the loss and reports the excess when 150 shares replace 100', () => {
    const r = computeWashSale({ ...SALE, buys: [{ date: '2026-06-20', shares: 150, cost: 6000 }] })!;
    expect(r.verdict).toBe('full');
    expect(r.sharesMatched).toBe(100);
    expect(r.excessShares).toBe(50);
    expect(r.disallowedLoss).toBe(1000);
    expect(r.lots[0].purchasedShares).toBe(150);
    expect(r.lots[0].replacementShares).toBe(100);
    expect(r.lots[0].cost).toBe(4000); // 6000 pro-rated to 100 of 150 shares
    expect(r.lots[0].adjustedBasis).toBe(5000);
  });

  it('counts a purchase made before the sale', () => {
    const r = computeWashSale({ ...SALE, buys: [{ date: '2026-06-01', shares: 100, cost: 4500 }] })!;
    expect(r.verdict).toBe('full');
    expect(r.disallowedLoss).toBe(1000);
  });
});

describe('matching in order of acquisition', () => {
  it('fills the earliest purchase first regardless of entry order', () => {
    const r = computeWashSale({
      ...SALE,
      buys: [
        { date: '2026-07-01', shares: 60, cost: 2400 },
        { date: '2026-06-20', shares: 60, cost: 2400 },
      ],
    })!;
    expect(r.lots.map((l) => l.date)).toEqual(['2026-06-20', '2026-07-01']);
    expect(r.lots[0].replacementShares).toBe(60);
    expect(r.lots[1].replacementShares).toBe(40); // only 40 left of the 100 sold
    expect(r.sharesMatched).toBe(100);
    expect(r.excessShares).toBe(20);
  });

  // A remainder that does not divide evenly must still add back to the total.
  // The odd penny goes to the largest fractional share, and to the earliest lot
  // when they tie, rather than to whichever lot happened to sort last. See
  // allocate() in lib/wash-sale.ts for why that distinction matters.
  it('allocates a $100 loss across three lots without losing a cent', () => {
    const r = computeWashSale({
      saleDate: '2026-06-15', sharesSold: 3, proceeds: 1000, costBasis: 1100,
      buys: [
        { date: '2026-06-16', shares: 1, cost: 300 },
        { date: '2026-06-17', shares: 1, cost: 300 },
        { date: '2026-06-18', shares: 1, cost: 300 },
      ],
    })!;
    expect(r.disallowedLoss).toBe(100);
    expect(r.lots.map((l) => l.basisAdded)).toEqual([33.34, 33.33, 33.33]);
    const summed = r.lots.reduce((n, l) => n + l.basisAdded, 0);
    expect(Math.round(summed * 100) / 100).toBe(100);
  });
});

describe('a purchase inside an IRA (Rev. Rul. 2008-5)', () => {
  it('disallows the loss and restores no basis anywhere', () => {
    const r = computeWashSale({
      ...SALE,
      acquiredDate: '2024-01-02',
      buys: [{ date: '2026-06-20', shares: 100, cost: 4200, retirement: true }],
    })!;
    expect(r.verdict).toBe('full');
    expect(r.disallowedLoss).toBe(1000);
    expect(r.deductibleLoss).toBe(0);
    expect(r.permanentlyLost).toBe(1000);
    expect(r.basisRestored).toBe(0);
    expect(r.lots[0].basisAdded).toBe(0);
    expect(r.lots[0].adjustedBasis).toBe(4200); // what was paid, and nothing more
    // Nothing tacks onto shares held inside a retirement account.
    expect(r.lots[0].holdingPeriodStart).toBeNull();
  });

  it('splits the disallowance when only one of two lots is in an IRA', () => {
    const r = computeWashSale({
      ...SALE,
      buys: [
        { date: '2026-06-20', shares: 50, cost: 2000 },
        { date: '2026-06-21', shares: 50, cost: 2000, retirement: true },
      ],
    })!;
    expect(r.disallowedLoss).toBe(1000);
    expect(r.basisRestored).toBe(500);
    expect(r.permanentlyLost).toBe(500);
  });
});

describe('holding-period tacking (§1223(3))', () => {
  // Held 365 days, bought back 14 days after the sale: the replacement shares
  // start their clock 365 days before that purchase.
  it('carries the sold lot days onto the replacement shares', () => {
    const r = computeWashSale({
      saleDate: '2026-01-01', sharesSold: 100, proceeds: 4000, costBasis: 5000,
      acquiredDate: '2025-01-01',
      buys: [{ date: '2026-01-15', shares: 100, cost: 4000 }],
    })!;
    expect(r.lots[0].daysTacked).toBe(365);
    expect(r.lots[0].holdingPeriodStart).toBe('2025-01-15');
    expect(r.lots[0].longTermFrom).toBe('2026-01-16');
  });

  it('reports nothing when the acquisition date was not supplied', () => {
    const r = computeWashSale({ ...SALE, buys: [{ date: '2026-06-20', shares: 100, cost: 4000 }] })!;
    expect(r.lots[0].holdingPeriodStart).toBeNull();
    expect(r.lots[0].daysTacked).toBe(0);
    expect(r.lots[0].longTermFrom).toBeNull();
  });
});

describe('input the tool refuses to price', () => {
  it.each([
    ['a malformed sale date', { ...SALE, saleDate: '06/15/2026', buys: [] }],
    ['a date that does not exist', { ...SALE, saleDate: '2026-02-31', buys: [] }],
    ['zero shares sold', { ...SALE, sharesSold: 0, buys: [] }],
    ['negative shares sold', { ...SALE, sharesSold: -5, buys: [] }],
    ['negative proceeds', { ...SALE, proceeds: -1, buys: [] }],
    ['a non-finite basis', { ...SALE, costBasis: Number.NaN, buys: [] }],
    ['an acquisition date after the sale', { ...SALE, acquiredDate: '2026-06-16', buys: [] }],
    ['a purchase with no shares', { ...SALE, buys: [{ date: '2026-06-20', shares: 0, cost: 100 }] }],
    ['a purchase with a bad date', { ...SALE, buys: [{ date: 'soon', shares: 10, cost: 100 }] }],
  ])('returns null for %s', (_label, input) => {
    expect(computeWashSale(input)).toBeNull();
  });

  it('accepts a sale for zero proceeds, which is a total loss', () => {
    const r = computeWashSale({ ...SALE, proceeds: 0, buys: [] })!;
    expect(r.realizedLoss).toBe(5000);
    expect(r.deductibleLoss).toBe(5000);
  });

  it('treats a break-even sale as a gain of zero, not a loss', () => {
    const r = computeWashSale({ ...SALE, proceeds: 5000, buys: [] })!;
    expect(r.verdict).toBe('gain');
    expect(r.realizedGain).toBe(0);
    expect(r.realizedLoss).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regressions. Each block below is a defect an adversarial review found in the
// first cut of this module, reproduced with the exact input that broke it. The
// original suite passed with every one of these live, because it only ever
// tested clean integer shares against evenly divisible losses.
// ─────────────────────────────────────────────────────────────────────────────

describe('allocating the disallowance across lots', () => {
  // Rounding each lot and dumping the residual on whichever sorted last made
  // that lot a plug rather than a figure: it printed -$0.01 of "loss added" and
  // a new basis BELOW what was paid, which §1091(d) can never produce.
  it('never prints a negative basis adjustment', () => {
    const r = computeWashSale({
      saleDate: '2026-06-15', sharesSold: 5, proceeds: 100, costBasis: 100.03,
      buys: [16, 17, 18, 19, 20].map((d) => ({ date: `2026-06-${d}`, shares: 1, cost: 20 })),
    })!;
    expect(r.disallowedLoss).toBe(0.03);
    for (const l of r.lots) {
      expect(l.basisAdded).toBeGreaterThanOrEqual(0);
      expect(l.adjustedBasis).toBeGreaterThanOrEqual(l.cost);
    }
    expect(r.lots.reduce((n, l) => n + l.basisAdded, 0)).toBeCloseTo(0.03, 10);
  });

  // 24 identical reinvestment lots used to get 23 of $0.01 and one of $0.12.
  // The page tells readers to enter DRIP purchases, so this is ordinary input.
  it('keeps identical lots within a cent of each other', () => {
    const r = computeWashSale({
      saleDate: '2026-06-15', sharesSold: 24, proceeds: 500, costBasis: 500.35,
      buys: Array.from({ length: 24 }, (_, i) => ({
        date: `2026-06-${String(16 + (i % 15)).padStart(2, '0')}`, shares: 1, cost: 20,
      })),
    })!;
    const added = r.lots.map((l) => l.basisAdded);
    expect(Math.max(...added) - Math.min(...added)).toBeLessThanOrEqual(0.01);
    expect(added.reduce((a, b) => a + b, 0)).toBeCloseTo(0.35, 10);
  });

  // The real contract of this module is that the parts reconcile. Asserting it
  // over randomised input is what would have caught the negative allocation.
  it('holds its reconciliation identities over 5,000 random cases', () => {
    let seed = 20260911;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const cents = (n: number) => Math.round(n * 100);

    for (let i = 0; i < 5000; i += 1) {
      const sharesSold = 1 + Math.floor(rnd() * 40);
      const costBasis = Math.round(rnd() * 200000) / 100;
      const proceeds = Math.round(rnd() * costBasis * 100) / 100;
      const lotCount = 1 + Math.floor(rnd() * 6);
      const buys = Array.from({ length: lotCount }, (_, k) => ({
        date: `2026-06-${String(16 + k).padStart(2, '0')}`,
        shares: 1 + Math.floor(rnd() * 12),
        cost: Math.round(rnd() * 50000) / 100,
        retirement: rnd() < 0.3,
      }));
      const r = computeWashSale({ saleDate: '2026-06-15', sharesSold, proceeds, costBasis, buys });
      expect(r).not.toBeNull();
      if (!r || r.verdict === 'gain') continue;

      expect(cents(r.disallowedLoss) + cents(r.deductibleLoss)).toBe(cents(r.realizedLoss));
      expect(cents(r.basisRestored) + cents(r.permanentlyLost)).toBe(cents(r.disallowedLoss));
      expect(r.lots.reduce((n, l) => n + cents(l.basisAdded), 0)).toBe(cents(r.basisRestored));
      for (const l of r.lots) {
        expect(l.basisAdded).toBeGreaterThanOrEqual(0);
        expect(cents(l.adjustedBasis)).toBe(cents(l.cost) + cents(l.basisAdded));
      }
      expect(r.sharesMatched).toBeLessThanOrEqual(sharesSold + 1e-9);
      expect(r.disallowedLoss).toBeLessThanOrEqual(r.realizedLoss);
    }
  });
});

describe('fractional shares', () => {
  // 0.05 + 0.35 sums to 0.39999999999999997, which read as 'partial' and put
  // "Part of the loss is disallowed" above a card saying $0.00 still deductible.
  it('treats a float-exact replacement as a full one', () => {
    const r = computeWashSale({
      saleDate: '2026-06-15', sharesSold: 0.4, proceeds: 400, costBasis: 1400,
      buys: [
        { date: '2026-06-16', shares: 0.05, cost: 50 },
        { date: '2026-06-17', shares: 0.35, cost: 350 },
      ],
    })!;
    expect(r.verdict).toBe('full');
    expect(r.disallowedLoss).toBe(1000);
    expect(r.deductibleLoss).toBe(0);
  });

  // 0.1 + 0.1 + 0.1 - 0.3 is 5.55e-17, which printed "You bought 0 shares more
  // than you sold" as a whole paragraph.
  it('reports no excess when the counts match exactly', () => {
    const r = computeWashSale({
      saleDate: '2026-06-15', sharesSold: 0.3, proceeds: 300, costBasis: 400,
      buys: [0, 1, 2].map((i) => ({ date: `2026-06-1${6 + i}`, shares: 0.1, cost: 100 })),
    })!;
    expect(r.excessShares).toBe(0);
    expect(r.verdict).toBe('full');
  });

  it.each([[0.8, 0.1, 0.7], [0.9, 0.2, 0.7], [0.9, 0.3, 0.6], [0.7, 0.05, 0.65]])(
    'matches %s split as %s plus %s without an epsilon gap',
    (sold, a, b) => {
      const r = computeWashSale({
        saleDate: '2026-06-15', sharesSold: sold, proceeds: 100, costBasis: 200,
        buys: [
          { date: '2026-06-16', shares: a, cost: 50 },
          { date: '2026-06-17', shares: b, cost: 50 },
        ],
      })!;
      expect(r.verdict).toBe('full');
      expect(r.excessShares).toBe(0);
    },
  );
});

describe('same-day purchases', () => {
  // Order of acquisition does not break a tie between two purchases on one
  // date, so entry order silently decided how much of the loss was destroyed
  // rather than deferred. It now says so on the page.
  it('flags that entry order settled the match', () => {
    const build = (retirementFirst: boolean) => computeWashSale({
      ...SALE,
      buys: retirementFirst
        ? [
            { date: '2026-06-20', shares: 60, cost: 2400, retirement: true },
            { date: '2026-06-20', shares: 60, cost: 2400 },
          ]
        : [
            { date: '2026-06-20', shares: 60, cost: 2400 },
            { date: '2026-06-20', shares: 60, cost: 2400, retirement: true },
          ],
    })!;
    expect(build(true).sameDateOrdering).toBe(true);
    expect(build(false).sameDateOrdering).toBe(true);
    // The swing the flag exists to disclose.
    expect(build(true).permanentlyLost).toBe(600);
    expect(build(false).permanentlyLost).toBe(400);
  });

  it('does not flag distinct dates', () => {
    const r = computeWashSale({
      ...SALE,
      buys: [
        { date: '2026-06-20', shares: 50, cost: 2000 },
        { date: '2026-06-21', shares: 50, cost: 2000 },
      ],
    })!;
    expect(r.sameDateOrdering).toBe(false);
  });
});

describe('holding-period edge cases', () => {
  it('reports no tacking when the lot was held zero days', () => {
    const r = computeWashSale({
      ...SALE, acquiredDate: '2026-06-15',
      buys: [{ date: '2026-06-20', shares: 100, cost: 4000 }],
    })!;
    expect(r.lots[0].daysTacked).toBe(0);
    expect(r.lots[0].holdingPeriodStart).toBeNull();
    expect(r.lots[0].longTermFrom).toBeNull();
  });

  // A long-held position replaced inside the window is long term the day the
  // replacement is bought, so the threshold date is in the past. The page must
  // say "already long term" rather than name a date years gone.
  it('marks a lot that is long term on the day it was bought', () => {
    const r = computeWashSale({
      ...SALE, acquiredDate: '2020-01-02',
      buys: [{ date: '2026-05-20', shares: 100, cost: 4000 }],
    })!;
    expect(r.lots[0].alreadyLongTerm).toBe(true);
    expect(r.lots[0].longTermFrom! < r.lots[0].date).toBe(true);
  });

  it('does not mark a short-held lot as already long term', () => {
    const r = computeWashSale({
      saleDate: '2026-01-01', sharesSold: 100, proceeds: 4000, costBasis: 5000,
      acquiredDate: '2025-01-01',
      buys: [{ date: '2026-01-15', shares: 100, cost: 4000 }],
    })!;
    expect(r.lots[0].alreadyLongTerm).toBe(false);
    expect(r.lots[0].longTermFrom).toBe('2026-01-16');
  });

  // Only the matched shares take the adjustment, so only they take the tacked
  // period. The page has to say which shares the sentence is about.
  it('scopes tacking to the replacement shares of a partly matched lot', () => {
    const r = computeWashSale({
      ...SALE, acquiredDate: '2025-01-02',
      buys: [{ date: '2026-06-20', shares: 150, cost: 6000 }],
    })!;
    expect(r.lots[0].purchasedShares).toBe(150);
    expect(r.lots[0].replacementShares).toBe(100);
    expect(r.lots[0].daysTacked).toBeGreaterThan(0);
  });
});

describe('amounts too large to price', () => {
  it.each([
    ['a basis that overflows the cent arithmetic', { ...SALE, costBasis: 1e307, buys: [] }],
    ['proceeds past the ceiling', { ...SALE, proceeds: 1e13, buys: [] }],
    ['a share count past the ceiling', { ...SALE, sharesSold: 1e10, buys: [] }],
    ['a purchase cost past the ceiling', { ...SALE, buys: [{ date: '2026-06-20', shares: 1, cost: 1e13 }] }],
  ])('refuses %s rather than printing Infinity or NaN', (_label, input) => {
    expect(computeWashSale(input)).toBeNull();
  });
});

describe('parseAmount, the step between a keystroke and a printed dollar', () => {
  it.each([
    ['4200', 4200],
    ['4,200.50', 4200.5],
    ['  4200  ', 4200],
    ['$4,200', 4200],
    ['0.35', 0.35],
    ['1,234,567', 1234567],
    ['0', 0],
  ])('reads %s as %s', (raw, want) => {
    expect(parseAmount(raw as string)).toBe(want);
  });

  // Every one of these used to come back as a different valid number, which is
  // worse than a rejection: the page printed a figure and said nothing.
  it.each([
    ['1,5', 'a decimal comma, which used to read as 15'],
    ['-100', 'a negative, whose sign used to be dropped'],
    ['1e3', 'exponent notation, which used to read as 13'],
    ['1/2', 'a fraction, which used to read as 12'],
    ['(5,000)', 'accounting parentheses'],
    ['100%', 'a percent sign'],
    ['1.234.567', 'two decimal points'],
    ['12..5', 'a doubled decimal point'],
    ['abc', 'letters'],
    ['', 'blank'],
    ['   ', 'whitespace'],
  ])('refuses %s (%s)', (raw) => {
    expect(parseAmount(raw as string)).toBeNull();
  });
});
