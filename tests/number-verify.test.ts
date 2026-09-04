// tests/number-verify.test.ts
import { describe, it, expect } from 'vitest';
import { verifyNumbers, extractFigures } from '@/lib/number-verify';

const FACTS = `
=== NVDA ===
Market Cap: $2,150,000,000
Current Price: $178.45
Change: +3.39 (+1.94%)
Revenue Growth YoY: 19.32%
P/E (TTM): 54.20
Catches: 3
`;

describe('verifyNumbers', () => {
  it('accepts a figure copied straight from the facts', () => {
    expect(verifyNumbers('NVDA trades at $178.45 on a 54.20 P/E.', FACTS).ok).toBe(true);
  });

  it('accepts the unit rewrite /analyze is told to perform', () => {
    // The prompt orders 2,150,000,000 -> $2.15B. A substring test fails here.
    expect(verifyNumbers('Market cap is $2.15B.', FACTS).ok).toBe(true);
  });

  it('accepts honest rounding', () => {
    expect(verifyNumbers('Revenue grew 19% year over year.', FACTS).ok).toBe(true);
    expect(verifyNumbers('Revenue grew 19.3% year over year.', FACTS).ok).toBe(true);
  });

  it('rejects a figure that rounding cannot explain', () => {
    const c = verifyNumbers('Revenue grew 24% year over year.', FACTS);
    expect(c.ok).toBe(false);
    expect(c.unverified[0].raw).toContain('24');
  });

  it('rejects an invented figure entirely', () => {
    const c = verifyNumbers('Free cash flow reached $8.2B last quarter.', FACTS);
    expect(c.ok).toBe(false);
  });

  it('does not let a percent match a plain number', () => {
    // 54.20 is a P/E in the facts, not a percentage.
    expect(verifyNumbers('Margins run at 54.20%.', FACTS).ok).toBe(false);
  });

  it('treats bps and percent as one axis', () => {
    expect(verifyNumbers('Up 194 bps on the day.', FACTS).ok).toBe(true);
  });

  it('ignores ISO dates rather than reading them as three numbers', () => {
    expect(verifyNumbers('The filing landed 2026-09-04.', FACTS).ok).toBe(true);
  });

  it('reports every distinct bad figure once', () => {
    const c = verifyNumbers('Up 24%, then 24% again, and 31% after.', FACTS);
    expect(c.unverified).toHaveLength(2);
  });

  it('an output with no figures passes', () => {
    expect(verifyNumbers('Nothing in the filings bears on this pillar.', FACTS).ok).toBe(true);
  });

  it('empty facts fail every figure, rather than passing silently', () => {
    expect(verifyNumbers('It rose 4%.', '').ok).toBe(false);
  });
});

describe('extractFigures', () => {
  it('reads sign, unit and precision', () => {
    const [f] = extractFigures('-$1,234.50');
    expect(f.value).toBe(-1234.5);
    expect(f.isPercent).toBe(false);
    expect(f.tolerance).toBeCloseTo(0.005);
  });

  it('expands B/M/K suffixes', () => {
    expect(extractFigures('$2.15B')[0].value).toBe(2.15e9);
    expect(extractFigures('$400M')[0].value).toBe(4e8);
    expect(extractFigures('12K')[0].value).toBe(12000);
  });
});
