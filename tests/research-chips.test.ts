import { describe, it, expect } from 'vitest';
import { chipsFromFindings } from '@/lib/research/chips';
import type { Finding } from '@/lib/research/types';
import type { ValueLedger } from '@/lib/research/account';

const F = (over: Partial<Finding>): Finding => ({
  id: 'catch:x',
  kind: 'catch',
  ticker: 'NVDA',
  summary: 's',
  source: 'src',
  ...over,
});

const LEDGER: ValueLedger = { surfacedTotal: 8600, lines: [], realizedTotal: 0, realized: [] };

describe('chipsFromFindings', () => {
  it('leads with challenged positions when contradicting findings exist', () => {
    const chips = chipsFromFindings(
      [F({ id: 'a', verdict: 'contradicts', ticker: 'AAPL' }), F({ id: 'b', kind: 'action', ticker: 'MSFT' })],
      LEDGER,
    );
    expect(chips[0]).toBe('Which positions are challenged right now?');
    expect(chips[1]).toContain('AAPL');
    expect(chips).toContain('How much could I harvest in tax losses?');
    expect(chips.length).toBeLessThanOrEqual(5);
  });

  it('skips the harvest chip when nothing is surfaced', () => {
    const chips = chipsFromFindings([F({ id: 'a', verdict: 'supports' })], { ...LEDGER, surfacedTotal: 0 });
    expect(chips).not.toContain('How much could I harvest in tax losses?');
    expect(chips).toContain('What is Helm seeing in my portfolio right now?');
  });

  it('never emits duplicates', () => {
    const chips = chipsFromFindings([F({ id: 'a', verdict: 'contradicts' })], LEDGER);
    expect(new Set(chips).size).toBe(chips.length);
  });
});
