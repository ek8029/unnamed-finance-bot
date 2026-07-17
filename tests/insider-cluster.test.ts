// tests/insider-cluster.test.ts
import { describe, it, expect } from 'vitest';
import { detectInsiderCluster, clusterText } from '@/lib/insider-cluster';
import type { Form4Summary } from '@/lib/edgar';

const f4 = (owner: string, opts?: Partial<Form4Summary>): Form4Summary => ({
  ownerName: owner,
  ownerRole: 'Director',
  is10b51: false,
  transactions: [{ isDisposition: true, shares: 1000, pricePerShare: 50, date: '2026-07-10', code: 'S' }],
  accessionNumber: `acc-${owner}`,
  filedAt: '2026-07-10',
  url: 'https://sec.gov/x',
  totalSaleValue: 50_000,
  ...opts,
} as Form4Summary);

describe('detectInsiderCluster', () => {
  it('null below 3 distinct sellers', () => {
    expect(detectInsiderCluster([f4('A'), f4('B')])).toBeNull();
  });
  it('same seller filing twice counts once', () => {
    expect(detectInsiderCluster([f4('A'), f4('A', { accessionNumber: 'acc-A2' }), f4('B')])).toBeNull();
  });
  it('10b5-1 sales excluded entirely', () => {
    expect(detectInsiderCluster([f4('A'), f4('B'), f4('C', { is10b51: true })])).toBeNull();
  });
  it('acquisitions do not count as sellers', () => {
    const buyer = f4('C', { transactions: [{ isDisposition: false, shares: 500, pricePerShare: 50, date: '2026-07-09', code: 'P' }] } as Partial<Form4Summary>);
    expect(detectInsiderCluster([f4('A'), f4('B'), buyer])).toBeNull();
  });
  it('3 distinct discretionary sellers form a cluster with summed value', () => {
    const c = detectInsiderCluster([f4('A'), f4('B'), f4('C', { filedAt: '2026-07-12' })]);
    expect(c).not.toBeNull();
    expect(c!.sellerCount).toBe(3);
    expect(c!.totalSaleValue).toBe(150_000);
    expect(c!.firstDate).toBe('2026-07-10');
    expect(c!.lastDate).toBe('2026-07-12');
  });
  it('clusterText is a complete system excerpt', () => {
    const c = detectInsiderCluster([f4('A'), f4('B'), f4('C')])!;
    const text = clusterText('NVDA', c);
    expect(text).toContain('NVDA');
    expect(text).toContain('3 distinct insiders');
    expect(text).toContain('non-10b5-1');
    expect(text).not.toMatch(/—/);
  });
});
