// tests/thesis-headline.test.ts
//
// headline() is the one sentence a thesis row leads with, on the web board and
// on the phone. It had no test, and the healthy branch used to restate the
// support/against tally that every caller already renders as chips directly
// above it — the same two numbers twice, once in figures and once in words.
import { describe, it, expect } from 'vitest';
import { headline } from '@/lib/content/thesis-board';
import type { ScoringThesisData, ScoredCatch, ScoredPillar } from '@/lib/content/scoring-thesis';
import type { LadderStatus, Mechanism } from '@/lib/content/mechanism-cluster';

function mech(maxStatus: LadderStatus, label: string): Mechanism<ScoredCatch> {
  return {
    label, items: [], sourceClasses: [], confirmations: 1, mentions: 1,
    firstSeen: '2026-08-01', lastSeen: '2026-08-01', maxStatus, ladderReason: '',
  } as unknown as Mechanism<ScoredCatch>;
}

function hit(title: string, verdict: ScoredCatch['verdict'] = 'supports'): ScoredCatch {
  return { title, verdict } as unknown as ScoredCatch;
}

function pillar(mechanisms: Mechanism<ScoredCatch>[], catches: ScoredCatch[] = []): ScoredPillar {
  return { key: 'p1', claim: 'c', breaksIf: null, origins: [], catches, mechanisms };
}

const thesis = (pillars: ScoredPillar[]): ScoringThesisData =>
  ({
    ticker: 'TEST', company: null, hasHouseThesis: false, pillars,
    rawRows: 0, dedupedRows: 0, contributingUsers: 0, lastScan: null, publicRows: 0,
  } as unknown as ScoringThesisData);

describe('headline', () => {
  it('does not restate the tally the chips already show', () => {
    const d = thesis([
      pillar([mech('watch', 'Server share')], [hit('AMD keeps taking server CPU share'), hit('EPYC wins sockets'), hit('A third', 'contradicts')]),
    ]);
    const out = headline(d);
    expect(out).not.toMatch(/Holding up/);
    expect(out).not.toMatch(/pieces of supporting evidence/);
  });

  it('leads a healthy thesis with its most recent evidence', () => {
    const d = thesis([
      pillar([mech('watch', 'Server share')], [hit('AMD keeps taking server CPU share')]),
    ]);
    expect(headline(d)).toBe('Quiet. Latest: AMD keeps taking server CPU share');
  });

  it('says so plainly when a healthy thesis has no evidence at all', () => {
    const d = thesis([pillar([mech('watch', 'Server share')], [])]);
    expect(headline(d)).toBe('Quiet. Nothing challenges this thesis.');
  });

  it('still leads a troubled thesis with the mechanism that moved', () => {
    const d = thesis([
      pillar([mech('watch', 'Quiet one')], [hit('nothing much')]),
      pillar([mech('broken', 'Margin compression')], [hit('bad', 'contradicts')]),
    ]);
    expect(headline(d)).toMatch(/Margin compression/);
  });

  it('reports convergence when several mechanisms fail on one pillar', () => {
    const d = thesis([
      pillar([mech('broken', 'Margin compression'), mech('weakening', 'Pricing pressure')], [hit('bad', 'contradicts')]),
    ]);
    expect(headline(d)).toMatch(/more independent issue/);
  });

  it('handles a thesis with no pillars', () => {
    expect(headline(thesis([]))).toBe('No scored evidence yet.');
  });
});
