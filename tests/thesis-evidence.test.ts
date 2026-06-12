// tests/thesis-evidence.test.ts
import { describe, it, expect } from 'vitest';
import { excerptFoundInSource } from '@/lib/thesis-evidence';

describe('excerptFoundInSource', () => {
  const source = 'Revenue for the quarter was $39.1 billion, up 112% year over year.  Data Center revenue reached a record.';

  it('accepts exact substring', () => {
    expect(excerptFoundInSource('Revenue for the quarter was $39.1 billion', source)).toBe(true);
  });

  it('accepts excerpt differing only in whitespace runs', () => {
    expect(excerptFoundInSource('year over year. Data Center revenue', source)).toBe(true);
  });

  it('accepts curly-quote vs straight-quote variants', () => {
    expect(excerptFoundInSource('company\u2019s outlook', "the company's outlook improved")).toBe(true);
  });

  it('rejects paraphrase', () => {
    expect(excerptFoundInSource('Revenue roughly doubled to $39.1B', source)).toBe(false);
  });

  it('rejects empty excerpt', () => {
    expect(excerptFoundInSource('', source)).toBe(false);
    expect(excerptFoundInSource('   ', source)).toBe(false);
  });
});
