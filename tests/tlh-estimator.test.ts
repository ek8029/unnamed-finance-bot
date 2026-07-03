import { describe, it, expect } from 'vitest';
import { estimateCappedTlhSavings } from '@/lib/tax-analysis';

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

  it('negative YTD nets (already-realized losses) join the loss pools', () => {
    const r = estimateCappedTlhSavings({ stLoss: 1_000, stGainYtd: -2_000, ltGainYtd: 0, ...RATES });
    // Pool 3,000, no gains → full $3k deduction at ordinary; nothing carries.
    expect(r.cappedSavings).toBeCloseTo(3_000 * 0.32, 6);
    expect(r.estimatedCarryforward).toBe(0);
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
