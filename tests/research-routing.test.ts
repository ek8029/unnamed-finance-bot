import { describe, it, expect } from 'vitest';
import {
  isMoveExplanation,
  wantsGroundedAnswer,
  detectTopics,
  extractTickers,
} from '@/lib/research/query-parse';

/** The route's actual guard, mirrored so a regression here fails loudly. */
function cardOwnsIt(query: string, queryType: 'stock_analysis' | 'other'): boolean {
  return queryType === 'stock_analysis' && !isMoveExplanation(query);
}
function goesGrounded(query: string, queryType: 'stock_analysis' | 'other'): boolean {
  return !cardOwnsIt(query, queryType) && wantsGroundedAnswer(query, detectTopics(query));
}

describe('isMoveExplanation', () => {
  const yes = [
    'why is PLTR up so much today',
    'why is pltr up so much today',
    'Why did NVDA drop yesterday?',
    'why is MU tanking',
    'what happened to AAPL today',
    "what's going on with TSLA",
    'how come AMD is down',
    "what's driving the move in COIN",
    'why is my portfolio red today',
  ];
  for (const q of yes) {
    it(`treats as a move question: "${q}"`, () => expect(isMoveExplanation(q)).toBe(true));
  }

  const no = [
    'analyze PLTR',
    'PLTR',
    'give me a breakdown of NVDA',
    'is AAPL a good buy',
    'should I sell my MSFT',
    'what is the P/E of GOOGL',
  ];
  for (const q of no) {
    it(`leaves to the card: "${q}"`, () => expect(isMoveExplanation(q)).toBe(false));
  }
});

describe('routing — the card must not swallow move questions', () => {
  it('sends "why is PLTR up so much today" to the grounded engine', () => {
    // Names a ticker, so classifyQuery calls it stock_analysis. Before the fix
    // that short-circuited the grounded path entirely and the user got a
    // multiples card with "positive market sentiment" as the explanation.
    expect(extractTickers('why is PLTR up so much today')).toContain('PLTR');
    expect(goesGrounded('why is PLTR up so much today', 'stock_analysis')).toBe(true);
  });

  it('still lets a clean analysis request keep its card', () => {
    expect(goesGrounded('analyze PLTR', 'stock_analysis')).toBe(false);
    expect(goesGrounded('PLTR', 'stock_analysis')).toBe(false);
  });

  it('own-book questions stay grounded regardless of classification', () => {
    expect(goesGrounded('which ticker is challenged and by what?', 'other')).toBe(true);
    expect(goesGrounded('how much could I harvest?', 'other')).toBe(true);
  });
});
