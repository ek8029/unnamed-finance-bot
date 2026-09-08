// tests/news-subject.test.ts
import { describe, it, expect } from 'vitest';
import { subjectPrefilter, lowValueShape } from '@/lib/news-subject';
import { detectPrimaryTicker, titleTargetsTicker } from '@/lib/news-primary-ticker';
import { isDirectHoldingNews } from '@/lib/news-relevance';

const call = (title: string, ticker = 'AMZN', companyName: string | null = 'Amazon.com Inc', tickers: string[] = [ticker]) =>
  subjectPrefilter({ title, ticker, companyName, tickers });

describe('subjectPrefilter', () => {
  it('drops market wrappers and live blogs', () => {
    expect(call('Stock Market Today: Dow Up On Fed Remarks; Nvidia Rallies', 'NVDA', 'NVIDIA Corp')?.reason).toBe('market wrapper');
    expect(call('US Stock Futures Rangebound After S&P 500 Snaps Losing Streak', 'MSFT', 'Microsoft Corp')?.reason).toBe('market wrapper');
    expect(call('Market Chatter: Anthropic, OpenAI Take Different Positions')?.reason).toBe('market wrapper');
  });

  it('drops aggregator list posts', () => {
    expect(call('Top Analyst Reports for Amazon, AbbVie & Alibaba')?.reason).toBeTruthy();
    expect(call('The Zacks Analyst Blog Highlights AMD, Costco and AstraZeneca', 'AMD', 'Advanced Micro Devices')?.reason).toBeTruthy();
  });

  it('drops a series of three or more names', () => {
    expect(call('Microsoft, Amazon, Google Circle $50B Chinese AI Upstart')?.reason).toBe('name series');
  });

  it('drops the ex-employer shape', () => {
    expect(call('Ex-Nvidia engineer raises $30M for chip startup', 'NVDA', 'NVIDIA Corp')?.reason).toBe('ex-employer');
    expect(call('Former Amazon exec joins rival grocery chain')?.reason).toBe('ex-employer');
  });

  it('leaves comparison pieces alone: they ARE about the company', () => {
    // Editorial calls live in lowValueShape, not in a stored accuracy verdict.
    expect(call('BigBear.ai vs. Palantir: Which Defense AI Stock Is the Better Choice?', 'PLTR', 'Palantir Technologies')).toBeNull();
  });

  it('keeps real company news for the model to confirm', () => {
    expect(call('FTC, 22 States Sue Amazon Over Unfair Charges In Ad Surcharge Scheme')).toBeNull();
    expect(call('Amazon.com (AMZN): AI Exposure Adds, But Other Businesses Drive Results')).toBeNull();
    expect(call('AbbVie Reports Positive Phase 3 Results For Etentamig', 'ABBV', 'AbbVie Inc')).toBeNull();
  });

  it('never returns about, only mention or null', () => {
    const r = call('Apple Reports Record Quarter', 'AAPL', 'Apple Inc');
    expect(r === null || r.verdict === 'mention').toBe(true);
  });

  it('an empty title is a mention, not a crash', () => {
    expect(call('')?.reason).toBe('no title');
  });
});

describe('company-name normalization', () => {
  // Regression: "Amazon.com Inc" used to normalize to AMAZONCOM, which matches
  // no headline, so every Amazon article missed name detection entirely.
  it('matches a headline naming a company whose legal name carries a dot', () => {
    expect(titleTargetsTicker('Why I Keep Accumulating Amazon Stock', 'AMZN', 'Amazon.com Inc')).toBe(true);
  });

  it('still resolves the subject among several tagged tickers', () => {
    const names = new Map([['AMZN', 'Amazon.com Inc'], ['WMT', 'Walmart Inc']]);
    expect(detectPrimaryTicker('Amazon opens a smaller-format grocery store', null, ['WMT', 'AMZN'], names)).toBe('AMZN');
  });

  it('returns null rather than guessing when nothing matches', () => {
    const names = new Map([['AMZN', 'Amazon.com Inc'], ['WMT', 'Walmart Inc']]);
    expect(detectPrimaryTicker('Grocery prices climb for a third month', null, ['WMT', 'AMZN'], names)).toBeNull();
  });
});

describe('short/common-word ticker ambiguity', () => {
  it.each(['ON', 'ALL', 'IT', 'KEY', 'CAR', 'A', 'AI', 'OPEN', 'REAL'])('requires explicit ticker evidence for %s even when the company name is missing', ticker => {
    expect(titleTargetsTicker(`Bitcoin rallies as ${ticker} becomes a theme`, ticker, ticker)).toBe(false);
    expect(titleTargetsTicker(`Earnings update for $${ticker}`, ticker, ticker)).toBe(true);
    expect(titleTargetsTicker(`Earnings update for (${ticker})`, ticker, ticker)).toBe(true);
  });

  it('recognizes the actual company behind a common-word symbol', () => {
    expect(titleTargetsTicker('KeyCorp appoints a new chief executive', 'KEY', 'KeyCorp')).toBe(true);
    expect(titleTargetsTicker('onsemi opens a new chip plant', 'ON', 'ON Semiconductor')).toBe(true);
  });
});

describe('single feed tags do not establish an article subject', () => {
  const names = new Map([
    ['NVDA', 'NVIDIA Corporation'],
    ['GOOGL', 'Alphabet Inc Class A'],
    ['AAPL', 'Apple Inc'],
  ]);

  it('does not attribute a Bitcoin story to an Nvidia feed subscriber', () => {
    expect(detectPrimaryTicker('Bitcoin rallies as traders weigh the next rate decision', null, ['NVDA'], names)).toBeNull();
  });

  it('does not attribute an Apple story to an Alphabet feed subscriber', () => {
    expect(detectPrimaryTicker('Apple introduces its newest iPhone', null, ['GOOGL'], names)).toBeNull();
  });

  it('does not promote a summary or footer mention into a headline subject', () => {
    expect(detectPrimaryTicker('Bitcoin rallies as traders weigh the next rate decision', 'Also consider NVIDIA stock ($NVDA).', ['NVDA'], names)).toBeNull();
  });

  it.each([
    ['Nvidia reports record data center sales', 'NVDA'],
    ['Apple introduces its newest iPhone', 'AAPL'],
    ['Alphabet reports quarterly results', 'GOOGL'],
    ['NVDA raises its dividend', 'NVDA'],
    ['Earnings update for (AAPL)', 'AAPL'],
  ])('keeps headline subject %s', (title, ticker) => {
    expect(detectPrimaryTicker(title, null, [ticker], names)).toBe(ticker);
  });

  it('preserves multi-ticker subject selection regardless of provider ordering', () => {
    expect(detectPrimaryTicker('Apple introduces its newest iPhone', null, ['GOOGL', 'AAPL', 'NVDA'], names)).toBe('AAPL');
  });

  it('preserves the existing multi-candidate description fallback', () => {
    expect(detectPrimaryTicker('Chipmaker announces results', 'NVIDIA reported record sales.', ['GOOGL', 'NVDA'], names)).toBe('NVDA');
  });
});

describe('cached news portfolio claims', () => {
  // Headlines observed in the UI; these feed/holding associations are synthetic
  // fixtures, not assertions about the original provider response.
  it.each([
    ['Wall Street Investment Firm Bernstein Thinks Bitcoin Could Hit $300,000 by 2029. Is Bitcoin Now a Buy?', 'NVDA', 'NVIDIA Corporation'],
    ['Apple’s new CEO faces a staggering $14 billion iPhone test', 'GOOGL', 'Alphabet Inc Class A'],
  ])('keeps observed unrelated headline as context: %s', (title, ticker, asset_name) => {
    expect(detectPrimaryTicker(title, null, [ticker], new Map([[ticker, asset_name]]))).toBeNull();
    expect(isDirectHoldingNews({ title, primaryTicker: ticker }, { ticker, asset_name })).toBe(false);
  });

  it('treats a Bitcoin story with a stale Nvidia primary ticker as context', () => {
    expect(isDirectHoldingNews(
      { title: 'Bitcoin rallies as traders weigh the next rate decision', primaryTicker: 'NVDA' },
      { ticker: 'NVDA', asset_name: 'NVIDIA Corporation' },
    )).toBe(false);
  });

  it('treats an Apple story with a stale Alphabet primary ticker as context', () => {
    expect(isDirectHoldingNews(
      { title: 'Apple introduces its newest iPhone', primaryTicker: 'GOOGL' },
      { ticker: 'GOOGL', asset_name: 'Alphabet Inc Class A' },
    )).toBe(false);
  });

  it('allows the actual subject holding through company-name evidence', () => {
    expect(isDirectHoldingNews(
      { title: 'Apple introduces its newest iPhone', primaryTicker: 'AAPL' },
      { ticker: 'AAPL', asset_name: 'Apple Inc' },
    )).toBe(true);
  });

  it('does not promote a tangential held ticker over the primary subject', () => {
    expect(isDirectHoldingNews(
      { title: 'Spotify partners with Apple', primaryTicker: 'SPOT' },
      { ticker: 'AAPL', asset_name: 'Apple Inc' },
    )).toBe(false);
  });

  it('does not infer a subject from the title when the feed has no primary subject', () => {
    expect(isDirectHoldingNews(
      { title: 'Apple introduces its newest iPhone', primaryTicker: null },
      { ticker: 'AAPL', asset_name: 'Apple Inc' },
    )).toBe(false);
  });

  it('does not claim portfolio impact for an unheld company', () => {
    expect(isDirectHoldingNews({ title: 'Apple introduces its newest iPhone', primaryTicker: 'AAPL' })).toBe(false);
  });
});

describe('lowValueShape', () => {
  it('flags opinion comparisons for the feed', () => {
    expect(lowValueShape('BigBear.ai vs. Palantir: Which Defense AI Stock Is the Better Choice?')).toBe('comparison headline');
    expect(lowValueShape('Better AI Infrastructure Stock: Nvidia vs. AMD')).toBe('comparison headline');
  });

  it('leaves reported events alone', () => {
    expect(lowValueShape('AbbVie Reports Positive Phase 3 Results For Etentamig')).toBeNull();
    expect(lowValueShape('Adobe names longtime exec Anil Chakravarthy CEO')).toBeNull();
    expect(lowValueShape('Apple Q3 revenue beat vs estimates')).toBeNull();
  });
});
