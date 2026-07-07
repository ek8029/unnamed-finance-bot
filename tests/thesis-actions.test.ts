// tests/thesis-actions.test.ts
import { describe, it, expect } from 'vitest';
import {
  selectActionableSituations,
  deriveActionKind,
  buildAction,
  buildThesisActions,
  topContradictions,
  type ActionEvidence,
  type PillarInput,
  type HoldingSnapshot,
} from '@/lib/thesis-actions';

function ev(overrides: Partial<ActionEvidence>): ActionEvidence {
  return {
    verdict: 'contradicts',
    materiality: 'material',
    source_type: 'news',
    excerpt: 'something contradicting',
    what_it_means: 'the thesis is weaker',
    source_title: 'Reuters',
    source_url: 'https://example.com/a',
    is_backfill: false,
    severe: false,
    ...overrides,
  };
}

function pillar(overrides: Partial<PillarInput>): PillarInput {
  return {
    thesisId: 't1',
    ticker: 'PRIM',
    pillarId: 'p1',
    claim: 'Backlog keeps converting to revenue',
    status: 'broken',
    evidence: [ev({})],
    ...overrides,
  };
}

const holdingLoss: HoldingSnapshot = { ticker: 'PRIM', totalValue: 8000, unrealisedGainLoss: -2500, harvestableLoss: 2500 };
const holdingGain: HoldingSnapshot = { ticker: 'PRIM', totalValue: 12000, unrealisedGainLoss: 3000, harvestableLoss: 0 };
// Underwater but entirely in a retirement account → nothing is harvestable.
const holdingRetirementLoss: HoldingSnapshot = { ticker: 'PRIM', totalValue: 8000, unrealisedGainLoss: -2500, harvestableLoss: 0 };

describe('buildThesisActions one-per-ticker', () => {
  const noHoldings = new Map<string, HoldingSnapshot>();
  it('collapses two weakening pillars of one ticker into a single action', () => {
    const out = buildThesisActions(
      [
        pillar({ ticker: 'ABC', pillarId: 'p1', status: 'weakening' }),
        pillar({ ticker: 'ABC', pillarId: 'p2', status: 'weakening' }),
      ],
      noHoldings,
    );
    expect(out).toHaveLength(1);
    expect(out[0].ticker).toBe('ABC');
  });
  it('keeps the highest-priority action when a ticker has mixed situations', () => {
    const out = buildThesisActions(
      [
        pillar({ ticker: 'XYZ', pillarId: 'p1', status: 'weakening' }),
        pillar({ ticker: 'XYZ', pillarId: 'p2', status: 'broken', evidence: [ev({ severe: true })] }),
      ],
      new Map<string, HoldingSnapshot>([['XYZ', { ticker: 'XYZ', totalValue: 8000, unrealisedGainLoss: -2500, harvestableLoss: 2500 }]]),
    );
    expect(out).toHaveLength(1);
    expect(out[0].priority).toBe('critical');
  });
  it('keeps separate actions for different tickers', () => {
    const out = buildThesisActions(
      [
        pillar({ ticker: 'AAA', pillarId: 'p1', status: 'weakening' }),
        pillar({ ticker: 'BBB', pillarId: 'p2', status: 'weakening' }),
      ],
      noHoldings,
    );
    expect(out).toHaveLength(2);
  });
});

const noEmDash = (s: string) => expect(s.includes('—')).toBe(false);

describe('selectActionableSituations', () => {
  it('skips intact and unverified pillars', () => {
    const out = selectActionableSituations([
      pillar({ status: 'intact', evidence: [ev({ verdict: 'supports' })] }),
      pillar({ status: 'unverified', evidence: [] }),
    ]);
    expect(out).toHaveLength(0);
  });

  it('keeps broken and weakening pillars that have a live material contradiction', () => {
    const out = selectActionableSituations([
      pillar({ status: 'broken' }),
      pillar({ status: 'weakening' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('skips a broken pillar with no citable contradiction (only backfill/context)', () => {
    const out = selectActionableSituations([
      pillar({ status: 'broken', evidence: [ev({ is_backfill: true })] }),
      pillar({ status: 'broken', evidence: [ev({ materiality: 'context' })] }),
    ]);
    expect(out).toHaveLength(0);
  });
});

describe('topContradictions', () => {
  it('ranks severe first, then primary source', () => {
    const news = ev({ source_type: 'news', excerpt: 'news' });
    const primary = ev({ source_type: 'filing', excerpt: 'filing' });
    const severe = ev({ source_type: 'price_move', excerpt: 'PRIM fell 28.7% on 2026-05-06', severe: true });
    const out = topContradictions([news, primary, severe]);
    expect(out[0].severe).toBe(true);
    expect(out[1].source_type).toBe('filing');
  });
});

describe('deriveActionKind', () => {
  it('weakening => watch', () => {
    expect(deriveActionKind('weakening', holdingLoss)).toBe('watch');
  });
  it('broken at a loss => harvest_loss', () => {
    expect(deriveActionKind('broken', holdingLoss)).toBe('harvest_loss');
  });
  it('broken at a gain => trim', () => {
    expect(deriveActionKind('broken', holdingGain)).toBe('trim');
  });
  it('broken with no holding => trim', () => {
    expect(deriveActionKind('broken', undefined)).toBe('trim');
  });
  it('broken at a loss but only in a retirement account => trim (nothing harvestable)', () => {
    expect(deriveActionKind('broken', holdingRetirementLoss)).toBe('trim');
  });
});

describe('buildAction', () => {
  it('harvest_loss: tax type, positive impact, wash-sale warning, non-discretionary', () => {
    const a = buildAction(pillar({ status: 'broken' }), holdingLoss);
    expect(a.kind).toBe('harvest_loss');
    expect(a.insightType).toBe('tax');
    expect(a.estimatedImpact).toBeGreaterThan(0);
    expect(a.recommendedAction.toLowerCase()).toContain('wash sale');
    expect(a.recommendedAction.toLowerCase()).toContain('you decide');
    expect(a.citedExcerpts.length).toBeGreaterThan(0);
    noEmDash(a.recommendedAction);
    noEmDash(a.description);
    noEmDash(a.explanation);
  });

  it('trim: portfolio type, null impact, non-discretionary', () => {
    const a = buildAction(pillar({ status: 'broken' }), holdingGain);
    expect(a.kind).toBe('trim');
    expect(a.insightType).toBe('portfolio');
    expect(a.estimatedImpact).toBeNull();
    expect(a.recommendedAction.toLowerCase()).toContain('you decide');
    noEmDash(a.recommendedAction);
  });

  it('watch: weakening, medium priority, no action required', () => {
    const a = buildAction(pillar({ status: 'weakening' }), holdingLoss);
    expect(a.kind).toBe('watch');
    expect(a.priority).toBe('medium');
    expect(a.recommendedAction.toLowerCase()).toContain('no action required');
  });

  it('priority: severe broken => critical, ordinary broken => high', () => {
    const severeP = pillar({
      status: 'broken',
      evidence: [ev({ source_type: 'price_move', excerpt: 'PRIM fell 28.7% on 2026-05-06', severe: true })],
    });
    expect(buildAction(severeP, holdingGain).priority).toBe('critical');
    expect(buildAction(pillar({ status: 'broken' }), holdingGain).priority).toBe('high');
  });

  it('explanation cites the real evidence excerpt', () => {
    const a = buildAction(
      pillar({ status: 'broken', evidence: [ev({ excerpt: 'guidance withdrawn for FY26' })] }),
      holdingGain,
    );
    expect(a.explanation).toContain('guidance withdrawn for FY26');
  });
});

describe('buildThesisActions', () => {
  it('joins holdings by ticker and collapses one ticker to its highest-priority action', () => {
    const holdings = new Map<string, HoldingSnapshot>([['PRIM', holdingLoss]]);
    const out = buildThesisActions(
      [
        pillar({ pillarId: 'p1', status: 'broken' }),
        pillar({ pillarId: 'p2', status: 'weakening' }),
        pillar({ pillarId: 'p3', status: 'intact', evidence: [ev({ verdict: 'supports' })] }),
      ],
      holdings,
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('harvest_loss'); // broken + loss holding wins over the weakening watch
  });
});
