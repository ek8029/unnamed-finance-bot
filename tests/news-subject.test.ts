// tests/news-subject.test.ts
import { describe, it, expect } from 'vitest';
import { subjectPrefilter, lowValueShape } from '@/lib/news-subject';
import { detectPrimaryTicker, titleTargetsTicker } from '@/lib/news-primary-ticker';

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
