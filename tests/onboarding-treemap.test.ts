import { describe, it, expect } from 'vitest';
import { squarify } from '@/lib/onboarding/treemap';

const totalArea = (tiles: { w: number; h: number }[]) => tiles.reduce((n, t) => n + t.w * t.h, 0);

describe('squarify', () => {
  it('fills the whole box', () => {
    const tiles = squarify([9, 7, 6, 4, 3, 1], 300, 120);
    expect(totalArea(tiles)).toBeCloseTo(300 * 120, 4);
  });

  it('gives each tile area in proportion to its value', () => {
    const tiles = squarify([3, 1], 200, 100);
    const byIndex = new Map(tiles.map((t) => [t.index, t.w * t.h]));
    expect(byIndex.get(0)! / byIndex.get(1)!).toBeCloseTo(3, 4);
  });

  it('keeps every tile inside the box', () => {
    for (const t of squarify([12, 8, 5, 5, 3, 2, 2, 1, 1, 1], 300, 120)) {
      expect(t.x).toBeGreaterThanOrEqual(-1e-6);
      expect(t.y).toBeGreaterThanOrEqual(-1e-6);
      expect(t.x + t.w).toBeLessThanOrEqual(300 + 1e-6);
      expect(t.y + t.h).toBeLessThanOrEqual(120 + 1e-6);
    }
  });

  it('does not overlap', () => {
    const tiles = squarify([9, 7, 6, 4, 3, 2, 1], 300, 120);
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i];
        const b = tiles[j];
        const gap = a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 || a.y + a.h <= b.y + 1e-6 || b.y + b.h <= a.y + 1e-6;
        expect(gap, `tiles ${i} and ${j} overlap`).toBe(true);
      }
    }
  });

  it('orders tiles largest first and carries the original index', () => {
    const tiles = squarify([1, 9, 4], 100, 100);
    expect(tiles.map((t) => t.index)).toEqual([1, 2, 0]);
  });

  it('drops values that cannot be drawn, and returns nothing when none can', () => {
    expect(squarify([5, 0, -2, Number.NaN], 100, 100).map((t) => t.index)).toEqual([0]);
    expect(squarify([], 100, 100)).toEqual([]);
    expect(squarify([0, 0], 100, 100)).toEqual([]);
    expect(squarify([1, 2], 0, 100)).toEqual([]);
  });

  it('keeps tiles roughly square rather than slivered', () => {
    const tiles = squarify([10, 9, 8, 7, 6, 5, 4, 3], 300, 200);
    const worst = Math.max(...tiles.map((t) => Math.max(t.w / t.h, t.h / t.w)));
    expect(worst).toBeLessThan(4);
  });
});
