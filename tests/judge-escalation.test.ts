// tests/judge-escalation.test.ts
import { describe, it, expect, vi } from 'vitest';
import { needsEscalation, reviewEscalations, type EscalationInput } from '@/lib/judge-escalation';
import type OpenAI from 'openai';

describe('needsEscalation', () => {
  it('material rows escalate regardless of confidence', () => {
    expect(needsEscalation({ materiality: 'material' })).toBe(true);
    expect(needsEscalation({ materiality: 'material', confidence: 'high' })).toBe(true);
  });
  it('low-confidence context rows escalate', () => {
    expect(needsEscalation({ materiality: 'context', confidence: 'low' })).toBe(true);
  });
  it('high-confidence context rows do not', () => {
    expect(needsEscalation({ materiality: 'context', confidence: 'high' })).toBe(false);
    expect(needsEscalation({ materiality: 'context' })).toBe(false);
  });
});

const ROWS: EscalationInput[] = [
  { pillarClaim: 'Margins expand', verdict: 'contradicts', materiality: 'material', excerpt: 'Guidance was withdrawn.', why: 'Direct hit to margin outlook.' },
  { pillarClaim: 'Gov revenue sticky', verdict: 'supports', materiality: 'material', excerpt: 'Contract renewed for 5 years.', why: 'Renewal confirms stickiness.' },
];

function mockOpenAI(content: string | null, shouldThrow = false): OpenAI {
  return {
    chat: {
      completions: {
        create: shouldThrow
          ? vi.fn().mockRejectedValue(new Error('rate limited'))
          : vi.fn().mockResolvedValue({ choices: [{ message: { content } }] }),
      },
    },
  } as unknown as OpenAI;
}

describe('reviewEscalations', () => {
  it('applies keep/downgrade/reject by index', async () => {
    const log: string[] = [];
    const ai = mockOpenAI(JSON.stringify({ reviews: [
      { index: 1, action: 'reject', reason: 'indirect' },
      { index: 2, action: 'downgrade', reason: 'background' },
    ] }));
    const actions = await reviewEscalations(ai, ROWS, log);
    expect(actions).toEqual(['reject', 'downgrade']);
  });
  it('API failure keeps all originals', async () => {
    const log: string[] = [];
    const actions = await reviewEscalations(mockOpenAI(null, true), ROWS, log);
    expect(actions).toEqual(['keep', 'keep']);
    expect(log.some((l) => l.includes('review failed'))).toBe(true);
  });
  it('malformed output keeps originals', async () => {
    const actions = await reviewEscalations(mockOpenAI('{"nope": true}'), ROWS, []);
    expect(actions).toEqual(['keep', 'keep']);
  });
  it('out-of-range or invalid actions are ignored', async () => {
    const ai = mockOpenAI(JSON.stringify({ reviews: [
      { index: 9, action: 'reject' },
      { index: 1, action: 'explode' },
    ] }));
    const actions = await reviewEscalations(ai, ROWS, []);
    expect(actions).toEqual(['keep', 'keep']);
  });
  it('empty input short-circuits without a call', async () => {
    const ai = mockOpenAI(null, true);
    const actions = await reviewEscalations(ai, [], []);
    expect(actions).toEqual([]);
  });
});
