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
  it('applies keep/downgrade/reject by index and marks reviewed', async () => {
    const log: string[] = [];
    const ai = mockOpenAI(JSON.stringify({ reviews: [
      { index: 1, action: 'reject', reason: 'indirect' },
      { index: 2, action: 'downgrade', reason: 'background' },
    ] }));
    const { actions, reviewed } = await reviewEscalations(ai, ROWS, log);
    expect(actions).toEqual(['reject', 'downgrade']);
    expect(reviewed).toBe(true);
  });
  it('API failure keeps all originals and reports not reviewed', async () => {
    const log: string[] = [];
    const { actions, reviewed } = await reviewEscalations(mockOpenAI(null, true), ROWS, log);
    expect(actions).toEqual(['keep', 'keep']);
    expect(reviewed).toBe(false);
    expect(log.some((l) => l.includes('review failed'))).toBe(true);
  });
  it('malformed-but-parseable output keeps originals, still reviewed', async () => {
    const { actions, reviewed } = await reviewEscalations(mockOpenAI('{"nope": true}'), ROWS, []);
    expect(actions).toEqual(['keep', 'keep']);
    expect(reviewed).toBe(true);
  });
  it('non-JSON output reports not reviewed', async () => {
    const { actions, reviewed } = await reviewEscalations(mockOpenAI('not json at all'), ROWS, []);
    expect(actions).toEqual(['keep', 'keep']);
    expect(reviewed).toBe(false);
  });
  it('out-of-range or invalid actions are ignored', async () => {
    const ai = mockOpenAI(JSON.stringify({ reviews: [
      { index: 9, action: 'reject' },
      { index: 1, action: 'explode' },
    ] }));
    const { actions } = await reviewEscalations(ai, ROWS, []);
    expect(actions).toEqual(['keep', 'keep']);
  });
  it('sends the kill criterion and source provenance when present, omits the lines when not', async () => {
    const ai = mockOpenAI(JSON.stringify({ reviews: [] }));
    await reviewEscalations(ai, [
      { ...ROWS[0], breaksIf: 'Gross margin falls below 40% for two quarters', sourceType: 'filing', publishedAt: '2026-08-14' },
      ROWS[1],
    ], []);
    const create = (ai.chat.completions.create as unknown as ReturnType<typeof vi.fn>);
    const sent = create.mock.calls[0][0].messages[1].content as string;
    expect(sent).toContain('Pillar breaks if: Gross margin falls below 40% for two quarters');
    expect(sent).toContain('Source: filing, 2026-08-14');
    // Finding 2 carries neither, so neither label may appear twice.
    expect(sent.match(/Pillar breaks if:/g)).toHaveLength(1);
    expect(sent.match(/^Source:/gm)).toHaveLength(1);
  });
  it('empty input short-circuits without a call', async () => {
    const ai = mockOpenAI(null, true);
    const { actions, reviewed } = await reviewEscalations(ai, [], []);
    expect(actions).toEqual([]);
    expect(reviewed).toBe(true);
  });
});
