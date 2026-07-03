import { describe, it, expect } from 'vitest';
import {
  statusAsOf,
  countsAsOf,
  convictionTrend,
  recentTransitions,
  type HistoryEvidence,
  type HistoryPillar,
} from '@/lib/thesis-history';

const NOW = new Date('2026-06-14T00:00:00.000Z');
const DAY = 86_400_000;
function daysBefore(n: number): string {
  return new Date(NOW.getTime() - n * DAY).toISOString();
}

function ev(p: Partial<HistoryEvidence>): HistoryEvidence {
  return {
    verdict: 'supports',
    materiality: 'material',
    source_type: 'news',
    source_key: Math.random().toString(36).slice(2),
    source_published_at: daysBefore(10),
    created_at: daysBefore(0), // deliberately "now" — the seed-time bias the module must ignore
    ...p,
  };
}

function pillar(evidence: HistoryEvidence[], over: Partial<HistoryPillar> = {}): HistoryPillar {
  return { id: 'p1', ticker: 'TEST', claim: 'c', confirmed: true, lifecycle: 'confirmed', evidence, ...over };
}

describe('statusAsOf — honest timeline', () => {
  it('live supporting evidence (10d ago) => intact', () => {
    expect(statusAsOf([ev({ verdict: 'supports', source_published_at: daysBefore(10) })], NOW)).toBe('intact');
  });

  it('FIX B: a single fresh NEWS contradiction is noted, not alarmed => intact', () => {
    // Weakening needs convergence (2 independent) or a primary source. One news
    // article among the supports stays in the evidence trail without flagging.
    expect(
      statusAsOf([ev({ verdict: 'contradicts', source_published_at: daysBefore(5) })], NOW),
    ).toBe('intact');
  });

  it('FIX B: a single fresh PRIMARY-source contradiction (filing) => weakening', () => {
    expect(
      statusAsOf(
        [ev({ verdict: 'contradicts', source_type: 'filing', source_published_at: daysBefore(5) })],
        NOW,
      ),
    ).toBe('weakening');
  });

  it('FIX B: two independent fresh news contradictions => weakening', () => {
    expect(
      statusAsOf(
        [
          ev({ verdict: 'contradicts', source_key: 'news-a', source_published_at: daysBefore(5) }),
          ev({ verdict: 'contradicts', source_key: 'news-b', source_published_at: daysBefore(3) }),
        ],
        NOW,
      ),
    ).toBe('weakening');
  });

  it('THE FIX: a contradiction that published 40d ago is NOT a recent breach => intact', () => {
    // created_at is "now" (seed-time). The buggy path would treat this as recent and weaken.
    // Honest replay uses the 40-day-old publish date => outside the 30d window => intact.
    expect(
      statusAsOf([ev({ verdict: 'contradicts', source_published_at: daysBefore(40) })], NOW),
    ).toBe('intact');
  });

  it('evidence older than the 90d live window => backfill => unverified', () => {
    expect(
      statusAsOf([ev({ verdict: 'supports', source_published_at: daysBefore(100) })], NOW),
    ).toBe('unverified');
  });

  it('evidence published after asOf is excluded (not yet known)', () => {
    // asOf = 20d ago; evidence published 10d ago should not exist yet.
    const asOf = new Date(NOW.getTime() - 20 * DAY);
    expect(statusAsOf([ev({ verdict: 'supports', source_published_at: daysBefore(10) })], asOf)).toBe(
      'unverified',
    );
  });

  it('two independent recent material contradictions incl. a primary source => broken', () => {
    expect(
      statusAsOf(
        [
          ev({ verdict: 'contradicts', source_type: 'filing', source_key: 'a', source_published_at: daysBefore(8) }),
          ev({ verdict: 'contradicts', source_type: 'news', source_key: 'b', source_published_at: daysBefore(3) }),
        ],
        NOW,
      ),
    ).toBe('broken');
  });
});

describe('countsAsOf', () => {
  it('skips dismissed and unconfirmed pillars', () => {
    const pillars = [
      pillar([ev({ verdict: 'supports' })]),                                  // intact
      pillar([ev({ verdict: 'supports' })], { confirmed: false }),            // skipped (draft)
      pillar([ev({ verdict: 'supports' })], { lifecycle: 'dismissed' }),      // skipped (dismissed)
    ];
    const c = countsAsOf(pillars, NOW);
    expect(c.intact).toBe(1);
    expect(c.unverified + c.weakening + c.broken).toBe(0);
  });
});

describe('convictionTrend', () => {
  it('returns one point per day and rises when support enters the window', () => {
    // support published 6d ago: intact only on the last 6 points (it also has to be < 90d, true).
    const pillars = [pillar([ev({ verdict: 'supports', source_published_at: daysBefore(6) })])];
    const trend = convictionTrend(pillars, NOW, 14);
    expect(trend).toHaveLength(14);
    expect(trend[0].intact).toBe(0); // 13d ago: evidence not yet published
    expect(trend[13].intact).toBe(1); // today: intact
  });
});

describe('recentTransitions', () => {
  it('detects an unverified -> weakening move and reports the driving publish date', () => {
    const movedDate = daysBefore(4);
    // Primary source: under FIX B a lone news contradiction no longer weakens.
    const pillars = [
      pillar([ev({ verdict: 'contradicts', source_type: 'filing', source_published_at: movedDate })], { ticker: 'LULU' }),
    ];
    const t = recentTransitions(pillars, NOW, 14);
    expect(t).toHaveLength(1);
    expect(t[0].ticker).toBe('LULU');
    expect(t[0].from).toBe('unverified');
    expect(t[0].to).toBe('weakening');
    expect(t[0].movedOn).toBe(movedDate.slice(0, 10));
  });

  it('does not list a pillar whose status held across the window', () => {
    const pillars = [pillar([ev({ verdict: 'supports', source_published_at: daysBefore(60) })])];
    // intact 14d ago and intact now (steady live support) => no transition
    expect(recentTransitions(pillars, NOW, 14)).toHaveLength(0);
  });
});
