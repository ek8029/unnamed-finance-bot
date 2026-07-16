// tests/thesis-verdict.test.ts
// Table tests for the pure holding-level verdict + sentence templates.

import { describe, it, expect } from 'vitest';
import { deriveThesisVerdict, verdictSentence, shortClaim, type VerdictPillar } from '@/lib/thesis-verdict';
import type { PillarStatus } from '@/lib/thesis-status';

const counts = (c: Partial<Record<PillarStatus, number>>): Record<PillarStatus, number> => ({
  unverified: 0, intact: 0, weakening: 0, broken: 0, ...c,
});

describe('deriveThesisVerdict', () => {
  const table: [Partial<Record<PillarStatus, number>>, string][] = [
    [{}, 'watching'],
    [{ unverified: 3 }, 'watching'],
    [{ intact: 2 }, 'supported'],
    [{ intact: 2, unverified: 1 }, 'supported'],
    [{ weakening: 1 }, 'challenged'],
    [{ weakening: 2, unverified: 1 }, 'challenged'],
    [{ broken: 1 }, 'challenged'],
    [{ broken: 1, intact: 3 }, 'challenged'], // broken dominates, never "mixed"
    [{ broken: 1, weakening: 1, intact: 1 }, 'challenged'],
    [{ weakening: 1, intact: 1 }, 'mixed'],
    [{ weakening: 2, intact: 3, unverified: 1 }, 'mixed'],
  ];
  it.each(table)('%o -> %s', (c, expected) => {
    expect(deriveThesisVerdict(counts(c))).toBe(expected);
  });
});

describe('shortClaim', () => {
  it('leaves short claims untouched', () => {
    expect(shortClaim('Margins keep expanding')).toBe('Margins keep expanding');
  });
  it('truncates on a word boundary with ellipsis', () => {
    const long = 'Government revenue stays sticky across every major allied procurement cycle through 2030';
    const out = shortClaim(long);
    expect(out.length).toBeLessThanOrEqual(53 + 1);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('  ');
  });
});

const p = (status: PillarStatus, claim = `${status} pillar claim`): VerdictPillar => ({ claim, status });

describe('verdictSentence', () => {
  it('empty pillars -> confirm nudge', () => {
    expect(verdictSentence([])).toBe('No confirmed pillars yet; Helm starts watching once you confirm one.');
  });
  it('all unverified -> watching sentence', () => {
    expect(verdictSentence([p('unverified'), p('unverified')])).toBe(
      'On balance: no evidence has landed yet; Helm is watching for the first filings and news.',
    );
  });
  it('single intact pillar names the claim', () => {
    expect(verdictSentence([p('intact', 'Data-center demand keeps growing')])).toBe(
      'On balance: "Data-center demand keeps growing" is holding.',
    );
  });
  it('multiple intact -> counted, with unverified tail', () => {
    expect(verdictSentence([p('intact'), p('intact'), p('unverified')])).toBe(
      'On balance: all 2 verified pillars are holding; 1 awaiting evidence.',
    );
  });
  it('mixed names the tested claim and the holder', () => {
    expect(
      verdictSentence([p('weakening', 'Margins keep expanding'), p('intact', 'Government revenue stays sticky')]),
    ).toBe('On balance: "Margins keep expanding" is being tested while "Government revenue stays sticky" holds.');
  });
  it('mixed with several intact counts them', () => {
    expect(verdictSentence([p('weakening', 'Margins keep expanding'), p('intact'), p('intact')])).toBe(
      'On balance: "Margins keep expanding" is being tested while 2 pillars hold.',
    );
  });
  it('broken names the claim and surviving pillars', () => {
    expect(verdictSentence([p('broken', 'UK NHS deal expands'), p('intact')])).toBe(
      'On balance: "UK NHS deal expands" has broken; 1 other pillar holding.',
    );
  });
  it('lone weakening pillar', () => {
    expect(verdictSentence([p('weakening', 'Margins keep expanding')])).toBe(
      'On balance: "Margins keep expanding" is being tested.',
    );
  });
  it('never uses em dashes or advice verbs', () => {
    const combos: VerdictPillar[][] = [
      [], [p('unverified')], [p('intact')], [p('weakening')], [p('broken')],
      [p('broken'), p('intact')], [p('weakening'), p('intact')],
    ];
    for (const c of combos) {
      const s = verdictSentence(c);
      expect(s).not.toMatch(/—/);
      expect(s.toLowerCase()).not.toMatch(/\b(sell|buy|trim|add|consider)\b/);
    }
  });
});
