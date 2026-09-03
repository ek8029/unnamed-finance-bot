// tests/news-subject-model.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { classifySubjects } from '@/lib/news-subject-model';

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
