import { describe, it, expect } from 'vitest';
import { expandGroupedCitations, extractCitedIds, validateCitations } from '@/lib/research/grounding';
import type { Finding } from '@/lib/research/types';

const F = (id: string): Finding => ({
  id,
  kind: 'catch',
  ticker: 'NVDA',
  summary: 's',
  source: 'x',
});

describe('extractCitedIds', () => {
  it('passes through a string array', () => {
    expect(extractCitedIds(['catch:1', ' inv:2 '])).toEqual(['catch:1', 'inv:2']);
  });
  it('pulls [id] tokens out of prose', () => {
    expect(extractCitedIds('the filing [catch:abc-1] and the memo [inv:def-2] agree')).toEqual([
      'catch:abc-1',
      'inv:def-2',
    ]);
  });
  it('returns [] for junk', () => {
    expect(extractCitedIds(null)).toEqual([]);
    expect(extractCitedIds(42)).toEqual([]);
  });
});

describe('validateCitations', () => {
  const findings = [F('catch:1'), F('inv:2'), F('action:3')];

  it('keeps only cited findings that were retrieved', () => {
    const out = validateCitations(['catch:1', 'action:3'], findings);
    expect(out.map((f) => f.id)).toEqual(['catch:1', 'action:3']);
  });

  it('drops a hallucinated id that was never retrieved', () => {
    const out = validateCitations(['catch:1', 'catch:999'], findings);
    expect(out.map((f) => f.id)).toEqual(['catch:1']);
  });

  it('preserves retrieved order, not citation order', () => {
    const out = validateCitations(['action:3', 'catch:1'], findings);
    expect(out.map((f) => f.id)).toEqual(['catch:1', 'action:3']);
  });

  it('returns [] when nothing valid is cited', () => {
    expect(validateCitations(['nope:1'], findings)).toEqual([]);
  });
});

describe('expandGroupedCitations', () => {
  it('splits a comma-grouped bracket into single-id brackets', () => {
    expect(expandGroupedCitations('Supported [catch:aa, catch:bb].')).toBe('Supported [catch:aa][catch:bb].');
  });

  it('handles three grouped ids and uneven spacing', () => {
    expect(expandGroupedCitations('[action:a,action:b , inv:c]')).toBe('[action:a][action:b][inv:c]');
  });

  it('leaves single citations and plain text alone', () => {
    const text = 'One catch [catch:aa] and prose, with a comma.';
    expect(expandGroupedCitations(text)).toBe(text);
  });
});
