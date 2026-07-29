import { describe, it, expect } from 'vitest';
import { extractTickers, detectTopics, isAdviceAsk, topicToInsightTypes, wantsGroundedAnswer } from '@/lib/research/query-parse';

describe('extractTickers', () => {
  it('picks explicit caps tickers and drops stopwords', () => {
    expect(extractTickers('How is my NVDA position doing?')).toEqual(['NVDA']);
  });
  it('picks $-prefixed and lowercase well-known tickers', () => {
    expect(extractTickers('compare $tsla to pltr').sort()).toEqual(['PLTR', 'TSLA']);
  });
  it('returns nothing for a topic-only question', () => {
    expect(extractTickers('any tax-loss harvesting opportunities?')).toEqual([]);
  });
});

describe('detectTopics', () => {
  it('flags tax on a harvesting question', () => {
    expect(detectTopics('any tax-loss harvesting opportunities?')).toContain('tax');
  });
  it('flags risk and concentration together', () => {
    const t = detectTopics('am I too concentrated, what is my biggest risk?');
    expect(t).toContain('risk');
    expect(t).toContain('concentration');
  });
  it('flags earnings', () => {
    expect(detectTopics('did NVDA beat on earnings last quarter?')).toContain('earnings');
  });
  it('returns empty for a cold analysis question', () => {
    expect(detectTopics('tell me about the company')).toEqual([]);
  });
});

describe('topicToInsightTypes', () => {
  it('maps tax to the tax insight type', () => {
    expect(topicToInsightTypes(['tax'])).toEqual(['tax']);
  });
  it('dedupes across overlapping topics', () => {
    const types = topicToInsightTypes(['risk', 'concentration']);
    expect(types).toContain('portfolio');
    expect(new Set(types).size).toBe(types.length);
  });
});

describe('wantsGroundedAnswer', () => {
  it('is true whenever a topic is present', () => {
    expect(wantsGroundedAnswer('harvest?', ['tax'])).toBe(true);
  });
  it('is true for own-book / agent-history questions with no topic', () => {
    expect(wantsGroundedAnswer('why is my position down and what did you see?', [])).toBe(true);
    expect(wantsGroundedAnswer('what changed on my thesis this week?', [])).toBe(true);
  });
  it('is false for a cold ticker analysis with no topic', () => {
    expect(wantsGroundedAnswer('bull case on the stock', [])).toBe(false);
  });
  it('is true for findings-vocabulary questions without own-book pronouns', () => {
    expect(wantsGroundedAnswer('which ticker is challenged and by what?', [])).toBe(true);
    expect(wantsGroundedAnswer('what is weakening right now?', [])).toBe(true);
    expect(wantsGroundedAnswer('any theses breaking?', [])).toBe(true);
    expect(wantsGroundedAnswer('what has helm flagged lately?', [])).toBe(true);
    expect(wantsGroundedAnswer('anything under pressure?', [])).toBe(true);
  });
  it('is true for which-position phrasing', () => {
    expect(wantsGroundedAnswer('which holding is doing worst?', [])).toBe(true);
    expect(wantsGroundedAnswer('which positions have findings against them?', [])).toBe(true);
  });
  it('is true when the question names Helm', () => {
    expect(wantsGroundedAnswer('what did helm find this week?', [])).toBe(true);
    expect(wantsGroundedAnswer('has Helm noticed anything?', [])).toBe(true);
  });
});

describe('isAdviceAsk', () => {
  it('catches should-I decision asks', () => {
    expect(isAdviceAsk('Should I sell my AAPL?')).toBe(true);
    expect(isAdviceAsk('should we buy more nvda here?')).toBe(true);
    expect(isAdviceAsk('should I just hold through earnings?')).toBe(true);
    expect(isAdviceAsk('is it worth selling now?')).toBe(true);
  });
  it('does not fire on state questions', () => {
    expect(isAdviceAsk('which ticker is challenged and by what?')).toBe(false);
    expect(isAdviceAsk('how much could I harvest in tax losses?')).toBe(false);
    expect(isAdviceAsk('should I worry about concentration?')).toBe(false);
  });
});
