import { describe, it, expect } from 'vitest';
import { citationDefect } from '@/lib/content/citation-quality';

const pass = (s: string, v: 'supports' | 'contradicts' | 'neutral' = 'supports', t?: string) =>
  citationDefect(s, v, t);

describe('citationDefect — the real MSTR rows that prompted this', () => {
  it('kills safe-harbor boilerplate scored as contradicting evidence', () => {
    const d = pass(
      'Actual results may differ materially from these forward-looking statements due to various important factors, including fluctuations in the price of Bitcoin and the risk factors discussed under the caption “Risk Factors” in Strategy’s Quarterly Report on Form 10-Q filed with the SEC on August 3, 2026',
      'contradicts',
    );
    expect(d?.code).toBe('boilerplate');
  });

  it('kills a table footnote', () => {
    expect(pass('net proceeds are presented net of sales commission.')?.code).toBe('fragment');
  });

  it('kills the same event with its subject and verb cut off', () => {
    expect(pass('$21.0 billion offering of MSTR Stock (the “MSTR Increase”).')?.code).toBe('fragment');
  });

  it('KEEPS the one real finding in that set', () => {
    expect(pass('Strategy announced a new $21.0 billion offering of MSTR Stock (the “MSTR Increase”).')).toBeNull();
  });
});

describe('citationDefect — does not eat real evidence', () => {
  const good = [
    'Data-center segment revenue declined 4% sequentially as hyperscaler orders slipped into the following quarter.',
    'Operating margin for the three months ended June 30, 2026 decreased by approximately one percentage point as compared to the prior comparative period.',
    'The Company repurchased 12.4 million shares for $1.8 billion during the quarter.',
    'Gross margin was 74.2%, down from 78.4% a year earlier.',
  ];
  for (const g of good) {
    it(`keeps: ${g.slice(0, 52)}…`, () => expect(pass(g, 'contradicts')).toBeNull());
  }
});

describe('citationDefect — the other boilerplate shapes', () => {
  const junk: [string, string][] = [
    ['These statements are forward-looking statements within the meaning of the securities laws.', 'boilerplate'],
    ['The Company undertakes no obligation to publicly update any forward-looking statement.', 'boilerplate'],
    ['This information is incorporated herein by reference to Exhibit 99.1 of the report.', 'boilerplate'],
    ['The results should be read in conjunction with the audited financial statements for the year.', 'boilerplate'],
    ['See Note 12 for further detail on the segment reporting changes made this period.', 'boilerplate'],
  ];
  for (const [s, code] of junk) {
    it(`kills: ${s.slice(0, 46)}…`, () => expect(pass(s)?.code).toBe(code));
  }
});

describe('citationDefect — the material bar', () => {
  // Scoped to filings: a news headline is a legitimate finding without a figure
  // in the sentence, and an unscoped version of this rule dropped 353 of them.
  it('rejects a supporting claim from a FILING with nothing checkable in it', () => {
    expect(pass('The Company believes its strategy remains well positioned for the future.', 'supports', 'filing')?.code)
      .toBe('unfalsifiable');
  });

  it('leaves the same sentence alone when it came from news', () => {
    expect(pass('The Company believes its strategy remains well positioned for the future.', 'supports', 'news')).toBeNull();
  });

  it('allows the same sentence as neutral context', () => {
    expect(pass('The Company believes its strategy remains well positioned for the future.', 'neutral')).toBeNull();
  });

  it('accepts a date instead of a figure', () => {
    expect(pass('The transaction was completed in September and remains subject to review.', 'supports', 'filing')).toBeNull();
  });
});

describe('citationDefect — system-generated rows are exempt', () => {
  it('lets a price move through despite having no verb', () => {
    expect(pass('PRIM fell 38.2% on 2026-06-23', 'contradicts', 'price_move')).toBeNull();
  });
  it('lets an xbrl line through', () => {
    expect(pass('Q2 2026 Revenue: $1.2B vs $980M prior year', 'supports', 'xbrl')).toBeNull();
  });
});

describe('citationDefect — degenerate input', () => {
  it('rejects empty', () => expect(pass('')?.code).toBe('empty'));
  it('rejects null', () => expect(citationDefect(null, 'supports')?.code).toBe('empty'));
});
