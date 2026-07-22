import { describe, it, expect } from 'vitest';
import { classifyClaim } from '@/lib/content/claim-type';
import { classifySource } from '@/lib/content/scoring-thesis';

// Every string below is a real source_title or excerpt from pillar_evidence.
describe('classifyClaim', () => {
  it('reads a reported event as an event even when a syndicator carried it', () => {
    // The four PLTR items the domain heuristic filed as analyst opinion, which
    // is what let the ladder talk a real string of contract losses down to watch.
    const events = [
      "Palantir (PLTR) Faces Swiss Legal Loss And French Contract Exit In Europe French authorities have ended Palantir's work with the country's intelligence agency, opting for a domestic provider instead.",
      'Can Palantir (PLTR) Hold Its £330 Million NHS Contract as the UK Government Turns Up the Heat? the UK government has formally launched a comprehensive review of its £330 million NHS contract',
      'Palantir Took a Swiss Courtroom Loss and a European Credibility Hit France is ditching Palantir, while London has blocked it and Germany has replaced it',
      'Apple China iPhone Sell-In Drops 19%',
    ];
    for (const t of events) expect(classifyClaim(t), t.slice(0, 50)).toBe('reported_event');
  });

  it('reads sell-side framing as opinion however factually it is written', () => {
    const opinions = [
      'Stifel cuts Microsoft target, says Street FY27 gross margin estimates are too high',
      'Apple Stock Downgraded To Sell. A Wall Street analyst downgraded Apple stock to the equivalent of a sell rating',
      'AMD Looks Set for a Beat-and-Raise Quarter on Surging AI Server Demand, According to BofA',
      'Chinese Open LLMs are no threat to memory demand, BofA says. Bank of America told clients in a note Tuesday',
      "Google's In-House AI Chip Strategy Could Be a Bigger Threat to Nvidia Than Investors Think. Google could lower its AI compute costs by up to 30%",
      '3 Hypergrowth Tech Stocks to Buy With $3,000 Right Now',
    ];
    for (const t of opinions) expect(classifyClaim(t), t.slice(0, 50)).toBe('opinion');
  });

  it('does not mistake a membership upgrade for a rating upgrade', () => {
    expect(
      classifyClaim('CNCF Strengthens Partnership with Broadcom as a Platinum Member. CNCF today announced that Broadcom has upgraded its membership'),
    ).toBe('reported_event');
  });

  it("does not let \"won't\" match the verb won", () => {
    expect(
      classifyClaim("Gary Black Says Tesla's Valuation Is So Stretched That Most Institutional Investors Won't Touch the Stock"),
    ).toBe('opinion');
  });

  it('handles present-tense headlines, which is how headlines are written', () => {
    expect(classifyClaim('Meta expands Louisiana Hyperion data center to 5GW and $50 billion')).toBe('reported_event');
    expect(classifyClaim('Amazon (AMZN) Launches Leo Broadband As Alexa Ads And AWS AI Reach Grow')).toBe('reported_event');
  });

  it('defaults to opinion when nothing is recognisable, so it cannot escalate alone', () => {
    expect(classifyClaim('The server CPU story is being ...')).toBe('opinion');
    expect(classifyClaim('')).toBe('opinion');
  });

  // Known misses, kept as documentation rather than aspiration. These are why
  // the judge owns this field going forward: they need meaning, not vocabulary.
  it.fails('still misreads a rating change phrased without the word "price"', () => {
    expect(classifyClaim('UBS Raises AMD Target on Stronger AI Outlook')).toBe('opinion');
  });

  it.fails('still misreads a deal in progress as opinion', () => {
    expect(classifyClaim('Anthropic in talks to lease Meta computing power in $10 billion deal')).toBe('reported_event');
  });
});

describe('classifySource', () => {
  it('takes the judge\'s stored answer over any inference', () => {
    expect(classifySource('news', 'https://finance.yahoo.com/x', 'Stifel cuts price target', 'primary_news')).toBe('primary_news');
  });

  it('ignores a stored value that is not a known class', () => {
    expect(classifySource('news', 'https://finance.yahoo.com/x', 'analysts say it may rise', 'nonsense')).toBe('analyst_opinion');
  });

  it('trusts wires and press-release distributors by domain', () => {
    expect(classifySource('news', 'https://www.globenewswire.com/news-release/x', 'anything at all')).toBe('primary_news');
  });

  it('classifies a syndicated report by its claim, not its domain', () => {
    expect(
      classifySource('news', 'https://finance.yahoo.com/x', "French authorities have ended Palantir's work with the agency"),
    ).toBe('primary_news');
    expect(
      classifySource('news', 'https://finance.yahoo.com/x', 'Stifel cuts its price target on Microsoft to $400'),
    ).toBe('analyst_opinion');
  });

  it('settles non-news source types by type alone', () => {
    expect(classifySource('filing', null, '')).toBe('company_filing');
    expect(classifySource('price_move', null, '')).toBe('price');
    expect(classifySource('form4', null, '')).toBe('insider');
    expect(classifySource('xbrl', null, '')).toBe('xbrl');
  });
});
