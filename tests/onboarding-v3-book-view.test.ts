import { describe, it, expect } from 'vitest';
import { manualPositions, overlapColumns, sectorSplit, shareLabel } from '@/lib/onboarding/v3-book-view';

const holding = (ticker: string, value: number, account_id: string | null, shares = 1) => ({
  ticker,
  total_value: value,
  account_id,
  shares,
});

describe('manualPositions', () => {
  it('returns only that account rows, largest first', () => {
    const { rows } = manualPositions('m1', [
      holding('AAPL', 100, 'm1', 2),
      holding('NVDA', 900, 'p1', 3),
      holding('MSFT', 400, 'm1', 1),
    ]);
    expect(rows.map((r) => r.ticker)).toEqual(['MSFT', 'AAPL']);
  });

  it('never pools another account, which is what the demo book exposed', () => {
    // Every one of the demo's 23 accounts carries source='manual'. Pooling them
    // repeated one list under all of them.
    const holdings = [holding('AAPL', 100, 'm1'), holding('MSFT', 400, 'm2')];
    expect(manualPositions('m1', holdings).rows.map((r) => r.ticker)).toEqual(['AAPL']);
    expect(manualPositions('m2', holdings).rows.map((r) => r.ticker)).toEqual(['MSFT']);
  });

  it('uppercases the ticker and keeps shares and value', () => {
    const { rows } = manualPositions('m1', [holding('aapl', 250.5, 'm1', 1.5)]);
    expect(rows[0]).toEqual({ ticker: 'AAPL', shares: 1.5, value: 250.5 });
  });

  it('caps the rows and reports how many were cut', () => {
    const many = Array.from({ length: 9 }, (_, i) => holding(`T${i}`, (i + 1) * 10, 'm1'));
    const { rows, more } = manualPositions('m1', many, 6);
    expect(rows).toHaveLength(6);
    expect(more).toBe(3);
  });

  it('is empty for an account holding nothing', () => {
    expect(manualPositions('m1', [holding('NVDA', 900, 'p1')])).toEqual({ rows: [], more: 0 });
    expect(manualPositions('m1', [])).toEqual({ rows: [], more: 0 });
  });

  it('ignores a holding with no account, which can never be a typed one', () => {
    expect(manualPositions('m1', [holding('AAPL', 100, null)]).rows).toEqual([]);
  });
});

describe('shareLabel', () => {
  it('keeps an integer bare and a fraction visible', () => {
    expect(shareLabel(4)).toBe('4');
    expect(shareLabel(0.5)).toBe('0.5');
  });

  it('prints two decimals above a share and six below one', () => {
    expect(shareLabel(103.922)).toBe('103.92');
    expect(shareLabel(51.1503)).toBe('51.15');
    expect(shareLabel(0.00234567)).toBe('0.002346');
  });

  it('never rounds a real position to zero', () => {
    expect(shareLabel(0.0000004)).not.toBe('0');
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

describe('sectorSplit', () => {
  const labels = { funds: 'Funds', crypto: 'Crypto', unclassified: 'No sector on file' };
  const h = (total_value: number, sector: string | null, assetClass: string | null) => ({ total_value, sector, assetClass });

  it('sums by sector and returns the largest first, as percentages of the whole', () => {
    const out = sectorSplit([h(300, 'Technology', 'equity'), h(100, 'Energy', 'equity'), h(100, 'Technology', 'equity')], labels);
    expect(out.map((s) => s.label)).toEqual(['Technology', 'Energy']);
    expect(out[0].pct).toBeCloseTo(80, 6);
    expect(out[0].value).toBe(400);
  });

  it('buckets a fund, a coin and an unclassified equity rather than dropping them', () => {
    const out = sectorSplit([h(100, null, 'etf'), h(100, null, 'mutual_fund'), h(50, null, 'crypto'), h(25, null, 'equity'), h(25, null, null)], labels);
    const byLabel = new Map(out.map((s) => [s.label, s.value]));
    expect(byLabel.get('Funds')).toBe(200);
    expect(byLabel.get('Crypto')).toBe(50);
    expect(byLabel.get('No sector on file')).toBe(50);
  });

  it('counts a fund as a fund even when a vendor filed a sector against it', () => {
    // SPY and VTI arrive with sector='Diversified'. Honouring that drew them as
    // a sector slice on a card whose own line says a fund is counted as a fund.
    expect(sectorSplit([h(100, 'Diversified', 'etf')], labels)[0].label).toBe('Funds');
    expect(sectorSplit([h(100, 'Technology', 'mutual_fund')], labels)[0].label).toBe('Funds');
    expect(sectorSplit([h(100, 'Technology', 'crypto')], labels)[0].label).toBe('Crypto');
  });

  it('reads the asset class case-insensitively', () => {
    expect(sectorSplit([h(100, null, 'ETF')], labels)[0].label).toBe('Funds');
  });

  it('ignores positions with no value, and returns nothing when none have any', () => {
    expect(sectorSplit([h(0, 'Technology', 'equity'), h(-5, 'Energy', 'equity')], labels)).toEqual([]);
    expect(sectorSplit([], labels)).toEqual([]);
  });

  it('adds up to 100 percent', () => {
    const out = sectorSplit([h(37, 'Technology', 'equity'), h(11, null, 'etf'), h(3, null, 'crypto')], labels);
    expect(out.reduce((n, s) => n + s.pct, 0)).toBeCloseTo(100, 6);
  });
});
