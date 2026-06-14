// tests/thesis-synthesis.test.ts
import { describe, it, expect } from 'vitest';
import { groundClusters, type SynthPillarInput } from '@/lib/thesis-synthesis';

const inputs: SynthPillarInput[] = [
  { id: 'a', ticker: 'AMZN', claim: 'consumer demand stays strong' },
  { id: 'b', ticker: 'LULU', claim: 'shoppers keep paying full price' },
  { id: 'c', ticker: 'NVDA', claim: 'datacenter buildout continues' },
];

describe('groundClusters', () => {
  it('keeps a genuine cross-ticker cluster with a specific driver', () => {
    const out = groundClusters(
      { clusters: [{ driver: 'Consumer discretionary spending', pillar_indices: [1, 2], rationale: 'r' }] },
      inputs,
    );
    expect(out).toHaveLength(1);
    expect(out[0].pillars.map((p) => p.ticker)).toEqual(['AMZN', 'LULU']);
  });

  it('rejects a generic internal-capability driver', () => {
    const out = groundClusters(
      { clusters: [{ driver: 'Operational efficiency and cost management', pillar_indices: [1, 2, 3], rationale: 'r' }] },
      inputs,
    );
    expect(out).toHaveLength(0);
  });

  it('rejects a single-ticker grouping', () => {
    const out = groundClusters(
      { clusters: [{ driver: 'Datacenter capex', pillar_indices: [3], rationale: 'r' }] },
      inputs,
    );
    expect(out).toHaveLength(0);
  });

  it('drops invalid pillar indices and rejects if fewer than 2 tickers remain', () => {
    const out = groundClusters(
      { clusters: [{ driver: 'Datacenter capex', pillar_indices: [3, 99], rationale: 'r' }] },
      inputs,
    );
    expect(out).toHaveLength(0);
  });
});
