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
  it('kills puffery, whatever it was filed under', () => {
    for (const t of ['filing', 'news', undefined]) {
      expect(pass('The Company believes its strategy remains well positioned for the future.', 'supports', t)?.code)
        .toBe('boilerplate');
    }
  });

  it('kills a filing describing its own segments or accounting policy', () => {
    expect(pass('We have two operating segments, commercial and government, which were determined by the chief operating decision maker.', 'supports', 'filing')?.code)
      .toBe('unfalsifiable');
    expect(pass('Revenue is generally recognized over the contract term on a ratable basis, consistent with prior periods.', 'supports', 'filing')?.code)
      .toBe('unfalsifiable');
  });

  // These four are the real rows a "filing needs a figure or a date" rule
  // deleted. Any future version of that idea has to keep them.
  const realMdna = [
    'We are reaffirming our fiscal year revenue guidance range and raising our full year guidance ranges for adjusted operating margin.',
    'Broadcom to develop and supply a range of custom ASIC silicon products for use in multiple generations of Apple products.',
    'The increase in costs and expenses was primarily due to increases in employee compensation, including severance expenses.',
    'Volume growth was driven primarily by continued resilience in consumer spending and ongoing expansion in digital commerce.',
  ];
  for (const s of realMdna) {
    it(`keeps real MD&A: ${s.slice(0, 46)}…`, () => expect(pass(s, 'supports', 'filing')).toBeNull());
  }
});

describe('citationDefect — news noise', () => {
  it('kills a columnist writing in the first person', () => {
    expect(pass('I keep hitting the buy button on Advanced Micro Devices because every quarter Lisa Su gives me a fresh reason.', 'supports', 'news')?.detail)
      .toBe('first-person-opinion');
  });

  it('kills a rating change and a price target', () => {
    expect(pass('Citi has upgraded Advanced Micro Devices to Buy from Neutral, raising its price target to $575 from $460.', 'supports', 'news')?.detail)
      .toBe('analyst-rating');
  });

  it('kills a listicle placement', () => {
    expect(pass('Broadcom Inc. (NASDAQ:AVGO) is one of the 10 Best AI Chip Stocks to Buy for the Long Term.', 'supports', 'news')?.detail)
      .toBe('listicle');
  });

  it('kills a sentence whose subject is what analysts think', () => {
    expect(pass('Analysts expect tariff refunds and lower fuel costs to offset the discounts, leaving profit guidance intact.', 'supports', 'news')?.detail)
      .toBe('analyst-opinion');
  });

  // The same words as a trailing clause do not make the sentence about the
  // analyst. This row is evidence about a product.
  it('keeps an analyst outlook quoted at the end of a sentence about the business', () => {
    expect(pass('These platforms are based on Broadcom\'s Tomahawk 6 ASIC with a total capacity of 102.4Tbps across 64 ports of 1.6Tbps - which industry analysts expect to make up the majority of new AI ports deployed by 2027.', 'supports', 'news'))
      .toBeNull();
  });

  it('leaves filings alone: news rules do not apply to them', () => {
    expect(pass('The Company raised its price target range for the segment during the period ended June 30, 2026.', 'supports', 'filing')).toBeNull();
  });
});

describe('citationDefect — severity', () => {
  it('marks a chopped clause soft, because the words in it are usually true', () => {
    const d = pass('the UK government has formally launched a comprehensive review of its £330 million NHS contract with Palantir Technologies.', 'contradicts', 'news');
    expect(d?.detail).toBe('starts mid-sentence');
    expect(d?.severity).toBe('soft');
  });

  it('marks boilerplate hard', () => {
    expect(pass('Actual results may differ materially from these forward-looking statements due to various factors.', 'contradicts', 'filing')?.severity)
      .toBe('hard');
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
