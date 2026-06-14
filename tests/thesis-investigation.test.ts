// tests/thesis-investigation.test.ts
import { describe, it, expect } from 'vitest';
import { pickTrigger, buildInvestigation, type InvEvidence } from '@/lib/thesis-investigation';

function row(o: Partial<InvEvidence>): InvEvidence {
  return {
    pillarId: 'p1',
    claim: 'Backlog converts to revenue',
    status: 'weakening',
    verdict: 'contradicts',
    materiality: 'material',
    source_type: 'news',
    excerpt: 'execution issues across solar projects',
    what_it_means: 'margins compress',
    source_title: 'HBSS',
    source_url: 'https://example.com/a',
    is_backfill: false,
    severe: false,
    published_at: '2026-05-06',
    ...o,
  };
}

describe('pickTrigger', () => {
  it('severe price move wins', () => {
    const t = pickTrigger([
      row({}),
      row({ source_type: 'price_move', excerpt: 'PRIM fell 28.7% on 2026-05-06', severe: true, status: 'broken' }),
    ]);
    expect(t?.kind).toBe('severe_move');
  });
  it('falls back to a primary filing contradiction', () => {
    const t = pickTrigger([row({}), row({ source_type: 'filing', status: 'broken', excerpt: 'guidance cut' })]);
    expect(t?.kind).toBe('new_filing');
  });
  it('null when nothing material contradicts', () => {
    expect(pickTrigger([row({ verdict: 'supports' }), row({ materiality: 'context' })])).toBeNull();
  });
});

describe('buildInvestigation', () => {
  it('no investigation for an ordinary single weakening news item (no severe, no broken)', () => {
    expect(buildInvestigation('t1', 'LULU', [row({ status: 'weakening', source_type: 'news' })])).toBeNull();
  });

  it('fires on a severe move, priority critical, cites the excerpt', () => {
    const inv = buildInvestigation('t1', 'PRIM', [
      row({ pillarId: 'pA', status: 'broken', source_type: 'price_move', excerpt: 'PRIM fell 28.7% on 2026-05-06', severe: true }),
      row({ pillarId: 'pB', status: 'weakening', excerpt: 'solar execution problems widen' }),
    ]);
    expect(inv).not.toBeNull();
    expect(inv!.trigger.kind).toBe('severe_move');
    expect(inv!.priority).toBe('critical');
    expect(inv!.finding).toContain('PRIM fell 28.7%');
    // broken pillar sorted first
    expect(inv!.affectedPillars[0].status).toBe('broken');
  });

  it('fires on a broken pillar via primary filing, priority high', () => {
    const inv = buildInvestigation('t1', 'PRIM', [
      row({ pillarId: 'pA', status: 'broken', source_type: 'filing', excerpt: 'full year guidance withdrawn' }),
    ]);
    expect(inv).not.toBeNull();
    expect(inv!.priority).toBe('high');
    expect(inv!.trigger.kind).toBe('new_filing');
  });
});
