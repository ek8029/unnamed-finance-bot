// tests/cross-thesis-risk.test.ts
import { describe, it, expect } from 'vitest';
import { worstStatus, buildRiskAlerts, toRiskClusters, type RiskCluster } from '@/lib/cross-thesis-risk';
import type { SynthCluster } from '@/lib/thesis-synthesis';
import type { PillarStatus } from '@/lib/thesis-status';

function cluster(driver: string, members: { ticker: string; worstStatus: PillarStatus }[]): RiskCluster {
  return { driver, members: members.map((m, i) => ({ ...m, thesisId: `t-${m.ticker}-${i}` })) };
}

const ADVICE_WORDS = ['buy', 'sell', 'hold', 'trim', 'reduce', 'add', 'rebalance', 'diversify'];

describe('worstStatus', () => {
  it('broken beats weakening beats intact', () => {
    expect(worstStatus('intact', 'broken')).toBe('broken');
    expect(worstStatus('weakening', 'intact')).toBe('weakening');
    expect(worstStatus('unverified', 'intact')).toBe('intact');
  });
});

describe('buildRiskAlerts', () => {
  it('skips a single-ticker cluster', () => {
    const out = buildRiskAlerts([cluster('AI capex', [{ ticker: 'NVDA', worstStatus: 'broken' }])]);
    expect(out).toHaveLength(0);
  });

  it('skips a cluster where nothing moved', () => {
    const out = buildRiskAlerts([
      cluster('AI capex', [
        { ticker: 'NVDA', worstStatus: 'intact' },
        { ticker: 'AVGO', worstStatus: 'intact' },
      ]),
    ]);
    expect(out).toHaveLength(0);
  });

  it('fires when a member moved; severity scales with broken count', () => {
    const oneBroken = buildRiskAlerts([
      cluster('AI capex', [
        { ticker: 'NVDA', worstStatus: 'broken' },
        { ticker: 'AVGO', worstStatus: 'intact' },
      ]),
    ]);
    expect(oneBroken).toHaveLength(1);
    expect(oneBroken[0].severity).toBe('high');
    expect(oneBroken[0].movedTickers).toEqual(['NVDA']);

    const twoBroken = buildRiskAlerts([
      cluster('AI capex', [
        { ticker: 'NVDA', worstStatus: 'broken' },
        { ticker: 'AVGO', worstStatus: 'broken' },
      ]),
    ]);
    expect(twoBroken[0].severity).toBe('critical');

    const weakOnly = buildRiskAlerts([
      cluster('rate path', [
        { ticker: 'TLT', worstStatus: 'weakening' },
        { ticker: 'IEF', worstStatus: 'intact' },
      ]),
    ]);
    expect(weakOnly[0].severity).toBe('medium');
  });

  it('rationale is neutral (no buy/sell/trim/diversify language)', () => {
    const out = buildRiskAlerts([
      cluster('AI capex', [
        { ticker: 'NVDA', worstStatus: 'broken' },
        { ticker: 'AVGO', worstStatus: 'weakening' },
      ]),
    ]);
    const text = out[0].rationale.toLowerCase();
    for (const w of ADVICE_WORDS) expect(text.includes(w)).toBe(false);
    expect(text.includes('—')).toBe(false);
  });
});

describe('toRiskClusters', () => {
  it('attaches worst status per ticker', () => {
    const synth: SynthCluster[] = [
      {
        driver: 'AI capex',
        rationale: 'r',
        pillars: [
          { ticker: 'NVDA', claim: 'c1', pillarId: 'p1' },
          { ticker: 'AVGO', claim: 'c2', pillarId: 'p2' },
        ],
      },
    ];
    const thesisIdByTicker = new Map([['NVDA', 'tn'], ['AVGO', 'ta']]);
    const worstByTicker = new Map<string, PillarStatus>([['NVDA', 'broken'], ['AVGO', 'intact']]);
    const out = toRiskClusters(synth, thesisIdByTicker, worstByTicker);
    expect(out[0].members.find((m) => m.ticker === 'NVDA')!.worstStatus).toBe('broken');
    expect(out[0].members.find((m) => m.ticker === 'NVDA')!.thesisId).toBe('tn');
  });
});
