import { describe, it, expect } from 'vitest';
import { estimateCappedTlhSavings, estimateTaxOnRealizedGains } from '@/lib/tax-math';

// Schedule D netting per IRC §1222/§1211(b)/§1212(b) — worked examples.
// ord = 32%, ltcg = 15% passed explicitly so config changes don't move tests.
const RATES = { ordinaryRate: 0.32, ltcgRate: 0.15 };

describe('estimateCappedTlhSavings — netted Schedule D math', () => {
  it('ST loss offsets ST gain at the ordinary rate; remainder deducts up to $3k', () => {
    const r = estimateCappedTlhSavings({ stLoss: 10_000, stGainYtd: 8_000, ltGainYtd: 0, ...RATES });
    // 8,000 × .32 + 2,000 (≤ $3k) × .32
    expect(r.cappedSavings).toBeCloseTo(2_560 + 640, 6);
    expect(r.deductibleThisYear).toBe(2_000);
    expect(r.estimatedCarryforward).toBe(0);
  });

  it('LT loss offsets LT gain at the LTCG rate', () => {
    const r = estimateCappedTlhSavings({ ltLoss: 5_000, stGainYtd: 0, ltGainYtd: 10_000, ...RATES });
    expect(r.cappedSavings).toBeCloseTo(5_000 * 0.15, 6);
    expect(r.deductibleThisYear).toBe(0);
  });

  it('cross-netting: excess ST loss absorbing LT gain saves at the LTCG rate, not ordinary', () => {
    const r = estimateCappedTlhSavings({ stLoss: 10_000, stGainYtd: 0, ltGainYtd: 6_000, ...RATES });
    // 6,000 × .15 (gain absorbed at ITS rate) + 3,000 deduction × .32; 1,000 carries
    expect(r.cappedSavings).toBeCloseTo(900 + 960, 6);
    expect(r.estimatedCarryforward).toBe(1_000);
  });

  it('cross-netting: excess LT loss absorbing ST gain saves at the ordinary rate', () => {
    const r = estimateCappedTlhSavings({ ltLoss: 5_000, stGainYtd: 5_000, ltGainYtd: 0, ...RATES });
    expect(r.cappedSavings).toBeCloseTo(5_000 * 0.32, 6);
  });

  it('unknown-character losses fold into LT (conservative: low-rate absorption first)', () => {
    const r = estimateCappedTlhSavings({ unknownLoss: 5_000, stGainYtd: 5_000, ltGainYtd: 5_000, ...RATES });
    // LT treatment: absorbs LT gain first → 5,000 × .15. (ST treatment would give .32.)
    expect(r.cappedSavings).toBeCloseTo(750, 6);
  });

  it('already-realized YTD losses enter the netting but are not credited to the harvest', () => {
    const r = estimateCappedTlhSavings({ stLoss: 1_000, stGainYtd: -2_000, ltGainYtd: 0, ...RATES });
    // Pool 3,000, no gains → full $3k deduction at ordinary = $960 for the whole
    // position. $640 of that the user already had from the $2,000 realized YTD,
    // so the MARGINAL benefit of harvesting the extra $1,000 is 1,000 x .32.
    expect(r.totalPositionSavings).toBeCloseTo(3_000 * 0.32, 6);
    expect(r.baselineSavings).toBeCloseTo(2_000 * 0.32, 6);
    expect(r.cappedSavings).toBeCloseTo(1_000 * 0.32, 6);
    expect(r.estimatedCarryforward).toBe(0);
  });

  it('§1211(b) cap already consumed: a further harvest saves nothing this year', () => {
    // $10,000 already realized as a net ST loss fills the $3,000 cap on its own.
    const r = estimateCappedTlhSavings({ ltLoss: 500, stGainYtd: -10_000, ltGainYtd: 0, ...RATES });
    expect(r.baselineSavings).toBeCloseTo(960, 6);
    expect(r.totalPositionSavings).toBeCloseTo(960, 6);
    expect(r.cappedSavings).toBe(0);
    // The harvested $500 still adds to the §1212(b) carryforward.
    expect(r.estimatedCarryforward).toBe(7_500);
  });

  it('exposes the §1211(b) waterfall for the harvest ladder', () => {
    const r = estimateCappedTlhSavings({ ltLoss: 20_000, stGainYtd: 0, ltGainYtd: 5_000, ...RATES });
    expect(r.gainsOffset).toBe(5_000);          // uncapped
    expect(r.ordinaryIncomeOffset).toBe(3_000); // annual cap
    expect(r.carryforward).toBe(12_000);        // §1212(b)
  });

  it('$3,000 cap binds; excess carries forward', () => {
    const r = estimateCappedTlhSavings({ ltLoss: 10_000, stGainYtd: 0, ltGainYtd: 0, ...RATES });
    expect(r.cappedSavings).toBeCloseTo(960, 6);
    expect(r.estimatedCarryforward).toBe(7_000);
    expect(r.remainingDeductibleLoss).toBe(0);
  });

  it('gains fully absorb losses: no deduction, no carryforward', () => {
    const r = estimateCappedTlhSavings({ stLoss: 3_000, ltLoss: 2_000, stGainYtd: 10_000, ltGainYtd: 5_000, ...RATES });
    expect(r.cappedSavings).toBeCloseTo(3_000 * 0.32 + 2_000 * 0.15, 6);
    expect(r.deductibleThisYear).toBe(0);
    expect(r.estimatedCarryforward).toBe(0);
    expect(r.remainingDeductibleLoss).toBe(3_000);
  });
});

describe('estimateTaxOnRealizedGains — IRC §1222(11) netting', () => {
  it('taxes each character at its own rate when both are net gains', () => {
    expect(estimateTaxOnRealizedGains({ stNet: 10_000, ltNet: 20_000, ...RATES }))
      .toBeCloseTo(10_000 * 0.32 + 20_000 * 0.15, 6);
  });

  it('a net short-term LOSS offsets long-term gain before any rate applies', () => {
    // The bug: max(0,-10_000)*.32 + 20_000*.15 = $3,000. Correct: 10,000 x .15.
    expect(estimateTaxOnRealizedGains({ stNet: -10_000, ltNet: 20_000, ...RATES }))
      .toBeCloseTo(1_500, 6);
  });

  it('a net long-term loss offsets short-term gain at the ordinary rate', () => {
    expect(estimateTaxOnRealizedGains({ stNet: 20_000, ltNet: -5_000, ...RATES }))
      .toBeCloseTo(15_000 * 0.32, 6);
  });

  it('a net capital loss owes nothing', () => {
    expect(estimateTaxOnRealizedGains({ stNet: -5_000, ltNet: 1_000, ...RATES })).toBe(0);
  });

  it('long-term-only gains are never taxed at the ordinary rate', () => {
    // The analyze-route bug quoted $16,000 on this book; §1(h) says $7,500.
    expect(estimateTaxOnRealizedGains({ stNet: 0, ltNet: 50_000, ...RATES }))
      .toBeCloseTo(7_500, 6);
  });
});
