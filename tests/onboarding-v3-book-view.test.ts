import { describe, it, expect } from 'vitest';
import { manualPositions, shareLabel } from '@/lib/onboarding/v3-book-view';

const accounts = [
  { id: 'm1', source: 'manual' as const },
  { id: 'p1', source: 'plaid' as const },
];

const holding = (ticker: string, value: number, account_id: string | null, shares = 1) => ({
  ticker,
  total_value: value,
  account_id,
  shares,
});

describe('manualPositions', () => {
  it('returns only the hand-typed rows, largest first', () => {
    const { rows } = manualPositions(accounts, [
      holding('AAPL', 100, 'm1', 2),
      holding('NVDA', 900, 'p1', 3),
      holding('MSFT', 400, 'm1', 1),
    ]);
    expect(rows.map((r) => r.ticker)).toEqual(['MSFT', 'AAPL']);
  });

  it('uppercases the ticker and keeps shares and value', () => {
    const { rows } = manualPositions(accounts, [holding('aapl', 250.5, 'm1', 1.5)]);
    expect(rows[0]).toEqual({ ticker: 'AAPL', shares: 1.5, value: 250.5 });
  });

  it('caps the rows and reports how many were cut, with the total over all of them', () => {
    const many = Array.from({ length: 9 }, (_, i) => holding(`T${i}`, (i + 1) * 10, 'm1'));
    const { rows, more, total } = manualPositions(accounts, many, 6);
    expect(rows).toHaveLength(6);
    expect(more).toBe(3);
    expect(total).toBe(450);
  });

  it('is empty with no manual account, and with a manual account holding nothing', () => {
    expect(manualPositions([{ id: 'p1', source: 'plaid' }], [holding('NVDA', 900, 'p1')]).rows).toEqual([]);
    expect(manualPositions(accounts, [holding('NVDA', 900, 'p1')])).toEqual({ rows: [], more: 0, total: 0 });
  });

  it('ignores a holding with no account, which can never be a typed one', () => {
    expect(manualPositions(accounts, [holding('AAPL', 100, null)]).rows).toEqual([]);
  });
});

describe('shareLabel', () => {
  it('keeps an integer bare and a fraction visible', () => {
    expect(shareLabel(4)).toBe('4');
    expect(shareLabel(0.5)).toBe('0.5');
    expect(shareLabel(1.23456789)).toBe('1.2346');
  });
  it('reads a non-number as zero rather than NaN', () => {
    expect(shareLabel(Number.NaN)).toBe('0');
  });
});
