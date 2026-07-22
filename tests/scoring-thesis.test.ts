import { describe, it, expect } from 'vitest';
import { classifySource, classifyEvidence } from '@/lib/content/scoring-thesis';

describe('classifySource', () => {
  it('maps our stored source types onto independent corroboration classes', () => {
    expect(classifySource('filing', 'https://www.sec.gov/Archives/x.htm')).toBe('company_filing');
    expect(classifySource('xbrl', null)).toBe('xbrl');
    expect(classifySource('form4', null)).toBe('insider');
    expect(classifySource('price_move', null)).toBe('price');
  });

  it('treats a company press release as primary', () => {
    expect(classifySource('news', 'https://www.globenewswire.com/news-release/abc')).toBe('primary_news');
  });

  it('refuses to call syndicators primary', () => {
    // Yahoo and Nasdaq carry both wire copy and opinion columns and are 741 of
    // 1,000 sampled rows. Trusting them as primary would let the ladder
    // escalate on an aggregator reprint.
    expect(classifySource('news', 'https://finance.yahoo.com/news/abc')).toBe('analyst_opinion');
    expect(classifySource('news', 'https://www.nasdaq.com/articles/abc')).toBe('analyst_opinion');
    expect(classifySource('news', 'https://247wallst.com/abc')).toBe('analyst_opinion');
  });

  it('falls back to opinion when the url is missing or unparseable', () => {
    expect(classifySource('news', null)).toBe('analyst_opinion');
    expect(classifySource('news', 'not a url')).toBe('analyst_opinion');
  });
});

describe('classifyEvidence', () => {
  const REPORTED_NUMBER = 'Operating margin decreased by approximately 1.2% as compared to the prior period.';

  it('will not call anything realized when the pillar has no kill criterion', () => {
    // Nothing to check the number against, so claiming the thesis broke is
    // unsupported. This is what stopped a routine 10-Q reading as "broken".
    expect(classifyEvidence('company_filing', REPORTED_NUMBER, false)).toBe('emerging');
  });

  it('calls a measured, unhedged, reported change realized once a kill criterion exists', () => {
    expect(classifyEvidence('company_filing', REPORTED_NUMBER, true)).toBe('realized');
  });

  it('requires an actual number, not just past tense', () => {
    expect(classifyEvidence('company_filing', 'Revenues increased compared to the prior period.', true)).toBe('emerging');
  });

  it('demotes hedged language even from a filing', () => {
    expect(classifyEvidence('company_filing', 'Margins could decline by 3% if costs rise.', true)).toBe('emerging');
  });

  it('treats a hedged opinion piece as speculative', () => {
    expect(classifyEvidence('analyst_opinion', 'Morgan Stanley predicted prices would keep rising.', true)).toBe('speculative');
  });

  it('treats an unhedged wire report as an emerging mechanism', () => {
    expect(classifyEvidence('primary_news', 'The company shut its Ohio plant on Tuesday.', true)).toBe('emerging');
  });

  it('never lets an opinion column reach realized', () => {
    expect(classifyEvidence('analyst_opinion', 'Revenue rose 14% last quarter.', true)).toBe('speculative');
  });
});
