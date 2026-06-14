// tests/thesis-brief.test.ts
import { describe, it, expect } from 'vitest';
import { summarizeThesisState, type BriefPillarState } from '@/lib/thesis-brief';
import type { Transition } from '@/lib/thesis-history';

function p(ticker: string, status: BriefPillarState['status'], claim = 'claim'): BriefPillarState {
  return { ticker, status, claim };
}

function tr(ticker: string, to: Transition['to'], movedOn: string): Transition {
  return { ticker, pillarId: `${ticker}-1`, claim: 'c', from: 'intact', to, movedOn };
}

describe('summarizeThesisState', () => {
  it('tallies counts and distinct tracked tickers', () => {
    const out = summarizeThesisState([p('AAA', 'intact'), p('AAA', 'broken'), p('BBB', 'weakening')], []);
    expect(out.trackedCount).toBe(2);
    expect(out.counts).toEqual({ intact: 1, weakening: 1, broken: 1, unverified: 0 });
  });

  it('needsAttention lists broken+weakening, broken first', () => {
    const out = summarizeThesisState([p('AAA', 'weakening'), p('BBB', 'broken'), p('CCC', 'intact')], []);
    expect(out.needsAttention.map((n) => n.status)).toEqual(['broken', 'weakening']);
  });

  it('moved keeps only adverse transitions, newest first', () => {
    const out = summarizeThesisState(
      [p('AAA', 'broken')],
      [tr('AAA', 'broken', '2026-06-10'), tr('BBB', 'intact', '2026-06-12'), tr('CCC', 'weakening', '2026-06-13')],
    );
    expect(out.moved.map((m) => m.ticker)).toEqual(['CCC', 'AAA']); // intact recovery dropped, sorted desc
  });

  it('headline: broken case', () => {
    const out = summarizeThesisState([p('AAA', 'broken'), p('BBB', 'weakening')], []);
    expect(out.headline).toContain('broke');
    expect(out.headline).toContain('weakened');
  });

  it('headline: weakening only', () => {
    expect(summarizeThesisState([p('AAA', 'weakening')], []).headline).toBe('1 pillar weakening, none broken.');
  });

  it('headline: all intact', () => {
    expect(summarizeThesisState([p('AAA', 'intact')], []).headline).toBe('All tracked pillars are intact.');
  });

  it('headline: no pillars', () => {
    expect(summarizeThesisState([], []).headline).toBe('No tracked theses yet.');
  });
});
