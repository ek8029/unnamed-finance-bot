import { describe, it, expect } from 'vitest';
import { manualPositions, overlapColumns, shareLabel } from '@/lib/onboarding/v3-book-view';

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

describe('overlapColumns', () => {
  const accounts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'f' }, { id: 'g' }];

  it('keeps only the accounts that hold one of the shown names', () => {
    const cols = overlapColumns([{ accountIds: ['c', 'f'] }], accounts);
    expect(cols.map((a) => a.id)).toEqual(['c', 'f']);
  });

  it('puts the account holding the most of them first', () => {
    const cols = overlapColumns(
      [{ accountIds: ['a', 'g'] }, { accountIds: ['g'] }, { accountIds: ['g', 'b'] }],
      accounts,
    );
    expect(cols[0].id).toBe('g');
  });

  it('caps the columns', () => {
    expect(overlapColumns([{ accountIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }], accounts, 5)).toHaveLength(5);
  });

  it('ignores an account id that belongs to no account, and counts an id once per row', () => {
    expect(overlapColumns([{ accountIds: ['manual', 'manual', 'a'] }], accounts).map((a) => a.id)).toEqual(['a']);
  });

  it('is empty when nothing lines up', () => {
    expect(overlapColumns([], accounts)).toEqual([]);
    expect(overlapColumns([{ accountIds: ['manual'] }], accounts)).toEqual([]);
  });
});
