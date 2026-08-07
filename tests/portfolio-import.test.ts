import { describe, it, expect } from 'vitest';
import {
  parseHoldingsCsv,
  parseNumber,
  splitLine,
  toRow,
  mergeLots,
} from '@/lib/portfolio-import';

// The whole point of this module is that a wrong number reaches TLH, the
// concentration scans and every thesis pillar. So the cases that matter are the
// ones where a brokerage's wording could silently change a value: total vs
// per-share cost, accounting negatives, and multiple lots of one name.

describe('parseNumber', () => {
  it('strips currency and thousands separators', () => {
    expect(parseNumber('$1,234.56')).toBe(1234.56);
    expect(parseNumber(' 42 ')).toBe(42);
  });

  it('reads accounting parentheses as negative', () => {
    expect(parseNumber('($1,200.00)')).toBe(-1200);
  });

  it('returns null for the many ways a brokerage writes "nothing"', () => {
    for (const blank of ['', '  ', 'N/A', 'n/a', '--', '-', '—', 'null']) {
      expect(parseNumber(blank)).toBeNull();
    }
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
  });
});

describe('splitLine', () => {
  it('honours quoted fields containing the delimiter', () => {
    expect(splitLine('AAPL,"Apple Inc, Class A",10', ',')).toEqual(['AAPL', 'Apple Inc, Class A', '10']);
  });

  it('unescapes doubled quotes', () => {
    expect(splitLine('A,"say ""hi""",1', ',')).toEqual(['A', 'say "hi"', '1']);
  });
});

describe('toRow — cost basis is PER SHARE', () => {
  it('uses a per-share column as-is', () => {
    expect(toRow('AAPL', '10', '150.00', null)).toEqual({ ticker: 'AAPL', shares: 10, costBasis: 150 });
  });

  it('divides a TOTAL cost column by the share count', () => {
    // The failure this guards: $1,500 total on 10 shares stored as $1,500/share
    // makes a winner look like a 90% loss and fabricates a harvestable loss.
    expect(toRow('AAPL', '10', null, '1500.00')).toEqual({ ticker: 'AAPL', shares: 10, costBasis: 150 });
  });

  it('prefers the per-share column when a file carries both', () => {
    const r = toRow('AAPL', '10', '150.00', '1500.00');
    expect(r).toEqual({ ticker: 'AAPL', shares: 10, costBasis: 150 });
  });

  it('leaves basis null rather than guessing when the source has none', () => {
    expect(toRow('AAPL', '10', null, null)).toEqual({ ticker: 'AAPL', shares: 10, costBasis: null });
  });

  it('rejects symbols the manual form would refuse to submit', () => {
    expect(toRow('BTC-USD', '1', null, null)).toMatchObject({ reason: expect.stringContaining('BTC-USD') });
    expect(toRow('TOOLONGSYM', '1', null, null)).toMatchObject({ reason: expect.any(String) });
  });

  it('rejects zero and negative quantities', () => {
    expect(toRow('AAPL', '0', null, null)).toMatchObject({ reason: expect.stringContaining('AAPL') });
    expect(toRow('AAPL', '(5)', null, null)).toMatchObject({ reason: expect.stringContaining('AAPL') });
  });

  it('reports a missing quantity instead of defaulting it', () => {
    expect(toRow('AAPL', '', null, null)).toMatchObject({ reason: 'no quantity for AAPL' });
  });
});

describe('parseHoldingsCsv', () => {
  it('reads a Fidelity-shaped export with per-share average cost', () => {
    const csv = [
      'Account Name,Symbol,Description,Quantity,Last Price,Average Cost Basis',
      'Individual,AAPL,APPLE INC,10,$220.00,$150.00',
      'Individual,MSFT,MICROSOFT CORP,5,$410.00,$300.00',
    ].join('\n');
    const { rows, skipped } = parseHoldingsCsv(csv);
    expect(skipped).toEqual([]);
    expect(rows).toEqual([
      { ticker: 'AAPL', shares: 10, costBasis: 150 },
      { ticker: 'MSFT', shares: 5, costBasis: 300 },
    ]);
  });

  it('reads a Schwab-shaped export where "Cost Basis" is the TOTAL', () => {
    const csv = [
      'Symbol,Description,Qty,Price,Cost Basis',
      'NVDA,NVIDIA CORP,20,"$120.00","$1,600.00"',
    ].join('\n');
    const { rows } = parseHoldingsCsv(csv);
    expect(rows).toEqual([{ ticker: 'NVDA', shares: 20, costBasis: 80 }]);
  });

  it('skips preamble lines and finds the real header', () => {
    const csv = [
      '"Positions for account X ... as of 08:00 PM ET, 2026/08/07"',
      '',
      'Symbol,Quantity,Average Cost',
      'TSM,12,90.00',
    ].join('\n');
    expect(parseHoldingsCsv(csv).rows).toEqual([{ ticker: 'TSM', shares: 12, costBasis: 90 }]);
  });

  it('handles tab-separated exports', () => {
    const tsv = 'Symbol\tShares\tPrice Paid\nMU\t30\t85.50';
    expect(parseHoldingsCsv(tsv).rows).toEqual([{ ticker: 'MU', shares: 30, costBasis: 85.5 }]);
  });

  it('reports unusable rows instead of dropping them silently', () => {
    const csv = [
      'Symbol,Quantity,Average Cost',
      'AAPL,10,150',
      'BTC-USD,1,60000',
      'CASH,,',
    ].join('\n');
    const { rows, skipped } = parseHoldingsCsv(csv);
    expect(rows).toEqual([{ ticker: 'AAPL', shares: 10, costBasis: 150 }]);
    expect(skipped).toHaveLength(2);
    expect(skipped.map(s => s.reason).join(' ')).toContain('BTC-USD');
  });

  it('returns nothing rather than guessing when no symbol column exists', () => {
    const csv = 'Date,Amount,Balance\n2026-08-01,100,1000';
    expect(parseHoldingsCsv(csv)).toEqual({ rows: [], skipped: [] });
  });

  it('caps at 50 rows', () => {
    const body = Array.from({ length: 60 }, (_, i) => `A${String.fromCharCode(65 + (i % 26))},1,10`);
    const csv = ['Symbol,Quantity,Average Cost', ...body].join('\n');
    expect(parseHoldingsCsv(csv).rows.length).toBe(50);
  });
});

describe('mergeLots', () => {
  it('share-weights the basis across lots of one name', () => {
    const merged = mergeLots([
      { ticker: 'AAPL', shares: 10, costBasis: 100 },
      { ticker: 'AAPL', shares: 30, costBasis: 200 },
    ]);
    expect(merged).toEqual([{ ticker: 'AAPL', shares: 40, costBasis: 175 }]);
  });

  it('drops the basis when one lot does not have one', () => {
    // Averaging a known basis against an unknown one invents a number, and that
    // number would be reported as a tax figure.
    const merged = mergeLots([
      { ticker: 'AAPL', shares: 10, costBasis: 100 },
      { ticker: 'AAPL', shares: 10, costBasis: null },
    ]);
    expect(merged).toEqual([{ ticker: 'AAPL', shares: 20, costBasis: null }]);
  });

  it('leaves distinct symbols alone', () => {
    const rows = [
      { ticker: 'AAPL', shares: 1, costBasis: 1 },
      { ticker: 'MSFT', shares: 2, costBasis: 2 },
    ];
    expect(mergeLots(rows)).toEqual(rows);
  });
});
