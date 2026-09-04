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

describe('sign handling', () => {
  const FACTS2 = 'Change: -0.7450000000000045 (-0.5045545359114182%)\nEPS Growth YoY: -1.26%';

  it('accepts an unsigned figure whose direction is in the prose', () => {
    // Measured on /analyze: the model writes "down 0.50%", the fact is -0.5045%.
    expect(verifyNumbers('The stock is down 0.50% on the day.', FACTS2).ok).toBe(true);
    expect(verifyNumbers('EPS declined 1.26% year over year.', FACTS2).ok).toBe(true);
  });

  it('still rejects a figure whose written sign contradicts the fact', () => {
    expect(verifyNumbers('The stock is +0.50% on the day.', FACTS2).ok).toBe(false);
  });

  it('accepts a written sign that agrees', () => {
    expect(verifyNumbers('The stock is -0.50% on the day.', FACTS2).ok).toBe(true);
  });
});

describe('tokens embedded in words and ids', () => {
  it('ignores hex fragments inside citation ids', () => {
    // "catch:8c4e41b6-cbce-4024-a1da-c9cb2b76e792" used to yield a "0b" token,
    // read as zero billion, whose tolerance swallowed every dollar figure.
    const facts = 'FINDINGS\n[catch:8c4e41b6-cbce-4024-a1da-c9cb2b76e792] NVDA pillar\nTotal value $1,294,883';
    const c = verifyNumbers('Technology is about $620,000 of the book.', facts);
    expect(c.ok).toBe(false);
    expect(c.unverified[0].raw).toContain('620,000');
  });

  it('still reads a real suffixed figure', () => {
    expect(verifyNumbers('Market cap $2.15B.', 'Market Cap: $2,150,000,000').ok).toBe(true);
  });

  it('ignores a number glued to letters', () => {
    expect(extractFigures('Q3 revenue and 10K filings').map((f) => f.raw)).toEqual([]);
  });
});

describe('durations are not figures', () => {
  it('ignores a 52-week window on both sides', () => {
    // The facts write "52W High: $195.10"; the model writes "52-week high".
    // Neither is asserting the number 52 about the company.
    expect(verifyNumbers('Trading near its 52-week high of $195.10.', '52W High: $195.10').ok).toBe(true);
  });

  it('ignores three-year and quarterly phrasing', () => {
    expect(extractFigures('over the last 3 years and 2 quarters').map((f) => f.raw)).toEqual([]);
  });

  it('still checks a real figure in the same sentence', () => {
    expect(verifyNumbers('Over 3 years revenue grew 40%.', 'Revenue Growth YoY: 19.32%').ok).toBe(false);
  });
});

describe('index names and trailing commas', () => {
  it('does not read the 500 in S&P 500 as a figure', () => {
    expect(verifyNumbers('Your book is not compared to the S&P 500 here.', 'Total value $1,294,883').ok).toBe(true);
    expect(verifyNumbers('The Nasdaq 100 and Russell 2000 are not in the data.', 'Total value $1,294,883').ok).toBe(true);
  });

  it('does not let a number end on a comma', () => {
    const [f] = extractFigures('unrealized +$479, and cost basis $873,226');
    expect(f.raw).toBe('+$479');
    expect(f.value).toBe(479);
  });

  it('still reads a full comma-grouped number', () => {
    expect(extractFigures('$873,226')[0].value).toBe(873226);
  });
});
