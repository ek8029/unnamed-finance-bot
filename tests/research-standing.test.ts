import { describe, it, expect } from 'vitest';
import { computeStanding } from '@/lib/research/standing';
import type { PortfolioBrief, ValueLedger } from '@/lib/research/account';
import type { Finding } from '@/lib/research/types';

function brief(over: Partial<PortfolioBrief> = {}): PortfolioBrief {
  return {
    totalValue: 100000,
    totalCostBasis: 90000,
    totalUnrealized: 10000,
    positionCount: 3,
    harvestableLoss: { stLoss: 0, ltLoss: 1000, unknownLoss: 0, total: 1000 },
    holdings: [
      { ticker: 'AAA', value: 15000, pct: 15, unrealizedGainLoss: 2000, costBasis: 13000, sector: 'Technology', accounts: [], taxableUnrealizedGainLoss: 2000, dayChangePct: null },
      { ticker: 'BBB', value: 12000, pct: 12, unrealizedGainLoss: -1000, costBasis: 13000, sector: 'Healthcare', accounts: [], taxableUnrealizedGainLoss: -1000, dayChangePct: null },
    ],
    sectorAllocation: [
      { sector: 'Technology', pct: 40 },
      { sector: 'Healthcare', pct: 30 },
    ],
    ...over,
  };
}
const emptyLedger: ValueLedger = { surfacedTotal: 0, lines: [], realizedTotal: 0, realized: [] };
const harvestLedger: ValueLedger = {
  surfacedTotal: 5000,
  lines: [{ label: 'TLH surfaced', amount: 5000, kind: 'tax_harvest', date: null }],
  realizedTotal: 0,
  realized: [],
};

describe('computeStanding', () => {
  it('flags a large single-name concentration and leads with it', () => {
    const b = brief({ holdings: [{ ticker: 'NVDA', value: 34000, pct: 34, unrealizedGainLoss: 5000, costBasis: 29000, sector: 'Technology', accounts: [], taxableUnrealizedGainLoss: 5000, dayChangePct: null }] });
    const s = computeStanding(b, [], emptyLedger);
    const conc = s.checks.find((c) => c.label === 'Concentration')!;
    expect(conc.status).toBe('flag');
    expect(s.headline).toContain('NVDA');
    expect(s.headline).toContain('34%');
  });

  it('flags a dominant sector when no single name is large', () => {
    const b = brief({ sectorAllocation: [{ sector: 'Technology', pct: 60 }, { sector: 'Healthcare', pct: 40 }] });
    const conc = computeStanding(b, [], emptyLedger).checks.find((c) => c.label === 'Concentration')!;
    expect(conc.status).toBe('flag');
    expect(conc.detail).toContain('Technology');
  });

  it('watches harvestable tax savings', () => {
    const tax = computeStanding(brief(), [], harvestLedger).checks.find((c) => c.label === 'Taxes')!;
    expect(tax.status).toBe('watch');
    expect(tax.detail).toContain('5,000');
  });

  it('flags theses when an investigation is present', () => {
    const findings: Finding[] = [{ id: 'inv:1', kind: 'investigation', ticker: 'NVDA', summary: 's', source: 'x' }];
    const th = computeStanding(brief(), findings, emptyLedger).checks.find((c) => c.label === 'Theses')!;
    expect(th.status).toBe('flag');
  });

  it('is all-clear when nothing is wrong', () => {
    const b = brief({ sectorAllocation: [{ sector: 'Technology', pct: 30 }, { sector: 'Healthcare', pct: 25 }] });
    const s = computeStanding(b, [{ id: 'catch:1', kind: 'catch', ticker: 'AAA', summary: 's', source: 'x', verdict: 'supports' }], emptyLedger);
    expect(s.checks.every((c) => c.status === 'ok')).toBe(true);
    expect(s.headline).toContain('steady');
  });
});
