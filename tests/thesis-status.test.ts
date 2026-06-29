import { describe, it, expect } from 'vitest';
import {
  computePillarStatus,
  computeThesisHealth,
  type StatusCatch,
  NORMALIZER,
  SOURCE_WEIGHT,
} from '../lib/content/thesis-status';

const TODAY = '2026-06-28';

function c(verdict: 'supports' | 'contradicts', dateISO: string, source: 'filing' | 'major_news' | 'minor_news' = 'filing'): StatusCatch {
  return { verdict, dateISO, source_type: source };
}

describe('computePillarStatus', () => {
  it('no catches -> unverified', () => {
    const r = computePillarStatus([], TODAY);
    expect(r.status).toBe('unverified');
    expect(r.inWindow).toBe(0);
    expect(r.score).toBe(0);
  });

  it('only out-of-window support (>365d) -> unverified', () => {
    const r = computePillarStatus([c('supports', '2025-01-01')], TODAY); // ~543d old
    expect(r.status).toBe('unverified');
    expect(r.inWindow).toBe(0);
  });

  it('single fresh filing support -> intact, score ~ +1.0', () => {
    const r = computePillarStatus([c('supports', TODAY)], TODAY);
    expect(r.status).toBe('intact');
    expect(r.score).toBeCloseTo(1.0, 5);
  });

  it('single fresh filing contradiction -> weakening, score ~ -1.0', () => {
    const r = computePillarStatus([c('contradicts', TODAY)], TODAY);
    expect(r.score).toBeCloseTo(-1.0, 5);
    expect(r.status).toBe('weakening');
  });

  it('two fresh filing contradictions -> broken, score ~ -2.0', () => {
    const r = computePillarStatus([c('contradicts', TODAY), c('contradicts', TODAY)], TODAY);
    expect(r.score).toBeCloseTo(-2.0, 5);
    expect(r.status).toBe('broken');
  });

  it('multiple recent supports -> intact', () => {
    const r = computePillarStatus(
      [c('supports', TODAY), c('supports', '2026-06-20'), c('supports', '2026-05-01')],
      TODAY,
    );
    expect(r.status).toBe('intact');
    expect(r.inWindow).toBe(3);
  });

  it('recency override: a fresh filing contradiction floors at weakening even amid older supports', () => {
    // 3 older supports (still positive sum) + 1 fresh filing contradiction.
    const r = computePillarStatus(
      [
        c('supports', '2026-04-01'),
        c('supports', '2026-03-01'),
        c('supports', '2026-02-01'),
        c('contradicts', TODAY),
      ],
      TODAY,
    );
    // Without override the score may still bucket softer; override guarantees >= weakening.
    expect(['weakening', 'broken']).toContain(r.status);
  });

  it('override does NOT apply when the fresh contradiction is news, not a filing', () => {
    // Strong fresh filing support + a fresh minor-news contradiction: should stay intact-ish.
    const r = computePillarStatus(
      [c('supports', TODAY, 'filing'), c('contradicts', TODAY, 'minor_news')],
      TODAY,
    );
    // sum = +3 -1 = +2 ; S = +0.667 -> intact ; most-recent could be the news contradiction
    // but override only triggers on a *filing* contradiction, so status stays intact.
    expect(r.status).toBe('intact');
  });

  it('decay: a half-life-old filing support is worth half a fresh one', () => {
    const r = computePillarStatus([c('supports', '2026-02-28')], TODAY); // 120 days -> 1 half-life
    expect(r.score).toBeCloseTo(0.5, 1);
    expect(r.status).toBe('intact'); // 0.5 >= intact threshold
  });

  it('mixed recent supports + one news contradiction -> watch (mildly positive/neutral)', () => {
    const r = computePillarStatus(
      [c('supports', '2026-06-01', 'minor_news'), c('contradicts', '2026-06-10', 'minor_news')],
      TODAY,
    );
    // roughly cancel -> small |S| -> watch
    expect(r.status).toBe('watch');
  });

  it('source weighting reflects constants (filing=3, major=2, minor=1)', () => {
    expect(SOURCE_WEIGHT.filing).toBe(3);
    expect(NORMALIZER).toBe(3);
    const filing = computePillarStatus([c('supports', TODAY, 'filing')], TODAY).score;
    const major = computePillarStatus([c('supports', TODAY, 'major_news')], TODAY).score;
    const minor = computePillarStatus([c('supports', TODAY, 'minor_news')], TODAY).score;
    expect(filing).toBeCloseTo(1.0, 5);
    expect(major).toBeCloseTo(2 / 3, 5);
    expect(minor).toBeCloseTo(1 / 3, 5);
  });
});

describe('computeThesisHealth', () => {
  it('all intact -> intact', () => {
    expect(computeThesisHealth(['intact', 'intact'])).toBe('intact');
  });
  it('any broken dominates', () => {
    expect(computeThesisHealth(['intact', 'broken', 'weakening'])).toBe('broken');
  });
  it('weakening over watch/intact', () => {
    expect(computeThesisHealth(['intact', 'watch', 'weakening'])).toBe('weakening');
  });
  it('watch over intact', () => {
    expect(computeThesisHealth(['intact', 'watch'])).toBe('watch');
  });
  it('intact when at least one intact and rest unverified', () => {
    expect(computeThesisHealth(['unverified', 'intact', 'unverified'])).toBe('intact');
  });
  it('all unverified -> unverified', () => {
    expect(computeThesisHealth(['unverified', 'unverified'])).toBe('unverified');
  });
  it('empty -> unverified', () => {
    expect(computeThesisHealth([])).toBe('unverified');
  });
});
