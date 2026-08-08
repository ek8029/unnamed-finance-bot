import { describe, it, expect } from 'vitest';
import { joinTitleExcerpt } from '@/lib/content/scoring-thesis';

describe('joinTitleExcerpt', () => {
  // The case that shipped: a price-move row writes both fields from the same
  // sentence, and clusterByMechanism labels the cluster with this text.
  it('does not repeat an excerpt the title already contains', () => {
    expect(
      joinTitleExcerpt('Price move: PRIM fell 38.2% on 2026-06-23', 'PRIM fell 38.2% on 2026-06-23'),
    ).toBe('Price move: PRIM fell 38.2% on 2026-06-23');
  });

  it('keeps the longer side when the excerpt contains the title', () => {
    expect(joinTitleExcerpt('Margin compression', 'Margin compression continued into Q3')).toBe(
      'Margin compression continued into Q3',
    );
  });

  it('ignores punctuation and casing when deciding overlap', () => {
    expect(joinTitleExcerpt('Price move — NVDA FELL 12%!', 'nvda fell 12')).toBe('Price move — NVDA FELL 12%!');
  });

  it('joins genuinely different text', () => {
    expect(joinTitleExcerpt('Azure growth slows', 'Revenue rose 21% year over year')).toBe(
      'Azure growth slows Revenue rose 21% year over year',
    );
  });

  it('collapses runs of whitespace', () => {
    expect(joinTitleExcerpt('  Two   words  ', ' and   more ')).toBe('Two words and more');
  });

  it('survives a missing side', () => {
    expect(joinTitleExcerpt(null, 'only an excerpt')).toBe('only an excerpt');
    expect(joinTitleExcerpt('only a title', null)).toBe('only a title');
    expect(joinTitleExcerpt(null, null)).toBe('');
  });

  // normClaim strips everything but alphanumerics, so a purely symbolic side
  // normalises to empty. It carries no information, so the other side wins —
  // a mechanism labelled "***" would be worse than no label at all.
  it('prefers the side that actually says something', () => {
    expect(joinTitleExcerpt('***', 'real text')).toBe('real text');
    expect(joinTitleExcerpt('real text', '---')).toBe('real text');
  });
});
