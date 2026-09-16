// tests/capital-gains.test.ts
// Pins the arithmetic the /tools/capital-gains-calculator page prints. Every
// figure is worked by hand in the test name or a comment, from the 2026 tables
// in Rev. Proc. 2025-32 (irs.gov/pub/irs-drop/rp-25-32.pdf): single 0 percent
// up to $49,450 and 15 percent up to $545,500; joint $98,900 / $613,700;
// separate $49,450 / $306,850; head of household $66,200 / $579,600.
import { describe, it, expect } from 'vitest';
import { computeCapitalGainsTax, parseAmount, TAX_YEARS, type CapitalGainsInput } from '@/lib/capital-gains';

const SINGLE: CapitalGainsInput = { year: 2026, filingStatus: 'single', ordinaryIncome: 0, shortTerm: 0, longTerm: 0 };
const cents = (n: number) => Math.round(n * 100);

describe('the bracket constants reproduce the Rev. Proc. 2025-32 tax tables', () => {
  // Section 3.01 prints the cumulative tax at the top of the 35 percent
  // bracket as the constant in the 37 percent row. If any threshold or rate
  // in the table is wrong, this figure moves.
  it.each([
    ['single', 640_600, 192_979.25],
    ['mfj', 768_700, 206_583.5],
    ['hoh', 640_600, 191_171],
    ['mfs', 384_350, 103_291.75],
  ] as const)('%s: tax on $%s of ordinary income is $%s', (filingStatus, income, want) => {
    const r = computeCapitalGainsTax({ ...SINGLE, filingStatus, ordinaryIncome: income })!;
    expect(r.taxOnOrdinaryIncome).toBe(want);
  });

  // The 22 percent row: $5,800 at $50,400 for single, $11,600 at $100,800 joint.
  it('matches the 22 percent row constants', () => {
    expect(computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 50_400 })!.taxOnOrdinaryIncome).toBe(5_800);
    expect(computeCapitalGainsTax({ ...SINGLE, filingStatus: 'mfj', ordinaryIncome: 100_800 })!.taxOnOrdinaryIncome).toBe(11_600);
    expect(computeCapitalGainsTax({ ...SINGLE, filingStatus: 'hoh', ordinaryIncome: 67_450 })!.taxOnOrdinaryIncome).toBe(7_740);
  });
});

describe('a long-term gain stacked on ordinary income', () => {
  it('is entirely at 0 percent with no other income', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, longTerm: 40_000 })!;
    expect(r.longTermTax).toBe(0);
    expect(r.totalTax).toBe(0);
    expect(r.longTermPieces).toEqual([{ kind: 'long-term', rate: 0, from: 0, to: 40_000, amount: 40_000, tax: 0 }]);
    expect(r.effectiveRate).toBe(0);
  });

  it('stays at 0 percent exactly at the $49,450 ceiling', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, longTerm: 49_450 })!;
    expect(r.longTermTax).toBe(0);
    expect(r.longTermPieces).toHaveLength(1);
  });

  it('puts the dollar past the ceiling at 15 percent', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, longTerm: 49_451 })!;
    expect(r.longTermPieces.map((p) => [p.rate, p.amount])).toEqual([[0, 49_450], [0.15, 1]]);
    expect(r.longTermTax).toBe(0.15);
  });

  // $30,000 of income fills the 0 percent band up to $49,450, so $19,450 of the
  // gain is at 0 and the other $10,550 at 15 percent: $1,582.50.
  it('splits a gain that straddles the 0 and 15 percent bands', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 30_000, longTerm: 30_000 })!;
    expect(r.longTermPieces.map((p) => [p.rate, p.from, p.to, p.amount, p.tax])).toEqual([
      [0, 30_000, 49_450, 19_450, 0],
      [0.15, 49_450, 60_000, 10_550, 1_582.5],
    ]);
    expect(r.longTermTax).toBe(1_582.5);
    expect(r.niit).toBe(0);
    expect(r.totalTax).toBe(1_582.5);
  });

  // Base $100,000. $445,500 at 15 percent to reach $545,500 = $66,825, then
  // $54,500 at 20 percent = $10,900. NIIT: MAGI $600,000 less $200,000 is
  // $400,000, under the $500,000 gain, so $400,000 x 3.8 percent = $15,200.
  it('splits a gain across 15 and 20 percent and adds the NIIT', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 100_000, longTerm: 500_000 })!;
    expect(r.longTermPieces.map((p) => [p.rate, p.amount, p.tax])).toEqual([
      [0.15, 445_500, 66_825],
      [0.2, 54_500, 10_900],
    ]);
    expect(r.longTermTax).toBe(77_725);
    expect(r.niitBase).toBe(400_000);
    expect(r.niit).toBe(15_200);
    expect(r.totalTax).toBe(92_925);
    expect(r.effectiveRate).toBeCloseTo(0.18585, 10);
  });

  it('is all 20 percent when ordinary income already exceeds the 15 percent ceiling', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 600_000, longTerm: 10_000 })!;
    expect(r.longTermPieces).toEqual([{ kind: 'long-term', rate: 0.2, from: 600_000, to: 610_000, amount: 10_000, tax: 2_000 }]);
    expect(r.niit).toBe(380);
    expect(r.totalTax).toBe(2_380);
  });

  // Joint: $80,000 fills the 0 percent band to $98,900, leaving $18,900 at 0
  // and $31,100 at 15 percent = $4,665.
  it('uses the joint thresholds for married filing jointly', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, filingStatus: 'mfj', ordinaryIncome: 80_000, longTerm: 50_000 })!;
    expect(r.longTermPieces.map((p) => [p.rate, p.amount])).toEqual([[0, 18_900], [0.15, 31_100]]);
    expect(r.longTermTax).toBe(4_665);
  });

  it('uses the head of household ceiling of $66,200', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, filingStatus: 'hoh', ordinaryIncome: 66_200, longTerm: 1_000 })!;
    expect(r.longTermPieces.map((p) => [p.rate, p.amount])).toEqual([[0.15, 1_000]]);
    expect(r.longTermTax).toBe(150);
  });

  // Separate: base $300,000, $6,850 at 15 percent to $306,850 = $1,027.50,
  // $13,150 at 20 percent = $2,630. NIIT on the whole $20,000 = $760.
  it('uses the separate 15 percent ceiling of $306,850 and the $125,000 NIIT threshold', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, filingStatus: 'mfs', ordinaryIncome: 300_000, longTerm: 20_000 })!;
    expect(r.longTermPieces.map((p) => [p.rate, p.amount, p.tax])).toEqual([[0.15, 6_850, 1_027.5], [0.2, 13_150, 2_630]]);
    expect(r.niitThreshold).toBe(125_000);
    expect(r.niit).toBe(760);
    expect(r.totalTax).toBe(4_417.5);
  });
});

describe('a short-term gain at the ordinary brackets', () => {
  it('is taxed at 10 percent with no other income', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, shortTerm: 10_000 })!;
    expect(r.shortTermPieces).toEqual([{ kind: 'short-term', rate: 0.1, from: 0, to: 10_000, amount: 10_000, tax: 1_000 }]);
    expect(r.totalTax).toBe(1_000);
  });

  // $10,000 of income leaves $2,400 of the 10 percent bracket (to $12,400):
  // $240, then $2,600 at 12 percent: $312.
  it('splits a gain that straddles the 10 and 12 percent brackets', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 10_000, shortTerm: 5_000 })!;
    expect(r.shortTermPieces.map((p) => [p.rate, p.from, p.to, p.amount, p.tax])).toEqual([
      [0.1, 10_000, 12_400, 2_400, 240],
      [0.12, 12_400, 15_000, 2_600, 312],
    ]);
    expect(r.shortTermTax).toBe(552);
  });

  it('is taxed at 37 percent above $640,600, plus the NIIT', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 640_600, shortTerm: 1_000 })!;
    expect(r.shortTermPieces.map((p) => [p.rate, p.tax])).toEqual([[0.37, 370]]);
    expect(r.niit).toBe(38);
    expect(r.totalTax).toBe(408);
  });

  // The long-term gain stacks on top of the short-term gain, not beside it.
  // Base $40,000 + $10,000 short-term = $50,000, past the $49,450 ceiling, so
  // none of the long-term gain reaches 0 percent. Stacked on ordinary income
  // alone, $9,450 of it would have.
  it('stacks the long-term gain on top of the short-term gain', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 40_000, shortTerm: 10_000, longTerm: 10_000 })!;
    expect(r.shortTermPieces.map((p) => [p.rate, p.amount, p.tax])).toEqual([[0.12, 10_000, 1_200]]);
    expect(r.longTermPieces.map((p) => [p.rate, p.from, p.amount, p.tax])).toEqual([[0.15, 50_000, 10_000, 1_500]]);
    expect(r.totalTax).toBe(2_700);
  });
});

describe('the net investment income tax threshold', () => {
  it('is not owed when MAGI lands exactly on $200,000', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 190_000, longTerm: 10_000 })!;
    expect(r.magi).toBe(200_000);
    expect(r.niitBase).toBe(0);
    expect(r.niit).toBe(0);
    expect(r.totalTax).toBe(1_500);
  });

  it('applies to the first dollar over the threshold', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 190_000, longTerm: 10_001 })!;
    expect(r.niitBase).toBe(1);
    expect(r.niit).toBe(0.04); // 3.8 cents, printed to the nearest cent
  });

  it('is capped at the gain when the excess over the threshold is larger', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 300_000, longTerm: 5_000 })!;
    expect(r.niitBase).toBe(5_000);
    expect(r.niit).toBe(190);
  });

  it('is capped at the excess when the gain is larger', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 195_000, longTerm: 50_000 })!;
    expect(r.niitBase).toBe(45_000);
    expect(r.niit).toBe(1_710);
  });

  it('uses $250,000 for married filing jointly and $200,000 for head of household', () => {
    expect(computeCapitalGainsTax({ ...SINGLE, filingStatus: 'mfj', ordinaryIncome: 240_000, longTerm: 10_000 })!.niit).toBe(0);
    expect(computeCapitalGainsTax({ ...SINGLE, filingStatus: 'mfj', ordinaryIncome: 240_000, longTerm: 10_001 })!.niitBase).toBe(1);
    expect(computeCapitalGainsTax({ ...SINGLE, filingStatus: 'hoh', ordinaryIncome: 190_000, longTerm: 10_001 })!.niitBase).toBe(1);
  });
});

describe('netting a gain against a loss (§1222)', () => {
  it('offsets a long-term gain with a short-term loss and keeps the remainder long-term', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, shortTerm: -5_000, longTerm: 20_000 })!;
    expect(r.netShortTermGain).toBe(0);
    expect(r.netLongTermGain).toBe(15_000);
    expect(r.netGain).toBe(15_000);
    expect(r.netCapitalLoss).toBe(0);
    expect(r.totalTax).toBe(0); // all inside the 0 percent band
  });

  it('offsets a short-term gain with a long-term loss and keeps the remainder short-term', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, shortTerm: 20_000, longTerm: -5_000 })!;
    expect(r.netShortTermGain).toBe(15_000);
    expect(r.netLongTermGain).toBe(0);
    expect(r.shortTermPieces.map((p) => [p.rate, p.amount])).toEqual([[0.1, 12_400], [0.12, 2_600]]);
  });

  it('nets to a long-term loss when the long-term loss exceeds the short-term gain', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, shortTerm: 10_000, longTerm: -30_000 })!;
    expect(r.netGain).toBe(0);
    expect(r.netCapitalLoss).toBe(20_000);
    expect(r.lossDeduction).toBe(3_000);
    expect(r.carryoverShortTerm).toBe(0);
    expect(r.carryoverLongTerm).toBe(17_000);
    expect(r.carryover).toBe(17_000);
    expect(r.totalTax).toBe(0);
    expect(r.shortTermPieces).toHaveLength(0);
    expect(r.longTermPieces).toHaveLength(0);
  });
});

describe('the capital loss deduction and carryover (§1211(b), §1212(b))', () => {
  // The $3,000 absorbs the short-term loss first, then $1,000 of the
  // long-term loss, leaving $3,000 of long-term loss to carry.
  it('absorbs the short-term loss first when both characters are losses', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, shortTerm: -2_000, longTerm: -4_000 })!;
    expect(r.netCapitalLoss).toBe(6_000);
    expect(r.lossDeduction).toBe(3_000);
    expect(r.carryoverShortTerm).toBe(0);
    expect(r.carryoverLongTerm).toBe(3_000);
  });

  it('caps the deduction at $1,500 for married filing separately', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, filingStatus: 'mfs', shortTerm: -5_000 })!;
    expect(r.lossCap).toBe(1_500);
    expect(r.lossDeduction).toBe(1_500);
    expect(r.carryoverShortTerm).toBe(3_500);
    expect(r.carryover).toBe(3_500);
  });

  it('deducts a loss under the cap in full with nothing to carry', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, longTerm: -1_000 })!;
    expect(r.lossDeduction).toBe(1_000);
    expect(r.carryover).toBe(0);
  });

  // $100,000 sits in the 22 percent bracket ($50,400 to $105,700), so $3,000
  // less ordinary income saves $660. At $12,400 the deduction reaches into the
  // 10 percent bracket: tax $1,240 becomes tax on $9,400, $940, saving $300.
  it('reports the ordinary tax the deduction removes', () => {
    expect(computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 100_000, longTerm: -3_000 })!.ordinaryTaxReduction).toBe(660);
    expect(computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 12_400, longTerm: -3_000 })!.ordinaryTaxReduction).toBe(300);
    expect(computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 0, longTerm: -3_000 })!.ordinaryTaxReduction).toBe(0);
  });

  it('owes no NIIT in a loss year', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 300_000, longTerm: -3_000 })!;
    expect(r.niit).toBe(0);
    expect(r.totalTax).toBe(0);
  });
});

describe('edge input', () => {
  it('returns zeros and no pieces when nothing was entered', () => {
    const r = computeCapitalGainsTax(SINGLE)!;
    expect(r.netGain).toBe(0);
    expect(r.totalTax).toBe(0);
    expect(r.effectiveRate).toBe(0);
    expect(r.shortTermPieces).toHaveLength(0);
    expect(r.longTermPieces).toHaveLength(0);
    expect(r.lossDeduction).toBe(0);
  });

  it('rounds a fractional gain to cents before slicing', () => {
    const r = computeCapitalGainsTax({ ...SINGLE, ordinaryIncome: 49_450, longTerm: 100.005 })!;
    expect(r.netLongTermGain).toBe(100.01);
    expect(r.longTermTax).toBe(15);
  });

  it.each([
    ['a negative ordinary income', { ...SINGLE, ordinaryIncome: -1 }],
    ['a non-finite ordinary income', { ...SINGLE, ordinaryIncome: Number.NaN }],
    ['an infinite gain', { ...SINGLE, longTerm: Infinity }],
    ['a gain past the ceiling', { ...SINGLE, shortTerm: 1e13 }],
    ['a loss past the ceiling', { ...SINGLE, longTerm: -1e13 }],
    ['a year with no fetched figures', { ...SINGLE, year: 2025 as unknown as 2026 }],
    ['an unknown filing status', { ...SINGLE, filingStatus: 'qw' as unknown as 'single' }],
  ])('returns null for %s', (_label, input) => {
    expect(computeCapitalGainsTax(input)).toBeNull();
  });

  it('re-exports the shared parseAmount', () => {
    expect(parseAmount('4,200.50')).toBe(4200.5);
    expect(parseAmount('-100')).toBeNull();
  });
});

describe('reconciliation identities over random input', () => {
  it('total tax equals the sum of the per-bracket pieces plus the NIIT, over 5,000 cases', () => {
    let seed = 20260916;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const statuses = ['single', 'mfj', 'mfs', 'hoh'] as const;

    for (let i = 0; i < 5000; i += 1) {
      const input: CapitalGainsInput = {
        year: 2026,
        filingStatus: statuses[Math.floor(rnd() * 4)],
        ordinaryIncome: Math.round(rnd() * 90_000_000) / 100,
        shortTerm: Math.round((rnd() - 0.3) * 50_000_000) / 100,
        longTerm: Math.round((rnd() - 0.3) * 100_000_000) / 100,
      };
      const r = computeCapitalGainsTax(input);
      expect(r).not.toBeNull();
      if (!r) continue;

      const pieceTax = [...r.shortTermPieces, ...r.longTermPieces].reduce((n, p) => n + cents(p.tax), 0);
      expect(cents(r.totalTax)).toBe(pieceTax + cents(r.niit));
      expect(cents(r.shortTermTax)).toBe(r.shortTermPieces.reduce((n, p) => n + cents(p.tax), 0));
      expect(cents(r.longTermTax)).toBe(r.longTermPieces.reduce((n, p) => n + cents(p.tax), 0));

      // The slices cover the gain exactly, in order, without gaps.
      expect(r.shortTermPieces.reduce((n, p) => n + cents(p.amount), 0)).toBe(cents(r.netShortTermGain));
      expect(r.longTermPieces.reduce((n, p) => n + cents(p.amount), 0)).toBe(cents(r.netLongTermGain));
      for (const p of [...r.shortTermPieces, ...r.longTermPieces]) {
        expect(p.amount).toBeGreaterThan(0);
        expect(cents(p.to - p.from)).toBe(cents(p.amount));
        // Within a cent: the library rounds amount x rate once, and a half-cent
        // tie can fall either way in floating point.
        expect(Math.abs(cents(p.tax) - cents(p.amount) * p.rate)).toBeLessThanOrEqual(1);
      }
      if (r.longTermPieces.length > 0) {
        expect(r.longTermPieces[0].from).toBe(Math.round((r.ordinaryIncome + r.netShortTermGain) * 100) / 100);
      }

      // Netting: exactly one of gain and loss is live, and the loss splits
      // between the deduction and the carryover without losing a cent.
      expect(r.netGain === 0 || r.netCapitalLoss === 0).toBe(true);
      expect(cents(r.lossDeduction) + cents(r.carryover)).toBe(cents(r.netCapitalLoss));
      expect(cents(r.carryoverShortTerm) + cents(r.carryoverLongTerm)).toBe(cents(r.carryover));
      expect(r.lossDeduction).toBeLessThanOrEqual(TAX_YEARS[2026].lossCap[input.filingStatus]);
      expect(r.niitBase).toBeLessThanOrEqual(r.netGain);
      expect(r.totalTax).toBeGreaterThanOrEqual(0);
    }
  });
});
