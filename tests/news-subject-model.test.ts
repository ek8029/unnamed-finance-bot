// tests/news-subject-model.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { classifySubjects } from '@/lib/news-subject-model';
import { emptyLedger } from '@/lib/ai/pricing';

const ROWS = [
  { key: 'a', title: 'Apple Reports Record Quarter', summary: null, ticker: 'AAPL', companyName: 'Apple Inc' },
];

describe('classifySubjects fails open', () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => { delete process.env.ANTHROPIC_API_KEY; });
  afterEach(() => { if (saved) process.env.ANTHROPIC_API_KEY = saved; });

  it('returns nothing and says why when the key is missing', async () => {
    const log: string[] = [];
    const out = await classifySubjects(ROWS, log);
    expect(out.size).toBe(0);
    expect(log.some((l) => l.includes('no ANTHROPIC_API_KEY'))).toBe(true);
  });

  it('an empty batch never calls the API', async () => {
    const log: string[] = [];
    const out = await classifySubjects([], log);
    expect(out.size).toBe(0);
    expect(log).toHaveLength(0);
  });
});

describe('classifySubjects stops at the run ceiling', () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key-never-called'; });
  afterEach(() => { if (saved) process.env.ANTHROPIC_API_KEY = saved; else delete process.env.ANTHROPIC_API_KEY; });

  it('makes no call once the ledger is already at the ceiling', async () => {
    const log: string[] = [];
    const ledger = emptyLedger();
    ledger.costUsd = 1; // the LLM_RUN_USD default
    const out = await classifySubjects(ROWS, log, ledger);
    expect(out.size).toBe(0);
    expect(ledger.calls).toBe(0);
    expect(log.some((l) => l.includes('run ceiling'))).toBe(true);
  });
});
