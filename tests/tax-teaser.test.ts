import { describe, it, expect } from 'vitest';
import { readTeaser } from '@/components/tax-teaser';

/**
 * The sign convention, pinned.
 *
 * `totalHarvestableLoss` is signed and a loss is NEGATIVE. The first version of
 * the teaser checked `> 0` and would have told every user with harvestable
 * losses that they had none, including a live account holding $137,028.20 of
 * them, on the exact screen that asks for money. The real values below were
 * read off production accounts.
 */
describe('readTeaser', () => {
  it('treats a negative total as harvestable and shows its magnitude', () => {
    const r = readTeaser({ totalHarvestableLoss: -137028.2, opportunityCount: 6 });
    expect(r.hasLosses).toBe(true);
    expect(r.harvestable).toBeCloseTo(137028.2, 2);
  });

  it.each([
    ['Ben', -1116.57, 3],
    ['Paul', -20702.97, 1],
    ['svbmn', -3374.98, 14],
  ])('reports harvestable for the real %s figure', (_who, total, count) => {
    const r = readTeaser({ totalHarvestableLoss: total as number, opportunityCount: count as number });
    expect(r.hasLosses).toBe(true);
    expect(r.harvestable).toBeGreaterThan(0);
  });

  it('reports a genuine zero as nothing to harvest', () => {
    const r = readTeaser({ totalHarvestableLoss: 0, opportunityCount: 0 });
    expect(r.hasLosses).toBe(false);
    expect(r.harvestable).toBe(0);
  });

  it('does not claim losses when no positions qualify, whatever the total says', () => {
    // opportunityCount is the field that means "positions that qualify". If it
    // is zero, there is nothing to show regardless of the total.
    const r = readTeaser({ totalHarvestableLoss: -500, opportunityCount: 0 });
    expect(r.hasLosses).toBe(false);
  });

  it('survives a missing or malformed payload without claiming a figure', () => {
    const r = readTeaser({ totalHarvestableLoss: undefined as never, opportunityCount: undefined as never });
    expect(r.hasLosses).toBe(false);
    expect(r.harvestable).toBe(0);
  });

  it('would fail the naive greater-than-zero check, which is the point', () => {
    // Guard against someone "simplifying" this back to `total > 0`.
    const real = -137028.2;
    expect(real > 0).toBe(false);
    expect(readTeaser({ totalHarvestableLoss: real, opportunityCount: 6 }).hasLosses).toBe(true);
  });
});
