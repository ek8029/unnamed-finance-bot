// tests/investigation-memo.test.ts — pure parts of the E1 investigation agent.
import { describe, it, expect } from 'vitest';
import { classifyTrigger, hasAdviceLanguage } from '@/lib/investigation-memo';

describe('classifyTrigger', () => {
  it('price-move contradiction wins', () => {
    expect(classifyTrigger([
      { source_type: 'price_move', verdict: 'contradicts' },
      { source_type: 'filing', verdict: 'contradicts' },
    ])).toBe('severe_move');
  });
  it('filing contradiction next', () => {
    expect(classifyTrigger([
      { source_type: 'filing', verdict: 'contradicts' },
      { source_type: 'news', verdict: 'contradicts' },
    ])).toBe('new_filing');
  });
  it('two or more news contradictions = pressure', () => {
    expect(classifyTrigger([
      { source_type: 'news', verdict: 'contradicts' },
      { source_type: 'news', verdict: 'contradicts' },
    ])).toBe('pressure');
  });
  it('single soft contradiction = breach', () => {
    expect(classifyTrigger([{ source_type: 'news', verdict: 'contradicts' }])).toBe('breach');
  });
  it('supports rows never drive the kind', () => {
    expect(classifyTrigger([
      { source_type: 'price_move', verdict: 'supports' },
      { source_type: 'news', verdict: 'contradicts' },
    ])).toBe('breach');
  });
});

describe('hasAdviceLanguage', () => {
  it('catches advice verbs', () => {
    expect(hasAdviceLanguage('You should consider selling into strength.')).toBe(true);
    expect(hasAdviceLanguage('It may be time to trim the position.')).toBe(true);
    expect(hasAdviceLanguage('Buy the dip before earnings.')).toBe(true);
  });
  it('allows state-only language', () => {
    expect(hasAdviceLanguage('The government revenue pillar weakened after two contract losses.')).toBe(false);
    expect(hasAdviceLanguage('Margin guidance was withdrawn; the break condition is partially met.')).toBe(false);
  });
  it('does not trip on sell-through or buyback vocabulary', () => {
    expect(hasAdviceLanguage('Management reported stronger sell-through and a larger buyback authorization.')).toBe(false);
  });
});
