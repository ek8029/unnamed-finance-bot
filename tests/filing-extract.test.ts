import { describe, it, expect } from 'vitest';
import { extractFilingSection, stripFilingHtml } from '@/lib/filing-extract';

const COVER =
  'UNITED STATES SECURITIES AND EXCHANGE COMMISSION FORM 10-Q. ' +
  'Indicate by check mark whether the registrant is a well known seasoned issuer. ' +
  'COVER '.repeat(60);

describe('stripFilingHtml', () => {
  it('strips tags', () => {
    expect(stripFilingHtml('<p>hello <b>world</b></p>')).toBe('hello world');
  });

  it('decodes the numeric non-breaking space that glues numbers together', () => {
    // "108&#160;million" must read as "108 million" or a quote never matches it.
    expect(stripFilingHtml('We repurchased 108&#160;million shares for $20.2&#160;billion.')).toBe(
      'We repurchased 108 million shares for $20.2 billion.',
    );
  });

  it('decodes hex entities and named ampersand/lt/gt', () => {
    expect(stripFilingHtml('x&#xA0;y')).toBe('x y');
    expect(stripFilingHtml('AT&amp;T filed a &lt;form&gt;')).toBe('AT&T filed a <form>');
  });

  it('decodes numeric punctuation entities, leaving no raw entity text', () => {
    const out = stripFilingHtml('the Company&#8217;s results &#8212; strong');
    expect(out).not.toContain('&#');
    expect(out).toContain('Company');
  });

  it('drops financial tables (number soup) but keeps the narrative prose', () => {
    const html =
      '<p>Revenue grew.</p><table><tr><td>Gross profit</td><td>74.9</td><td>60.5</td></tr></table><p>Driven by data center demand.</p>';
    expect(stripFilingHtml(html)).toBe('Revenue grew. Driven by data center demand.');
  });
});

describe('extractFilingSection', () => {
  it('lands on the Results of Operations content section, skipping TOC, header tail, and risk-factor mentions', () => {
    const toc = ' Results of Operations 23 Item 3 Market Risk 30 ';
    const header =
      " Management's Discussion and Analysis of Financial Condition and Results of Operations Forward-Looking Statements this report contains forward looking statements. ";
    const riskMention = ' could harm our business and results of operations or reputation. ';
    const content = ' Results of Operations Revenue rose 30 percent on data center strength. ' + 'N'.repeat(200);
    const out = extractFilingSection(COVER + toc + header + riskMention + content, '10-Q', 200);
    expect(out).toContain('Revenue rose 30 percent');
    expect(out).not.toContain('Forward-Looking');
    expect(out).not.toContain('check mark');
  });

  it('matches the "Results of Continuing Operations" heading variant', () => {
    const doc = COVER + ' Results of Continuing Operations Segment revenue grew sharply. ' + 'N'.repeat(300);
    expect(extractFilingSection(doc, '10-Q', 200)).toContain('Segment revenue grew sharply');
  });

  it('falls back to risk factors when no MD&A results section is present', () => {
    const doc = COVER + ' Risk Factors Our business faces competition and supply constraints. ' + 'R'.repeat(300);
    expect(extractFilingSection(doc, '10-K', 200)).toContain('Our business faces competition');
  });

  it('8-K: returns a post-cover body window, not the cover start', () => {
    const doc = 'A'.repeat(1600) + ' Item 2.02 Results of Operations. Quarterly revenue was strong. ' + 'B'.repeat(300);
    const out = extractFilingSection(doc, '8-K', 200);
    expect(out).toContain('Item 2.02');
    expect(out).not.toContain('AAAA');
  });

  it('returns short filings whole', () => {
    const short = 'Short filing text well under the limit.';
    expect(extractFilingSection(short, '10-K', 8000)).toBe(short);
  });
});
