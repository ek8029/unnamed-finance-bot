import { describe, it, expect } from 'vitest';
import {
  costUsd, isPriced, usageFromAnthropic, usageFromOpenAI,
  emptyLedger, recordUsage, mergeLedger, describeLedger, MODEL_PRICES, readRunCeilingUsd,
} from '@/lib/ai/pricing';

describe('rate card', () => {
  it('carries the four judge models at the verified 2026-09-05 list prices', () => {
    expect(MODEL_PRICES['claude-sonnet-5']).toEqual({ input: 2.0, output: 10.0, cacheRead: 0.2, cacheWrite: 2.5 });
    expect(MODEL_PRICES['claude-haiku-4-5']).toEqual({ input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 });
    expect(MODEL_PRICES['gpt-4o']).toEqual({ input: 2.5, output: 10.0, cacheRead: 1.25, cacheWrite: 0 });
    expect(MODEL_PRICES['gpt-4o-mini']).toEqual({ input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0 });
  });

  it('prices the measured classifier batch at the number the live test printed', () => {
    // 2026-09-05 live test: 1,569 in / 291 out on claude-haiku-4-5 = $0.00302.
    const c = costUsd('claude-haiku-4-5', { input: 1569, output: 291, cacheRead: 0, cacheWrite: 0 });
    expect(c).toBeCloseTo(0.00302, 5);
  });

  it('charges cache reads at a tenth of input on Anthropic models', () => {
    const uncached = costUsd('claude-sonnet-5', { input: 10_000, output: 0, cacheRead: 0, cacheWrite: 0 });
    const cached = costUsd('claude-sonnet-5', { input: 0, output: 0, cacheRead: 10_000, cacheWrite: 0 });
    expect(cached).toBeCloseTo(uncached / 10, 9);
  });

  it('an unknown model costs zero and is reported as unpriced, never guessed', () => {
    expect(isPriced('gpt-9-preview')).toBe(false);
    expect(costUsd('gpt-9-preview', { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite: 0 })).toBe(0);
    const l = emptyLedger();
    recordUsage(l, 'gpt-9-preview', { input: 5, output: 5, cacheRead: 0, cacheWrite: 0 });
    expect(l.unpriced).toEqual(['gpt-9-preview']);
    expect(describeLedger(l)).toContain('UNPRICED: gpt-9-preview');
  });
});

describe('usage adapters', () => {
  it('reads Anthropic usage with cache fields, tolerating nulls', () => {
    expect(usageFromAnthropic({ input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 900, cache_creation_input_tokens: null }))
      .toEqual({ input: 100, output: 20, cacheRead: 900, cacheWrite: 0 });
    expect(usageFromAnthropic(undefined)).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  });

  it('splits OpenAI cached tokens out of prompt_tokens so they are not double counted', () => {
    const u = usageFromOpenAI({ prompt_tokens: 1000, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 400 } });
    expect(u).toEqual({ input: 600, output: 50, cacheRead: 400, cacheWrite: 0 });
    // 600 at $2.50 + 400 at $1.25 + 50 at $10 per million
    expect(costUsd('gpt-4o', u)).toBeCloseTo((600 * 2.5 + 400 * 1.25 + 50 * 10) / 1e6, 9);
    expect(usageFromOpenAI(null)).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
  });
});

describe('ledger', () => {
  it('accumulates per model and in total, and merges into a parent', () => {
    const job = emptyLedger();
    recordUsage(job, 'claude-sonnet-5', { input: 1000, output: 100, cacheRead: 0, cacheWrite: 0 });
    recordUsage(job, 'gpt-4o-mini', { input: 2000, output: 200, cacheRead: 0, cacheWrite: 0 });
    expect(job.calls).toBe(2);
    expect(job.input).toBe(3000);
    expect(job.byModel['claude-sonnet-5'].calls).toBe(1);
    expect(job.costUsd).toBeCloseTo((1000 * 2 + 100 * 10 + 2000 * 0.15 + 200 * 0.6) / 1e6, 9);

    const run = emptyLedger();
    mergeLedger(run, job);
    mergeLedger(run, job);
    expect(run.calls).toBe(4);
    expect(run.byModel['gpt-4o-mini'].input).toBe(4000);
    expect(run.costUsd).toBeCloseTo(job.costUsd * 2, 9);
    expect(describeLedger(run)).toMatch(/^4 calls · in 6,000 · out 600 · cache 0 · \$0\.00/);
  });
});

describe('readRunCeilingUsd', () => {
  it('defaults to $1 and ignores garbage, zero, and negatives', () => {
    expect(readRunCeilingUsd({})).toBe(1);
    expect(readRunCeilingUsd({ LLM_RUN_USD: 'free' })).toBe(1);
    expect(readRunCeilingUsd({ LLM_RUN_USD: '0' })).toBe(1);
    expect(readRunCeilingUsd({ LLM_RUN_USD: '-2' })).toBe(1);
    expect(readRunCeilingUsd({ LLM_RUN_USD: '0.25' })).toBe(0.25);
  });
});
